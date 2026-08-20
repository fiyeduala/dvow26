import { useState } from "react";
import { Check, Loader2, PartyPopper, PencilLine, X } from "lucide-react";
import {
  CEREMONY_OPTIONS,
  MEAL_OPTIONS,
  WEDDING,
  ceremonyLabel,
  rsvpSchema,
  type CeremonyChoice,
  type Guest,
  type RsvpInput,
} from "@/lib/invite";

const labelClass = "mb-2 block text-[11px] tracking-luxe uppercase text-gold";
const fieldClass =
  "w-full rounded-md border border-input bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40";

export function RsvpForm({
  guest,
  onSubmit,
  pending,
}: {
  guest: Guest;
  onSubmit: (input: RsvpInput) => Promise<void>;
  pending: boolean;
}) {
  const hasReplied = Boolean(guest.responded_at);
  const [editing, setEditing] = useState(!hasReplied);
  const [attending, setAttending] = useState<boolean | null>(guest.attending);
  const [ceremonies, setCeremonies] = useState<CeremonyChoice | null>(
    (guest.ceremonies as CeremonyChoice | null) ?? null,
  );
  const [mealChoice, setMealChoice] = useState(guest.meal_choice ?? "");
  const [plusOneName, setPlusOneName] = useState(guest.plus_one_name ?? "");
  const [dietaryNotes, setDietaryNotes] = useState(guest.dietary_notes ?? "");
  const [message, setMessage] = useState(guest.message ?? "");
  const [error, setError] = useState<string | null>(null);

  // A plus one only makes sense when more than the guest's own seat is reserved.
  const allowsPlusOne = guest.seats > 1;

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (attending === null) {
      setError("Please let us know whether you can join us.");
      return;
    }

    const parsed = rsvpSchema.safeParse({
      attending,
      ceremonies: attending ? (ceremonies ?? undefined) : undefined,
      mealChoice: attending ? mealChoice : "",
      plusOneName: attending && allowsPlusOne ? plusOneName : "",
      dietaryNotes: attending ? dietaryNotes : "",
      message,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your response and try again.");
      return;
    }

    setError(null);
    await onSubmit(parsed.data);
    setEditing(false);
  };

  if (hasReplied && !editing) {
    return <RsvpSummary guest={guest} onEdit={() => setEditing(true)} />;
  }

  return (
    <div className="animate-rise rounded-xl border border-border bg-card/80 p-7 shadow-panel backdrop-blur-md sm:p-9">
      <h3 className="text-2xl">Will you be joining us?</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Kindly reply by {WEDDING.rsvpBy}. You can change your response at any time before then.
      </p>

      <form onSubmit={handle} className="mt-7 space-y-6">
        <fieldset>
          <legend className={labelClass}>Your response</legend>
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

            {allowsPlusOne ? (
              <div>
                <label htmlFor="plus-one" className={labelClass}>
                  Name of your guest
                </label>
                <input
                  id="plus-one"
                  value={plusOneName}
                  onChange={(e) => setPlusOneName(e.target.value)}
                  placeholder="Who is joining you?"
                  maxLength={100}
                  className={fieldClass}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {guest.seats} seats are reserved in your name.
                </p>
              </div>
            ) : null}

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

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium tracking-widest uppercase text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {hasReplied ? "Update response" : "Send response"}
          </button>
          {hasReplied ? (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-border px-4 py-3 text-xs tracking-widest uppercase text-muted-foreground transition hover:text-foreground"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function RsvpSummary({ guest, onEdit }: { guest: Guest; onEdit: () => void }) {
  const responded = guest.responded_at
    ? new Date(guest.responded_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="animate-rise rounded-xl border border-border bg-card/80 p-7 shadow-panel backdrop-blur-md sm:p-9">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-luxe uppercase text-gold">Your response</p>
          <h3 className="mt-2 flex items-center gap-2 text-2xl">
            {guest.attending ? (
              <>
                <PartyPopper className="size-5 text-lilac" aria-hidden="true" />
                We can’t wait to celebrate with you
              </>
            ) : (
              "You will be missed"
            )}
          </h3>
          {responded ? (
            <p className="mt-2 text-sm text-muted-foreground">Received {responded}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-2 rounded-md border border-gold/50 px-3 py-2 text-xs tracking-widest uppercase text-gold transition hover:text-foreground"
        >
          <PencilLine className="size-3.5" aria-hidden="true" /> Change response
        </button>
      </div>

      {guest.attending ? (
        <>
          <div className="rule-gold my-7 w-full" />
          <dl className="grid gap-5 sm:grid-cols-2">
            <SummaryItem label="Attending" value={ceremonyLabel(guest.ceremonies)} />
            <SummaryItem label="Meal preference" value={guest.meal_choice ?? "No preference"} />
            {guest.plus_one_name ? (
              <SummaryItem label="Joining you" value={guest.plus_one_name} />
            ) : null}
            {guest.dietary_notes ? (
              <SummaryItem label="Dietary notes" value={guest.dietary_notes} />
            ) : null}
            {guest.message ? <SummaryItem label="Your note" value={guest.message} /> : null}
          </dl>
        </>
      ) : guest.message ? (
        <>
          <div className="rule-gold my-7 w-full" />
          <dl className="grid gap-5">
            <SummaryItem label="Your note" value={guest.message} />
          </dl>
        </>
      ) : null}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-luxe uppercase text-gold">{label}</dt>
      <dd className="mt-1 text-sm text-foreground/90">{value}</dd>
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-xs tracking-widest uppercase transition ${
        selected
          ? "border-gold bg-gold/10 text-gold"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
