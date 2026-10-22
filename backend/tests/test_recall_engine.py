"""Comprehensive verification suite for the DairyTrace Smart Recall Engine, Seed Data, and FSSAI Exporter.

Covers all requirements in AGENT_TASK_ASSIGNMENTS.md Section 4:
- Test 1: Flagging `MILK-101` catches `PAN-201`, `PAN-202`, and Retailers A, B, C.
- Test 2: Ensures `PAN-303` (and `MILK-103`) is never falsely flagged.
- Test 3: Ensures co-input `MILK-102` is flagged for quarantine review.
- Multi-parent & diamond DAG traversal deduplication and co-input disambiguation.
- Cycle prevention in forward blast radius, backward lineage, and link validation.
- FSSAI Recall Dossier JSON & Printable HTML verification (including XSS HTML escaping).
"""

import os
import sys
import unittest
from datetime import datetime

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.models import Batch, BatchLink, DistributionRecord
from app.seed_data import seed_tech4food_scenario
from app.services.fssai_export import (
    export_fssai_notice,
    generate_fssai_dossier_json,
    generate_fssai_printable_html,
)
from app.services.recall_engine import (
    compute_blast_radius,
    execute_recall,
    get_batch_lineage,
    would_create_cycle,
)
from tests.conftest import isolated_db_session


def test_flagging_milk_101_catches_pan_201_pan_202_and_retailers_a_b_c(db_session=None):
    """Test 1: Flagging MILK-101 catches PAN-201, PAN-202, and Retailers A, B, C."""
    def _run(session):
        seed_tech4food_scenario(session)
        blast = compute_blast_radius("MILK-101", session)

        assert blast["root_batch"] == "MILK-101"
        assert set(blast["affected_product_batches"]) == {"PAN-201", "PAN-202"}
        assert len(blast["affected_product_batches"]) == 2

        destinations = blast["compromised_retail_destinations"]
        assert len(destinations) == 3

        dest_names = [d.destination_name for d in destinations]
        assert any("Retailer A" in name and "Kothrud" in name for name in dest_names)
        assert any("Retailer B" in name and "Wakad" in name for name in dest_names)
        assert any("Retailer C" in name and "Hinjawadi" in name for name in dest_names)

        total_kg = sum(d.quantity_dispatched for d in destinations)
        assert total_kg == 210.0  # 60kg + 60kg + 90kg

    if db_session is not None:
        _run(db_session)
    else:
        with isolated_db_session() as session:
            _run(session)


def test_control_batch_pan_303_and_milk_103_never_falsely_flagged(db_session=None):
    """Test 2: Ensures PAN-303 and MILK-103 are never falsely flagged when MILK-101 is recalled."""
    def _run(session):
        seed_tech4food_scenario(session)
        blast = compute_blast_radius("MILK-101", session)

        assert "PAN-303" not in blast["affected_product_batches"]
        assert "MILK-103" not in blast["affected_product_batches"]
        assert "PAN-303" not in blast["co_input_batches_for_review"]
        assert "MILK-103" not in blast["co_input_batches_for_review"]

        compromised_batch_ids = {d.batch_id for d in blast["compromised_retail_destinations"]}
        assert "PAN-303" not in compromised_batch_ids
        assert "MILK-103" not in compromised_batch_ids

        # Also verify after executing the recall that PAN-303 and MILK-103 remain ACTIVE
        execute_recall(
            root_batch_id="MILK-101",
            reason="Aflatoxin M1 above FSSAI threshold",
            severity="CRITICAL",
            initiated_by="Saloni Gupta (QA Lead)",
            db_session=session,
        )
        pan_303 = session.query(Batch).filter_by(id="PAN-303").first()
        milk_103 = session.query(Batch).filter_by(id="MILK-103").first()
        assert pan_303.status == "ACTIVE"
        assert milk_103.status == "ACTIVE"

    if db_session is not None:
        _run(db_session)
    else:
        with isolated_db_session() as session:
            _run(session)


def test_co_input_milk_102_flagged_for_quarantine_review(db_session=None):
    """Test 3: Ensures co-input MILK-102 is flagged for quarantine review and marked QUARANTINED on recall."""
    def _run(session):
        seed_tech4food_scenario(session)
        blast = compute_blast_radius("MILK-101", session)

        assert blast["co_input_batches_for_review"] == ["MILK-102"]
        assert "MILK-102" not in blast["affected_product_batches"]

        # Execute recall and confirm MILK-102 transitions to QUARANTINED while MILK-101, PAN-201, PAN-202 become RECALLED
        execute_recall(
            root_batch_id="MILK-101",
            reason="Detected antibiotic residue in Shirur milk tank",
            severity="CRITICAL",
            initiated_by="Vikash Kumar (Compliance Officer)",
            db_session=session,
        )
        milk_101 = session.query(Batch).filter_by(id="MILK-101").first()
        milk_102 = session.query(Batch).filter_by(id="MILK-102").first()
        pan_201 = session.query(Batch).filter_by(id="PAN-201").first()
        pan_202 = session.query(Batch).filter_by(id="PAN-202").first()

        assert milk_101.status == "RECALLED"
        assert pan_201.status == "RECALLED"
        assert pan_202.status == "RECALLED"
        assert milk_102.status == "QUARANTINED"

    if db_session is not None:
        _run(db_session)
    else:
        with isolated_db_session() as session:
            _run(session)


def test_diamond_dag_and_multi_parent_deduplication(db_session=None):
    """Validates that diamond-shaped graphs do not duplicate affected batches or misclassify descendants as co-inputs."""
    def _run(session):
        now = datetime(2026, 10, 22, 8, 0, 0)
        for bid, ptype in [
            ("M-ROOT", "MILK"),
            ("M-SAFE-CO", "MILK"),
            ("CURD-A", "PANEER"),
            ("CURD-B", "PANEER"),
            ("FINAL-PANEER", "PANEER"),
        ]:
            session.add(
                Batch(
                    id=bid,
                    product_type=ptype,
                    initial_quantity=100.0,
                    remaining_quantity=50.0,
                    facility_name="Test Plant",
                    status="ACTIVE",
                    production_date=now,
                )
            )
        session.flush()

        # Diamond: M-ROOT -> CURD-B inserted BEFORE M-ROOT -> CURD-A; CURD-A -> CURD-B;
        # and CURD-A + CURD-B + M-SAFE-CO -> FINAL-PANEER
        links = [
            BatchLink(parent_batch_id="M-ROOT", child_batch_id="CURD-B", quantity_used=40.0, unit="L"),
            BatchLink(parent_batch_id="CURD-A", child_batch_id="CURD-B", quantity_used=10.0, unit="KG"),
            BatchLink(parent_batch_id="M-ROOT", child_batch_id="CURD-A", quantity_used=40.0, unit="L"),
            BatchLink(parent_batch_id="CURD-A", child_batch_id="FINAL-PANEER", quantity_used=20.0, unit="KG"),
            BatchLink(parent_batch_id="CURD-B", child_batch_id="FINAL-PANEER", quantity_used=20.0, unit="KG"),
            BatchLink(parent_batch_id="M-SAFE-CO", child_batch_id="FINAL-PANEER", quantity_used=30.0, unit="L"),
        ]
        session.add_all(links)
        session.commit()

        blast = compute_blast_radius("M-ROOT", session)
        # No duplicate batch IDs in affected_product_batches
        assert len(blast["affected_product_batches"]) == len(set(blast["affected_product_batches"]))
        assert set(blast["affected_product_batches"]) == {"CURD-A", "CURD-B", "FINAL-PANEER"}
        # CURD-A and CURD-B are descendants of M-ROOT, so ONLY M-SAFE-CO should be in co_input_batches_for_review
        assert blast["co_input_batches_for_review"] == ["M-SAFE-CO"]

        # Verify get_batch_lineage also prunes CURD-A from co_inputs despite M-ROOT -> CURD-B being visited first
        lineage = get_batch_lineage("M-ROOT", session)
        assert {b["id"] for b in lineage["downstream"]} == {"CURD-A", "CURD-B", "FINAL-PANEER"}
        assert {b["id"] for b in lineage["co_inputs"]} == {"M-SAFE-CO"}

    if db_session is not None:
        _run(db_session)
    else:
        with isolated_db_session() as session:
            _run(session)


def test_cycle_prevention_in_graph_traversal_and_link_guard(db_session=None):
    """Validates that cyclic BatchLink edges never cause infinite loops in BFS or lineage traversal."""
    def _run(session):
        now = datetime(2026, 10, 22, 9, 0, 0)
        for bid in ["NODE-A", "NODE-B", "NODE-C"]:
            session.add(
                Batch(
                    id=bid,
                    product_type="MILK",
                    initial_quantity=100.0,
                    remaining_quantity=100.0,
                    facility_name="Cycle Test Lab",
                    status="ACTIVE",
                    production_date=now,
                )
            )
        session.flush()

        session.add(BatchLink(parent_batch_id="NODE-A", child_batch_id="NODE-B", quantity_used=10.0, unit="L"))
        session.add(BatchLink(parent_batch_id="NODE-B", child_batch_id="NODE-C", quantity_used=10.0, unit="L"))
        session.commit()

        # Verify cycle guard detects that NODE-C -> NODE-A and NODE-A -> NODE-A would create cycles
        assert would_create_cycle("NODE-C", "NODE-A", session) is True
        assert would_create_cycle("NODE-B", "NODE-A", session) is True
        assert would_create_cycle("NODE-A", "NODE-A", session) is True
        assert would_create_cycle("NODE-A", "NODE-C", session) is False

        # Even if a corrupted legacy DB contains an explicit cycle (NODE-C -> NODE-A),
        # compute_blast_radius and get_batch_lineage must terminate cleanly without infinite recursion
        session.add(BatchLink(parent_batch_id="NODE-C", child_batch_id="NODE-A", quantity_used=10.0, unit="L"))
        session.commit()

        blast = compute_blast_radius("NODE-A", session)
        assert set(blast["affected_product_batches"]) == {"NODE-B", "NODE-C"}
        assert "NODE-A" not in blast["affected_product_batches"]
        assert blast["co_input_batches_for_review"] == []

        lineage = get_batch_lineage("NODE-A", session)
        assert lineage["batch_id"] == "NODE-A"
        assert len(lineage["nodes"]) == 3

    if db_session is not None:
        _run(db_session)
    else:
        with isolated_db_session() as session:
            _run(session)


def test_edge_cases_empty_and_leaf_batches_and_seed_idempotency(db_session=None):
    """Tests leaf batches, invalid inputs, and repeated seed execution idempotency (including sequence reset)."""
    def _run(session):
        # Calling seed twice after recall execution must cleanly wipe and reset RecallEvent ID sequence to 1
        first_seed = seed_tech4food_scenario(session)
        first_recall = execute_recall("MILK-101", "First test recall", "CRITICAL", "QA", session)
        assert first_recall["recall_event"]["id"] == 1

        second_seed = seed_tech4food_scenario(session)
        second_recall = execute_recall("MILK-101", "Second test recall after re-seed", "CRITICAL", "QA", session)
        assert second_recall["recall_event"]["id"] == 1

        # Re-seed for clean state assertions
        seed_tech4food_scenario(session)
        assert first_seed["batches_created"] == 6
        assert second_seed["batches_created"] == 6
        assert session.query(Batch).count() == 6
        assert session.query(BatchLink).count() == 4
        assert session.query(DistributionRecord).count() == 3

        # Leaf finished batch PAN-202 has no child batches, only its own retail distribution (Retailer C)
        leaf_blast = compute_blast_radius("PAN-202", session)
        assert leaf_blast["affected_product_batches"] == []
        assert leaf_blast["co_input_batches_for_review"] == []
        assert len(leaf_blast["compromised_retail_destinations"]) == 1
        assert "Retailer C" in leaf_blast["compromised_retail_destinations"][0].destination_name

        # Empty batch_id must raise ValueError
        try:
            compute_blast_radius("", session)
            raise AssertionError("Expected ValueError for empty root_batch_id")
        except ValueError:
            pass

    if db_session is not None:
        _run(db_session)
    else:
        with isolated_db_session() as session:
            _run(session)


def test_fssai_export_dossier_and_printable_html(db_session=None):
    """Validates that the FSSAI exporter generates complete statutory fields and safe printable HTML."""
    def _run(session):
        seed_tech4food_scenario(session)
        result = execute_recall(
            root_batch_id="MILK-101",
            reason="Aflatoxin M1 contamination (<script>alert(1)</script>)",
            severity="CRITICAL",
            initiated_by="Aditya Kumar (QA Head)",
            db_session=session,
        )
        recall_id = result["recall_event"]["id"]

        exported = export_fssai_notice(recall_id, session)
        assert exported["ref_number"].startswith("FSSAI/FOSCOS/REC/")
        assert exported["brand_name"] == "FoodSync DairyPure"
        assert exported["batch_numbers"]["root_batch_id"] == "MILK-101"
        assert set(exported["batch_numbers"]["recalled_finished_batches"]) == {"PAN-201", "PAN-202"}
        assert exported["batch_numbers"]["quarantined_co_input_batches"] == ["MILK-102"]
        assert exported["distribution_summary"]["total_retail_outlets_affected"] == 3
        assert exported["distribution_summary"]["total_quantity_dispatched_kg"] == 210.0

        html_doc = exported["printable_html"]
        assert "<!DOCTYPE html>" in html_doc
        assert "FSSAI Statutory Food Recall Notice (Form-I)" in html_doc
        assert "PAN-201" in html_doc
        assert "PAN-202" in html_doc
        assert "MILK-102" in html_doc
        assert "Retailer A (Kothrud)" in html_doc
        # Verify XSS HTML escaping works properly
        assert "<script>alert(1)</script>" not in html_doc
        assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html_doc

    if db_session is not None:
        _run(db_session)
    else:
        with isolated_db_session() as session:
            _run(session)


class TestRecallEngineSuite(unittest.TestCase):
    """Unittest wrapper so `python -m unittest` runs all recall engine tests alongside `pytest`."""

    def test_1_flagging_milk_101(self):
        test_flagging_milk_101_catches_pan_201_pan_202_and_retailers_a_b_c()

    def test_2_control_pan_303_not_flagged(self):
        test_control_batch_pan_303_and_milk_103_never_falsely_flagged()

    def test_3_co_input_milk_102_quarantined(self):
        test_co_input_milk_102_flagged_for_quarantine_review()

    def test_4_diamond_dag_deduplication(self):
        test_diamond_dag_and_multi_parent_deduplication()

    def test_5_cycle_prevention(self):
        test_cycle_prevention_in_graph_traversal_and_link_guard()

    def test_6_edge_cases_and_seed_idempotency(self):
        test_edge_cases_empty_and_leaf_batches_and_seed_idempotency()

    def test_7_fssai_export_dossier_and_html(self):
        test_fssai_export_dossier_and_printable_html()


if __name__ == "__main__":
    unittest.main()
