-- Deactivate legacy asset and expense type options (app filters by is_active).
UPDATE asset_types
SET is_active = false
WHERE value IN ('primary_residence', 'secondary_residence', 'business', 'real_estate');

UPDATE expense_types
SET is_active = false
WHERE value = 'mortgage';
