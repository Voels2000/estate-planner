# Live `calculate_estate_composition` source

Production function **does not match** `20260424000000_fix_estate_composition_rpc.sql` in git.

Verified via live RPC (May 2026): return keys include `exemption_used`, `estimated_tax_federal`, `liabilities`, `dloc_dlom_discount`, `source_role` — and signature is `(uuid, text)` only.

## Before applying lifetime-gifts migration

1. In Supabase SQL editor, run:

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'calculate_estate_composition'
ORDER BY oid;
```

2. Paste the **full** result into `live_calculate_estate_composition.sql` in this folder (replace file contents when prod changes).

3. Generate the migration:

```bash
node scripts/build-estate-composition-lifetime-gifts-migration.mjs
```

4. Review `../20260516140000_calculate_estate_composition_add_lifetime_gifts.sql` — confirm the single new line after the `v_exemption` null guard and `lifetime_gifts_used` in the return object.

5. Apply with `supabase db push` (or your usual migration path).
