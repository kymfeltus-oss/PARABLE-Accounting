# Parable Accounting Database Workspace

This directory contains the Supabase database configuration and, in future phases, version-controlled PostgreSQL migrations for Parable Accounting.

## Migration Rules

1. All database schema changes must be implemented through version-controlled migrations.
2. Production schema changes must never be made manually without a corresponding migration.
3. Each migration should address one clearly defined database change or tightly related set of changes.
4. Migrations must include appropriate constraints, foreign keys, indexes, and timestamps where required.
5. Financial records must preserve accounting and audit integrity.
6. Row Level Security policies will be introduced deliberately and tested before production data access is enabled.
7. Service-role credentials must never be exposed to browser code.
8. Development seed data must be clearly separated from production data.
9. Authentication remains deferred until the approved authentication phase.
10. No migration may be pushed to a remote Supabase project without explicit approval.

## Current Phase

Phase 2 - Data Foundation

The Supabase migration workspace is initialized, but no Parable Accounting database schema has been created yet.
