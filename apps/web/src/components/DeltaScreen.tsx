// Act 4 — the DD shuffle. The diff summary shown BEFORE a re-import applies:
// counts of added / removed / changed / untouched rooms and exactly which human
// decisions are affected. Apply is one click; nothing is lost without being
// shown (plan §9).

import type { DeltaSummary, ResolveResult } from '@lausd-pa/engine';

function FieldDiff({ field, before, after }: { field: string; before: unknown; after: unknown }) {
  const show = (v: unknown) => (v === null || v === undefined ? '—' : String(v));
  return (
    <li>
      <code>{field}</code>: {show(before)} <span className="diff-arrow">→</span> {show(after)}
    </li>
  );
}

export function DeltaScreen({
  label,
  delta,
  nextResolved,
  onApply,
  onCancel,
}: {
  label: string;
  delta: DeltaSummary;
  nextResolved: ResolveResult;
  onApply: () => void;
  onCancel: () => void;
}) {
  const importOk = nextResolved.import_report.ok;
  return (
    <div className="delta-backdrop">
      <div className="delta-screen">
        <h2>Re-import preview — {label}</h2>

        {!importOk && (
          <div className="diag diag-warning">
            This file does not validate:{' '}
            {nextResolved.import_report.errors.map((e) => e.message).join(' · ')}
          </div>
        )}

        <div className="delta-counts">
          <div className="delta-count">
            <span className="delta-num">{delta.changed.length}</span> room
            {delta.changed.length === 1 ? '' : 's'} changed
          </div>
          <div className="delta-count">
            <span className="delta-num">{delta.added.length}</span> added
          </div>
          <div className="delta-count">
            <span className="delta-num">{delta.removed.length}</span> removed
          </div>
          <div className="delta-count delta-untouched">
            <span className="delta-num">{delta.untouched_count}</span> untouched
          </div>
        </div>

        <p className="delta-preserved">
          ✓ {delta.preserved_human_count} of your decisions carry over untouched
          {delta.stale_decisions.length > 0 &&
            `, ${delta.stale_decisions.length} re-queued because facts changed underneath ${delta.stale_decisions.length === 1 ? 'it' : 'them'}`}
          {delta.new_queued_decision_ids.length > 0 &&
            `, ${delta.new_queued_decision_ids.length} new decision${delta.new_queued_decision_ids.length === 1 ? '' : 's'} from added rooms`}
          .
        </p>

        {delta.changed.length > 0 && (
          <section className="delta-section">
            <h3>Changed rooms</h3>
            {delta.changed.map((c) => (
              <div key={c.room_id} className="delta-room">
                <strong>
                  {c.room_number} — {c.name_as_drawn}
                </strong>
                <ul className="delta-fields">
                  {c.changed_fields.map((f) => (
                    <FieldDiff key={f.field} field={f.field} before={f.before} after={f.after} />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {delta.added.length > 0 && (
          <section className="delta-section">
            <h3>Added rooms</h3>
            <ul>
              {delta.added.map((a) => (
                <li key={a.room_id}>
                  {a.room_number} — {a.name_as_drawn}
                </li>
              ))}
            </ul>
          </section>
        )}

        {delta.removed.length > 0 && (
          <section className="delta-section">
            <h3>Removed rooms</h3>
            <ul>
              {delta.removed.map((r) => (
                <li key={r.room_id}>
                  {r.room_number} — {r.name_as_drawn}
                </li>
              ))}
            </ul>
            {delta.decisions_to_archive.length > 0 && (
              <p className="delta-archive-note">
                {delta.decisions_to_archive.length} of your decisions belong to removed rooms —
                they will be archived (kept in the decisions file), never silently dropped.
              </p>
            )}
          </section>
        )}

        {delta.stale_decisions.length > 0 && (
          <section className="delta-section delta-stale">
            <h3>Your decisions that need re-confirmation</h3>
            <ul>
              {delta.stale_decisions.map((s) => (
                <li key={s.decision_id}>
                  <strong>{s.subject}</strong> — {s.change_summary}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="delta-actions">
          <button className="btn" onClick={onCancel}>
            Cancel — keep current program
          </button>
          <button className="btn btn-primary btn-big" onClick={onApply} disabled={!importOk}>
            Apply re-import
            {delta.stale_decisions.length + delta.new_queued_decision_ids.length > 0
              ? ` (${delta.stale_decisions.length + delta.new_queued_decision_ids.length} card${delta.stale_decisions.length + delta.new_queued_decision_ids.length === 1 ? '' : 's'} to resolve)`
              : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
