# Sign-in: Privy + GitHub / Google

stakestack signs users in with [Privy](https://privy.io), using GitHub or Google.
No embedded wallets are created. Without Privy keys the app runs exactly as before: the sign-in
button is hidden and `GET /api/me` answers `503`.

| Piece | File |
|---|---|
| Privy provider (GitHub + Google, wallets off) | `apps/web/components/auth/PrivyIsland.tsx` |
| Lazy loader, mounted once in the app layout | `apps/web/components/auth/AuthLoader.tsx` |
| Auth state for the rest of the app: `useAuth()` | `apps/web/components/auth/store.ts` |
| Header sign-in button and account menu | `apps/web/components/auth/AccountButton.tsx` |
| `fetch` that sends the access token | `apps/web/components/auth/useAuthedFetch.ts` |
| Server-side token check: `getSession(req)` | `apps/web/lib/privy.ts` |
| `GET /api/me`: the verified user id | `apps/web/app/api/me/route.ts` |

The Privy SDK is large (about 650 KB gzipped), so it loads as its own chunk after the page has
hydrated and only on the app pages; the landing page never loads it, and nothing is loaded when no
app id is configured. Components read the session with `useAuth()` instead of Privy's hooks.

## 1. Create the Privy app

1. Sign in at [dashboard.privy.io](https://dashboard.privy.io) and create an app (for example
   `stakestack`). Privy recommends a separate development app (for example `stakestack-dev`) for
   localhost and Vercel preview deployments.
2. **Configuration › App settings › Basics**: copy the **App ID** and the **App secret**. Privy does not
   store the secret, so save it now; a lost secret has to be regenerated.
3. **Configuration › App settings › Domains › Allowed origins** (production app): add
   `https://stakestack-eth.vercel.app`. Include `www` variants if you serve them. A development app
   does not need allowed origins; if you do restrict it, localhost must include the port
   (`http://localhost:3100`, `http://localhost:3000`).

## 2. Create the GitHub OAuth App

GitHub › **Settings › Developer settings › OAuth Apps › New OAuth App**
(for an organisation: the org's **Settings › Developer settings › OAuth Apps**).

| Field | Value |
|---|---|
| Application name | `stakestack` (shown on GitHub's consent screen) |
| Homepage URL | `https://stakestack-eth.vercel.app` |
| Authorization callback URL | `https://auth.privy.io/api/v1/oauth/callback` |
| Enable Device Flow | **off** (Privy requires it off) |

Register it, copy the **Client ID**, then **Generate a new client secret** and copy it once.
The callback goes to Privy, not to stakestack, so one OAuth App serves localhost and production.

## 3. Turn on GitHub in Privy

Privy dashboard › **Login methods › Socials › GitHub**: enable it, open the credentials dropdown and
paste the GitHub **Client ID** and **Client secret**. Custom credentials go live for every user as
soon as you save. Without them Privy uses its own shared GitHub app, which is fine for development
but shows Privy instead of stakestack on the consent screen.

## 3b. Google (optional second login method)

The app asks Privy for `['github', 'google']`; a method also has to be enabled in the Privy
dashboard to appear. With your own Google credentials, in [Google Cloud Console](https://console.cloud.google.com):

1. **Google Auth Platform › Branding**: app name and support email. Under **Authorized domains**
   add `privy.io` (the redirect goes to `auth.privy.io`). Adding a logo triggers Google's brand
   verification, so leave it out unless you plan to verify.
2. **Audience**: user type **External**, then **Publish app** so the status is **In production**.
   In **Testing** only listed test users can sign in. With only the basic `openid`, `email` and
   `profile` scopes no scope review is needed.
3. **Clients › Create client › Web application**:
   - Authorized redirect URI: `https://auth.privy.io/api/v1/oauth/callback`
   - Authorized JavaScript origins: none needed (Privy runs the OAuth exchange server-side)
4. Paste the Client ID and Client secret into Privy › **Login methods › Socials › Google**.

Changes in Google Cloud can take from a few minutes to a few hours to apply. Google sign-in may not
work inside in-app browsers (links opened from chat or social apps).

## 4. Environment variables

Locally, add them to the repository root `.env` (`apps/web/.env.local` is a symlink to it) and
restart `pnpm dev`:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id      # public, ends up in the browser bundle
PRIVY_APP_SECRET=your-privy-app-secret          # server only, never prefix with NEXT_PUBLIC_
# Optional: Configuration › App settings › verification key; skips one key fetch per server instance
PRIVY_JWT_VERIFICATION_KEY=
# Optional: an app client id when one Privy app serves several domains
NEXT_PUBLIC_PRIVY_CLIENT_ID=
```

On Vercel: **Project › Settings › Environment Variables**, add `NEXT_PUBLIC_PRIVY_APP_ID` and
`PRIVY_APP_SECRET` (production app for Production, development app for Preview), then redeploy.
`NEXT_PUBLIC_*` values are baked in at build time, so a redeploy is required after changing them.

## 5. Check it

1. Open `/build`, click **Sign in** in the header and finish the GitHub or Google prompt.
2. Open the account menu (your avatar). It asks the server to verify the session:
   **Session verified by the server** means the App ID and App secret match.
   **Server sign-in not configured** means `PRIVY_APP_SECRET` is missing on the server.
3. `GET /api/me` with `Authorization: Bearer <access token>` returns `{ userId, sessionId, expiresAt }`.

## Using the session in code

```ts
// API route
import { getSession } from '@/lib/privy';
export async function POST(req: Request) {
  const session = await getSession(req);          // null when signed out or the token is invalid
  if (!session) return Response.json({ error: 'sign in first' }, { status: 401 });
  // session.userId is the Privy user id (did:privy:...)
}

// client component inside the app layout
const { ready, authenticated, user, login } = useAuth();
const authedFetch = useAuthedFetch();
await authedFetch('/api/your-route', { method: 'POST', body: JSON.stringify(data) });
```

## Member stacks

Signed-in members save stacks to their account and can keep up to 50. On `/build` they get a
**My stacks** bar (open, switch, start new, delete), and their latest stack opens automatically.
Tools from their stacks are listed first in the builder (tagged **Yours**), and `/releases`
defaults to **My tools**. Guests can still save share links; after saving they are invited to sign
up, and the stack is saved to their new account once sign-in completes.

| Piece | File |
|---|---|
| Ownership table (`stack_owners`, RLS on, no API grants) | `supabase/migrations/0005_stack_owners.sql` |
| `GET/POST /api/my/stacks`, `PUT/DELETE /api/my/stacks/:id` | `apps/web/app/api/my/stacks/` |
| Validation and queries | `apps/web/lib/stacks.ts` |
| Client store: `useMyStacks()` | `apps/web/components/auth/myStacks.ts` |

Stacks stay public by slug, like anonymous share links. Who owns a stack is kept in
`stack_owners`, which the publishable key can neither read nor write, so nobody can list another
member's stacks or claim one. The web server writes it with the Supabase **secret key** after it has
verified the Privy session.

Setup:

1. Apply the migration: `pnpm db:migrate`.
2. Give the web server a secret key. Locally `SUPABASE_SECRET_KEY` from `.env` is used. On Vercel,
   create a separate secret key in Supabase (**Project Settings › API Keys**, name it
   `stakestack-web`) and add it as `SUPABASE_SECRET_KEY`. It is server-only: never prefix it with
   `NEXT_PUBLIC_`. Without it, member routes answer `503` and guests are unaffected.
