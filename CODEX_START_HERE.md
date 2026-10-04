# 💻 Codex — START HERE

You are working on the repository `study-paws-4real`.

First read:

1. `MASTER_SPEC.md`
2. `README.md`
3. `ROADMAP.md`
4. `js/brain.js`
5. `js/smart-class.js`
6. `js/study-retrieval.js`
7. `js/prompt-builder.js`
8. `js/ai-runner.js`
9. `backend/README.md`

Do not begin by rewriting the app.

## Current mission

Audit the repository as it exists now and prepare it for the FIRST REAL SAFE AI TEST using the Farmacoterapia de IC class, slides 1–5 only.

### Step 1 — Audit without changing behavior

Check:

- PWA boots locally
- imports resolve
- service worker asset list matches real files
- no OpenAI API key exists in frontend or tracked files
- Vercel backend routes resolve logically
- `/health` and `/v1/generate` contracts match the frontend client
- budget guard still prevents accidental full-class spending
- generation jobs preserve completed blocks
- slide images are resolved only at AI request time
- first test can be limited to slides 1–5
- context package preserves provenance

Report findings before making large changes.

### Step 2 — Fix only blockers

If the audit reveals blockers, make the smallest safe changes needed.

Do not redesign UI or architecture during this step.

### Step 3 — Local verification

Run whatever local/static checks are appropriate for this vanilla-JS PWA and backend.

At minimum:

- syntax/import sanity
- local static server smoke test if available
- backend handler import/syntax check
- check that no secret is committed

### Step 4 — Stop before paid generation

Do NOT make an OpenAI API call automatically.

When the repo is ready for the first paid call, stop and report:

- exact setup still required in Vercel
- exact environment variables needed
- exact Study Paws settings needed
- estimated scope of the first test
- what button/action will trigger slides 1–5 only
- what evidence we should inspect in the result

The user should explicitly approve the first real paid call.

## Product intent

Study Paws should make deterministic study decisions locally and use AI only for synthesis/teaching.

Never move the OpenAI API key into the PWA.
Never silently override teacher material with external knowledge.
Never send the entire corpus when selective context is enough.
