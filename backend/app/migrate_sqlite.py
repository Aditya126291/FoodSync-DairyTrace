"""One-time, verified copy of an existing SQLite deployment into PostgreSQL."""

import argparse
import json
from pathlib import Path
from sqlalchemy import MetaData, Table, create_engine, inspect, text

from app.database import DATABASE_URL

TABLE_ORDER = (
    "users",
    "batches",
    "batch_links",
    "quality_records",
    "distribution_records",
    "recall_events",
    "security_inspections",
    "complaints",
    "audit_log",
)
JSON_COLUMNS = {
    "recall_events": {"affected_batches_json", "affected_destinations_json"},
    "complaints": {"capa_json"},
}
SEQUENCE_TABLES = (
    "users", "batch_links", "quality_records", "distribution_records",
    "recall_events", "security_inspections", "complaints", "audit_log",
)


def migrate(source_path: str) -> None:
    if not DATABASE_URL.startswith("postgresql"):
        raise SystemExit("DATABASE_URL must point to PostgreSQL for this migration.")
    source_file = Path(source_path).expanduser().resolve()
    if not source_file.is_file():
        raise SystemExit(f"SQLite source file does not exist: {source_file}")

    source = create_engine(f"sqlite:///{source_file.as_posix()}")
    target = create_engine(DATABASE_URL, pool_pre_ping=True)
    try:
        target_inspector = inspect(target)
        source_tables = set(source_inspector.get_table_names())
        target_tables = set(target_inspector.get_table_names())
        required = set(TABLE_ORDER)
        if not required.issubset(source_tables):
            raise SystemExit(f"SQLite source is missing tables: {sorted(required - source_tables)}")
        if "alembic_version" not in target_tables:
            raise SystemExit("Run `alembic upgrade head` against PostgreSQL before copying data.")
        with source.connect() as source_connection:
            orphan_complaints = source_connection.execute(text(
                "SELECT count(*) FROM complaints c LEFT JOIN batches b ON b.id = c.batch_id WHERE b.id IS NULL"
            )).scalar_one()
        if orphan_complaints:
            raise SystemExit(f"SQLite source has {orphan_complaints} complaints referencing missing batches; repair those rows first.")
        target_rows = {name: Table(name, MetaData(), autoload_with=target) for name in TABLE_ORDER}

        with target.connect() as connection:
            counts = {table: connection.execute(text(f'SELECT count(*) FROM "{table}"')).scalar_one() for table in TABLE_ORDER}
        if any(counts.values()):
            raise SystemExit("Target PostgreSQL tables are not empty; refusing to merge or overwrite data.")

        row_counts = {}
        with source.connect() as source_connection, target.begin() as target_connection:
            for table in TABLE_ORDER:
                rows = source_connection.execute(text(f'SELECT * FROM "{table}"')).mappings().all()
                row_counts[table] = len(rows)
                if not rows:
                    continue
                converted = []
                for source_row in rows:
                    row = dict(source_row)
                    for column in JSON_COLUMNS.get(table, set()):
                        value = row.get(column)
                        if isinstance(value, str):
                            row[column] = json.loads(value)
                    converted.append(row)
                target_connection.execute(target_rows[table].insert(), converted)

            for table in TABLE_ORDER:
                copied = target_connection.execute(text(f'SELECT count(*) FROM "{table}"')).scalar_one()
                if copied != row_counts[table]:
                    raise RuntimeError(f"Row count mismatch for {table}: source={row_counts[table]}, target={copied}")

            for table in SEQUENCE_TABLES:
                target_connection.execute(
                    text(f"SELECT setval(pg_get_serial_sequence(:table_name, 'id'), COALESCE((SELECT MAX(id) FROM \"{table}\"), 1), (SELECT MAX(id) IS NOT NULL FROM \"{table}\"))"),
                    {"table_name": f"{table}.id"},
                )

        print("SQLite data copied and verified.")
        for table, count in row_counts.items():
            print(f"{table}: {count}")
        print("Keep the SQLite file unchanged until production cutover is verified.")
    finally:
        source.dispose()
        target.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Path to the SQLite .db file")
    args = parser.parse_args()
    migrate(args.source)
