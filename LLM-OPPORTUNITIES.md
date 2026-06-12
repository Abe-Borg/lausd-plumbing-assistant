# LLM Integration Opportunities

The core engine is deliberately deterministic — no LLM in the resolution pipeline. These opportunities all live at the **periphery**: LLM suggests or explains, human confirms, engine stays byte-identical.

---

## 1. Exception Card Resolution Assistant

**What:** When the engine can't resolve a room deterministically, it queues an exception card for human review (e.g., "Is Room 14 a K-3 or 4-6 classroom?"). An LLM looks at the room name, program notes, and grade band context and surfaces a ranked suggestion with a short rationale. The designer still clicks Confirm — the LLM never writes to the decision store directly.

**Why it matters:** Most designers treat the queue as a chore. Good suggestions turn a 30-second-per-card slog into a one-click review. Reduces errors from fatigue.

### Draft Implementation Plan

- Add an optional `suggest(card, project_context) → { value, rationale, confidence }` hook to the exception card contract.
- Call Claude with the card fields + relevant KB excerpt (fixture family, rule text, room taxonomy) as context. System prompt: return structured JSON, never invent a code section.
- Render suggestion inline on the card UI with a confidence badge; Confirm/Override buttons unchanged.
- Log accepted vs. overridden suggestions per session for future fine-tuning signals.
- No API key → feature silently absent (cards still work normally).

---

## 2. Plain-English Decision Explanations

**What:** Every resolved fixture gets a citation (e.g., `CBC Table 422.1, row K-6-Admin`). An LLM turns that citation + the rule text into a readable sentence: "Two water closets are required because this room is classified as a K–6 administrative space serving more than 25 occupants (CBC Table 422.1)."

**Why it matters:** Engineers stamp drawings but junior staff write the basis-of-design narratives. Auto-explaining each fixture count saves hours and reduces transcription errors.

### Draft Implementation Plan

- Add an `explain` field (optional, nullable) to the fixture schedule output schema.
- On-demand: "Explain" button per row fetches `explain(fixture_row, kb_rule_record) → string` from a thin API route or edge function.
- Prompt includes: room classification, fixture family, rule text verbatim, occupant count. Instruction: one sentence, cite the exact section already on the record, no additions.
- Cache by `(fixture_id, rule_id, occupant_count)` — same inputs, same output, store in localStorage alongside decisions.
- Bulk "Explain All" generates a basis-of-design section ready to paste into the project narrative.

---

## 3. Natural Language Q&A over the KB

**What:** A chat-style interface where a designer asks "What fixtures are required for a food prep room?" or "Does LAUSD require a mop sink in every custodial space?" and gets an answer grounded strictly in the existing KB records — no hallucinated code sections.

**Why it matters:** Designers currently grep PDFs. The KB already has every relevant record with citations. RAG over it is straightforward and dramatically faster than manual lookup.

### Draft Implementation Plan

- Build a retrieval layer: embed all KB records (fixture families, rules, profiles) at build time using `text-embedding-3-small` or equivalent; store vectors in a flat JSON file bundled with the app or served from a tiny edge function.
- At query time: embed the question, cosine-rank top-5 KB records, inject verbatim into Claude prompt with instruction: "Answer using only the provided records. If the answer is not in the records, say so."
- UI: collapsible chat panel in the web app, input box + scrollable thread, each answer shows which KB records were cited with links to `SOURCES.md`.
- Guardrail: response must include at least one KB record ID or return a "not in KB" message. Post-process to strip any answer that references a document not in the retrieved set.
- Offline-first variant: run a small local embedding model + `llama.cpp` if network unavailable (phase 2).

---

## 4. Standards Document → KB Record Parser

**What:** When LAUSD issues a new plumbing addendum or a new code cycle drops, a designer uploads the PDF. An LLM extracts structured KB records (fixture families, rules, citations) as draft JSON. A human reviews the diff, edits if needed, and merges — same append-only KB process as today.

**Why it matters:** Maintaining the KB by hand is the single biggest scaling bottleneck. A document is typically 20–80 pages; manual extraction takes days. LLM drafting + human review takes hours.

### Draft Implementation Plan

- Build a standalone CLI script (`packages/kb-ingest/ingest.ts`): accepts a PDF path, calls a document extraction API (e.g., Claude with file upload or PDF-to-text pre-processing), outputs candidate JSON records in the existing KB schema.
- Prompt: provide current KB schema + one or two exemplar records; ask for extraction only, no inference beyond what the document states; include exact page numbers in every citation.
- Output: a `draft-YYYYMMDD.json` file in `packages/kb/data/drafts/`. The existing KB loader ignores `drafts/` — records are only live after manual promotion.
- Diff tool: `npm run kb:diff draft-YYYYMMDD.json` prints new records, modified records, and conflicts against the current KB for human review.
- Validation: run AJV against the existing KB schema before writing any draft file; reject any record missing `source_doc`, `section`, `page`.

---

## 5. Delta Narration

**What:** When a designer imports a v2 room program, the app already shows a structured diff (rooms added, removed, reclassified, counts changed). An LLM writes a one-paragraph change summary in plain English suitable for a project log or meeting notes.

**Why it matters:** Project managers need to communicate scope changes to clients and contractors. Translating a table of diffs into a coherent paragraph is mechanical but time-consuming. This is a pure quality-of-life feature.

### Draft Implementation Plan

- Pass the structured delta object (already computed by the engine) to `narrate(delta) → string` after every v2 import.
- Prompt: provide the delta as JSON + the project name + date; ask for one paragraph, past tense, no invented details, flag any net fixture count change with the exact number.
- Render in the Delta screen below the existing diff table with a "Copy to clipboard" button.
- If the delta is empty (no changes), skip the LLM call and render "No changes detected."
- No streaming needed — delta is computed synchronously, narration can be a single blocking call before the screen renders.

---

## Shared Infrastructure Notes

All five features can share:
- A single `packages/llm/` client wrapper with model config, retry logic, and a dead-simple `call(systemPrompt, userPrompt) → string` interface.
- One `ANTHROPIC_API_KEY` env var; when absent, all features degrade gracefully to their no-LLM baseline.
- A `llm_calls` log in localStorage (prompt hash, model, latency, feature tag) for debugging and future cost analysis.
