import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import {
  CEREMONY_OPTIONS,
  MEAL_OPTIONS,
  WEDDING,
  createRsvpSchema,
  type CeremonyChoice,
  type CreateRsvpInput,
} from "@/lib/invite";

const labelClass = "mb-2 block text-[11px] tracking-luxe uppercase text-gold";
const fieldClass =
  "w-full rounded-md border border-input bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40";

/**
 * The first thing a guest sees. Nothing is gated: they tell us who they are and
 * what they are coming to, and the reply is what earns them an access code.
 */
export function RsvpRegisterForm({
  onSubmit,
  pending,
}: {
  onSubmit: (input: CreateRsvpInput) => Promise<void>;
  pending: boolean;
}) {
  const [fullName, setFullName] = useState("");
  const [attending, setAttending] = useState<boolean | null>(null);
  const [ceremonies, setCeremonies] = useState<CeremonyChoice | null>(null);
  const [mealChoice, setMealChoice] = useState("");
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (attending === null) {
      setError("Please let us know whether you can join us.");
      return;
    }

    const parsed = createRsvpSchema.safeParse({
      fullName,
      attending,
      ceremonies: attending ? (ceremonies ?? undefined) : undefined,
      mealChoice: attending ? mealChoice : "",
      dietaryNotes: attending ? dietaryNotes : "",
      message,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your response and try again.");
      return;
    }

    setError(null);
    await onSubmit(parsed.data);
  };

  return (
    <div className="w-full animate-rise rounded-xl border border-border bg-card/80 p-7 shadow-panel backdrop-blur-md sm:p-9">
      <h2 className="text-3xl">Kindly RSVP</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Reply by {WEDDING.rsvpBy}. Once you do, we will issue your personal access code, and that
        code opens your access card.
      </p>

      <form onSubmit={handle} className="mt-7 space-y-6">
        <div>
          <label htmlFor="full-name" className={labelClass}>
            Your full name
          </label>
          <input
            id="full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="As you would like it printed on your card"
            maxLength={120}
            autoComplete="name"
            required
            className={fieldClass}
          />
        </div>

        <fieldset>
          <legend className={labelClass}>Will you be joining us?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceButton
              selected={attending === true}
              onClick={() => setAttending(true)}
              icon={<Check className="size-4" aria-hidden="true" />}
              label="Joyfully accepts"
            />
            <ChoiceButton
              selected={attending === false}
              onClick={() => setAttending(false)}
              icon={<X className="size-4" aria-hidden="true" />}
              label="Regretfully declines"
            />
          </div>
        </fieldset>

        {attending ? (
          <>
            <fieldset>
              <legend className={labelClass}>Which celebrations will you attend?</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {CEREMONY_OPTIONS.map((option) => (
                  <ChoiceButton
                    key={option.value}
                    selected={ceremonies === option.value}
                    onClick={() => setCeremonies(option.value)}
                    label={option.label}
                    hint={option.hint}
                  />
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="meal-choice" className={labelClass}>
                Meal preference
              </label>
              <select
                id="meal-choice"
                value={mealChoice}
                onChange={(e) => setMealChoice(e.target.value)}
                className={fieldClass}
              >
                <option value="">No preference</option>
                {MEAL_OPTIONS.map((meal) => (
                  <option key={meal} value={meal}>
                    {meal}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="dietary" className={labelClass}>
                Dietary notes
              </label>
              <input
                id="dietary"
                value={dietaryNotes}
                onChange={(e) => setDietaryNotes(e.target.value)}
                placeholder="Allergies or anything our kitchen should know"
                maxLength={300}
                className={fieldClass}
              />
            </div>
          </>
        ) : null}

        <div>
          <label htmlFor="message" className={labelClass}>
            A note to the couple
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share a wish or a blessing"
            maxLength={500}
            rows={3}
            className={`${fieldClass} resize-none`}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium tracking-widest uppercase text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? "Sending…" : "Send RSVP & get my code"}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          One seat is reserved per reply. Need more? Tell us in the note above.
        </p>
      </form>
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  icon,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-center justify-center gap-1 rounded-md border px-4 py-3 text-center transition ${
        selected
          ? "border-gold bg-gold/10 text-gold"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="flex items-center gap-2 text-xs tracking-widest uppercase">
        {icon}
        {label}
      </span>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </button>
  );
}
