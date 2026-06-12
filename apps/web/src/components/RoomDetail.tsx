// Room detail: effective facts with provenance, every decision with rationale
// + citations, fixture lines, obligations, rules that correctly did not fire,
// and undo (reopen) on human decisions (plan §7).

import type { DecisionPoint, ResolveResult } from '@lausd-pa/engine';
import { deriveFixtureLines, isResolved } from '@lausd-pa/engine';
import { kb } from '../data.ts';
import { obligationById, profileByCode } from '@lausd-pa/kb';
import { CitationChips, DraftBadge } from './shared.tsx';

function statusLabel(dp: DecisionPoint): string {
  switch (dp.status) {
    case 'auto_resolved':
      return 'auto-resolved';
    case 'human_resolved':
      return 'your decision';
    case 'queued':
      return dp.pending_reason ? `pending — ${dp.pending_reason}` : 'in queue';
    case 'stale':
      return 'needs re-confirmation (facts changed)';
    case 'out_of_coverage':
      return 'outside MVP rule coverage';
  }
}

function FixtureLinesText({ result, dp }: { result: ResolveResult; dp: DecisionPoint }) {
  if (!dp.requirement || !isResolved(dp) || dp.resolution?.kind !== 'quantities') return null;
  const room = result.rooms.find((r) => r.room_id === dp.room_id);
  if (!room || !room.effective.room_type_code) return null;
  if (dp.requirement.key === 'fountain') {
    return (
      <span className="fixture-lines">
        → 1 × {dp.resolution.assembly_choice}
      </span>
    );
  }
  const profile = profileByCode(kb, room.effective.room_type_code);
  const req = profile?.fixture_requirements.find((r) => r.id === dp.requirement!.profile_req_id);
  if (!req) return null;
  const derived = deriveFixtureLines(kb, req, dp, room.effective);
  if (derived.pending) return <span className="fixture-lines pending">→ {derived.pending}</span>;
  if (derived.lines.length === 0) return <span className="fixture-lines">→ none</span>;
  return (
    <span className="fixture-lines">
      → {derived.lines.map((l) => `${l.n} × ${l.assembly}`).join(' + ')}
    </span>
  );
}

export function RoomDetail({
  result,
  roomId,
  onClose,
  onReopen,
}: {
  result: ResolveResult;
  roomId: string;
  onClose: () => void;
  onReopen: (decisionId: string) => void;
}) {
  const room = result.rooms.find((r) => r.room_id === roomId);
  if (!room) return null;
  const dps = result.decision_points.filter((d) => d.room_id === roomId);
  // Building/site-level requirements this room generates (fountain rule):
  const generated = result.decision_points.filter(
    (d) =>
      d.requirement?.key === 'fountain' &&
      Array.isArray(d.inputs_snapshot.members) &&
      (d.inputs_snapshot.members as string[]).includes(roomId),
  );
  const e = room.effective;
  const waterLabel =
    room.water_class === 'HC'
      ? 'Hot + cold'
      : room.water_class === 'T'
        ? 'Tempered'
        : room.water_class === 'TP'
          ? 'Tepid'
          : room.water_class === 'C'
            ? 'Cold only'
            : room.water_class === 'M'
              ? 'Mixed by fixture'
              : '—';

  const obligations =
    e.room_type_code && room.total_count > 0
      ? (profileByCode(kb, e.room_type_code)?.obligations ?? [])
          .map((id) => obligationById(kb, id))
          .filter((o) => o !== undefined)
      : [];

  return (
    <div className="room-detail-backdrop" onClick={onClose}>
      <aside className="room-detail" onClick={(ev) => ev.stopPropagation()}>
        <header className="room-detail-head">
          <div>
            <h2>
              {room.room_number} — {room.name_as_drawn}
            </h2>
            <p className="room-detail-sub">
              {e.room_type_code ? (
                <>
                  {kb.taxonomy.find((t) => t.code === e.room_type_code)?.display_name}{' '}
                  <span className="provenance">({e.type_provenance})</span>
                </>
              ) : (
                <span className="provenance">{e.type_provenance}</span>
              )}
            </p>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            close ✕
          </button>
        </header>

        <dl className="room-facts">
          <div>
            <dt>Age band</dt>
            <dd>
              {e.age_band ?? '—'} <span className="provenance">({e.age_band_provenance})</span>
            </dd>
          </div>
          <div>
            <dt>Water service</dt>
            <dd>{waterLabel}</dd>
          </div>
          {e.sex !== null && e.sex !== 'unisex' && (
            <div>
              <dt>Serves</dt>
              <dd>
                {e.sex === 'male' ? 'boys' : 'girls'}{' '}
                <span className="provenance">({e.sex_provenance})</span>
              </dd>
            </div>
          )}
          {e.classroom_attached && (
            <div>
              <dt>Layout</dt>
              <dd>classroom-attached single restroom</dd>
            </div>
          )}
          {e.ada_designated && (
            <div>
              <dt>ADA</dt>
              <dd>designated accessible facility</dd>
            </div>
          )}
        </dl>

        {room.display_note && <p className="room-note">{room.display_note}</p>}

        {dps.length === 0 ? (
          <p className="room-no-reqs">
            No plumbing decisions for this room
            {e.room_type_code === null ? ' until it is classified.' : '.'}
          </p>
        ) : (
          <ul className="room-decisions">
            {dps.map((dp) => (
              <li key={dp.id} className={`room-decision rd-${dp.status}`}>
                <div className="rd-head">
                  <strong>{dp.requirement?.label ?? dp.subject}</strong>
                  <span className={`rd-status rd-status-${dp.status}`}>{statusLabel(dp)}</span>
                  {dp.verification_status === 'draft' && <DraftBadge />}
                </div>
                <FixtureLinesText result={result} dp={dp} />
                <p className="rd-rationale">{dp.rationale}</p>
                <CitationChips citations={dp.citations} />
                {dp.status === 'human_resolved' && (
                  <button className="btn btn-ghost rd-reopen" onClick={() => onReopen(dp.id)}>
                    ↺ reopen this decision
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {generated.length > 0 && (
          <section className="room-generated">
            <h4>Building/site requirements this room generates</h4>
            <ul className="room-decisions">
              {generated.map((dp) => (
                <li key={dp.id} className={`room-decision rd-${dp.status}`}>
                  <div className="rd-head">
                    <strong>{dp.subject}</strong>
                    <span className={`rd-status rd-status-${dp.status}`}>{statusLabel(dp)}</span>
                    {dp.verification_status === 'draft' && <DraftBadge />}
                  </div>
                  <FixtureLinesText result={result} dp={dp} />
                  <p className="rd-rationale">{dp.rationale}</p>
                  <CitationChips citations={dp.citations} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {room.not_applicable_rules.length > 0 && (
          <section className="room-na">
            <h4>Rules evaluated, correctly not firing</h4>
            <ul>
              {room.not_applicable_rules.map((r) => (
                <li key={r.requirement_id}>
                  {r.label}: {r.reason} <CitationChips citations={r.citations} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {obligations.length > 0 && (
          <section className="room-obligations">
            <h4>Obligations riding with this room's fixtures</h4>
            <ul>
              {obligations.map((o) => (
                <li key={o!.id}>
                  {o!.text} <CitationChips citations={o!.citations} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
