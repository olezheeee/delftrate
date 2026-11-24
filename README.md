# DelftRate

A student-run site where TU Delft students rate their courses: the subject and the professor who teaches it, combined into one score that says what is coming and how to study for it. Raters unlock invitations from student teams.

DelftRate is an independent student project and is not affiliated with or endorsed by TU Delft.

## Status

`index.html` is the approved demonstration (fictional data, no backend). Open it in a browser, or run:

```bash
python3 -m http.server 5599 --bind 127.0.0.1
```

The real application is being built on the `develop` branch.

## Stack

- **Next.js** (App Router, React, TypeScript): pages and server logic in one codebase, in `app/`.
- **Supabase**: Postgres database and sign-in. Clients are in `lib/supabase/`.
- **Vercel**: hosting, with a preview link per pull request (not connected yet).
- **ESLint, TypeScript, Vitest**: run on every pull request by `.github/workflows/ci.yml`.

## Running the app

You need Node.js 24 or 26 (the LTS releases). First time on this project? Follow [SETUP.md](SETUP.md).

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

To talk to the database, copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key (ask a lead). Never commit `.env.local`.

Pages that use the server client (`lib/supabase/server.ts`) read cookies, so the component that calls it must be inside a `<Suspense>` boundary; otherwise `npm run build` fails.

Before you press **Ready for review**, run the same checks as the pull request does:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Working on it

New here? Follow [SETUP.md](SETUP.md) first. Then read [CONTRIBUTING.md](CONTRIBUTING.md). In short: start each session with `/start-session`, work on a `task/...` branch, and send it to `develop` through a pull request.
