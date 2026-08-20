-- RSVP-first flow.
--
-- The invitation used to be code-gated: an admin issued a code, the guest typed
-- it in, then replied. That is inverted here. Anyone with the link fills in the
-- RSVP, the database mints their access code, and the code is what unlocks the
-- access card. Guests self-register with exactly one seat; the hosts adjust
-- seats and table assignments afterwards in the admin area.

-- 1. New guest columns ------------------------------------------------------

ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS ceremonies TEXT;
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS self_registered BOOLEAN NOT NULL DEFAULT false;

-- Which of the two celebrations the guest is coming to. NULL means "not
-- answered", which is also what a decline stores.
ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_ceremonies_check;
ALTER TABLE public.guests
  ADD CONSTRAINT guests_ceremonies_check
  CHECK (ceremonies IS NULL OR ceremonies IN ('traditional', 'white', 'both'));

-- 2. Access code minting ----------------------------------------------------

-- Codes keep the WORD-1234 shape the hosts already hand out by other means.
CREATE OR REPLACE FUNCTION public.generate_access_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _words TEXT[] := ARRAY[
    'LILAC', 'GOLD', 'ORCHID', 'AMBER', 'VELVET', 'ROYAL', 'PLUM', 'AURUM',
    'IRIS', 'CROWN', 'LUMEN', 'NOIR', 'SATIN', 'PEARL', 'EMBER', 'CORAL'
  ];
  _code TEXT;
  _try INTEGER := 0;
BEGIN
  LOOP
    _try := _try + 1;
    _code := _words[1 + floor(random() * array_length(_words, 1))::INTEGER]
             || '-' || lpad(floor(random() * 10000)::INTEGER::TEXT, 4, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.guests g
       WHERE public.normalize_code(g.access_code) = public.normalize_code(_code)
    );

    -- A crowded word list must never spin forever; widen the space instead.
    IF _try >= 25 THEN
      _code := 'DVOW-' || upper(substr(md5(random()::TEXT || clock_timestamp()::TEXT), 1, 8));
      EXIT;
    END IF;
  END LOOP;

  RETURN _code;
END;
$fn$;

REVOKE ALL ON FUNCTION public.generate_access_code() FROM PUBLIC;

-- 3. Self-service RSVP ------------------------------------------------------

-- SECURITY DEFINER because RLS on public.guests only lets admins insert. This
-- is the one door an anonymous visitor gets, and it can only ever create a
-- single-seat row for itself.
CREATE OR REPLACE FUNCTION public.create_rsvp(
  _full_name TEXT,
  _attending BOOLEAN,
  _ceremonies TEXT DEFAULT NULL,
  _meal_choice TEXT DEFAULT NULL,
  _dietary_notes TEXT DEFAULT NULL,
  _message TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _name TEXT := btrim(coalesce(_full_name, ''));
  _which TEXT := lower(nullif(btrim(coalesce(_ceremonies, '')), ''));
  _code TEXT;
BEGIN
  IF length(_name) < 2 THEN
    RAISE EXCEPTION 'Please enter your full name.' USING ERRCODE = '22023';
  END IF;
  _name := left(_name, 120);

  IF _which IS NOT NULL AND _which NOT IN ('traditional', 'white', 'both') THEN
    RAISE EXCEPTION 'Please choose which ceremonies you will attend.' USING ERRCODE = '22023';
  END IF;

  IF _attending IS NOT TRUE THEN
    -- A guest who declines is still recorded, but attends no ceremony.
    _which := NULL;
  ELSIF _which IS NULL THEN
    RAISE EXCEPTION 'Please choose which ceremonies you will attend.' USING ERRCODE = '22023';
  END IF;

  _code := public.generate_access_code();

  INSERT INTO public.guests (
    full_name, access_code, seats, attending, ceremonies,
    meal_choice, dietary_notes, message, responded_at, self_registered, is_active
  )
  VALUES (
    _name, _code, 1, _attending, _which,
    CASE WHEN _attending THEN nullif(left(coalesce(_meal_choice, ''), 60), '') END,
    CASE WHEN _attending THEN nullif(left(coalesce(_dietary_notes, ''), 300), '') END,
    nullif(left(coalesce(_message, ''), 500), ''),
    now(), true, true
  );

  RETURN _code;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_rsvp(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_rsvp(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated, service_role;

-- 4. Carry ceremonies through the existing gate ------------------------------

-- Both are dropped rather than replaced: one gains a return column and the
-- other gains a parameter, neither of which CREATE OR REPLACE can do.
DROP FUNCTION IF EXISTS public.verify_access_code(TEXT);

CREATE FUNCTION public.verify_access_code(_code TEXT)
RETURNS TABLE (
  full_name TEXT,
  seats INTEGER,
  table_assignment TEXT,
  attending BOOLEAN,
  ceremonies TEXT,
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
AS $fn$
DECLARE
  _clean TEXT := public.normalize_code(_code);
BEGIN
  IF length(_clean) < 4 OR length(_clean) > 32 THEN
    RETURN;
  END IF;

  UPDATE public.guests g
     SET first_opened_at = coalesce(g.first_opened_at, now())
   WHERE public.normalize_code(g.access_code) = _clean AND g.is_active;

  RETURN QUERY
  SELECT g.full_name, g.seats, g.table_assignment, g.attending, g.ceremonies,
         g.meal_choice, g.plus_one_name, g.dietary_notes, g.message, g.responded_at
    FROM public.guests g
   WHERE public.normalize_code(g.access_code) = _clean AND g.is_active;
END;
$fn$;

REVOKE ALL ON FUNCTION public.verify_access_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_access_code(TEXT) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.submit_rsvp(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT);

CREATE FUNCTION public.submit_rsvp(
  _code TEXT,
  _attending BOOLEAN,
  _ceremonies TEXT DEFAULT NULL,
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
AS $fn$
DECLARE
  _clean TEXT := public.normalize_code(_code);
  _which TEXT := lower(nullif(btrim(coalesce(_ceremonies, '')), ''));
  _hit INTEGER;
BEGIN
  IF length(_clean) < 4 OR length(_clean) > 32 THEN
    RETURN false;
  END IF;

  IF _which IS NOT NULL AND _which NOT IN ('traditional', 'white', 'both') THEN
    RAISE EXCEPTION 'Please choose which ceremonies you will attend.' USING ERRCODE = '22023';
  END IF;

  IF _attending IS NOT TRUE THEN
    _which := NULL;
  END IF;

  UPDATE public.guests g
     SET attending = _attending,
         ceremonies = _which,
         meal_choice = nullif(left(coalesce(_meal_choice, ''), 60), ''),
         plus_one_name = nullif(left(coalesce(_plus_one_name, ''), 100), ''),
         dietary_notes = nullif(left(coalesce(_dietary_notes, ''), 300), ''),
         message = nullif(left(coalesce(_message, ''), 500), ''),
         responded_at = now()
   WHERE public.normalize_code(g.access_code) = _clean AND g.is_active;

  GET DIAGNOSTICS _hit = ROW_COUNT;
  RETURN _hit > 0;
END;
$fn$;

REVOKE ALL ON FUNCTION public.submit_rsvp(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_rsvp(TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated, service_role;
