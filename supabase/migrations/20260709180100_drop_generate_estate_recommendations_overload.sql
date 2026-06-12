-- PostgREST cannot disambiguate overloaded generate_estate_recommendations(uuid)
-- vs generate_estate_recommendations(uuid, jsonb). Keep only the two-arg form
-- (p_composition defaults to NULL).

DROP FUNCTION IF EXISTS public.generate_estate_recommendations(uuid);
