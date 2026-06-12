// The payoff (Act 3): fixture schedule, fixture-to-occupant tabulation, water
// temperature matrix. On-screen view + CSV export + print view; every row
// traceable (hover reveals the producing rooms/decisions); DRAFT badges
// wherever a value rests on unverified KB content.

import { useState } from 'react';
import type { Artifacts, ResolveResult, TabRow } from '@lausd-pa/engine';
import { artifactCsvs, rowLabel, statusLabel } from '@lausd-pa/engine';
import { downloadText } from '../state.ts';
import { CitationChips, DraftBadge } from './shared.tsx';

type Tab = 'schedule' | 'tabulation' | 'matrix';

function PendingBanner({ result }: { result: ResolveResult }) {
  const open = result.completeness.total - result.completeness.resolved;
  if (open === 0) {
    return <div className="artifact-banner banner-ok">✓ All {result.completeness.total} decisions resolved — deliverables complete.</div>;
  }
  return (
    <div className="artifact-banner banner-pending">
      {open} decision{open === 1 ? '' : 's'} still pending — affected rows are listed as explicit
      gaps, never silently missing.
    </div>
  );
}

function ScheduleTable({ artifacts }: { artifacts: Artifacts }) {
  const s = artifacts.schedule;
  return (
    <div>
      <table className="artifact-table">
        <thead>
          <tr>
            <th>Designation</th>
            <th>Description</th>
            <th>Spec</th>
            <th>Approved manufacturers</th>
            <th>Mounting ht. (in. AFF)</th>
            <th className="num">Count</th>
            <th>Locations</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {s.rows.map((r) => (
            <tr
              key={r.designation}
              className={r.is_component ? 'row-component' : ''}
              title={`Produced by: ${r.sources.map((src) => `${src.room_number} (${src.n})`).join(', ')}`}
            >
              <td className="designation">{r.designation}</td>
              <td>{r.description}</td>
              <td>{r.spec_section}</td>
              <td>{r.manufacturers}</td>
              <td>{r.mounting_height}</td>
              <td className="num">{r.count}</td>
              <td className="locations">{r.location_text}</td>
              <td>{r.draft && <DraftBadge title={r.todo} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {s.gaps.length > 0 && (
        <section className="artifact-gaps">
          <h4>Pending decisions (not yet on the schedule)</h4>
          <ul>
            {s.gaps.map((g) => (
              <li key={g.decision_id}>
                {g.subject} — {g.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="schedule-notes">
        <h4>Schedule notes</h4>
        <ol>
          {s.footer_notes.map((n) => (
            <li key={n.obligation_id}>
              {n.text} <CitationChips citations={n.citations} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function TabulationRows({ rows, campus }: { rows: TabRow[]; campus: boolean }) {
  return (
    <tbody>
      {rows.map((r, i) => (
        <tr key={i} className={r.status === 'short' ? 'row-short' : r.status === 'pending' ? 'row-pending' : ''}>
          <td>{rowLabel(r)}</td>
          <td>{r.basis_text}</td>
          <td className="num">
            {r.required ? (
              <>
                {r.required.count} {r.required.draft && <DraftBadge title="CPC ratio placeholder — OQ-1" />}
              </>
            ) : campus ? (
              '—'
            ) : (
              'campus basis'
            )}
          </td>
          <td>{r.required?.ratio_text ?? ''}</td>
          <td className="num">{r.provided.count}</td>
          <td className={`tab-status tab-${r.status}`}>{statusLabel(r)}</td>
          <td className="tab-note">{r.provided.note ?? ''}</td>
        </tr>
      ))}
    </tbody>
  );
}

function TabulationTable({ artifacts }: { artifacts: Artifacts }) {
  const t = artifacts.tabulation;
  if (!t) return <p>Tabulation unavailable — planned capacity missing.</p>;
  const header = (
    <thead>
      <tr>
        <th>Fixture class</th>
        <th>Occupancy basis</th>
        <th className="num">Required</th>
        <th>Ratio</th>
        <th className="num">Provided</th>
        <th>Status</th>
        <th></th>
      </tr>
    </thead>
  );
  return (
    <div>
      <div className="artifact-banner banner-draft">{t.draft_banner}</div>
      <p className="tab-occupancy">{t.occupancy_summary}</p>
      <h4>Campus</h4>
      <table className="artifact-table">
        {header}
        <TabulationRows rows={t.campus} campus={true} />
      </table>
      {t.per_building.map((b) => (
        <div key={b.building_id}>
          <h4>{b.name}</h4>
          <table className="artifact-table">
            {header}
            <TabulationRows rows={b.rows} campus={false} />
          </table>
        </div>
      ))}
      <p className="tab-footnote">{t.per_building_note}</p>
    </div>
  );
}

function MatrixTable({ artifacts }: { artifacts: Artifacts }) {
  const m = artifacts.temp_matrix;
  return (
    <div>
      <table className="artifact-table">
        <thead>
          <tr>
            <th>Room</th>
            <th>Name</th>
            <th>Type</th>
            <th>Service</th>
            <th>Driving citation</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {m.rows.map((r, i) => (
            <tr key={i} className={`service-${r.service}`}>
              <td>{r.room_number}</td>
              <td>{r.name_as_drawn}</td>
              <td>{r.type_display}</td>
              <td className="service-cell">{r.service_label}</td>
              <td>
                <CitationChips citations={r.citations} />
              </td>
              <td className="tab-note">{r.note ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="matrix-foot">
        <strong>Setpoints:</strong> {m.setpoints_note}
      </p>
      <p className="matrix-foot">
        <strong>TMV placement:</strong> {m.tmv_note}
      </p>
    </div>
  );
}

export function ArtifactsView({
  result,
  artifacts,
}: {
  result: ResolveResult;
  artifacts: Artifacts;
}) {
  const [tab, setTab] = useState<Tab>('schedule');
  const csvs = artifactCsvs(artifacts);
  const csvName =
    tab === 'schedule'
      ? 'fixture-schedule.csv'
      : tab === 'tabulation'
        ? 'fixture-to-occupant-tabulation.csv'
        : 'water-temperature-matrix.csv';

  return (
    <div className="artifacts">
      <PendingBanner result={result} />
      <div className="artifact-tabs no-print">
        <button className={tab === 'schedule' ? 'tab-active' : ''} onClick={() => setTab('schedule')}>
          Fixture schedule
        </button>
        <button className={tab === 'tabulation' ? 'tab-active' : ''} onClick={() => setTab('tabulation')}>
          Fixture-to-occupant tabulation
        </button>
        <button className={tab === 'matrix' ? 'tab-active' : ''} onClick={() => setTab('matrix')}>
          Water temperature matrix
        </button>
        <span className="artifact-actions">
          <button className="btn" onClick={() => downloadText(csvName, csvs[csvName]!)}>
            ⬇ CSV
          </button>
          <button className="btn" onClick={() => window.print()}>
            🖨 Print
          </button>
        </span>
      </div>
      <div className="artifact-body print-area">
        <h3 className="print-title">
          Vista del Sol ES —{' '}
          {tab === 'schedule'
            ? 'Plumbing Fixture Schedule'
            : tab === 'tabulation'
              ? 'Fixture-to-Occupant Tabulation (SDG 2.1-J.1.h)'
              : 'Water Temperature Service Matrix (SDG 3.4-D)'}
        </h3>
        {tab === 'schedule' && <ScheduleTable artifacts={artifacts} />}
        {tab === 'tabulation' && <TabulationTable artifacts={artifacts} />}
        {tab === 'matrix' && <MatrixTable artifacts={artifacts} />}
      </div>
    </div>
  );
}
