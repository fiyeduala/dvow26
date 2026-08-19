-- Test guest used to exercise the RSVP flow end to end.
-- normalize_code() upper-cases and strips non-alphanumerics on both sides of the
-- lookup, so the stored 'DVow1234' matches 'dvow1234', 'DVOW-1234', etc.
-- Idempotent: re-running resets the row rather than failing on the unique code.
INSERT INTO public.guests (full_name, access_code, seats, table_assignment, is_active)
VALUES ('Ajayi Simpa', 'DVow1234', 2, 'Table 1', true)
ON CONFLICT (access_code) DO UPDATE
   SET full_name        = EXCLUDED.full_name,
       seats            = EXCLUDED.seats,
       table_assignment = EXCLUDED.table_assignment,
       is_active        = EXCLUDED.is_active;
