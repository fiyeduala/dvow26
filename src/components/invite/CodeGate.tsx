import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { codeSchema } from "@/lib/invite";

export function CodeGate({
  onSubmit,
  error,
  pending,
}: {
  onSubmit: (code: string) => void;
  error: string | null;
  pending: boolean;
}) {
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = codeSchema.safeParse(code);
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? "Please enter a valid code");
      return;
    }
    setLocalError(null);
    onSubmit(parsed.data);
  };

  const shown = localError ?? error;

  return (
    <div className="w-full max-w-md animate-rise rounded-xl border border-border bg-card/80 p-8 shadow-panel backdrop-blur-md sm:p-10">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border text-gold">
        <Lock className="size-5" aria-hidden="true" />
      </div>
      <h2 className="mt-6 text-center text-3xl">Private invitation</h2>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Enter the access code printed on your invitation to view the details and RSVP.
      </p>

      <form onSubmit={handle} className="mt-8 space-y-4">
        <div>
          <label htmlFor="access-code" className="mb-2 block text-[11px] tracking-luxe uppercase text-gold">
            Access code
          </label>
          <input
            id="access-code"
            name="access-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="LILAC-0000"
            maxLength={32}
            autoComplete="off"
            autoCapitalize="characters"
            aria-invalid={Boolean(shown)}
            className="w-full rounded-md border border-input bg-background/60 px-4 py-3 text-center text-lg tracking-[0.2em] text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        {shown ? (
          <p role="alert" className="text-center text-sm text-destructive">
            {shown}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium tracking-widest uppercase text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Unlock invitation
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Codes are unique to each guest and cannot be shared.
      </p>
    </div>
  );
}
