// The dashboard answers "what do you want from me?" in one glance:
// completeness, what auto-resolved (with citations), what's waiting, and the
// room grid grouped by building/floor.

import { useState } from 'react';
import type { DecisionPoint, ResolveResult, RoomRollup } from '@lausd-pa/engine';
import { isResolved } from '@lausd-pa/engine';
import { CitationChips, DraftBadge, Meter } from './shared.tsx';

function roomStateClass(room: RoomRollup): string {
  if (room.out_of_coverage) return 'room-ooc';
  if (room.total_count === 0) return 'room-none';
  if (room.resolved_count === room.total_count) return 'room-done';
  return 'room-open';
}

export function Dashboard({
  result,
  onGoQueue,
  onGoArtifacts,
  onSelectRoom,
}: {
  result: ResolveResult;
  onGoQueue: () => void;
  onGoArtifacts: () => void;
  onSelectRoom: (roomId: string) => void;
}) {
  const [showAuto, setShowAuto] = useState(false);
  const auto = result.decision_points.filter(
    (d) => d.status === 'auto_resolved' && d.resolution !== undefined,
  );
  const queueCount = result.cards.length;
  const done = result.completeness.resolved === result.completeness.total;

  const byBuilding = new Map<string, RoomRollup[]>();
  for (const room of result.rooms) {
    const key = room.building_id ?? 'unassigned';
    byBuilding.set(key, [...(byBuilding.get(key) ?? []), room]);
  }

  return (
    <div className="dashboard">
      <section className="stats-row">
        <button className="stat-card stat-auto" onClick={() => setShowAuto((s) => !s)}>
          <span className="stat-number">{auto.length}</span>
          <span className="stat-label">decisions auto-resolved with citations {showAuto ? '▾' : '▸'}</span>
        </button>
        <button
          className={`stat-card ${queueCount > 0 ? 'stat-queue' : 'stat-clear'}`}
          onClick={queueCount > 0 ? onGoQueue : onGoArtifacts}
        >
          <span className="stat-number">{queueCount}</span>
          <span className="stat-label">
            {queueCount > 0 ? 'exception cards waiting — resolve them' : 'queue clear — view artifacts'}
          </span>
        </button>
        <div className="stat-card">
          <Meter resolved={result.completeness.resolved} total={result.completeness.total} size="large" />
          <span className="stat-label">{done ? 'artifacts unlocked' : 'project completeness'}</span>
        </div>
      </section>

      {showAuto && (
        <section className="auto-panel">
          <h3>Auto-resolved by the engine</h3>
          <ul className="auto-list">
            {auto.map((dp: DecisionPoint) => (
              <li key={dp.id}>
                <span className="auto-subject">{dp.subject}</span>
                <span className="auto-rationale"> — {dp.rationale}</span>{' '}
                {dp.verification_status === 'draft' && <DraftBadge />}
                <CitationChips citations={dp.citations} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.diagnostics.length > 0 && (
        <section className="diagnostics">
          {result.diagnostics.map((d, i) => (
            <div key={i} className={`diag diag-${d.severity}`}>
              {d.message}
            </div>
          ))}
        </section>
      )}

      {[...byBuilding.entries()].map(([buildingId, rooms]) => {
        const building = result.buildings.find((b) => b.building_id === buildingId);
        const floors = new Map<number | null, RoomRollup[]>();
        for (const r of rooms) floors.set(r.floor, [...(floors.get(r.floor) ?? []), r]);
        return (
          <section key={buildingId} className="building">
            <header className="building-head">
              <h3>{building?.name ?? buildingId}</h3>
              {building && building.total_count > 0 && (
                <Meter resolved={building.resolved_count} total={building.total_count} />
              )}
            </header>
            {[...floors.entries()]
              .sort(([a], [b]) => (a ?? 0) - (b ?? 0))
              .map(([floor, floorRooms]) => (
                <div key={String(floor)} className="floor-row">
                  {floors.size > 1 && <span className="floor-label">Floor {floor}</span>}
                  <div className="room-grid">
                    {floorRooms.map((room) => (
                      <button
                        key={room.room_id}
                        className={`room-chip ${roomStateClass(room)}`}
                        onClick={() => onSelectRoom(room.room_id)}
                        title={`${room.name_as_drawn} — ${room.resolved_count}/${room.total_count} resolved`}
                      >
                        <span className="room-number">{room.room_number}</span>
                        <span className="room-name">{room.name_as_drawn.toLowerCase()}</span>
                        <span className="room-state">
                          {room.total_count === 0
                            ? room.out_of_coverage
                              ? 'no rules yet'
                              : 'no plumbing'
                            : room.resolved_count === room.total_count
                              ? '✓'
                              : `${room.resolved_count}/${room.total_count}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </section>
        );
      })}
    </div>
  );
}

export { isResolved };
