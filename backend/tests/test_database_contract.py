import pytest
from sqlalchemy import create_engine, delete, event, inspect, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.dialects import postgresql

from app.database import Base
from app.models import Batch, BatchLink


def make_sqlite_engine():
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, connection_record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    return engine


def test_schema_uses_precise_amounts_and_traceability_constraints():
    engine = make_sqlite_engine()
    inspector = inspect(engine)

    amount_type = inspector.get_columns("batches")[2]["type"]
    assert str(amount_type).startswith("NUMERIC")
    assert {key["constrained_columns"][0] for key in inspector.get_foreign_keys("complaints")} >= {"batch_id"}

    assert "NUMERIC(14, 4)" in str(Batch.__table__.c.initial_quantity.type.compile(dialect=postgresql.dialect()))
    parent_fk = next(iter(BatchLink.__table__.c.parent_batch_id.foreign_keys))
    assert parent_fk.ondelete == "RESTRICT"
    assert "uq_batch_links_parent_child" in {constraint.name for constraint in BatchLink.__table__.constraints}
    engine.dispose()


def test_database_rejects_duplicate_lineage_and_batch_deletion():
    engine = make_sqlite_engine()
    with Session(engine) as session:
        milk = Batch(id="MILK-TEST", product_type="MILK", initial_quantity=10, remaining_quantity=10, facility_name="Test")
        paneer = Batch(id="PAN-TEST", product_type="PANEER", initial_quantity=2, remaining_quantity=2, facility_name="Test")
        session.add_all([milk, paneer])
        session.commit()
        session.add(BatchLink(parent_batch_id=milk.id, child_batch_id=paneer.id, quantity_used=1, unit="L"))
        session.commit()

        session.add(BatchLink(parent_batch_id=milk.id, child_batch_id=paneer.id, quantity_used=1, unit="L"))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

        with pytest.raises(IntegrityError):
            session.execute(delete(Batch).where(Batch.id == milk.id))
            session.commit()
        session.rollback()
    engine.dispose()


def test_atomic_stock_update_rejects_overdraw():
    engine = make_sqlite_engine()
    with Session(engine) as session:
        session.add(Batch(id="MILK-STOCK", product_type="MILK", initial_quantity=5, remaining_quantity=5, facility_name="Test"))
        session.commit()

        result = session.execute(
            update(Batch)
            .where(Batch.id == "MILK-STOCK", Batch.remaining_quantity >= 6)
            .values(remaining_quantity=Batch.remaining_quantity - 6)
        )
        assert result.rowcount == 0
        assert session.get(Batch, "MILK-STOCK").remaining_quantity == 5
    engine.dispose()
