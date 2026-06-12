// Shared test harness: resolve Vista del Sol and play the scripted decision
// file (the demo's Act 2 in code). Card ids are deterministic, so the script
// addresses them directly; it re-resolves between answers like the real UI.

import { kb } from '@lausd-pa/kb';
import dossierJson from '../../../synthetic/vista-del-sol/dossier.json';
import roomsV1Json from '../../../synthetic/vista-del-sol/room_program.json';
import roomsV2Json from '../../../synthetic/vista-del-sol/room_program.v2.json';
import {
  acceptSuggestions,
  applyCardAnswer,
  emptyStore,
  resolve,
  type CardAnswer,
  type DecisionStore,
  type ExceptionCard,
  type FixtureCounts,
  type ResolveResult,
} from '../src/index.ts';

export { dossierJson, roomsV1Json, roomsV2Json, kb };

export function resolveV1(store: DecisionStore = emptyStore('vds-es-2026')): ResolveResult {
  return resolve({ dossier: dossierJson, roomProgram: roomsV1Json, kb, store });
}

export function resolveV2(store: DecisionStore): ResolveResult {
  return resolve({ dossier: dossierJson, roomProgram: roomsV2Json, kb, store });
}

function quantitiesByReqKey(
  card: ExceptionCard,
  byKey: Record<string, FixtureCounts>,
): CardAnswer {
  const counts: Record<string, FixtureCounts> = {};
  for (const dpId of card.decision_ids) {
    const key = dpId.split('/req:')[1];
    if (key !== undefined && byKey[key]) counts[dpId] = byKey[key];
  }
  return { kind: 'quantities', counts };
}

export type ScriptStep = { card_id: string; answer: (card: ExceptionCard) => CardAnswer };

/**
 * The scripted decision file (plan §12 T3): the full Act-2 walkthrough.
 *  - STEAM ROOM → makerspace; MULTI-USE ROOM confirmed multipurpose
 *  - Boys RR A110 → elementary band
 *  - general-classroom sinks: yes (batch, 10 rooms)
 *  - boys RR quantities: designer edits urinals to 1 std + 1 accessible
 *  - girls RR quantities: accept suggestions
 *  - flexible classroom sink: accept suggestion (1 × ST-2)
 *  - lunch shelter: 2 pavilion drains; hose bibbs HB-1 × 2
 *  - acknowledge Rule 16-D and all-electric
 */
export const SCRIPTED_DECISIONS: ScriptStep[] = [
  {
    card_id: 'card:room:rm-b115/classify',
    answer: () => ({ kind: 'classification', room_type_code: 'makerspace' }),
  },
  {
    card_id: 'card:room:rm-b116/classify',
    answer: () => ({ kind: 'classification', room_type_code: 'multipurpose_room' }),
  },
  {
    card_id: 'card:room:rm-a110/age_band',
    answer: () => ({ kind: 'age_band', age_band: 'elementary' }),
  },
  {
    card_id: 'policy:classroom_general_sinks',
    answer: () => ({ kind: 'policy', value: 'yes' }),
  },
  {
    card_id: 'qty:restroom_student:male',
    answer: (card) =>
      quantitiesByReqKey(card, {
        wc: { standard: 1, accessible: 1 },
        urinal: { standard: 1, accessible: 1 },
        lav: { standard: 1, accessible: 1 },
      }),
  },
  {
    card_id: 'qty:restroom_student:female',
    answer: (card) => acceptSuggestions(card),
  },
  {
    card_id: 'qty:classroom_flexible:rm-a107',
    answer: (card) => acceptSuggestions(card),
  },
  {
    card_id: 'qty:lunch_shelter:rm-s001',
    answer: (card) => quantitiesByReqKey(card, { pavilion_drain: { standard: 2, accessible: 0 } }),
  },
  {
    card_id: 'choice:room:rm-s001/req:hose_bibb',
    answer: () => ({ kind: 'choice', assembly: 'HB-1', counts: { standard: 2, accessible: 0 } }),
  },
  { card_id: 'card:project:ladwp_16d', answer: () => ({ kind: 'acknowledge' }) },
  { card_id: 'card:project:all_electric', answer: () => ({ kind: 'acknowledge' }) },
];

export function runScript(
  steps: ScriptStep[] = SCRIPTED_DECISIONS,
  initialStore: DecisionStore = emptyStore('vds-es-2026'),
  resolver: (store: DecisionStore) => ResolveResult = resolveV1,
): { store: DecisionStore; result: ResolveResult } {
  let store = initialStore;
  for (const step of steps) {
    const result = resolver(store);
    const card = result.cards.find((c) => c.card_id === step.card_id);
    if (!card) {
      throw new Error(
        `scripted card not found: ${step.card_id}; queue was: ${result.cards.map((c) => c.card_id).join(', ')}`,
      );
    }
    store = applyCardAnswer(store, result, step.card_id, step.answer(card));
  }
  return { store, result: resolver(store) };
}
