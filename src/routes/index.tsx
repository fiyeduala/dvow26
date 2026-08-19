import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Shirt, LogOut, Car, Compass, Download } from "lucide-react";
import { toast } from "sonner";
import { downloadInvitationCard } from "@/lib/invitation-card";
import heroImage from "@/assets/wedding-hero.jpg";
import { CodeGate } from "@/components/invite/CodeGate";
import { RsvpForm } from "@/components/invite/RsvpForm";
import {
  WEDDING,
  fetchPublicEventSettings,
  submitRsvp,
  verifyAccessCode,
  type Guest,
  type RsvpInput,
} from "@/lib/invite";

const title = `${WEDDING.brideAndGroom} — Private Wedding Invitation`;
const description = `Enter your personal access code to view the private wedding invitation for ${WEDDING.brideAndGroom} on ${WEDDING.date}.`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [gatePending, setGatePending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [rsvpPending, setRsvpPending] = useState(false);
  const { data: settings } = useQuery({
    queryKey: ["public-event-settings"],
    queryFn: fetchPublicEventSettings,
    staleTime: 60_000,
  });

  const ceremony = settings?.ceremony_venue
    ? [settings.ceremony_time, settings.ceremony_venue, settings.ceremony_address]
        .filter(Boolean)
        .join(" — ")
    : WEDDING.ceremony;
  const reception = settings?.reception_venue
    ? [settings.reception_time, settings.reception_venue, settings.reception_address]
        .filter(Boolean)
        .join(" — ")
    : WEDDING.reception;

  const unlock = async (value: string) => {
    setGatePending(true);
    setGateError(null);
    try {
      const found = await verifyAccessCode(value);
      if (!found) {
        setGateError("That access code isn't on our guest list. Please check your invitation.");
        return;
      }
      setGuest(found);
      setCode(value);
    } catch (err) {
      setGateError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setGatePending(false);
    }
  };

  const lock = () => {
    setGuest(null);
    setCode(null);
  };

  const sendRsvp = async (input: RsvpInput) => {
    if (!code) return;
    setRsvpPending(true);
    try {
      const saved = await submitRsvp(code, input);
      if (!saved) {
        toast.error("We couldn't find your invitation. Please re-enter your code.");
        return;
      }
      // Re-read the guest so responded_at and the stored values come from the
      // database rather than being guessed from the form.
      const refreshed = await verifyAccessCode(code);
      if (refreshed) setGuest(refreshed);
      toast.success(
        input.attending
          ? "Thank you — we can't wait to see you!"
          : "Thank you for letting us know.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Your RSVP could not be saved.");
    } finally {
      setRsvpPending(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <img
        src={heroImage}
        alt="Lilac orchids and gold leaves on a black background"
        width={1600}
        height={1200}
        className="pointer-events-none absolute inset-0 size-full object-cover opacity-60"
      />
      <div className="veil pointer-events-none absolute inset-0" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center px-5 py-14 sm:px-8">
        <header className="text-center">
          <p className="text-[11px] tracking-luxe uppercase text-gold">
            {WEDDING.families.join(" · ")}
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {WEDDING.greeting}
          </p>
          <div className="rule-gold mx-auto mt-6 w-40" />
          <p className="mt-6 text-[11px] tracking-luxe uppercase text-gold">The wedding of</p>
          <h1 className="mt-4 text-4xl leading-tight text-gilded sm:text-5xl">
            {WEDDING.brideFullName}
            <span className="mx-3 text-lilac">&amp;</span>
            {WEDDING.groomFullName}
          </h1>

          <p className="mt-3 text-sm tracking-[0.25em] text-lilac">{WEDDING.hashtag}</p>
          <p className="mt-5 text-sm text-muted-foreground">{WEDDING.date}</p>
        </header>

        <section className="mt-12 flex w-full flex-1 flex-col items-center">
          {!guest || !code ? (
            <CodeGate onSubmit={unlock} error={gateError} pending={gatePending} />
          ) : (
            <div className="w-full animate-rise space-y-6">
              <div className="rounded-xl border border-border bg-card/80 p-7 shadow-panel backdrop-blur-md sm:p-9">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] tracking-luxe uppercase text-gold">Reserved for</p>
                    <h2 className="mt-2 text-3xl">{guest.full_name}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {guest.seats} {guest.seats === 1 ? "seat" : "seats"} reserved
                      {guest.table_assignment ? ` · ${guest.table_assignment}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setDownloading(true);
                          await downloadInvitationCard({
                            guestName: guest.full_name,
                            seats: guest.seats,
                            tableAssignment: guest.table_assignment,
                            ceremony,
                            reception,
                            dressCode: settings?.dress_code || WEDDING.dressCode,
                          });
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Download failed");
                        } finally {
                          setDownloading(false);
                        }
                      }}
                      disabled={downloading}
                      className="flex items-center gap-2 rounded-md border border-gold/50 px-3 py-2 text-xs tracking-widest uppercase text-gold transition hover:text-foreground disabled:opacity-60"
                    >
                      <Download className="size-3.5" aria-hidden="true" />
                      {downloading ? "Preparing…" : "Download invitation"}
                    </button>
                    <button
                      type="button"
                      onClick={lock}
                      className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs tracking-widest uppercase text-muted-foreground transition hover:text-foreground"
                    >
                      <LogOut className="size-3.5" aria-hidden="true" /> Lock
                    </button>
                  </div>
                </div>

                <div className="rule-gold my-7 w-full" />

                <dl className="grid gap-5 sm:grid-cols-2">
                  <Detail
                    icon={<CalendarDays className="size-4" />}
                    label="Ceremony"
                    value={ceremony}
                  />
                  <Detail
                    icon={<MapPin className="size-4" />}
                    label="Reception"
                    value={reception}
                  />
                  <Detail
                    icon={<Shirt className="size-4" />}
                    label="Dress code"
                    value={settings?.dress_code || WEDDING.dressCode}
                  />
                </dl>

                {(settings?.ceremony_map_url || settings?.reception_map_url) && (
                  <div className="mt-7 flex flex-wrap gap-3">
                    {settings?.ceremony_map_url && (
                      <a
                        href={settings.ceremony_map_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-border px-3 py-2 text-xs tracking-widest uppercase text-gold transition hover:text-foreground"
                      >
                        Ceremony map
                      </a>
                    )}
                    {settings?.reception_map_url && (
                      <a
                        href={settings.reception_map_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-border px-3 py-2 text-xs tracking-widest uppercase text-gold transition hover:text-foreground"
                      >
                        Reception map
                      </a>
                    )}
                  </div>
                )}
              </div>

              <RsvpForm guest={guest} onSubmit={sendRsvp} pending={rsvpPending} />

              {(settings?.directions || settings?.parking_notes) && (
                <div className="rounded-xl border border-border bg-card/80 p-7 shadow-panel backdrop-blur-md sm:p-9">
                  <h3 className="text-2xl">Getting there</h3>
                  <dl className="mt-5 space-y-5">
                    {settings?.directions && (
                      <Detail
                        icon={<Compass className="size-4" />}
                        label="Directions"
                        value={settings.directions}
                      />
                    )}
                    {settings?.parking_notes && (
                      <Detail
                        icon={<Car className="size-4" />}
                        label="Parking"
                        value={settings.parking_notes}
                      />
                    )}
                  </dl>
                </div>
              )}
            </div>
          )}
        </section>

        <footer className="mt-14 text-center text-xs text-muted-foreground">
          <div className="rule-gold mx-auto mb-5 w-24" />
          With love, {WEDDING.brideAndGroom} · {WEDDING.hashtag}
        </footer>
      </div>
    </main>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-gold" aria-hidden="true">
        {icon}
      </span>
      <div>
        <dt className="text-[11px] tracking-luxe uppercase text-gold">{label}</dt>
        <dd className="mt-1 text-sm text-foreground/90">{value}</dd>
      </div>
    </div>
  );
}
