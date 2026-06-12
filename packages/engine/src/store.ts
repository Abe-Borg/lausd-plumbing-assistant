// Decision-store helpers. All pure: every mutation returns a new store.
// `decided_at` is UI metadata passed in by the caller — the engine never reads
// a clock (determinism, plan §0.1).

import type {
  CardMember,
  DecisionPoint,
  DecisionResolution,
  DecisionStore,
  ExceptionCard,
  FixtureCounts,
  ResolveResult,
  Sex,
} from './decisions.ts';
import type { AgeBand } from './contracts/types.ts';

export type CardAnswer =
  | { kind: 'classification'; room_type_code: string }
  | { kind: 'age_band'; age_band: AgeBand }
  | { kind: 'sex'; sex: Sex }
  | { kind: 'policy'; value: 'yes' | 'no' }
  | { kind: 'quantities'; counts: Record<string, FixtureCounts> }
  | { kind: 'choice'; assembly: string; counts: FixtureCounts }
  | { kind: 'acknowledge' };

function withDecision(
  store: DecisionStore,
  dp: DecisionPoint,
  resolution: DecisionResolution,
  viaCard: string,
  decidedAt?: string,
): DecisionStore {
  return {
    ...store,
    decisions: {
      ...store.decisions,
      [dp.id]: {
        resolution,
        inputs_fingerprint: dp.inputs_fingerprint,
        inputs_snapshot: dp.inputs_snapshot,
        via_card: viaCard,
        ...(decidedAt !== undefined ? { decided_at: decidedAt } : {}),
      },
    },
  };
}

function resolutionForPolicy(dp: DecisionPoint, value: 'yes' | 'no', thenN: number): DecisionResolution {
  return {
    kind: 'quantities',
    counts: { standard: value === 'yes' ? thenN : 0, accessible: 0 },
    policy_value: value,
  };
}

/**
 * Apply a card answer to the store. Batch cards fan out to one stored decision
 * per member decision point, so later single-room overrides remain possible
 * (plan §6.5).
 */
export function applyCardAnswer(
  store: DecisionStore,
  result: ResolveResult,
  cardId: string,
  answer: CardAnswer,
  decidedAt?: string,
): DecisionStore {
  const card = result.cards.find((c) => c.card_id === cardId);
  if (!card) throw new Error(`unknown card: ${cardId}`);
  const dps = new Map(result.decision_points.map((d) => [d.id, d]));
  let next = store;

  for (const dpId of card.decision_ids) {
    const dp = dps.get(dpId);
    if (!dp) throw new Error(`card ${cardId} references unknown decision ${dpId}`);

    let resolution: DecisionResolution;
    switch (answer.kind) {
      case 'classification':
        resolution = { kind: 'classification', room_type_code: answer.room_type_code };
        break;
      case 'age_band':
        resolution = { kind: 'age_band', age_band: answer.age_band };
        break;
      case 'sex':
        resolution = { kind: 'sex', sex: answer.sex };
        break;
      case 'policy': {
        // The `then` quantity is carried on the card's quantity field preview;
        // for MVP policies it is 1 (general-classroom sinks).
        resolution = resolutionForPolicy(dp, answer.value, 1);
        break;
      }
      case 'quantities': {
        const counts = answer.counts[dpId];
        if (!counts) continue; // a member the designer left untouched on a partial answer
        resolution = { kind: 'quantities', counts };
        break;
      }
      case 'choice':
        resolution = { kind: 'quantities', counts: answer.counts, assembly_choice: answer.assembly };
        break;
      case 'acknowledge':
        resolution = { kind: 'acknowledged' };
        break;
    }
    next = withDecision(next, dp, resolution, cardId, decidedAt);
  }
  return next;
}

/** One-tap "accept all suggestions" for a quantity card. */
export function acceptSuggestions(card: ExceptionCard): CardAnswer {
  const counts: Record<string, FixtureCounts> = {};
  for (const dpId of card.decision_ids) {
    const reqKey = dpId.split('/req:')[1];
    const field = card.quantity_fields?.find((f) => f.req_key === reqKey);
    if (field?.suggested) counts[dpId] = field.suggested;
  }
  return { kind: 'quantities', counts };
}

/** Reopen (undo) a human decision from the room detail view (plan §7). */
export function reopenDecision(store: DecisionStore, dpId: string): DecisionStore {
  if (!(dpId in store.decisions)) return store;
  const decisions = { ...store.decisions };
  delete decisions[dpId];
  return { ...store, decisions };
}

/**
 * Archive stored decisions whose rooms/decision points no longer exist
 * (removed rooms on re-import). Never silently dropped — they move to
 * `archived` with a reason (plan §9).
 */
export function archiveOrphans(
  store: DecisionStore,
  livingDecisionIds: Set<string>,
  reason: string,
): DecisionStore {
  const decisions: DecisionStore['decisions'] = {};
  const archived = { ...store.archived };
  for (const [id, d] of Object.entries(store.decisions)) {
    if (livingDecisionIds.has(id)) decisions[id] = d;
    else archived[id] = { ...d, archived_reason: reason };
  }
  return { ...store, decisions, archived };
}

export function membersOf(card: ExceptionCard): CardMember[] {
  return card.batch_members ?? [];
}
