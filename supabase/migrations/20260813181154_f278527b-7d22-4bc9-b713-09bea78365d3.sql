CREATE TABLE public.guests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  seats INTEGER NOT NULL DEFAULT 1,
  table_assignment TEXT,
  attending BOOLEAN,
  meal_choice TEXT,
  plus_one_name TEXT,
  dietary_notes TEXT,
  message TEXT,
  responded_at TIMESTAMPTZ,
  first_opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.guests TO service_role;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

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
  _clean TEXT := upper(regexp_replace(coalesce(_code, ''), '[^A-Za-z0-9]', '', 'g'));
BEGIN
  IF length(_clean) < 4 OR length(_clean) > 32 THEN
    RETURN;
  END IF;

  UPDATE public.guests g
    SET first_opened_at = coalesce(g.first_opened_at, now())
  WHERE upper(g.access_code) = _clean;

  RETURN QUERY
  SELECT g.full_name, g.seats, g.table_assignment, g.attending, g.meal_choice,
         g.plus_one_name, g.dietary_notes, g.message, g.responded_at
  FROM public.guests g
  WHERE upper(g.access_code) = _clean;
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
  _clean TEXT := upper(regexp_replace(coalesce(_code, ''), '[^A-Za-z0-9]', '', 'g'));
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
   WHERE upper(g.access_code) = _clean;

  GET DIAGNOSTICS _hit = ROW_COUNT;
  RETURN _hit > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_access_code(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_rsvp(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_access_code(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_rsvp(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

INSERT INTO public.guests (full_name, access_code, seats, table_assignment) VALUES
  ('Adaeze Okonkwo', 'LILAC-4821', 2, 'Table 1'),
  ('Tunde Balogun', 'GOLD-7315', 1, 'Table 2'),
  ('Chiamaka Eze', 'ORCHID-9042', 2, 'Table 2'),
  ('Ibrahim Suleiman', 'AMBER-5567', 1, 'Table 3'),
  ('Ngozi Nwachukwu', 'VELVET-2290', 4, 'Table 1'),
  ('Damilola Ajayi', 'ROYAL-8134', 2, 'Table 4'),
  ('Fatima Bello', 'PLUM-6608', 1, 'Table 5'),
  ('Emeka Obi', 'AURUM-3471', 2, 'Table 3'),
  ('Zainab Yusuf', 'IRIS-1958', 1, 'Table 5'),
  ('Segun Adeyemi', 'CROWN-7726', 3, 'Table 4'),
  ('Blessing Etim', 'LUMEN-4409', 2, 'Table 6'),
  ('Kelechi Anyanwu', 'NOIR-8853', 1, 'Table 6');