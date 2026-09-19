-- PIXIU Tech — Supabase Data API lockdown for the current Django architecture
-- IMPORTANT: REVIEW BEFORE RUNNING IN PRODUCTION.
-- The portal authenticates through Django JWT and connects to PostgreSQL directly;
-- it does NOT currently use Supabase Auth / auth.uid(). Therefore do not create
-- auth.uid() user policies until the authentication architecture is deliberately changed.
--
-- This script is intentionally NOT executed by the app or deployment.
-- It disables direct table access for Supabase API roles and enables RLS as
-- defense-in-depth while leaving the server-side database connection available.

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'alter table %I.%I enable row level security',
      r.schemaname,
      r.tablename
    );
  end loop;
end $$;

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke all privileges on all functions in schema public from anon, authenticated;

-- Optional schema-level backstop: prevent Supabase API roles from resolving
-- public-schema objects directly. Enable only after confirming no browser/API
-- feature needs direct access to public-schema objects.
-- revoke usage on schema public from anon, authenticated;

-- There are intentionally NO permissive user policies here.
-- If a future browser client uses Supabase Auth, add table-specific policies
-- based on auth.uid() / auth.jwt() and grant only the required operations.
