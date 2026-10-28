"""Initial production schema for DairyTrace."""

from alembic import op
import sqlalchemy as sa

revision = "0001_production_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(160), nullable=False, unique=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("organisation", sa.String(120)),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("password_hash", sa.String(120), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("failed_logins", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_login_at", sa.DateTime()),
        sa.CheckConstraint("role IN ('INSPECTOR', 'QA_OFFICER')", name="ck_users_role"),
    )
    op.create_table(
        "batches",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("product_type", sa.String(20), nullable=False),
        sa.Column("initial_quantity", sa.Numeric(14, 4), nullable=False),
        sa.Column("remaining_quantity", sa.Numeric(14, 4), nullable=False),
        sa.Column("facility_name", sa.String(120), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("production_date", sa.DateTime(), nullable=False),
        sa.Column("expiry_date", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("sku", sa.String(80)),
        sa.Column("serial_number", sa.String(120)),
        sa.CheckConstraint("product_type IN ('MILK', 'PANEER')", name="ck_batches_product_type"),
        sa.CheckConstraint("status IN ('ACTIVE', 'QUARANTINED', 'RECALLED')", name="ck_batches_status"),
        sa.CheckConstraint("initial_quantity > 0", name="ck_batches_initial_quantity_positive"),
        sa.CheckConstraint("remaining_quantity >= 0 AND remaining_quantity <= initial_quantity", name="ck_batches_remaining_quantity_range"),
    )
    op.create_table(
        "batch_links",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("parent_batch_id", sa.String(64), sa.ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("child_batch_id", sa.String(64), sa.ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("quantity_used", sa.Numeric(14, 4), nullable=False),
        sa.Column("unit", sa.String(10), nullable=False, server_default="L"),
        sa.Column("linked_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("parent_batch_id", "child_batch_id", name="uq_batch_links_parent_child"),
        sa.CheckConstraint("parent_batch_id <> child_batch_id", name="ck_batch_links_no_self_link"),
        sa.CheckConstraint("quantity_used > 0", name="ck_batch_links_quantity_positive"),
        sa.CheckConstraint("unit IN ('L', 'KG')", name="ck_batch_links_unit"),
    )
    op.create_table(
        "quality_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("batch_id", sa.String(64), sa.ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("test_date", sa.DateTime(), nullable=False),
        sa.Column("lab_name", sa.String(120), nullable=False),
        sa.Column("fat_percentage", sa.Numeric(7, 3), nullable=False),
        sa.Column("snf_percentage", sa.Numeric(7, 3), nullable=False),
        sa.Column("acidity", sa.Numeric(7, 4), nullable=False),
        sa.Column("adulterant_test", sa.String(20), nullable=False, server_default="NEGATIVE"),
        sa.Column("contaminant_details", sa.Text()),
        sa.Column("trust_level", sa.String(30), nullable=False),
        sa.Column("certificate_url", sa.String(255)),
        sa.CheckConstraint("fat_percentage BETWEEN 0 AND 100", name="ck_quality_fat_range"),
        sa.CheckConstraint("snf_percentage BETWEEN 0 AND 100", name="ck_quality_snf_range"),
        sa.CheckConstraint("acidity BETWEEN 0 AND 10", name="ck_quality_acidity_range"),
        sa.CheckConstraint("adulterant_test IN ('NEGATIVE', 'POSITIVE', 'SUSPECTED', 'NOT_TESTED')", name="ck_quality_adulterant_test"),
        sa.CheckConstraint("trust_level IN ('SUPPLIER_ENTERED', 'DOCUMENT_CHECKED', 'VERIFIED')", name="ck_quality_trust_level"),
    )
    op.create_table(
        "distribution_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("batch_id", sa.String(64), sa.ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("destination_name", sa.String(120), nullable=False),
        sa.Column("destination_type", sa.String(20), nullable=False, server_default="RETAILER"),
        sa.Column("location", sa.String(120), nullable=False),
        sa.Column("quantity_dispatched", sa.Numeric(14, 4), nullable=False),
        sa.Column("contact_phone", sa.String(20), nullable=False),
        sa.Column("dispatched_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("quantity_dispatched > 0", name="ck_distribution_quantity_positive"),
        sa.CheckConstraint("destination_type IN ('RETAILER', 'DISTRIBUTOR')", name="ck_distribution_destination_type"),
    )
    op.create_table(
        "recall_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("root_batch_id", sa.String(64), sa.ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="CRITICAL"),
        sa.Column("initiated_by", sa.String(80), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("affected_batches_json", sa.JSON(), nullable=False),
        sa.Column("affected_destinations_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("severity IN ('CRITICAL', 'MAJOR', 'PRECAUTIONARY')", name="ck_recall_severity"),
        sa.CheckConstraint("status IN ('ACTIVE', 'CONTAINED', 'CLOSED')", name="ck_recall_status"),
    )
    op.create_table(
        "security_inspections",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("batch_id", sa.String(64), sa.ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("tamper_seal_condition", sa.String(24), nullable=False),
        sa.Column("seal_serial_number", sa.String(100)),
        sa.Column("packaging_status", sa.String(24), nullable=False),
        sa.Column("expected_quantity", sa.Numeric(14, 4), nullable=False),
        sa.Column("actual_quantity", sa.Numeric(14, 4), nullable=False),
        sa.Column("temperature_c", sa.Numeric(7, 2), nullable=False),
        sa.Column("humidity_percent", sa.Numeric(7, 2), nullable=False),
        sa.Column("cold_chain_compliant", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("verdict", sa.String(32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("inspector_name", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("evidence_filename", sa.String(255)),
        sa.Column("evidence_mime_type", sa.String(80)),
        sa.Column("evidence_sha256", sa.String(64)),
        sa.Column("record_sha256", sa.String(64), nullable=False),
        sa.CheckConstraint("expected_quantity >= 0 AND actual_quantity >= 0", name="ck_inspection_quantities_nonnegative"),
        sa.CheckConstraint("temperature_c BETWEEN -50 AND 100", name="ck_inspection_temperature_range"),
        sa.CheckConstraint("humidity_percent BETWEEN 0 AND 100", name="ck_inspection_humidity_range"),
    )
    op.create_table(
        "complaints",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("complaint_number", sa.String(50), nullable=False, unique=True),
        sa.Column("batch_id", sa.String(64), sa.ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("customer_name", sa.String(255), server_default=""),
        sa.Column("complaint_source", sa.String(255), server_default=""),
        sa.Column("product_name", sa.String(255), server_default=""),
        sa.Column("strength_grade", sa.String(100), server_default=""),
        sa.Column("batch_lot_number", sa.String(100), server_default=""),
        sa.Column("manufacturing_date", sa.String(100), server_default=""),
        sa.Column("expiry_date", sa.String(100), server_default=""),
        sa.Column("affected_quantity", sa.String(100), server_default=""),
        sa.Column("originating_site", sa.String(255), server_default=""),
        sa.Column("impacted_material", sa.String(255), server_default=""),
        sa.Column("complaint_type", sa.String(100), server_default=""),
        sa.Column("complaint_date", sa.String(100), server_default=""),
        sa.Column("defect_summary", sa.Text(), server_default=""),
        sa.Column("detailed_description", sa.Text(), server_default=""),
        sa.Column("severity", sa.String(50), server_default=""),
        sa.Column("priority", sa.String(50), server_default=""),
        sa.Column("risk_assessment", sa.Text(), server_default=""),
        sa.Column("root_cause", sa.Text(), server_default=""),
        sa.Column("capa_json", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="Committed"),
        sa.Column("reporter_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("status IN ('Committed', 'Under review', 'Investigation opened', 'Recall triggered', 'Resolved')", name="ck_complaints_status"),
        sqlite_autoincrement=True,
    )
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("actor_label", sa.String(160), nullable=False, server_default="public"),
        sa.Column("action", sa.String(60), nullable=False),
        sa.Column("entity", sa.String(60), nullable=False),
        sa.Column("entity_id", sa.String(80)),
        sa.Column("detail", sa.String(1000)),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    for table, column in (
        ("users", "email"), ("batches", "product_type"), ("batches", "status"),
        ("batches", "sku"), ("batches", "serial_number"),
        ("batch_links", "parent_batch_id"), ("batch_links", "child_batch_id"),
        ("quality_records", "batch_id"), ("distribution_records", "batch_id"),
        ("recall_events", "root_batch_id"), ("security_inspections", "batch_id"),
        ("complaints", "complaint_number"), ("complaints", "batch_id"),
        ("complaints", "severity"), ("complaints", "status"),
        ("audit_log", "actor_id"), ("audit_log", "action"),
    ):
        op.create_index(f"ix_{table}_{column}", table, [column], unique=False)
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])
    op.create_index("ix_complaints_batch_status_created", "complaints", ["batch_id", "status", "created_at"])


def downgrade():
    for table in ("audit_log", "complaints", "security_inspections", "recall_events", "distribution_records", "quality_records", "batch_links", "batches", "users"):
        op.drop_table(table)
