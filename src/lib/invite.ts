import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const WEDDING = {
  brideAndGroom: "Victoria Oyiemeafu Agbose-Akinwole & Daniel Osigie Iyeduala",
  brideFullName: "Victoria Oyiemeafu Agbose-Akinwole",
  groomFullName: "Daniel Osigie Iyeduala",
  families: ["The Iyeduala Family", "The Agbose-Akinwole Family"],
  hashtag: "#DVow2026",
  greeting:
    "With hearts full of gratitude and joy, we warmly welcome you to share in our celebration of love.",
  date: "Saturday, 21 November 2026",
  ceremony: "3:00 PM — The Rose Chapel, Ikoyi, Lagos",
  reception: "6:00 PM — The Gilded Hall, Victoria Island",
  dressCode: "Black tie — lilac, purple or gold accents",
  rsvpBy: "Friday, 30 October 2026",
  schedule: [
    { time: "2:30 PM", title: "Guest arrival & seating" },
    { time: "3:00 PM", title: "Wedding ceremony" },
    { time: "4:30 PM", title: "Cocktails & photographs" },
    { time: "6:00 PM", title: "Reception & dinner" },
    { time: "9:00 PM", title: "First dance & dancing" },
  ],
} as const;

export const MEAL_OPTIONS = ["Jollof & grilled chicken", "Herb-crusted beef", "Seared salmon", "Vegetarian"] as const;

export const codeSchema = z
  .string()
  .trim()
  .min(4, { message: "Access code is too short" })
  .max(32, { message: "Access code is too long" })
  .regex(/^[A-Za-z0-9-\s]+$/, { message: "Codes only contain letters, numbers and dashes" });

export const rsvpSchema = z.object({
  attending: z.boolean(),
  mealChoice: z.string().trim().max(60).optional(),
  plusOneName: z.string().trim().max(100).optional(),
  dietaryNotes: z.string().trim().max(300).optional(),
  message: z.string().trim().max(500).optional(),
});

export type RsvpInput = z.infer<typeof rsvpSchema>;

export type Guest = {
  full_name: string;
  seats: number;
  table_assignment: string | null;
  attending: boolean | null;
  meal_choice: string | null;
  plus_one_name: string | null;
  dietary_notes: string | null;
  message: string | null;
  responded_at: string | null;
};

export async function verifyAccessCode(code: string): Promise<Guest | null> {
  const parsed = codeSchema.parse(code);
  const { data, error } = await supabase.rpc("verify_access_code", { _code: parsed });
  if (error) throw new Error("We couldn't check that code right now. Please try again.");
  const rows = (data ?? []) as Guest[];
  return rows[0] ?? null;
}

export async function submitRsvp(code: string, input: RsvpInput): Promise<boolean> {
  const parsedCode = codeSchema.parse(code);
  const values = rsvpSchema.parse(input);
  const args: {
    _code: string;
    _attending: boolean;
    _meal_choice?: string;
    _plus_one_name?: string;
    _dietary_notes?: string;
    _message?: string;
  } = { _code: parsedCode, _attending: values.attending };
  if (values.mealChoice) args._meal_choice = values.mealChoice;
  if (values.plusOneName) args._plus_one_name = values.plusOneName;
  if (values.dietaryNotes) args._dietary_notes = values.dietaryNotes;
  if (values.message) args._message = values.message;

  const { data, error } = await supabase.rpc("submit_rsvp", args);
  if (error) throw new Error("Your RSVP could not be saved. Please try again.");
  return Boolean(data);
}

export type PublicEventSettings = {
  ceremony_venue: string;
  ceremony_address: string;
  ceremony_time: string;
  ceremony_map_url: string;
  reception_venue: string;
  reception_address: string;
  reception_time: string;
  reception_map_url: string;
  directions: string;
  parking_notes: string;
  dress_code: string;
};

export async function fetchPublicEventSettings(): Promise<PublicEventSettings | null> {
  const { data, error } = await supabase
    .from("event_settings")
    .select(
      "ceremony_venue, ceremony_address, ceremony_time, ceremony_map_url, reception_venue, reception_address, reception_time, reception_map_url, directions, parking_notes, dress_code",
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}
