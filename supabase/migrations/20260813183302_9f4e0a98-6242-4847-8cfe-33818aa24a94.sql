-- 1. guests: active flag
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_guests_updated_at ON public.guests;
CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON public.guests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles" ON public.user_roles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- first signed-in user may claim admin
CREATE OR REPLACE FUNCTION public.claim_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'admin');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN true;
END; $$;

-- 3. admin access to guests
DROP POLICY IF EXISTS "Admins manage guests" ON public.guests;
CREATE POLICY "Admins manage guests" ON public.guests
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guests TO authenticated;
GRANT ALL ON public.guests TO service_role;

-- 4. event settings (venue + directions)
CREATE TABLE IF NOT EXISTS public.event_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ceremony_venue text NOT NULL DEFAULT '',
  ceremony_address text NOT NULL DEFAULT '',
  ceremony_time text NOT NULL DEFAULT '',
  ceremony_map_url text NOT NULL DEFAULT '',
  reception_venue text NOT NULL DEFAULT '',
  reception_address text NOT NULL DEFAULT '',
  reception_time text NOT NULL DEFAULT '',
  reception_map_url text NOT NULL DEFAULT '',
  directions text NOT NULL DEFAULT '',
  parking_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.event_settings TO authenticated;
GRANT ALL ON public.event_settings TO service_role;
ALTER TABLE public.event_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Event settings are public" ON public.event_settings;
CREATE POLICY "Event settings are public" ON public.event_settings
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins update event settings" ON public.event_settings;
CREATE POLICY "Admins update event settings" ON public.event_settings
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_event_settings_updated_at ON public.event_settings;
CREATE TRIGGER update_event_settings_updated_at BEFORE UPDATE ON public.event_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.event_settings (
  ceremony_venue, ceremony_address, ceremony_time, ceremony_map_url,
  reception_venue, reception_address, reception_time, reception_map_url,
  directions, parking_notes
)
SELECT
  'The Rose Chapel', 'Ikoyi, Lagos', '3:00 PM',
  'https://www.google.com/maps/search/?api=1&query=Ikoyi+Lagos',
  'The Gilded Hall', 'Victoria Island, Lagos', '6:00 PM',
  'https://www.google.com/maps/search/?api=1&query=Victoria+Island+Lagos',
  'From Third Mainland Bridge, take the Falomo Bridge exit towards Ikoyi; the chapel is a 5 minute drive from Falomo Roundabout. The reception is 15 minutes away on Victoria Island.',
  'Complimentary valet parking is available at both venues from 2:00 PM.'
WHERE NOT EXISTS (SELECT 1 FROM public.event_settings);

-- 5. gate on active codes
CREATE OR REPLACE FUNCTION public.verify_access_code(_code text)
RETURNS TABLE(full_name text, seats integer, table_assignment text, attending boolean, meal_choice text, plus_one_name text, dietary_notes text, message text, responded_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _clean TEXT := public.normalize_code(_code);
BEGIN
  IF length(_clean) < 4 OR length(_clean) > 32 THEN RETURN; END IF;

  UPDATE public.guests g SET first_opened_at = coalesce(g.first_opened_at, now())
  WHERE public.normalize_code(g.access_code) = _clean AND g.is_active;

  RETURN QUERY
  SELECT g.full_name, g.seats, g.table_assignment, g.attending, g.meal_choice,
         g.plus_one_name, g.dietary_notes, g.message, g.responded_at
  FROM public.guests g
  WHERE public.normalize_code(g.access_code) = _clean AND g.is_active;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_rsvp(_code text, _attending boolean, _meal_choice text DEFAULT NULL, _plus_one_name text DEFAULT NULL, _dietary_notes text DEFAULT NULL, _message text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _clean TEXT := public.normalize_code(_code); _hit INTEGER;
BEGIN
  IF length(_clean) < 4 OR length(_clean) > 32 THEN RETURN false; END IF;

  UPDATE public.guests g
     SET attending = _attending,
         meal_choice = nullif(left(coalesce(_meal_choice, ''), 60), ''),
         plus_one_name = nullif(left(coalesce(_plus_one_name, ''), 100), ''),
         dietary_notes = nullif(left(coalesce(_dietary_notes, ''), 300), ''),
         message = nullif(left(coalesce(_message, ''), 500), ''),
         responded_at = now()
   WHERE public.normalize_code(g.access_code) = _clean AND g.is_active;

  GET DIAGNOSTICS _hit = ROW_COUNT;
  RETURN _hit > 0;
END; $$;