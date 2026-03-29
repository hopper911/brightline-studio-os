# Vercel deployment

## Quick setup

1. **Import the repo** in [Vercel](https://vercel.com) and connect your Git provider.

2. **Root directory**  
   Leave empty (default)—this repo contains only Studio OS.

3. **Build command**  
   The default uses the `build` script: `prisma generate && next build`

4. **Environment variables**  
   - Optional for build: a placeholder `DATABASE_URL` is in `vercel.json` so Prisma can run `generate`.
   - For a working database: add `DATABASE_URL` in Project Settings → Environment Variables (e.g. Neon, Supabase Postgres).

5. **Deploy**  
   Push to the connected branch (e.g. `main`); Vercel deploys automatically.

## NextAuth sign-in (required)

Without these, `/api/auth/signin` shows **"There is a problem with the server configuration"**.

In **Vercel → Project → Settings → Environment Variables**, add for **Production** (and **Preview** if you use preview URLs for sign-in):

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | Random string (e.g. run `openssl rand -base64 32` locally). **Required** in production. |
| `NEXTAUTH_SECRET` | Optional; set to the **same value** as `AUTH_SECRET` if tools expect this name. |
| `AUTH_URL` | Canonical site URL, e.g. `https://your-project.vercel.app` (no trailing slash). |
| `NEXTAUTH_URL` | Optional alias; same value as `AUTH_URL` if you use older docs. |

**Resend** (magic-link email):

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | From [Resend](https://resend.com) dashboard. |
| `EMAIL_FROM` | Verified sender, e.g. `Studio OS <onboarding@yourdomain.com>`. |

After saving, **redeploy** (Deployments → … → Redeploy) or push a new commit.

## Notes

- Without a real `DATABASE_URL`, CRM and Projects API routes will show "Database not configured".
- To enable them, add a Postgres URL (e.g. Neon) and redeploy.
