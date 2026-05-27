SELECT
  t.table_name,
  BOOL_OR(g.grantee = 'authenticated') AS has_auth_grant,
  BOOL_OR(g.grantee = 'service_role')  AS has_svc_grant,
  BOOL_OR(g.grantee = 'anon')          AS has_anon_grant,
  c.relrowsecurity                      AS rls_enabled
FROM information_schema.tables t
LEFT JOIN information_schema.role_table_grants g
  ON g.table_name = t.table_name
  AND g.table_schema = 'public'
LEFT JOIN pg_class c
  ON c.relname = t.table_name
  AND c.relnamespace = 'public'::regnamespace
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name, c.relrowsecurity
ORDER BY
  CASE WHEN NOT BOOL_OR(g.grantee = 'authenticated') THEN 0 ELSE 1 END,
  t.table_name;
