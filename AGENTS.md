# AGENTS.md

All project instructions for this repo are in `CLAUDE.md`. Read it completely before doing anything and follow it exactly, in particular section 4 (only change files in your owner's area), section 5 (fixed contracts) and section 11 (test before saying "done").

## UI workflow

For any UI, frontend or design task:

1. Use Impeccable (`impeccable`) and Taste Skill (`design-taste-frontend`) for design decisions. Avoid purple gradients, glass panels, nested cards, oversized corner radii, fake metrics and vague SaaS copy.
2. After building, use `playwright-cli` to take browser screenshots at mobile and desktop widths. Inspect both, fix visible problems and retake affected screenshots.
3. Finish with a Hallmark (`hallmark`) review and fix its findings before reporting done.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
