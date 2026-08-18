import { supabase } from "@/integrations/supabase/client";
import { guestSchema, type GuestInput } from "@/lib/admin";

export type ParsedGuestRow = GuestInput & { rowNumber: number };
export type CsvParseResult = {
  rows: ParsedGuestRow[];
  errors: { rowNumber: number; message: string }[];
};

const HEADER_ALIASES: Record<string, keyof GuestInput> = {
  name: "full_name",
  "full name": "full_name",
  full_name: "full_name",
  guest: "full_name",
  "guest name": "full_name",
  code: "access_code",
  "access code": "access_code",
  access_code: "access_code",
  "invite code": "access_code",
  seats: "seats",
  seat: "seats",
  "no of seats": "seats",
  table: "table_assignment",
  "table assignment": "table_assignment",
  table_assignment: "table_assignment",
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === "," || char === ";" || char === "\t") {
      out.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out;
}

export function parseGuestCsv(text: string): CsvParseResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  const result: CsvParseResult = { rows: [], errors: [] };
  if (lines.length === 0) {
    result.errors.push({ rowNumber: 0, message: "The file is empty." });
    return result;
  }

  const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase().replace(/_/g, "_").trim());
  const mapped = header.map((h) => HEADER_ALIASES[h] ?? HEADER_ALIASES[h.replace(/_/g, " ")]);

  if (!mapped.includes("full_name") || !mapped.includes("access_code")) {
    result.errors.push({
      rowNumber: 1,
      message: "The first row must be a header with at least: name, access code (optional: seats, table).",
    });
    return result;
  }

  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!);
    const raw: Record<string, string> = {};
    mapped.forEach((key, index) => {
      if (key) raw[key] = cells[index] ?? "";
    });

    const candidate = {
      full_name: raw["full_name"] ?? "",
      access_code: raw["access_code"] ?? "",
      seats: raw["seats"] ? Number(raw["seats"]) : 1,
      table_assignment: raw["table_assignment"] ?? "",
    };

    const parsed = guestSchema.safeParse(candidate);
    if (!parsed.success) {
      result.errors.push({
        rowNumber: i + 1,
        message: parsed.error.issues[0]?.message ?? "Invalid row",
      });
      continue;
    }
    result.rows.push({ ...parsed.data, rowNumber: i + 1 });
  }

  return result;
}

export type ImportResult = { inserted: number; skipped: number; failures: string[] };

export async function importGuests(rows: ParsedGuestRow[]): Promise<ImportResult> {
  const failures: string[] = [];
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const { error } = await supabase.from("guests").insert({
      full_name: row.full_name,
      access_code: row.access_code.toUpperCase(),
      seats: row.seats,
      table_assignment: row.table_assignment || null,
    });
    if (!error) {
      inserted += 1;
      continue;
    }
    if (error.code === "23505" || /duplicate/i.test(error.message)) {
      skipped += 1;
      failures.push(`Row ${row.rowNumber}: code ${row.access_code} already exists`);
    } else {
      failures.push(`Row ${row.rowNumber}: ${error.message}`);
    }
  }

  return { inserted, skipped, failures };
}

export const SAMPLE_CSV = "name,access code,seats,table\nAda Okonkwo,DVOW-1001,2,Table 3\nEmeka Obi,DVOW-1002,1,Table 5\n";
