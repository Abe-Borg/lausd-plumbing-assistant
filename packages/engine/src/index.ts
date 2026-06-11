// Engine package: pure resolution pipeline per plan §6.
// T1: contracts-as-code (validation). T3 adds the pipeline, decision store, delta.

export * from './contracts/types.ts';
export { CONTRACT_ENUMS } from './contracts/schemas.ts';
export { validateImport, SUPPORTED_CONTRACT_VERSION } from './contracts/validate.ts';
