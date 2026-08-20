import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, LogOut, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SAMPLE_CSV, importGuests, parseGuestCsv } from "@/lib/guest-csv";
import { ceremonyLabel } from "@/lib/invite";
import {
  addGuest,
  claimAdmin,
  deleteGuest,
  fetchEventSettings,
  fetchGuests,
  guestsToCsv,
  randomCode,
  saveEventSettings,
  setGuestActive,
  updateGuest,
  type GuestInput,
  type SettingsInput,
} from "@/lib/admin";

const title = "Guest & venue admin — #DEVOW2026";
const description =
  "Manage wedding guest access codes, seats, table assignments, venue details and directions.";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const panel = "rounded-xl border border-border bg-card/80 p-6 shadow-panel backdrop-blur-md sm:p-8";
const field =
  "mt-2 w-full rounded-md border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary";
const labelCls = "text-[11px] tracking-luxe uppercase text-gold";

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"guests" | "venue">("guests");

  useEffect(() => {
    void claimAdmin();
  }, []);

  const guests = useQuery({ queryKey: ["admin", "guests"], queryFn: fetchGuests });
  const settings = useQuery({ queryKey: ["event-settings"], queryFn: fetchEventSettings });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  };

  const isDenied =
    guests.isError && /permission|row-level|denied/i.test(guests.error?.message ?? "");

  return (
    <main className="relative min-h-screen px-5 py-12 sm:px-8">
      <div className="veil pointer-events-none absolute inset-0" />
      <div className="relative mx-auto w-full max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={labelCls}>#DEVOW2026 · Host area</p>
            <h1 className="mt-2 text-4xl text-gilded">Guest & venue admin</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Add guests, issue or deactivate access codes, and edit the venue and directions.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/"
              className="rounded-md border border-border px-3 py-2 text-xs tracking-widest uppercase text-muted-foreground transition hover:text-foreground"
            >
              View invitation
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs tracking-widest uppercase text-muted-foreground transition hover:text-foreground"
            >
              <LogOut className="size-3.5" aria-hidden="true" /> Sign out
            </button>
          </div>
        </header>

        <div className="rule-gold my-8 w-full" />

        <div className="mb-6 flex gap-2">
          {(["guests", "venue"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-xs tracking-luxe uppercase transition ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "guests" ? "Guests & codes" : "Venue & directions"}
            </button>
          ))}
        </div>

        {isDenied ? (
          <div className={panel}>
            <h2 className="text-2xl">Awaiting admin rights</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This account isn't an admin yet. Reload the page — if an admin already exists, ask
              them to grant you access.
            </p>
          </div>
        ) : tab === "guests" ? (
          <GuestsTab guests={guests} />
        ) : (
          <VenueTab settings={settings} />
        )}
      </div>
    </main>
  );
}

function GuestsTab({
  guests,
}: {
  guests: ReturnType<typeof useQuery<Awaited<ReturnType<typeof fetchGuests>>>>;
}) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "guests"] });

  const [search, setSearch] = useState("");
  const [form, setForm] = useState<GuestInput>({
    full_name: "",
    access_code: randomCode(),
    seats: 1,
    table_assignment: "",
  });

  const create = useMutation({
    mutationFn: () => addGuest(form),
    onSuccess: () => {
      toast.success("Guest added");
      setForm({ full_name: "", access_code: randomCode(), seats: 1, table_assignment: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setGuestActive(id, active),
    onSuccess: (_d, v) => {
      toast.success(v.active ? "Code reactivated" : "Code deactivated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const seats = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) => updateGuest(id, { seats: value }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteGuest(id),
    onSuccess: () => {
      toast.success("Guest removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allRows = guests.data ?? [];
  const active = allRows.filter((g) => g.is_active);
  const totalSeats = active.reduce((sum, g) => sum + g.seats, 0);
  const confirmed = allRows.filter((g) => g.attending === true);
  const declined = allRows.filter((g) => g.attending === false).length;
  const awaiting = allRows.filter((g) => g.attending === null).length;
  // "Both" counts towards each ceremony's head count, which is what catering needs.
  const atTraditional = confirmed.filter(
    (g) => g.ceremonies === "traditional" || g.ceremonies === "both",
  ).length;
  const atWhite = confirmed.filter(
    (g) => g.ceremonies === "white" || g.ceremonies === "both",
  ).length;
  const selfRegistered = allRows.filter((g) => g.self_registered).length;

  const term = search.trim().toLowerCase();
  const rows = term
    ? allRows.filter((g) =>
        [g.full_name, g.access_code, g.table_assignment, g.meal_choice, g.message]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term)),
      )
    : allRows;

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([guestsToCsv(allRows)], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `dvow2026-guests-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active codes" value={active.length} />
        <Stat label="Seats reserved" value={totalSeats} />
        <Stat label="Confirmed yes" value={confirmed.length} />
        <Stat label="Declined" value={declined} />
        <Stat label="Awaiting reply" value={awaiting} />
        <Stat label="At traditional" value={atTraditional} />
        <Stat label="At white" value={atWhite} />
        <Stat label="Self-registered" value={selfRegistered} />
      </div>

      <CsvUpload onDone={invalidate} />

      <form
        className={panel}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <h2 className="text-2xl">Add a guest</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="full_name">
              Full name
            </label>
            <input
              id="full_name"
              required
              className={field}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="access_code">
              Access code
            </label>
            <div className="flex gap-2">
              <input
                id="access_code"
                required
                className={field}
                value={form.access_code}
                onChange={(e) => setForm({ ...form, access_code: e.target.value })}
              />
              <button
                type="button"
                title="Generate a new code"
                onClick={() => setForm({ ...form, access_code: randomCode() })}
                className="mt-2 rounded-md border border-border px-3 text-muted-foreground transition hover:text-foreground"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="seats">
              Seats
            </label>
            <input
              id="seats"
              type="number"
              min={1}
              max={20}
              className={field}
              value={form.seats}
              onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="table_assignment">
              Table (optional)
            </label>
            <input
              id="table_assignment"
              className={field}
              value={form.table_assignment ?? ""}
              onChange={(e) => setForm({ ...form, table_assignment: e.target.value })}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={create.isPending}
          className="mt-6 flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs tracking-luxe uppercase text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {create.isPending ? "Adding…" : "Add guest"}
        </button>
      </form>

      <div className={panel}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl">Guest list</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every reply, in full. {rows.length} of {allRows.length} shown.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, code, table, note…"
              className="w-56 rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={exportCsv}
              disabled={allRows.length === 0}
              className="flex items-center gap-2 rounded-md border border-gold/50 px-3 py-2 text-xs tracking-luxe uppercase text-gold transition hover:text-foreground disabled:opacity-60"
            >
              <Download className="size-3.5" aria-hidden="true" /> Export CSV
            </button>
          </div>
        </div>

        {guests.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading guests…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {allRows.length === 0 ? "No guests yet." : "No guests match that search."}
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {[
                    "Guest",
                    "Code",
                    "Seats",
                    "Table",
                    "RSVP",
                    "Ceremonies",
                    "Meal",
                    "Dietary",
                    "Note",
                    "Replied",
                    "Source",
                    "Status",
                    "",
                  ].map((h) => (
                    <th key={h} className={`pb-3 pr-4 ${labelCls}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id} className="border-b border-border/50 align-top">
                    <td className="py-3 pr-4">
                      {g.full_name}
                      {g.plus_one_name ? (
                        <span className="block text-xs text-muted-foreground">
                          +1 {g.plus_one_name}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-lilac">{g.access_code}</td>
                    <td className="py-3 pr-4">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        defaultValue={g.seats}
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (value !== g.seats && value >= 1) seats.mutate({ id: g.id, value });
                        }}
                        className="w-16 rounded-md border border-border bg-background/60 px-2 py-1 text-sm outline-none focus:border-primary"
                      />
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{g.table_assignment ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          g.attending === null
                            ? "text-muted-foreground"
                            : g.attending
                              ? "text-gold"
                              : "text-destructive"
                        }
                      >
                        {g.attending === null ? "No reply" : g.attending ? "Attending" : "Declined"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {g.ceremonies ? ceremonyLabel(g.ceremonies) : "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{g.meal_choice ?? "—"}</td>
                    <td className="max-w-[180px] py-3 pr-4 text-muted-foreground">
                      <span className="line-clamp-2" title={g.dietary_notes ?? ""}>
                        {g.dietary_notes ?? "—"}
                      </span>
                    </td>
                    <td className="max-w-[220px] py-3 pr-4 text-muted-foreground">
                      <span className="line-clamp-2" title={g.message ?? ""}>
                        {g.message ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {g.responded_at ? new Date(g.responded_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {g.self_registered ? "Self" : "Invited"}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={g.is_active ? "text-gold" : "text-muted-foreground"}>
                        {g.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => toggle.mutate({ id: g.id, active: !g.is_active })}
                          className="rounded-md border border-border px-2.5 py-1.5 text-[11px] tracking-widest uppercase text-muted-foreground transition hover:text-foreground"
                        >
                          {g.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                        <button
                          type="button"
                          title="Remove guest"
                          onClick={() => {
                            if (window.confirm(`Remove ${g.full_name} from the guest list?`))
                              remove.mutate(g.id);
                          }}
                          className="rounded-md border border-border px-2.5 py-1.5 text-muted-foreground transition hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function VenueTab({
  settings,
}: {
  settings: ReturnType<typeof useQuery<Awaited<ReturnType<typeof fetchEventSettings>>>>;
}) {
  const queryClient = useQueryClient();
  const row = settings.data;
  const [form, setForm] = useState<SettingsInput | null>(null);

  useEffect(() => {
    if (row && !form) {
      const { id, created_at, updated_at, ...rest } = row;
      setForm(rest);
    }
  }, [row, form]);

  const save = useMutation({
    mutationFn: () => saveEventSettings(row!.id, form!),
    onSuccess: () => {
      toast.success("Venue details saved");
      queryClient.invalidateQueries({ queryKey: ["event-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (settings.isLoading || !form) {
    return (
      <div className={panel}>
        <p className="text-sm text-muted-foreground">Loading venue details…</p>
      </div>
    );
  }

  const set = (key: keyof SettingsInput) => (value: string) => setForm({ ...form, [key]: value });

  return (
    <form
      className={panel}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-2xl">Venue & directions</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        These details appear on the invitation once a guest unlocks it.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Text label="Ceremony venue" value={form.ceremony_venue} onChange={set("ceremony_venue")} />
        <Text label="Ceremony time" value={form.ceremony_time} onChange={set("ceremony_time")} />
        <Text
          label="Ceremony address"
          value={form.ceremony_address}
          onChange={set("ceremony_address")}
        />
        <Text
          label="Ceremony map link"
          value={form.ceremony_map_url}
          onChange={set("ceremony_map_url")}
        />
        <Text
          label="Reception venue"
          value={form.reception_venue}
          onChange={set("reception_venue")}
        />
        <Text label="Reception time" value={form.reception_time} onChange={set("reception_time")} />
        <Text
          label="Reception address"
          value={form.reception_address}
          onChange={set("reception_address")}
        />
        <Text
          label="Reception map link"
          value={form.reception_map_url}
          onChange={set("reception_map_url")}
        />
      </div>

      <div className="mt-4 grid gap-4">
        <Text label="Dress code" value={form.dress_code} onChange={set("dress_code")} />
        <Area label="Directions" value={form.directions} onChange={set("directions")} rows={4} />
        <Area
          label="Parking notes"
          value={form.parking_notes}
          onChange={set("parking_notes")}
          rows={2}
        />
      </div>

      <button
        type="submit"
        disabled={save.isPending}
        className="mt-6 rounded-md bg-primary px-4 py-2.5 text-xs tracking-luxe uppercase text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
      >
        {save.isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input className={field} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <textarea
        rows={rows}
        className={field}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-5 backdrop-blur-md">
      <p className={labelCls}>{label}</p>
      <p className="mt-2 text-3xl text-gilded">{value}</p>
    </div>
  );
}

function CsvUpload({ onDone }: { onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string[] | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setReport(null);
    try {
      const text = await file.text();
      const parsed = parseGuestCsv(text);
      if (parsed.rows.length === 0) {
        setReport(
          parsed.errors.map((e) => (e.rowNumber ? `Row ${e.rowNumber}: ${e.message}` : e.message)),
        );
        toast.error("No valid guest rows found in that file.");
        return;
      }
      const result = await importGuests(parsed.rows);
      const lines = [
        `${result.inserted} guest${result.inserted === 1 ? "" : "s"} imported.`,
        ...(result.skipped ? [`${result.skipped} skipped (duplicate codes).`] : []),
        ...parsed.errors.map((e) => `Row ${e.rowNumber}: ${e.message}`),
        ...result.failures,
      ];
      setReport(lines);
      if (result.inserted > 0) toast.success(`${result.inserted} guests imported`);
      else toast.error("Nothing was imported.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "guest-list-template.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className={panel}>
      <h2 className="text-2xl">Import guest list (CSV)</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload a CSV with columns <span className="text-gold">name</span>,{" "}
        <span className="text-gold">access code</span>, and optionally{" "}
        <span className="text-gold">seats</span> and <span className="text-gold">table</span>.
        Existing codes are skipped.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs tracking-luxe uppercase text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          <Upload className="size-3.5" aria-hidden="true" />
          {busy ? "Importing…" : "Choose CSV file"}
        </button>
        <button
          type="button"
          onClick={downloadTemplate}
          className="rounded-md border border-border px-4 py-2.5 text-xs tracking-luxe uppercase text-muted-foreground transition hover:text-foreground"
        >
          Download template
        </button>
      </div>

      {report && (
        <ul className="mt-5 space-y-1 text-sm text-muted-foreground">
          {report.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
