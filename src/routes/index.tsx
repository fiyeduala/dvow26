import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  MapPin,
  Shirt,
  LogOut,
  Car,
  Compass,
  Copy,
  KeyRound,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import heroImage from "@/assets/wedding-hero.jpg";
import { AccessCardPanel } from "@/components/invite/AccessCardPanel";
import { CodeGate } from "@/components/invite/CodeGate";
import { RsvpForm } from "@/components/invite/RsvpForm";
import { RsvpRegisterForm } from "@/components/invite/RsvpRegisterForm";
import {
  WEDDING,
  ceremonyLabel,
  createRsvp,
  fetchPublicEventSettings,
  submitRsvp,
  verifyAccessCode,
  type CreateRsvpInput,
  type Guest,
  type RsvpInput,
} from "@/lib/invite";

const title = `${WEDDING.brideAndGroom} — Wedding Invitation & RSVP`;
const description = `RSVP to the wedding of ${WEDDING.brideAndGroom} on ${WEDDING.date} and receive your personal access code and access card.`;

// Keeps a guest signed in to their own card across a refresh.
const STORED_CODE_KEY = "dvow2026:access-code";

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
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [showGate, setShowGate] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [gatePending, setGatePending] = useState(false);
  const [registerPending, setRegisterPending] = useState(false);
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
        setGateError("That access code isn't on our guest list. Please check it and try again.");
        return;
      }
      setGuest(found);
      setCode(value);
      setIssuedCode(null);
      window.localStorage.setItem(STORED_CODE_KEY, value);
    } catch (err) {
      setGateError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setGatePending(false);
    }
  };

  // A guest who already unlocked on this device goes straight back to their card.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORED_CODE_KEY);
    if (!saved) return;
    verifyAccessCode(saved)
      .then((found) => {
        if (found) {
          setGuest(found);
          setCode(saved);
        } else {
          window.localStorage.removeItem(STORED_CODE_KEY);
        }
      })
      .catch(() => window.localStorage.removeItem(STORED_CODE_KEY));
  }, []);

  const lock = () => {
    setGuest(null);
    setCode(null);
    setIssuedCode(null);
    setShowGate(false);
    window.localStorage.removeItem(STORED_CODE_KEY);
  };

  const register = async (input: CreateRsvpInput) => {
    setRegisterPending(true);
    try {
      const newCode = await createRsvp(input);
      setIssuedCode(newCode);
      toast.success(
        input.attending
          ? "Thank you — your access code is ready."
          : "Thank you for letting us know.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Your RSVP could not be saved.");
    } finally {
      setRegisterPending(false);
    }
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

  const unlocked = Boolean(guest && code);

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
          {!unlocked ? (
            issuedCode ? (
              <CodeIssued
                code={issuedCode}
                pending={gatePending}
                error={gateError}
                onOpen={() => unlock(issuedCode)}
              />
            ) : showGate ? (
              <div className="flex w-full flex-col items-center gap-5">
                <CodeGate onSubmit={unlock} error={gateError} pending={gatePending} />
                <button
                  type="button"
                  onClick={() => {
                    setShowGate(false);
                    setGateError(null);
                  }}
                  className="text-xs tracking-widest uppercase text-muted-foreground transition hover:text-gold"
                >
                  Haven't replied yet? RSVP here
                </button>
              </div>
            ) : (
              <div className="flex w-full flex-col items-center gap-5">
                <RsvpRegisterForm onSubmit={register} pending={registerPending} />
                <button
                  type="button"
                  onClick={() => setShowGate(true)}
                  className="flex items-center gap-2 text-xs tracking-widest uppercase text-muted-foreground transition hover:text-gold"
                >
                  <KeyRound className="size-3.5" aria-hidden="true" />
                  Already have an access code?
                </button>
              </div>
            )
          ) : (
            <div className="w-full animate-rise space-y-6">
              <div className="rounded-xl border border-border bg-card/80 p-7 shadow-panel backdrop-blur-md sm:p-9">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] tracking-luxe uppercase text-gold">Reserved for</p>
                    <h2 className="mt-2 text-3xl">{guest!.full_name}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {guest!.seats} {guest!.seats === 1 ? "seat" : "seats"} reserved
                      {guest!.table_assignment ? ` · ${guest!.table_assignment}` : ""}
                    </p>
                    <p className="mt-1 font-mono text-sm text-lilac">{code}</p>
                  </div>
                  <button
                    type="button"
                    onClick={lock}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs tracking-widest uppercase text-muted-foreground transition hover:text-foreground"
                  >
                    <LogOut className="size-3.5" aria-hidden="true" /> Lock
                  </button>
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

              {guest!.attending ? (
                <AccessCardPanel
                  input={{
                    guestName: guest!.full_name,
                    seats: guest!.seats,
                    tableAssignment: guest!.table_assignment,
                    accessCode: code!,
                    attendingLabel: guest!.ceremonies ? ceremonyLabel(guest!.ceremonies) : null,
                    ceremony,
                    reception,
                    dressCode: settings?.dress_code || WEDDING.dressCode,
                  }}
                />
              ) : null}

              <RsvpForm guest={guest!} onSubmit={sendRsvp} pending={rsvpPending} />

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

/** Shown once the RSVP is in: the code exists, and it is what opens the card. */
function CodeIssued({
  code,
  onOpen,
  pending,
  error,
}: {
  code: string;
  onOpen: () => void;
  pending: boolean;
  error: string | null;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Access code copied");
    } catch {
      toast.error("Copy failed — please write the code down.");
    }
  };

  return (
    <div className="w-full max-w-md animate-rise rounded-xl border border-border bg-card/80 p-8 shadow-panel backdrop-blur-md sm:p-10">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border text-gold">
        <KeyRound className="size-5" aria-hidden="true" />
      </div>
      <h2 className="mt-6 text-center text-3xl">Your access code</h2>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Keep this safe. It opens your access card, and you will be asked for it on arrival.
      </p>

      <div className="mt-7 rounded-lg border border-gold/50 bg-background/40 px-4 py-6">
        <p className="text-center text-2xl tracking-[0.25em] text-gilded">{code}</p>
      </div>

      <div className="mt-5 space-y-3">
        <button
          type="button"
          onClick={onOpen}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium tracking-widest uppercase text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          View my access card
        </button>
        <button
          type="button"
          onClick={copy}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-3 text-xs tracking-widest uppercase text-muted-foreground transition hover:text-foreground"
        >
          <Copy className="size-3.5" aria-hidden="true" /> Copy code
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
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
