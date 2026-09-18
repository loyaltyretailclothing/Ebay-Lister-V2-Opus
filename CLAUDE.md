# eBay Listing App — Gen 2

AI-powered eBay listing tool. Two users (Shannon + Aaron), 200-400 listings/month.

## Core Rules (always apply)
- Discuss before coding: explain, propose, wait for "go ahead".
  "Don't make changes" = investigate only.
- Local dev and production share one Cloudinary account. Never write
  test/cleanup data to it; verify read-only. Never delete user data.
- Never handle secrets; users add API keys to Vercel/.env.local themselves.
- SKUs: required, never auto-generated, never reuse one ever used on eBay
  (live/sold/ended); check before any write to eBay; failed lookup = stop.
- Verify eBay rules against eBay's live API before stating them.
- Build before commit; never commit .claude/settings.local.json;
  push to main deploys to Vercel.

## Knowledge Base
Read `docs/Home.md` at the start of a session, and the relevant
`docs/` note before working on an area. Full rules: `docs/Rules.md`.
When something changes, update the matching note in the same session.

## Tech Stack
- Next.js (App Router) with Tailwind CSS on Vercel
- Anthropic Claude for AI photo analysis
- Cloudinary for photo storage
- eBay REST APIs (Inventory, Browse, Marketing) with OAuth 2.0

## Project Structure
- `src/app/` — Pages and API routes (App Router)
- `src/components/` — Reusable UI components
- `src/lib/` — Shared utilities (ebay.js, cloudinary.js, claude.js, constants.js)

## Key Conventions
- API routes use Next.js Route Handlers (`route.js`)
- eBay auth uses OAuth 2.0 refresh token flow (see `src/lib/ebay.js`)
- Photos fit inside 1600x1600 (shape kept) @80% for storage, 600px@70% for AI analysis
- All env vars listed in `.env.local.example`

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — ESLint

## Plan
See `GEN2-PLAN.md` for the full build plan and phase breakdown.
