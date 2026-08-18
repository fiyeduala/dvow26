import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type GuestRow = Tables<"guests">;
export type EventSettings = Tables<"event_settings">;

export const guestSchema = z.object({
  full_name: z.string().trim().min(2, "Please enter the guest's name").max(120),
  access_code: z
    .string()
    .trim()
    .min(4, "Code is too short")
    .max(32, "Code is too long")
    .regex(/^[A-Za-z0-9-\s]+$/, "Codes only contain letters, numbers and dashes"),
  seats: z.coerce.number().int().min(1, "At least 1 seat").max(20),
  table_assignment: z.string().trim().max(60).optional(),
});

export type GuestInput = z.infer<typeof guestSchema>;

export const settingsSchema = z.object({
  ceremony_venue: z.string().trim().max(120),
  ceremony_address: z.string().trim().max(240),
  ceremony_time: z.string().trim().max(60),
  ceremony_map_url: z.string().trim().max(500),
  reception_venue: z.string().trim().max(120),
  reception_address: z.string().trim().max(240),
  reception_time: z.string().trim().max(60),
  reception_map_url: z.string().trim().max(500),
  directions: z.string().trim().max(1500),
  parking_notes: z.string().trim().max(600),
  dress_code: z.string().trim().max(240),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export async function fetchEventSettings(): Promise<EventSettings | null> {
  const { data, error } = await supabase
    .from("event_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveEventSettings(id: string, input: SettingsInput) {
  const values = settingsSchema.parse(input);
  const { error } = await supabase.from("event_settings").update(values).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchGuests(): Promise<GuestRow[]> {
  const { data, error } = await supabase
    .from("guests")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addGuest(input: GuestInput) {
  const values = guestSchema.parse(input);
  const { error } = await supabase.from("guests").insert({
    full_name: values.full_name,
    access_code: values.access_code.toUpperCase(),
    seats: values.seats,
    table_assignment: values.table_assignment || null,
  });
  if (error) {
    throw new Error(
      error.code === "23505" || error.message.includes("duplicate")
        ? "That access code is already in use."
        : error.message,
    );
  }
}

export async function updateGuest(id: string, patch: Partial<GuestRow>) {
  const { error } = await supabase.from("guests").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setGuestActive(id: string, isActive: boolean) {
  return updateGuest(id, { is_active: isActive });
}

export async function deleteGuest(id: string) {
  const { error } = await supabase.from("guests").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function claimAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_admin");
  if (error) return false;
  return Boolean(data);
}

export function randomCode(prefix = "DEVOW") {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${n}`;
}
