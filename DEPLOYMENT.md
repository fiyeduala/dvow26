# Deploying the #DVow2026 Guest Entry Pass

**Stack:** TanStack Start v1 (React 19 + TypeScript), Vite 7 build, Nitro server output,
Tailwind CSS v4, Supabase backend (guests, access codes, event settings, admin auth).

This is a **server-rendered app**, not a static site. It must be deployed to a host that
can run the generated server bundle (Cloudflare Workers, Netlify, Vercel, Node, Docker).
A plain static file host (S3, GitHub Pages, cPanel HTML hosting) will not work.

---

## 1. Get the code onto GitHub

In the Lovable editor: **top-right GitHub button → Connect project → authorize → Create
repository**. This requires your GitHub OAuth authorization; it cannot be done for you.
After that, every change syncs both ways.

Locally:

```sh
git clone <your-repo-url>
cd <repo>
npm install        # or bun install
```

## 2. Backend (database + auth)

Option A — keep using the existing managed backend (nothing to do; just copy the env vars).

Option B — run your own Supabase project:

1. Create a Supabase project.
2. Apply every file in `supabase/migrations/` **in filename order** (SQL editor, or
   `supabase db push` with the Supabase CLI).
3. Auth settings: keep anonymous sign-ups disabled, keep email confirmation on, add Google
   OAuth credentials if you want Google sign-in.
4. Add your production domain to **Auth → URL Configuration** (Site URL + Redirect URLs),
   otherwise host sign-in links bounce back to the wrong origin.
5. The first host account that signs up at `/auth` claims the admin role via `claim_admin()`.

## 3. Environment variables

Copy `.env.example` to `.env` and fill in your project's URL and publishable key, and set the
same variables in your host's dashboard.

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` are baked
  into the browser bundle at **build time** — they must exist before `npm run build`.
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` are read during SSR.
- Never set a service-role key in a `VITE_*` variable. The app does not need one.
- `.env` is git-ignored; only `.env.example` is committed.

## 4. Build and run locally

```sh
npm run dev        # local development
npm run build      # production build -> dist/client + dist/server
npm run preview    # serve the production build locally
```

## 5. Deploy

The build targets **Cloudflare Workers** by default and emits `dist/server/wrangler.json`.

- **Cloudflare Workers/Pages** (default)
  ```sh
  npm run build
  npx wrangler deploy -c dist/server/wrangler.json
  ```
  Set the `VITE_*` vars in CI/build settings and the `SUPABASE_*` vars as Worker vars.
- **Netlify** — `NITRO_PRESET=netlify npm run build`, publish the generated output.
- **Vercel** — `NITRO_PRESET=vercel npm run build`.
- **Node / Docker / VPS** — `NITRO_PRESET=node_server npm run build`, then run
  `node dist/server/index.mjs` behind Nginx or a process manager (PM2, systemd).

## 6. Domain and SSL

Point your domain's DNS at your host and let it issue the TLS certificate. Then add that
domain to Supabase Auth → URL Configuration (step 2.4).

If you'd rather not manage builds and certificates, publish from Lovable and attach the same
domain in Project Settings → Domains — SSL is automatic there.

## Notes

- `src/routeTree.gen.ts` is generated — never edit it by hand.
- All data access runs through the browser Supabase client with RLS plus SQL
  `SECURITY DEFINER` functions (`verify_access_code`, `submit_rsvp`, `claim_admin`); there
  are no server secrets in the app runtime.
- Guest access codes are normalized (uppercased, non-alphanumerics stripped) in the database
  functions, so `LILAC-4821` and `lilac4821` both work.
- Guest list CSV import and per-guest invitation PNG download run entirely client-side.
