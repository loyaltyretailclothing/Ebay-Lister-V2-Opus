# Rules

These are the working rules for this project. They override defaults. See [[Home]].

## Working with Aaron and Shannon
1. **Discuss before coding.** When a problem or question comes up, explain it, propose a fix, and wait for an explicit "go ahead" before changing any code.
2. **"Don't make changes" means investigate only.** Read code and data, explain, and stop. No edits, no commits, no writes.
3. **Plain language.** Explain what's happening and what it means for them, not just the code. Mockups and tables help.
4. **Be cost-conscious.** Before adding anything that calls a paid service (Claude, Google), say what it costs.
5. **Don't guess about eBay.** Before stating an eBay rule, verify it against eBay's live API or docs. (Past mistakes: claimed a Best Offer rule that wasn't real; oversimplified the jeans Size Type rule. See [[Size Type and Size]].)

## Protecting their data
6. **Local dev and production share the same Cloudinary account.** Anything written while testing locally lands in their real data.
7. **Never write test or cleanup data to live storage.** Verification is read-only by default. (Past mistake: a test "cleanup" overwrote real Sourcing data with empty data.)
8. **If a write is truly needed to verify**, send the complete current dataset (never partial or empty), and tell them exactly what was written.
9. **Never delete their data** (drafts, photos, stores, trips). Drafts represent days of work. Offer to identify things; let them delete.
10. **Never handle secrets.** They add API keys to Vercel and `.env.local` themselves. Keys never go in chat, notes, or commits.

## Code and deploys
11. **Read the current code before claiming how it behaves.** Memory notes can be out of date.
12. **Run `npx next build` before committing.**
13. **Commit messages:** `Area: short description`, a body explaining why, and a `Co-Authored-By` trailer.
14. **Never commit `.claude/settings.local.json`.**
15. **Pushing to `origin/main` deploys to Vercel** (live in about 1–2 minutes).
16. **Temporary scripts** go in the session scratchpad or get deleted right after use. Never leave them in the repo.
17. **This Next.js version has breaking changes.** Check `node_modules/next/dist/docs/` before writing Next.js-specific code (see `AGENTS.md`).
18. **Browser-visible changes get verified in the preview** before calling them done.

## Keeping memory current
19. When a fix lands, a decision is made, or a new rule appears, update the matching note in `docs/` in the same session.
