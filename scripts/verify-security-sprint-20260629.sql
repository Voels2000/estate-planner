SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260629%' ORDER BY version;

SELECT routine_name, routine_type FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'assert_household_caller_access';

SELECT policyname, cmd, qual::text LIKE '%attorney_listings%' AS uses_listing_join
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'attorney_clients' ORDER BY policyname;
