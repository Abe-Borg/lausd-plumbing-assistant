// The exception queue — the product (plan §0.3, §7). One card at a time,
// biggest-impact first; 2–6 options with consequences and citation chips;
// quantity cards pre-fill suggestions with their basis; batch cards disclose
// members; answers "snap" with a ~300 ms resolved flash. No card needs more
// than numbers typed.

import { useEffect, useState } from 'react';
import type {
  CardAnswer,
  ExceptionCard,
  FixtureCounts,
  ResolveResult,
} from '@lausd-pa/engine';
import type { AgeBand } from '@lausd-pa/engine';
import { CitationChips, DraftBadge } from './shared.tsx';

type FieldValues = Record<string, FixtureCounts>;

function initialFieldValues(card: ExceptionCard): FieldValues {
  const values: FieldValues = {};
  for (const f of card.quantity_fields ?? []) {
    values[f.req_key] = f.suggested ? { ...f.suggested } : { standard: 1, accessible: 0 };
  }
  return values;
}

function answerFromFields(card: ExceptionCard, values: FieldValues): CardAnswer {
  const counts: Record<string, FixtureCounts> = {};
  for (const dpId of card.decision_ids) {
    const key = dpId.split('/req:')[1];
    if (key !== undefined && values[key]) counts[dpId] = values[key];
  }
  return { kind: 'quantities', counts };
}

function QuantityFields({
  card,
  values,
  onChange,
}: {
  card: ExceptionCard;
  values: FieldValues;
  onChange: (v: FieldValues) => void;
}) {
  return (
    <div className="qty-fields">
      {(card.quantity_fields ?? []).map((f) => {
        const v = values[f.req_key] ?? { standard: 0, accessible: 0 };
        const set = (patch: Partial<FixtureCounts>) =>
          onChange({ ...values, [f.req_key]: { ...v, ...patch } });
        return (
          <div key={f.req_key} className="qty-field">
            <div className="qty-field-head">
              <strong>{f.label}</strong>
              <span className="assembly-preview">{f.assembly_preview}</span>
            </div>
            <div className="qty-inputs">
              <label>
                {f.has_accessible_variant ? 'Standard' : 'Count'}
                <input
                  type="number"
                  min={0}
                  value={v.standard}
                  onChange={(e) => set({ standard: Math.max(0, Number(e.target.value) || 0) })}
                />
              </label>
              {f.has_accessible_variant && (
                <label>
                  Accessible
                  <input
                    type="number"
                    min={0}
                    value={v.accessible}
                    onChange={(e) => set({ accessible: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </label>
              )}
            </div>
            {f.suggestion_basis && (
              <p className="qty-basis">
                {f.suggestion_is_draft && <DraftBadge title="Suggestion rests on DRAFT CPC values (OQ-1) and the R2 allocation heuristic — edit freely" />}{' '}
                {f.suggestion_basis}
              </p>
            )}
          </div>
        );
      })}
      {(card.batch_members?.length ?? 0) > 1 && (
        <p className="qty-batch-note">
          Applies to each room below; reopen any single room later from its detail view to
          override it alone.
        </p>
      )}
    </div>
  );
}

function MemberList({ card }: { card: ExceptionCard }) {
  const members = card.batch_members ?? [];
  if (members.length === 0) return null;
  if (members.length === 1) {
    return (
      <p className="member-single">
        Room {members[0]!.room_number} — {members[0]!.name_as_drawn}
      </p>
    );
  }
  return (
    <details className="member-list">
      <summary>applies to {members.length} rooms</summary>
      <ul>
        {members.map((m) => (
          <li key={m.room_id}>
            {m.room_number} — {m.name_as_drawn}
          </li>
        ))}
      </ul>
    </details>
  );
}

function StaleBanner({ card }: { card: ExceptionCard }) {
  if (!card.stale_context) return null;
  return (
    <div className="stale-banner">
      <strong>Facts changed under your decision.</strong> {card.stale_context.change_summary}.
      <div className="stale-prior">
        Your previous answer:{' '}
        {card.stale_context.prior_resolution.kind === 'quantities'
          ? `${card.stale_context.prior_resolution.counts.standard + card.stale_context.prior_resolution.counts.accessible} × ${card.stale_context.prior_resolution.assembly_choice ?? '(previous assembly)'}`
          : JSON.stringify(card.stale_context.prior_resolution)}
      </div>
    </div>
  );
}

function CardBody({
  card,
  onAnswer,
}: {
  card: ExceptionCard;
  onAnswer: (answer: CardAnswer) => void;
}) {
  const [values, setValues] = useState<FieldValues>(() => initialFieldValues(card));
  const [chosen, setChosen] = useState<string | null>(card.default_suggestion ?? null);
  const [showAllOptions, setShowAllOptions] = useState(false);

  // Reset local inputs when a different card arrives (CardBody is also keyed
  // by card_id at the call site; this guards against key reuse).
  useEffect(() => {
    setValues(initialFieldValues(card));
    setChosen(card.default_suggestion ?? null);
    setShowAllOptions(false);
    // intentionally keyed on the card identity only
  }, [card.card_id]);

  const submitChoice = (value: string) => {
    switch (card.card_type) {
      case 'classify_room':
        onAnswer({ kind: 'classification', room_type_code: value });
        return;
      case 'batch_policy':
        onAnswer({ kind: 'policy', value: value as 'yes' | 'no' });
        return;
      case 'project_ack':
      case 'out_of_coverage':
        onAnswer({ kind: 'acknowledge' });
        return;
      case 'missing_field': {
        if (card.card_id.endsWith('/age_band')) {
          onAnswer({ kind: 'age_band', age_band: value as AgeBand });
        } else if (card.card_id.endsWith('/sex')) {
          onAnswer({ kind: 'sex', sex: value as 'male' | 'female' | 'unisex' });
        }
        return;
      }
      default:
        setChosen(value);
    }
  };

  const isChoice = card.card_type === 'choice' || (card.card_type === 'stale' && (card.options?.length ?? 0) > 0);
  const hasFields = (card.quantity_fields?.length ?? 0) > 0;
  const options = card.options ?? [];
  const visibleOptions = card.card_type === 'classify_room' && !showAllOptions ? options.slice(0, 6) : options;

  return (
    <>
      <StaleBanner card={card} />
      <h2 className="card-prompt">{card.prompt}</h2>
      {card.detail && <p className="card-detail">“{card.detail}”</p>}
      <MemberList card={card} />

      {options.length > 0 && (
        <div className="card-options">
          {visibleOptions.map((o) => (
            <button
              key={o.value}
              className={`option-btn${chosen === o.value ? ' option-chosen' : ''}${card.default_suggestion === o.value ? ' option-default' : ''}`}
              onClick={() => (isChoice ? setChosen(o.value) : submitChoice(o.value))}
            >
              <span className="option-label">
                {o.label}
                {card.default_suggestion === o.value ? ' (suggested)' : ''}
              </span>
              {o.consequence_summary && <span className="option-consequence">{o.consequence_summary}</span>}
              <CitationChips citations={o.citations} />
            </button>
          ))}
          {card.card_type === 'classify_room' && !showAllOptions && options.length > 6 && (
            <button className="btn btn-ghost" onClick={() => setShowAllOptions(true)}>
              show all {options.length} room types…
            </button>
          )}
        </div>
      )}

      {hasFields && <QuantityFields card={card} values={values} onChange={setValues} />}

      {(hasFields || isChoice) && (
        <div className="card-actions">
          <button
            className="btn btn-primary"
            disabled={isChoice && chosen === null}
            onClick={() => {
              if (isChoice) {
                const f = card.quantity_fields?.[0];
                const counts = f ? (values[f.req_key] ?? { standard: 1, accessible: 0 }) : { standard: 1, accessible: 0 };
                onAnswer({ kind: 'choice', assembly: chosen!, counts });
              } else {
                onAnswer(answerFromFields(card, values));
              }
            }}
          >
            {isChoice ? (chosen ? `Confirm ${chosen}` : 'Choose an assembly') : 'Accept quantities'}
          </button>
        </div>
      )}

      <footer className="card-citations">
        <CitationChips citations={card.citations} />
      </footer>
    </>
  );
}

export function QueueView({
  result,
  lastAnswered,
  onAnswer,
  onSnapDone,
  onAllClear,
}: {
  result: ResolveResult;
  lastAnswered: string | null;
  onAnswer: (result: ResolveResult, cardId: string, answer: CardAnswer) => void;
  onSnapDone: () => void;
  onAllClear: () => void;
}) {
  const [snap, setSnap] = useState(false);
  const cards = result.cards;
  const card = cards[0];

  useEffect(() => {
    if (lastAnswered === null) return;
    setSnap(true);
    const t = setTimeout(() => {
      setSnap(false);
      onSnapDone();
    }, 320);
    return () => clearTimeout(t);
  }, [lastAnswered, onSnapDone]);

  if (!card) {
    return (
      <div className="queue-empty">
        <div className="queue-empty-mark">✓</div>
        <h2>Queue clear.</h2>
        <p>Every decision is resolved — the deliverables are ready.</p>
        <button className="btn btn-primary btn-big" onClick={onAllClear}>
          View artifacts
        </button>
      </div>
    );
  }

  return (
    <div className="queue">
      <div className="queue-progress">
        card 1 of {cards.length} · {result.completeness.resolved}/{result.completeness.total} resolved
      </div>
      <div className={`card card-${card.card_type}${snap ? ' card-snap' : ''}`}>
        {snap ? (
          <div className="card-resolved-flash">✓ resolved</div>
        ) : (
          <CardBody
            key={card.card_id}
            card={card}
            onAnswer={(answer) => onAnswer(result, card.card_id, answer)}
          />
        )}
      </div>
      {cards.length > 1 && (
        <ol className="queue-upnext">
          {cards.slice(1, 4).map((c) => (
            <li key={c.card_id}>{c.prompt}</li>
          ))}
          {cards.length > 4 && <li className="queue-more">+ {cards.length - 4} more</li>}
        </ol>
      )}
    </div>
  );
}
