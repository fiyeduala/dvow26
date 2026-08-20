import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  renderInvitationCard,
  saveInvitationCard,
  type InvitationCardInput,
} from "@/lib/invitation-card";

/**
 * Paints the guest's access card and shows it as an image, so the slip they
 * download is exactly the one they are looking at.
 */
export function AccessCardPanel({ input }: { input: InvitationCardInput }) {
  const [card, setCard] = useState<{ url: string; fileName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Destructured so the repaint keys off the printed values, not the identity
  // of the object the parent rebuilds on every render.
  const {
    guestName,
    seats,
    tableAssignment,
    accessCode,
    attendingLabel,
    ceremony,
    reception,
    dressCode,
  } = input;

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    renderInvitationCard({
      guestName,
      seats,
      tableAssignment,
      accessCode,
      attendingLabel,
      ceremony,
      reception,
      dressCode,
    })
      .then(({ url, fileName }) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        created = url;
        setCard({ url, fileName });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "The access card could not be created.");
        }
      });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [
    guestName,
    seats,
    tableAssignment,
    accessCode,
    attendingLabel,
    ceremony,
    reception,
    dressCode,
  ]);

  return (
    <div className="animate-rise rounded-xl border border-border bg-card/80 p-7 shadow-panel backdrop-blur-md sm:p-9">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-luxe uppercase text-gold">Your access card</p>
          <h3 className="mt-2 text-2xl">{guestName}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Save this image and present it on arrival.
          </p>
        </div>
        <button
          type="button"
          onClick={() => card && saveInvitationCard(card.url, card.fileName)}
          disabled={!card}
          className="flex items-center gap-2 rounded-md border border-gold/50 px-3 py-2 text-xs tracking-widest uppercase text-gold transition hover:text-foreground disabled:opacity-60"
        >
          <Download className="size-3.5" aria-hidden="true" />
          {card ? "Download card" : "Preparing…"}
        </button>
      </div>

      <div className="rule-gold my-7 w-full" />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : card ? (
        <img
          src={card.url}
          alt={`Wedding access card for ${guestName}, access code ${accessCode}`}
          className="mx-auto w-full max-w-sm rounded-lg border border-gold/30"
        />
      ) : (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Painting your card…
        </div>
      )}
    </div>
  );
}
