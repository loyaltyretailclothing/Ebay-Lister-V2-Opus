# eBay Listing App — Gen 2

AI-powered eBay listing tool. Two users (Shannon + Aaron), 200-400 listings/month.

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
- Photos resize to 1600x1600@75% for storage, 800px@75% for AI analysis
- All env vars listed in `.env.local.example`

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — ESLint

## Plan
See `GEN2-PLAN.md` for the full build plan and phase breakdown.
