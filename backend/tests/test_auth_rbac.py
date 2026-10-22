"""Authentication & role-based access control tests."""

import datetime

import jwt
import pytest

from app import security
from app.models import User
from tests.conftest import isolated_test_client

BATCH_BODY = {"product_type": "MILK", "initial_quantity": 100, "facility_name": "Test Facility"}

# (method, path, json_body, minimum_role) -- minimum_role: "staff" or "qa"
PROTECTED = [
    ("GET", "/api/batches", None, "staff"),
    ("GET", "/api/batches/lookup?q=MILK", None, "staff"),
    ("GET", "/api/batches/MILK-101", None, "staff"),
    ("GET", "/api/batches/MILK-101/lineage", None, "staff"),
    ("GET", "/api/quality/MILK-101", None, "staff"),
    ("GET", "/api/distribution", None, "staff"),
    ("GET", "/api/inspections", None, "staff"),
    ("GET", "/api/recall/history", None, "staff"),
    ("POST", "/api/recall/simulate", {"batch_id": "MILK-101"}, "staff"),
    ("GET", "/api/complaints", None, "staff"),
    ("GET", "/api/complaints/1", None, "staff"),
    ("PATCH", "/api/complaints/1/status", {"status": "Under review"}, "staff"),
    ("POST", "/api/batches", BATCH_BODY, "qa"),
    ("POST", "/api/batches/link", {}, "qa"),
    ("POST", "/api/distribution", {}, "qa"),
    ("POST", "/api/quality", {}, "qa"),
    ("POST", "/api/recall/execute", {"batch_id": "MILK-101", "reason": "test"}, "qa"),
    ("GET", "/api/recall/1/export-fssai", None, "qa"),
    ("DELETE", "/api/complaints/1", None, "qa"),
]

PUBLIC = [
    "/api/health",
    "/api/public/passport/PAN-201",
    "/api/batches/PAN-201/qr?format=json",
    "/api/complaints/context/PAN-201",
]


@pytest.mark.parametrize("method,path,body,level", PROTECTED)
def test_anonymous_requests_are_rejected(method, path, body, level):
    with isolated_test_client(role=None) as (c, _):
        c.reseed()
        res = c.request(method, path, json=body)
        assert res.status_code == 401, f"{method} {path} -> {res.status_code}"


@pytest.mark.parametrize("method,path,body,level", PROTECTED)
def test_inspector_can_only_use_staff_endpoints(method, path, body, level):
    with isolated_test_client(role="INSPECTOR") as (c, _):
        c.reseed()
        res = c.request(method, path, json=body)
        if level == "qa":
            assert res.status_code == 403, f"{method} {path} -> {res.status_code}"
        else:
            assert res.status_code not in (401, 403), f"{method} {path} -> {res.status_code}"


@pytest.mark.parametrize("method,path,body,level", PROTECTED)
def test_qa_officer_is_authorised_everywhere(method, path, body, level):
    with isolated_test_client(role="QA_OFFICER") as (c, _):
        c.reseed()
        res = c.request(method, path, json=body)
        assert res.status_code not in (401, 403), f"{method} {path} -> {res.status_code}"


def test_public_endpoints_need_no_login():
    with isolated_test_client(role=None) as (c, _):
        c.reseed()
        for path in PUBLIC:
            assert c.get(path).status_code == 200, path


def test_seed_endpoint_is_not_exposed_over_http():
    with isolated_test_client(role="QA_OFFICER") as (c, _):
        assert c.post("/api/seed/tech4food").status_code in (404, 405)


def test_login_success_returns_role_and_me_endpoint_works():
    with isolated_test_client(role=None) as (c, _):
        res = c.post("/api/auth/login", json={"email": "Inspector@DairyTrace.demo", "password": "Inspect@2026"})
        assert res.status_code == 200
        body = res.json()
        assert body["user"]["role"] == "INSPECTOR"
        assert "password_hash" not in body["user"]
        me = c.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
        assert me.status_code == 200 and me.json()["email"] == "inspector@dairytrace.demo"


def test_login_failures_are_generic_and_lock_after_five_attempts():
    with isolated_test_client(role=None) as (c, _):
        unknown = c.post("/api/auth/login", json={"email": "nobody@x.io", "password": "whatever"})
        wrong = c.post("/api/auth/login", json={"email": "qa@dairytrace.demo", "password": "wrong"})
        assert unknown.status_code == wrong.status_code == 401
        assert unknown.json()["detail"] == wrong.json()["detail"]  # no user enumeration
        for _ in range(4):
            c.post("/api/auth/login", json={"email": "qa@dairytrace.demo", "password": "wrong"})
        locked = c.post("/api/auth/login", json={"email": "qa@dairytrace.demo", "password": "QaOfficer@2026"})
        assert locked.status_code == 429


def test_forged_expired_and_tampered_tokens_are_rejected():
    with isolated_test_client(role=None) as (c, s):
        inspector = s.query(User).filter_by(role="INSPECTOR").one()
        now = datetime.datetime.now(datetime.timezone.utc)

        def token(secret=security.JWT_SECRET, exp=now + datetime.timedelta(minutes=5), role="QA_OFFICER"):
            return jwt.encode({"sub": str(inspector.id), "role": role, "exp": int(exp.timestamp())}, secret, algorithm="HS256")

        def hit(t):
            return c.get("/api/batches", headers={"Authorization": f"Bearer {t}"}).status_code

        assert hit(token(secret="attacker-secret")) == 401  # forged signature
        assert hit(token(exp=now - datetime.timedelta(minutes=1))) == 401  # expired
        assert hit("not.a.jwt") == 401
        # A token that *claims* QA_OFFICER for an inspector account must not grant QA rights (DB role wins).
        forged_role = token(role="QA_OFFICER")
        assert hit(forged_role) == 200
        res = c.post("/api/batches", json=BATCH_BODY, headers={"Authorization": f"Bearer {forged_role}"})
        assert res.status_code == 403


def test_deactivated_user_token_stops_working():
    with isolated_test_client(role="INSPECTOR") as (c, s):
        assert c.get("/api/batches").status_code == 200
        user = s.query(User).filter_by(role="INSPECTOR").one()
        user.is_active = False
        s.commit()
        assert c.get("/api/batches").status_code == 401


def test_recall_initiator_comes_from_token_not_request_body():
    with isolated_test_client(role="QA_OFFICER") as (c, s):
        c.reseed()
        res = c.post("/api/recall/execute", json={"batch_id": "MILK-101", "reason": "Aflatoxin", "initiated_by": "Mallory"})
        assert res.status_code == 200
        history = c.get("/api/recall/history").json()
        assert "Mallory" not in history[0]["initiated_by"]
        assert "QA_OFFICER" in history[0]["initiated_by"]
        from app.models import AuditLog

        assert s.query(AuditLog).filter_by(action="RECALL_EXECUTED").count() == 1


def test_password_hashing_is_not_plaintext():
    with isolated_test_client(role=None) as (_, s):
        user = s.query(User).first()
        assert user.password_hash.startswith("$2") and "Inspect@2026" not in user.password_hash
