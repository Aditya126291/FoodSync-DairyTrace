"""Admin CLI. Staff accounts can only be created here -- there is no self-signup.

Usage (from backend/):
    python -m app.manage create-user --email a@b.c --name "Full Name" --role INSPECTOR [--org "Org"]
    python -m app.manage list-users
    python -m app.manage reset-password --email a@b.c
    python -m app.manage deactivate-user --email a@b.c
    python -m app.manage seed            # demo users + Tech4Food sample genealogy (wipes batches!)
"""

from __future__ import annotations

import argparse
import getpass
import sys

from app.database import SessionLocal, init_db
from app.models import User
from app.security import STAFF_ROLES, hash_password


def _password(args: argparse.Namespace) -> str:
    if getattr(args, "password", None):
        return args.password
    first = getpass.getpass("Password (min 10 chars): ")
    if first != getpass.getpass("Repeat password: "):
        sys.exit("Passwords do not match.")
    return first


def _check_strength(password: str) -> None:
    if len(password) < 10:
        sys.exit("Password must be at least 10 characters.")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="DairyTrace admin CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    create = sub.add_parser("create-user")
    create.add_argument("--email", required=True)
    create.add_argument("--name", required=True)
    create.add_argument("--role", required=True, choices=STAFF_ROLES)
    create.add_argument("--org", default=None)
    create.add_argument("--password", default=None, help="Omit to be prompted securely")

    sub.add_parser("list-users")
    for name in ("reset-password", "deactivate-user"):
        cmd = sub.add_parser(name)
        cmd.add_argument("--email", required=True)
        if name == "reset-password":
            cmd.add_argument("--password", default=None)
    sub.add_parser("seed")

    args = parser.parse_args(argv)
    init_db()
    db = SessionLocal()
    try:
        if args.cmd == "create-user":
            email = args.email.strip().lower()
            if db.query(User).filter_by(email=email).first():
                sys.exit(f"User {email} already exists.")
            password = _password(args)
            _check_strength(password)
            db.add(User(email=email, full_name=args.name, organisation=args.org, role=args.role,
                        password_hash=hash_password(password)))
            db.commit()
            print(f"Created {args.role} {email}")
        elif args.cmd == "list-users":
            for u in db.query(User).order_by(User.id):
                print(f"{u.id:>3}  {u.email:<34} {u.role:<11} {'active' if u.is_active else 'DISABLED'}  {u.full_name}")
        elif args.cmd in ("reset-password", "deactivate-user"):
            user = db.query(User).filter_by(email=args.email.strip().lower()).first()
            if not user:
                sys.exit("No such user.")
            if args.cmd == "reset-password":
                password = _password(args)
                _check_strength(password)
                user.password_hash = hash_password(password)
                user.failed_logins, user.locked_until = 0, None
            else:
                user.is_active = False
            db.commit()
            print("Done.")
        elif args.cmd == "seed":
            from app.seed_data import seed_demo_users, seed_tech4food_scenario

            for email in seed_demo_users(db):
                print(f"Created demo user {email}")
            summary = seed_tech4food_scenario(db)
            print(f"Seeded {summary['batches_created']} batches, {summary['complaints_created']} complaints.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
