// App state: a thin shell around the pure engine. The project (dossier + room
// program) is loaded at runtime — staged from file picks on the load screen or
// resumed from localStorage — so one built artifact serves every project.
// Decision stores persist per project_id (plan §3); the last-opened project is
// remembered so reopening the app offers a resume.

import { useEffect, useMemo, useReducer } from 'react';
import {
  applyCardAnswer,
  archiveOrphans,
  buildArtifacts,
  computeDelta,
  emptyStore,
  reopenDecision,
  resolve,
  validateImport,
  type Artifacts,
  type CardAnswer,
  type DecisionStore,
  type DeltaSummary,
  type Dossier,
  type ResolveResult,
  type RoomProgram,
} from '@lausd-pa/engine';
import { kb, sample } from './data.ts';

export type View = 'dashboard' | 'queue' | 'artifacts';

/** A runtime-loaded project: validated dossier + the room program as loaded. */
export interface ActiveProject {
  dossier: Dossier;
  /** Raw as loaded — resolve() re-validates, so refused rooms surface as cards. */
  roomProgram: unknown;
  programLabel: string;
}

export function projectIdOf(project: ActiveProject): string {
  return project.dossier.project.project_id;
}

export interface PendingImport {
  label: string;
  roomProgram: unknown;
}

export interface AppState {
  phase: 'load' | 'importing' | 'workspace';
  /** Null until files are staged on the load screen (or a persisted project resumes). */
  project: ActiveProject | null;
  store: DecisionStore;
  view: View;
  selectedRoomId: string | null;
  pendingImport: PendingImport | null;
  /** Card ids answered this session — drives the "snap" animation. */
  lastAnswered: string | null;
}

export type Action =
  | { type: 'open_project'; project: ActiveProject }
  | { type: 'import_finished' }
  | { type: 'back_to_load' }
  | { type: 'reset_project' }
  | { type: 'set_view'; view: View }
  | { type: 'select_room'; roomId: string | null }
  | { type: 'answer_card'; result: ResolveResult; cardId: string; answer: CardAnswer }
  | { type: 'clear_answered' }
  | { type: 'reopen_decision'; decisionId: string }
  | { type: 'load_store'; store: DecisionStore }
  | { type: 'stage_import'; pending: PendingImport }
  | { type: 'cancel_import' }
  | { type: 'apply_import'; nextResolved: ResolveResult };

const PROJECT_KEY_PREFIX = 'lausd-pa:project:';
const LAST_PROJECT_KEY = 'lausd-pa:last-project';

interface PersistedProject {
  schema_version: 2;
  dossier: unknown;
  roomProgram: unknown;
  programLabel: string;
  store: DecisionStore;
}

function readPersistedProject(projectId: string): PersistedProject | null {
  try {
    const raw = localStorage.getItem(PROJECT_KEY_PREFIX + projectId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedProject;
    if (parsed.schema_version !== 2 || !parsed.store || parsed.store.project_id !== projectId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Pre-runtime-loading builds persisted under `lausd-pa:<project_id>` without a
// dossier (it was baked into the bundle). The only such build shipped the sample
// project, whose dossier still ships in the bundle — migrate that entry once so
// decisions saved in the old build survive the upgrade.
interface PersistedStateV1 {
  schema_version: 1;
  store: DecisionStore;
  programLabel: string;
  roomProgram: unknown;
}

function migrateV1SampleEntry(): void {
  try {
    const oldKey = `lausd-pa:${sample.projectId}`;
    const raw = localStorage.getItem(oldKey);
    if (!raw) return;
    localStorage.removeItem(oldKey); // one-shot: migrated or discarded
    const newKey = PROJECT_KEY_PREFIX + sample.projectId;
    if (localStorage.getItem(newKey)) return; // v2 data exists — don't clobber it
    const parsed = JSON.parse(raw) as PersistedStateV1;
    if (
      parsed.schema_version !== 1 ||
      !parsed.store ||
      parsed.store.project_id !== sample.projectId
    ) {
      return;
    }
    const payload: PersistedProject = {
      schema_version: 2,
      dossier: sample.dossier,
      roomProgram: parsed.roomProgram ?? sample.roomProgramV1,
      programLabel: parsed.programLabel || 'room_program.json (v1)',
      store: parsed.store,
    };
    localStorage.setItem(newKey, JSON.stringify(payload));
    if (!localStorage.getItem(LAST_PROJECT_KEY)) {
      localStorage.setItem(LAST_PROJECT_KEY, sample.projectId);
    }
  } catch {
    // Storage unavailable or a corrupt old entry — start fresh, as before.
  }
}

/** The last project worked on, if its persisted copy still validates. */
function loadLastProject(): { project: ActiveProject; store: DecisionStore } | null {
  try {
    const projectId = localStorage.getItem(LAST_PROJECT_KEY);
    if (!projectId) return null;
    const persisted = readPersistedProject(projectId);
    if (!persisted) return null;
    const report = validateImport(persisted.dossier, persisted.roomProgram);
    if (!report.ok || !report.dossier) return null;
    return {
      project: {
        dossier: report.dossier,
        roomProgram: persisted.roomProgram,
        programLabel: persisted.programLabel,
      },
      store: persisted.store,
    };
  } catch {
    return null;
  }
}

export function persist(state: AppState): void {
  if (!state.project) return;
  try {
    const projectId = projectIdOf(state.project);
    const payload: PersistedProject = {
      schema_version: 2,
      dossier: state.project.dossier,
      roomProgram: state.project.roomProgram,
      programLabel: state.project.programLabel,
      store: state.store,
    };
    localStorage.setItem(PROJECT_KEY_PREFIX + projectId, JSON.stringify(payload));
    localStorage.setItem(LAST_PROJECT_KEY, projectId);
  } catch {
    // Storage unavailable (private mode etc.) — the session still works.
  }
}

export function clearPersisted(projectId: string): void {
  try {
    localStorage.removeItem(PROJECT_KEY_PREFIX + projectId);
    if (localStorage.getItem(LAST_PROJECT_KEY) === projectId) {
      localStorage.removeItem(LAST_PROJECT_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function initialState(): AppState {
  migrateV1SampleEntry();
  const resumed = loadLastProject();
  return {
    phase: 'load',
    project: resumed?.project ?? null,
    store: resumed?.store ?? emptyStore(''),
    view: 'dashboard',
    selectedRoomId: null,
    pendingImport: null,
    lastAnswered: null,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'open_project': {
      const projectId = projectIdOf(action.project);
      // Decisions resume per project: the store already in state (resume path),
      // else whatever this browser persisted for the project, else empty.
      const store =
        state.store.project_id === projectId
          ? state.store
          : (readPersistedProject(projectId)?.store ?? emptyStore(projectId));
      return {
        ...state,
        phase: 'importing',
        project: action.project,
        store,
        view: 'dashboard',
        selectedRoomId: null,
        pendingImport: null,
        lastAnswered: null,
      };
    }
    case 'import_finished':
      return { ...state, phase: 'workspace' };
    case 'back_to_load':
      return { ...state, phase: 'load', pendingImport: null, selectedRoomId: null };
    case 'reset_project': {
      if (state.project) clearPersisted(projectIdOf(state.project));
      return {
        phase: 'load',
        project: null,
        store: emptyStore(''),
        view: 'dashboard',
        selectedRoomId: null,
        pendingImport: null,
        lastAnswered: null,
      };
    }
    case 'set_view':
      return { ...state, view: action.view, selectedRoomId: null };
    case 'select_room':
      return { ...state, selectedRoomId: action.roomId };
    case 'answer_card': {
      const store = applyCardAnswer(
        state.store,
        action.result,
        action.cardId,
        action.answer,
        new Date().toISOString(), // UI metadata only — engine never reads it
      );
      return { ...state, store, lastAnswered: action.cardId };
    }
    case 'clear_answered':
      return { ...state, lastAnswered: null };
    case 'reopen_decision':
      return { ...state, store: reopenDecision(state.store, action.decisionId) };
    case 'load_store':
      return { ...state, store: action.store };
    case 'stage_import':
      return { ...state, pendingImport: action.pending };
    case 'cancel_import':
      return { ...state, pendingImport: null };
    case 'apply_import': {
      if (!state.pendingImport || !state.project) return state;
      const livingIds = new Set(action.nextResolved.decision_points.map((d) => d.id));
      const store = archiveOrphans(
        state.store,
        livingIds,
        `room removed in ${state.pendingImport.label}`,
      );
      return {
        ...state,
        project: {
          ...state.project,
          roomProgram: state.pendingImport.roomProgram,
          programLabel: state.pendingImport.label,
        },
        store,
        pendingImport: null,
        view: 'queue',
      };
    }
  }
}

export interface EngineView {
  result: ResolveResult;
  artifacts: Artifacts;
  /** Present while an import is staged: the would-be next state + diff. */
  pending: { result: ResolveResult; delta: DeltaSummary } | null;
}

/** Null until a project is loaded. */
export function useEngine(state: AppState): EngineView | null {
  const { project, store, pendingImport } = state;
  const result = useMemo(
    () =>
      project
        ? resolve({ dossier: project.dossier, roomProgram: project.roomProgram, kb, store })
        : null,
    [project, store],
  );
  const artifacts = useMemo(() => (result ? buildArtifacts(kb, result) : null), [result]);
  const pending = useMemo(() => {
    if (!project || !pendingImport) return null;
    const nextResolved = resolve({
      dossier: project.dossier,
      roomProgram: pendingImport.roomProgram,
      kb,
      store,
    });
    const delta = computeDelta(project.roomProgram as RoomProgram, nextResolved, store);
    return { result: nextResolved, delta };
  }, [project, pendingImport, store]);
  if (!result || !artifacts) return null;
  return { result, artifacts, pending };
}

export function useAppState(): [AppState, React.Dispatch<Action>] {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  useEffect(() => {
    if (state.phase === 'workspace') persist(state);
  }, [state]);
  return [state, dispatch];
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, text: string, mime = 'text/csv'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
