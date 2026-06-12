// Act 1 — the load screen. Vista del Sol is preloaded; opening it runs the
// (sub-second) import and lands on the dashboard.

import { useEffect, useState } from 'react';
import { dossierJson } from '../data.ts';

export function LoadScreen({
  importing,
  roomCount,
  onOpen,
  onImported,
  resuming,
}: {
  importing: boolean;
  roomCount: number;
  onOpen: () => void;
  onImported: () => void;
  resuming: boolean;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!importing) return;
    const steps = [
      setTimeout(() => setStep(1), 150),
      setTimeout(() => setStep(2), 450),
      setTimeout(() => onImported(), 800),
    ];
    return () => steps.forEach(clearTimeout);
  }, [importing, onImported]);

  const p = dossierJson.project;
  return (
    <div className="load-screen">
      <header className="load-brand">
        <h1>LAUSD Standards/Decision Engine</h1>
        <p>Where project facts become LAUSD-compliant plumbing decisions.</p>
      </header>
      <div className="project-card">
        <div className="project-card-head">
          <h2>{p.school_name}</h2>
          <span className="pill">preloaded</span>
        </div>
        <dl className="project-facts">
          <div><dt>Project</dt><dd>{p.name}</dd></div>
          <div><dt>LAUSD ID</dt><dd>{p.lausd_project_id}</dd></div>
          <div><dt>Type</dt><dd>New construction · K-{p.grade_max}</dd></div>
          <div><dt>Capacity</dt><dd>{p.planned_capacity} students · {p.classroom_count} classrooms</dd></div>
          <div><dt>Water</dt><dd>{p.water_purveyor.name} · {p.street_pressure_psi} psi street</dd></div>
          <div><dt>Energy</dt><dd>All-electric (no gas service)</dd></div>
        </dl>
        {!importing ? (
          <button className="btn btn-primary btn-big" onClick={onOpen}>
            {resuming ? 'Resume project' : 'Open project'}
          </button>
        ) : (
          <div className="import-progress" role="status">
            <div className={step >= 0 ? 'done' : ''}>✓ dossier.json + room_program.json validated</div>
            <div className={step >= 1 ? 'done' : 'pending'}>
              {step >= 1 ? '✓' : '…'} {roomCount} rooms resolved against the LAUSD knowledge base
            </div>
            <div className={step >= 2 ? 'done' : 'pending'}>
              {step >= 2 ? '✓' : '…'} exception queue assembled
            </div>
          </div>
        )}
      </div>
      <footer className="load-foot">
        Inputs conform to <code>contracts/dossier-contract.md</code> v0.1 · no network, no LLM —
        every decision cites its LAUSD source.
      </footer>
    </div>
  );
}
