# PostgreSQL deployment

The application uses SQLite by default for local development and tests. Production must set `APP_ENV=production` and a managed PostgreSQL `DATABASE_URL`; production refuses to start on SQLite. Use a dedicated database and application role, keep credentials in the hosting provider's secret store, and allow encrypted connections (`sslmode=require` by default, or `verify-full` when the provider supplies a verifiable CA chain).

## First deployment

1. Provision a managed PostgreSQL database and a least-privilege application user. Keep automated backups and point-in-time recovery enabled where the provider supports them.
2. Configure `APP_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, and the production `CORS_ORIGINS` in the backend service environment. Set `DB_POOL_SIZE` and `DB_MAX_OVERFLOW` so their combined maximum is below the provider's connection limit across all application replicas.
3. Install backend dependencies from `backend/requirements.txt`.
4. Run schema migrations as a one-off release step from the `backend` directory: `alembic upgrade head`.
5. Deploy/restart the API service after the migration succeeds. Application startup does not create or mutate PostgreSQL schema.
6. Provision staff with the management CLI. Run demo seeding only in a non-production environment.

## Existing SQLite database cutover

1. Back up `backend/dairytrace.db` and stop writes to the old application.
2. Provision PostgreSQL and configure `APP_ENV=production` and `DATABASE_URL`.
3. From `backend`, run `alembic upgrade head`, then `python -m app.migrate_sqlite --source ./dairytrace.db`.
4. The copy command refuses a non-PostgreSQL target, a non-empty target, missing source tables, or complaints whose batch is missing. It copies all records transactionally, converts legacy JSON text to JSON values, preserves primary keys, verifies per-table row counts, and advances PostgreSQL identity sequences.
5. Verify staff login, batch passports, lineage, complaints, inspections, recalls, and FSSAI exports against the new service. Retain the original SQLite backup unchanged until the cutover is accepted.

The data-copy command does not delete, mutate, or automatically switch the SQLite source. To roll back, point the service back at the untouched SQLite file and restore the prior application configuration. Back up PostgreSQL before each schema release; review Alembic downgrade scripts before using them because dropping tables is destructive.

## Schema changes

Create and review Alembic revisions in `backend/migrations/versions`, then run `alembic upgrade head` as a release step. Do not use `Base.metadata.create_all()` or demo seed/reset commands to manage production schema or production data.
