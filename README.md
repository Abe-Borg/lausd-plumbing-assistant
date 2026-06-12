# LAUSD Plumbing Assistant — Standards/Decision Engine

**Where project facts become LAUSD-compliant plumbing decisions.** Load a room program →
deterministic LAUSD decisions auto-resolve with citations → the designer clears a short
exception-card queue → out come the fixture schedule, the fixture-to-occupant
tabulation, and the water-temperature service matrix. Re-import a revised room program
and no human decision is ever lost.

The MVP is specified in [`plans/mvp-implementation-plan.md`](plans/mvp-implementation-plan.md)
(authoritative). Planning record: [`NOTES.md`](NOTES.md). Input contracts:
[`contracts/`](contracts/). Demo project: [`synthetic/vista-del-sol/`](synthetic/vista-del-sol/).

## Layout

| Path | What |
|---|---|
| `packages/engine/` | Pure TypeScript decision engine: `(inputs, kb, decisions) → result`. No DOM, no I/O, no network, no randomness. |
| `packages/kb/` | Knowledge-base content as JSON (every record cited) + typed loader. `SOURCES.md` indexes records → source documents. |
| `apps/web/` | Vite + React single-page app. No backend; state persists in localStorage. |
| `contracts/` | Normative input contracts + the published room-type taxonomy (append-only codes). |
| `synthetic/vista-del-sol/` | Synthetic demo project (43 rooms, K-5, all-electric). |
| `OPEN-QUESTIONS.md` | Domain facts awaiting human verification; every `draft` KB record points here. |

## Commands

```bash
npm install              # once (Node 20.19+ or 22.12+, per Vite 7)
npm test                 # vitest, includes determinism golden tests
npm run typecheck        # strict tsc across workspaces
npm run lint             # eslint
npm run dev              # the web app
npm run build:singlefile # one self-contained dist/index.html — open by double-click, no server
```

Projects load at runtime: the app opens to a load screen where the user picks a
`dossier.json` + `room_program.json` pair (validated against `contracts/` on the spot).
One built artifact serves every project; the Vista del Sol sample ships bundled and can
be staged from the load screen. Decisions persist in localStorage per `project_id`.

Hard rules for contributors (plan §0): deterministic core, no invented LAUSD facts
(`draft` + open question instead), exception cards over guesses, stable IDs are sacred,
no UI overwhelm, contracts/docs updated in the same change set.
