import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { claimAdmin } from "@/lib/admin";

const title = "Host sign in — Victoria & Daniel #DEVOW2026";
const description = "Private sign in for the wedding hosts to manage guest access codes, seats and venue details.";

export const Route = createFileRoute("/auth")({
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
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (signUpError) throw signUpError;
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setNotice("Check your inbox to confirm the address, then sign in.");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
      await claimAdmin();
      await navigate({ to: "/admin", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-16">
      <div className="veil pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card/80 p-8 shadow-panel backdrop-blur-md">
        <p className="text-[11px] tracking-luxe uppercase text-gold">#DEVOW2026</p>
        <h1 className="mt-3 text-3xl text-gilded">Host access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to manage guest codes, seats and venue details."
            : "Create the host account. The first account becomes the admin."}
        </p>
        <div className="rule-gold my-6 w-full" />

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-[11px] tracking-luxe uppercase text-gold">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-[11px] tracking-luxe uppercase text-gold">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="text-sm text-lilac">{notice}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-primary px-4 py-3 text-xs tracking-luxe uppercase text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create host account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
          className="mt-5 text-xs tracking-widest uppercase text-muted-foreground transition hover:text-foreground"
        >
          {mode === "signin" ? "Need a host account?" : "Already have an account?"}
        </button>

        <div className="mt-6 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Back to the invitation
          </Link>
        </div>
      </div>
    </main>
  );
}
