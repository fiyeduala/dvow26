CREATE OR REPLACE FUNCTION public.normalize_code(_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT upper(regexp_replace(coalesce(_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

REVOKE ALL ON FUNCTION public.normalize_code(TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.verify_access_code(_code TEXT)
RETURNS TABLE (
  full_name TEXT,
  seats INTEGER,
  table_assignment TEXT,
  attending BOOLEAN,
  meal_choice TEXT,
  plus_one_name TEXT,
  dietary_notes TEXT,
  message TEXT,
  responded_at TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean TEXT := public.normalize_code(_code);
BEGIN
  IF length(_clean) < 4 OR length(_clean) > 32 THEN
    RETURN;
  END IF;

  UPDATE public.guests g
    SET first_opened_at = coalesce(g.first_opened_at, now())
  WHERE public.normalize_code(g.access_code) = _clean;

  RETURN QUERY
  SELECT g.full_name, g.seats, g.table_assignment, g.attending, g.meal_choice,
         g.plus_one_name, g.dietary_notes, g.message, g.responded_at
  FROM public.guests g
  WHERE public.normalize_code(g.access_code) = _clean;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_rsvp(
  _code TEXT,
  _attending BOOLEAN,
  _meal_choice TEXT DEFAULT NULL,
  _plus_one_name TEXT DEFAULT NULL,
  _dietary_notes TEXT DEFAULT NULL,
  _message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean TEXT := public.normalize_code(_code);
  _hit INTEGER;
BEGIN
  IF length(_clean) < 4 OR length(_clean) > 32 THEN
    RETURN false;
  END IF;

  UPDATE public.guests g
     SET attending = _attending,
         meal_choice = nullif(left(coalesce(_meal_choice, ''), 60), ''),
         plus_one_name = nullif(left(coalesce(_plus_one_name, ''), 100), ''),
         dietary_notes = nullif(left(coalesce(_dietary_notes, ''), 300), ''),
         message = nullif(left(coalesce(_message, ''), 500), ''),
         responded_at = now()
   WHERE public.normalize_code(g.access_code) = _clean;

  GET DIAGNOSTICS _hit = ROW_COUNT;
  RETURN _hit > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_access_code(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_rsvp(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;