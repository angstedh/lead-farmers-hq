# THE LEAD FARMERS — HQ

A self-hosted book-club portal. React + Vite front end, Supabase (Postgres)
for the shared reading list, meeting dates, and message board. Deploys to
Vercel or Netlify the same way a static site does.

---

## What you need
- A free **Supabase** account
- A **Vercel** or **Netlify** account (whichever your calendar uses)
- **Node 18+** if you want to run it locally first (optional)

---

## 1. Set up the database (Supabase)
1. Create a new project at supabase.com. Give it a database password (save it; you won't need it for this app).
2. Open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and click **Run**. That creates two tables (`app_kv`, `messages`) and their access policies.
3. Open **Project Settings → API**. Copy two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string)

---

## 2. (Optional) Run it locally
```bash
npm install
cp .env.example .env.local      # then paste your two values into .env.local
npm run dev
```
Open the printed `localhost` URL. Add a book — refresh — it persists. That means the database is wired correctly.

---

## 3. Put it on GitHub
```bash
git init && git add . && git commit -m "Lead Farmers HQ"
```
Create an empty repo on GitHub and push to it. (Vercel/Netlify deploy from the repo.)

---

## 4. Deploy

### Vercel
1. **Add New → Project**, import the GitHub repo.
2. Framework preset auto-detects **Vite** (build `npm run build`, output `dist`). Leave as-is.
3. **Environment Variables** → add both:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy.** You get a live URL.

### Netlify
1. **Add new site → Import an existing project**, pick the repo.
2. Build command `npm run build`, publish directory `dist`.
3. **Site settings → Environment variables** → add the same two `VITE_…` vars.
4. **Deploy site.**

> The `VITE_` prefix matters — Vite only exposes variables with that prefix to the browser. After changing env vars, trigger a fresh deploy so they're baked into the build.

---

## 5. Hand out the link
Send the deployed URL to the club. The gate accepts any code (it's theater), and each person gets a randomly assigned absurd call sign on entry. Everyone shares the same books, dates, and board.

---

## Security — read this
This is an **open** portal by design. The `anon` key ships in the browser bundle (normal for Supabase), and the schema's policies let that key read and write freely. In practice: **anyone who has the URL can use it, and a technical person who has the URL could write to the database directly.** For a joke book club that's fine — the URL itself is your "password."

If it ever needs real gating (members only, no free-for-all writes), the move is **Supabase Auth** plus tighter row-level-security policies. That's a contained change to `src/lib/` and the SQL — ask and I'll wire it.

---

## Customizing
- **Club name / motto:** edit them in the **HQ** tab in the running app (saved to the database), or change the defaults at the top of `src/App.jsx`.
- **Call-sign words / explosions / jungle:** all near the top of `src/App.jsx`.
- **On Firebase instead of Supabase?** The whole data layer is just `src/lib/supabase.js` + `src/lib/db.js`. Swap those two files for a Firebase implementation that exports the same functions (`kvGet`, `kvSet`, `listMessages`, `addMessage`, `deleteMessage`) and nothing else changes.

## Project layout
```
index.html
package.json
vite.config.js
supabase/schema.sql        ← run once in Supabase
src/
  main.jsx
  App.jsx                  ← the whole portal
  index.css
  lib/
    supabase.js            ← client (reads env vars)
    db.js                  ← data functions
```
