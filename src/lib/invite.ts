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

export const MEAL_OPTIONS = [
  "Jollof & grilled chicken",
  "Herb-crusted beef",
  "Seared salmon",
  "Vegetarian",
] as const;

export const CEREMONY_OPTIONS = [
  {
    value: "traditional",
    label: "Traditional only",
    hint: "The traditional ceremony",
  },
  { value: "white", label: "White only", hint: "The white wedding" },
  { value: "both", label: "Both ceremonies", hint: "Traditional and white" },
] as const;

export type CeremonyChoice = (typeof CEREMONY_OPTIONS)[number]["value"];

const ceremonyValues = CEREMONY_OPTIONS.map((option) => option.value) as [
  CeremonyChoice,
  ...CeremonyChoice[],
];

export const ceremonySchema = z.enum(ceremonyValues);

export function ceremonyLabel(value: string | null): string {
  return CEREMONY_OPTIONS.find((option) => option.value === value)?.label ?? "Not answered";
}

export const codeSchema = z
  .string()
  .trim()
  .min(4, { message: "Access code is too short" })
  .max(32, { message: "Access code is too long" })
  .regex(/^[A-Za-z0-9-\s]+$/, { message: "Codes only contain letters, numbers and dashes" });

export const rsvpSchema = z
  .object({
    attending: z.boolean(),
    ceremonies: ceremonySchema.optional(),
    mealChoice: z.string().trim().max(60).optional(),
    plusOneName: z.string().trim().max(100).optional(),
    dietaryNotes: z.string().trim().max(300).optional(),
    message: z.string().trim().max(500).optional(),
  })
  .refine((value) => !value.attending || Boolean(value.ceremonies), {
    message: "Please tell us which ceremonies you will attend.",
    path: ["ceremonies"],
  });

export type RsvpInput = z.infer<typeof rsvpSchema>;

/** The open registration form: the guest's name is what mints the access code. */
export const createRsvpSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, { message: "Please enter your full name" })
      .max(120, { message: "That name is too long" }),
    attending: z.boolean(),
    ceremonies: ceremonySchema.optional(),
    mealChoice: z.string().trim().max(60).optional(),
    dietaryNotes: z.string().trim().max(300).optional(),
    message: z.string().trim().max(500).optional(),
  })
  .refine((value) => !value.attending || Boolean(value.ceremonies), {
    message: "Please tell us which ceremonies you will attend.",
    path: ["ceremonies"],
  });

export type CreateRsvpInput = z.infer<typeof createRsvpSchema>;

export type Guest = {
  full_name: string;
  seats: number;
  table_assignment: string | null;
  attending: boolean | null;
  ceremonies: string | null;
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

/**
 * Registers a brand new guest and returns the access code the database minted
 * for them. This is the entry point of the invitation: the code does not exist
 * until the RSVP has been answered.
 */
export async function createRsvp(input: CreateRsvpInput): Promise<string> {
  const values = createRsvpSchema.parse(input);
  const args: {
    _full_name: string;
    _attending: boolean;
    _ceremonies?: string;
    _meal_choice?: string;
    _dietary_notes?: string;
    _message?: string;
  } = { _full_name: values.fullName, _attending: values.attending };
  if (values.attending && values.ceremonies) args._ceremonies = values.ceremonies;
  if (values.attending && values.mealChoice) args._meal_choice = values.mealChoice;
  if (values.attending && values.dietaryNotes) args._dietary_notes = values.dietaryNotes;
  if (values.message) args._message = values.message;

  const { data, error } = await supabase.rpc("create_rsvp", args);
  if (error) {
    // 22023 is the code the function raises for its own validation messages,
    // which are written for the guest to read.
    throw new Error(
      error.code === "22023" ? error.message : "Your RSVP could not be saved. Please try again.",
    );
  }
  const code = typeof data === "string" ? data : "";
  if (!code)
    throw new Error("Your RSVP was saved but no access code came back. Please contact us.");
  return code;
}

export async function submitRsvp(code: string, input: RsvpInput): Promise<boolean> {
  const parsedCode = codeSchema.parse(code);
  const values = rsvpSchema.parse(input);
  const args: {
    _code: string;
    _attending: boolean;
    _ceremonies?: string;
    _meal_choice?: string;
    _plus_one_name?: string;
    _dietary_notes?: string;
    _message?: string;
  } = { _code: parsedCode, _attending: values.attending };
  if (values.attending && values.ceremonies) args._ceremonies = values.ceremonies;
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
