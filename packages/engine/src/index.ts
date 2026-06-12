// Engine package: pure resolution pipeline per plan §6.
// Everything is a pure function of (inputs, kb, decisions).

export * from './contracts/types.ts';
export { CONTRACT_ENUMS } from './contracts/schemas.ts';
export { validateImport, SUPPORTED_CONTRACT_VERSION } from './contracts/validate.ts';

export * from './decisions.ts';
export { resolve, type ResolveInput } from './resolve.ts';
export {
  applyCardAnswer,
  acceptSuggestions,
  reopenDecision,
  archiveOrphans,
  membersOf,
  type CardAnswer,
} from './store.ts';
export { computeDelta, type DeltaSummary, type RoomChange, type StaleDecisionPreview } from './delta.ts';
export * from './artifacts/index.ts';
export { deriveFixtureLines, type FixtureLine, type DerivedFixtures } from './fixtures.ts';
export { computeOccupancy, requiredCount, ratioAllocationSuggestion } from './counts.ts';
export { fingerprint, canonicalJson, fnv1a64 } from './fingerprint.ts';
export { rankCandidates, diceSimilarity } from './similarity.ts';
export { normalizeRooms, ageBandFromSchoolLevel, deriveSex } from './normalize.ts';
