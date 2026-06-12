// Act 1 — the load screen. Projects load at runtime: pick a dossier.json and
// room_program.json, the contract validation (plan §4.3) runs immediately, and
// a passing pair opens into the workspace. The last project resumes from
// localStorage; the bundled Vista del Sol sample stages through the same path.

import { useEffect, useMemo, useState } from 'react';
import { validateImport, type Dossier, type ImportIssue } from '@lausd-pa/engine';
import { sample } from '../data.ts';
import type { ActiveProject } from '../state.ts';

interface StagedFile {
  name: string;
  data: unknown;
}

const LEVEL_LABELS: Record<string, string> = {
  eec: 'Early education',
  elementary: 'Elementary',
  middle: 'Middle',
  high: 'High school',
  span: 'Span',
  adult_ed: 'Adult ed',
};

const TYPE_LABELS: Record<string, string> = {
  new_construction: 'New construction',
  comprehensive_modernization: 'Comprehensive modernization',
  repair_expansion: 'Repair & expansion',
  addition: 'Addition',
  replacement_in_kind: 'Replacement in kind',
};

function gradeLabel(g: number | null | undefined): string | null {
  if (g == null) return null;
  return g === 0 ? 'K' : `${g}`;
}

function projectTitle(dossier: Dossier): string {
  const p = dossier.project;
  return p.school_name ?? p.name ?? p.project_id;
}

/** Facts grid; every field beyond project_id is optional in the contract. */
function ProjectFacts({ dossier }: { dossier: Dossier }) {
  const p = dossier.project;
  const grades = [gradeLabel(p.grade_min), gradeLabel(p.grade_max)].filter(Boolean).join('–');
  const typeBits = [
    p.project_type ? (TYPE_LABELS[p.project_type] ?? p.project_type) : null,
    p.school_level ? (LEVEL_LABELS[p.school_level] ?? p.school_level) : null,
    grades || null,
  ].filter(Boolean);
  const capacityBits = [
    p.planned_capacity != null ? `${p.planned_capacity} students` : null,
    p.classroom_count != null ? `${p.classroom_count} classrooms` : null,
  ].filter(Boolean);
  const waterBits = [
    p.water_purveyor?.name ?? null,
    p.street_pressure_psi != null ? `${p.street_pressure_psi} psi street` : null,
  ].filter(Boolean);
  const gas = p.gas?.has_service;
  return (
    <dl className="project-facts">
      <div><dt>Project</dt><dd>{p.name ?? p.project_id}</dd></div>
      <div><dt>LAUSD ID</dt><dd>{p.lausd_project_id ?? '—'}</dd></div>
      <div><dt>Type</dt><dd>{typeBits.length > 0 ? typeBits.join(' · ') : '—'}</dd></div>
      <div><dt>Capacity</dt><dd>{capacityBits.length > 0 ? capacityBits.join(' · ') : '—'}</dd></div>
      <div><dt>Water</dt><dd>{waterBits.length > 0 ? waterBits.join(' · ') : '—'}</dd></div>
      <div>
        <dt>Energy</dt>
        <dd>{gas == null ? '—' : gas ? 'Gas service' : 'All-electric (no gas service)'}</dd>
      </div>
    </dl>
  );
}

function IssueList({ issues, cap }: { issues: ImportIssue[]; cap: number }) {
  return (
    <ul>
      {issues.slice(0, cap).map((i, n) => (
        <li key={n}>{i.message}</li>
      ))}
      {issues.length > cap && <li>…and {issues.length - cap} more</li>}
    </ul>
  );
}

function FileRow({
  label,
  file,
  onPick,
}: {
  label: string;
  file: StagedFile | null;
  onPick: (file: File) => void;
}) {
  return (
    <div className="file-row">
      <code>{label}</code>
      <span className={file ? 'file-name staged' : 'file-name'}>
        {file ? `✓ ${file.name}` : 'not loaded'}
      </span>
      <label className="btn">
        {file ? 'Replace…' : 'Choose file…'}
        <input
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onPick(f);
          }}
        />
      </label>
    </div>
  );
}

export function LoadScreen({
  importing,
  roomCount,
  project,
  hasDecisions,
  onOpen,
  onImported,
}: {
  importing: boolean;
  roomCount: number;
  /** The resumable (or currently opening) project, if any. */
  project: ActiveProject | null;
  hasDecisions: boolean;
  onOpen: (project: ActiveProject) => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState(0);
  const [dossierFile, setDossierFile] = useState<StagedFile | null>(null);
  const [programFile, setProgramFile] = useState<StagedFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (!importing) return;
    const steps = [
      setTimeout(() => setStep(1), 150),
      setTimeout(() => setStep(2), 450),
      setTimeout(() => onImported(), 800),
    ];
    return () => steps.forEach(clearTimeout);
  }, [importing, onImported]);

  const stage = (which: 'dossier' | 'program') => (f: File) => {
    f.text().then((text) => {
      try {
        const data: unknown = JSON.parse(text);
        setParseError(null);
        (which === 'dossier' ? setDossierFile : setProgramFile)({ name: f.name, data });
      } catch {
        setParseError(`${f.name} is not valid JSON.`);
      }
    });
  };

  const report = useMemo(
    () =>
      dossierFile && programFile ? validateImport(dossierFile.data, programFile.data) : null,
    [dossierFile, programFile],
  );

  const staged: ActiveProject | null =
    report?.ok && report.dossier && programFile
      ? { dossier: report.dossier, roomProgram: programFile.data, programLabel: programFile.name }
      : null;

  const brand = (
    <header className="load-brand">
      <h1>LAUSD Standards/Decision Engine</h1>
      <p>Where project facts become LAUSD-compliant plumbing decisions.</p>
    </header>
  );
  const foot = (
    <footer className="load-foot">
      Inputs conform to <code>contracts/dossier-contract.md</code> v0.1 · no network, no LLM —
      every decision cites its LAUSD source.
    </footer>
  );

  if (importing && project) {
    return (
      <div className="load-screen">
        {brand}
        <div className="project-card">
          <div className="project-card-head">
            <h2>{projectTitle(project.dossier)}</h2>
          </div>
          <ProjectFacts dossier={project.dossier} />
          <div className="import-progress" role="status">
            <div className={step >= 0 ? 'done' : ''}>✓ dossier.json + room_program.json validated</div>
            <div className={step >= 1 ? 'done' : 'pending'}>
              {step >= 1 ? '✓' : '…'} {roomCount} rooms resolved against the LAUSD knowledge base
            </div>
            <div className={step >= 2 ? 'done' : 'pending'}>
              {step >= 2 ? '✓' : '…'} exception queue assembled
            </div>
          </div>
        </div>
        {foot}
      </div>
    );
  }

  return (
    <div className="load-screen">
      {brand}

      {project && (
        <div className="project-card">
          <div className="project-card-head">
            <h2>{projectTitle(project.dossier)}</h2>
            <span className="pill">{hasDecisions ? 'in progress' : 'last opened'}</span>
          </div>
          <ProjectFacts dossier={project.dossier} />
          <button className="btn btn-primary btn-big" onClick={() => onOpen(project)}>
            {hasDecisions ? 'Resume project' : 'Open project'}
          </button>
        </div>
      )}

      <div className="project-card">
        <div className="project-card-head">
          <h2>{project ? 'Or load a different project' : 'Load a project'}</h2>
        </div>
        <FileRow label="dossier.json" file={dossierFile} onPick={stage('dossier')} />
        <FileRow label="room_program.json" file={programFile} onPick={stage('program')} />
        {parseError && <div className="import-issues">{parseError}</div>}

        {report && !report.ok && (
          <div className="import-issues">
            <strong>Import refused</strong>
            <IssueList issues={report.errors} cap={6} />
          </div>
        )}

        {report?.ok && staged && (
          <>
            {(report.warnings.length > 0 || report.refusedRooms.length > 0) && (
              <details className="import-warnings">
                <summary>
                  {[
                    report.warnings.length > 0
                      ? `${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'} — engine proceeds degraded`
                      : null,
                    report.refusedRooms.length > 0
                      ? `${report.refusedRooms.length} room${report.refusedRooms.length === 1 ? '' : 's'} refused (queued as import blockers)`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </summary>
                <IssueList
                  issues={[...report.warnings, ...report.refusedRooms.flatMap((r) => r.issues)]}
                  cap={8}
                />
              </details>
            )}
            <div className="project-card-head">
              <h2>{projectTitle(staged.dossier)}</h2>
              <span className="pill">validated</span>
            </div>
            <ProjectFacts dossier={staged.dossier} />
            <button className="btn btn-primary btn-big" onClick={() => onOpen(staged)}>
              Open project
            </button>
          </>
        )}

        {!staged && (
          <div className="load-sample">
            No files handy?{' '}
            <button
              className="btn-ghost"
              onClick={() => {
                setParseError(null);
                setDossierFile({ name: 'dossier.json (bundled sample)', data: sample.dossier });
                setProgramFile({
                  name: 'room_program.json (sample v1)',
                  data: sample.roomProgramV1,
                });
              }}
            >
              Stage the bundled sample (Vista del Sol ES)
            </button>
          </div>
        )}
      </div>

      {foot}
    </div>
  );
}
