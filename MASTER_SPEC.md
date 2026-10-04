# 🐾 Study Paws — MASTER SPEC V1

## 1. Product goal

Study Paws is a mobile-first medical study PWA. Its job is not merely to summarize files. It should behave like a study tutor that already knows how to organize the user's material, select the right context, preserve provenance, adapt to the study mode, and only then call AI for synthesis/explanation.

The app should make as many deterministic decisions locally as possible so the AI is not repeatedly asked to reinvent workflow, source hierarchy, pedagogy, chunking, or context selection.

## 2. Non-negotiable principles

1. Never put an OpenAI API key in the frontend, GitHub Pages, localStorage, exported backups, or committed files.
2. Preserve source provenance.
3. Never silently replace what the teacher taught with external information.
4. If sources disagree, expose the discrepancy and its context.
5. Do not send every document in full when selective retrieval is sufficient.
6. Do not mark a topic mastered merely because it was read.
7. Keep understanding, recall, application, and defense as separate mastery dimensions.
8. Prefer explanation before tables; tables are consolidation, not the primary teaching method.
9. Preserve real slide/page order when using slide-by-slide mode.
10. Do not invent slides or claim a source says something it does not support.
11. When the user is stuck, repair the smallest broken conceptual link instead of adding more content.
12. Avoid broad rewrites when a targeted change is sufficient.

## 3. Study Paws Brain

### Global learning pattern

Default pedagogical flow:

big picture → causal explanation → structured guide → close source → reconstruct from memory → active recall → application → targeted feedback → retry

Preferred explanation:

what is it → normal state → what changes → why → consequences → clinical expression → how to detect it → what decision changes

Avoid:

- isolated lists
- tables as first explanation
- superficial “high yield”
- unprioritized information
- difficult cases before a minimum framework exists

Mastery dimensions:

- UNDERSTAND
- RECALL
- APPLY
- DEFEND

### Medicina Interna · Materia

Role: internal medicine exam tutor.

Teacher material determines evaluative scope. PPT/PDF and transcript are the core teaching layer; guidelines and textbooks expand or update without silently overwriting teacher content.

Typical guide structure:

short big picture → real class structure → pathophysiology → clinical features from mechanism → tests (what / why / what changes) → diagnosis and differentials → treatment and rationale → key doses/contraindications → follow-up → exam traps → professor follow-ups → mini-cases

### Medicina Interna · Práctica

Role: clinical reasoning tutor.

Organize knowledge from the patient, not from the textbook chapter:

patient presentation → main problem → syndrome → severity/urgency → dangerous differentials → targeted history → physical exam → tests and purpose → interpretation → initial management → treatment → reassessment → follow-up/referral

### Farmacología

Role: pharmacology + clinical decision tutor.

Default chain:

clinical problem → pharmacologic target → mechanism → physiologic change → clinical effect → indication/choice → dose/route/interval → PK → metabolism/elimination → adverse effects from mechanism → contraindications → interactions → monitoring → comparison/alternative

Understand primarily:

mechanisms, choice logic, adverse effect reasoning, interactions, contraindication logic

Memorize primarily:

doses, intervals, half-lives, important CYPs, monitoring values, non-deducible exceptions

## 4. Source policy

Each file can be:

- Auto
- Core
- Support
- Exclude

The PWA should rank sources before AI use.

Core teacher materials should retain high priority. Excluded files should not be sent.

When PPT/PDF + transcript appear to belong to the same class, pair them and preserve the relationship.

The app should store why a source was excluded when useful.

## 5. Smart Class Engine

Current architecture already supports:

- local indexing
- slide/page-aware chunks
- transcript chunks
- PPT/PDF ↔ transcript pairing
- deep alignment between slides and transcript fragments
- selective retrieval
- provenance
- Context Inspector
- first slide block inspection before paid generation

For slide-by-slide generation, prefer small blocks (roughly 5 slides) so detail is preserved and failures are recoverable.

Images should be rendered/resolved only when needed for the current AI block, not preloaded for every request.

## 6. Prompt package

The backend should receive a package that is already structured by the PWA:

- active Brain profile
- study task metadata
- source policy
- selected context fragments
- provenance
- relevant page/slide numbers
- visual inputs only when useful
- current block identity
- study mode and depth

The AI should synthesize and teach. It should not decide from scratch which course mode exists, which files matter, or how the study workflow works.

## 7. AI pipeline

Current preferred architecture:

Study Paws PWA → personal backend token → Vercel Function → OPENAI_API_KEY secret → OpenAI Responses API

Backend routes:

- GET /health
- POST /v1/generate

Secrets belong only in Vercel:

- OPENAI_API_KEY
- STUDY_PAWS_ACCESS_TOKEN

Configurable:

- OPENAI_MODEL
- REASONING_EFFORT
- ALLOWED_ORIGIN

Cloudflare files are retained as an alternative, but Vercel is the current primary route.

## 8. Cost and reliability

Generation is block-based and resumable.

Requirements:

- keep completed blocks if a later block fails
- allow pause/resume
- show token/cost information when available
- enforce budget guardrails
- never burn the whole class budget on an unapproved first run
- first real validation should use one small block

## 9. First real validation target

Source/class:

Farmacoterapia de IC

Validation block:

Slides 1–5 only.

Goal:

prove that the full local pipeline works before generating the entire class:

document → extraction → indexing → alignment/retrieval → context inspection → prompt package → backend → OpenAI → saved result

The first output should be reviewed manually before approving the rest of the class.

## 10. Output quality target for slide-by-slide study guides

For each slide/block, when supported by source material:

- guiding question
- what the slide is teaching
- integrated explanation
- mechanism / pathophysiology when relevant
- clinical correlation
- tests: what / why / what changes
- treatment / rationale when relevant
- UNDERSTAND
- MEMORIZE
- exam trap
- professor follow-up
- mini-case when useful

For Pharmacology, additionally prioritize:

- drug/target
- mechanism
- indication
- dose/route/interval
- PK/metabolism
- adverse effects
- contraindications
- interactions
- monitoring
- why this drug vs another

Do not force every subsection when the slide does not support it.

## 11. Knowledge state

Current conceptual model:

0 = not assessed
1–4 = increasing confidence for each dimension

Dimensions:

- understand
- recall
- apply
- defend

Future quizzes should update these dimensions separately instead of collapsing them into one score.

## 12. Near-term roadmap

Priority order:

1. Confirm local app still runs after any changes.
2. Deploy/configure Vercel backend without exposing secrets.
3. Test /health.
4. Run one approved real AI generation: Farmacoterapia de IC slides 1–5.
5. Inspect content quality, provenance, usage and cost.
6. Fix only demonstrated problems.
7. Approve full class generation if the first block is good.
8. Make provenance visible in final generated guides.
9. Add active recall from guides.
10. Add diagnostic correction.
11. Add rescue mode.
12. Only later consider external-source research, automatic long-term preference learning, or fine-tuning.

## 13. Coding rules for Codex

Before editing:

- inspect current repository state
- read README.md, ROADMAP.md, this MASTER_SPEC.md, and relevant implementation files
- do not assume old documentation is fully current if code says otherwise

When editing:

- prefer small, reversible commits
- preserve local-first behavior
- preserve GitHub Pages compatibility
- preserve current PWA/service-worker update behavior
- do not commit secrets
- do not remove working features just to simplify architecture
- do not introduce a framework/build system unless clearly justified
- reuse existing modules before creating duplicates
- run syntax/static checks where possible
- state what changed, what was tested, and what remains unverified

## 14. Definition of success

Study Paws is successful when the AI is the last intelligent synthesis layer, not the first.

The PWA should already know:

- who is teaching
- how the user learns
- what mode is active
- which sources matter
- how those sources relate
- what context to send
- how much to send
- what part is being generated
- what was already completed
- how much the call may cost

Then the AI can focus on the part it is best at: understanding the selected evidence and teaching it well.
