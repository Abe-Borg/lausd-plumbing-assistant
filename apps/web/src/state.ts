// App state: a thin shell around the pure engine. The engine result is a memo
// of (dossier, active room program, decision store); the store persists to
// localStorage keyed by project_id and via download/load JSON (plan §3).

import { useEffect, useMemo, useReducer } from 'react';
import {
  applyCardAnswer,
  archiveOrphans,
  buildArtifacts,
  computeDelta,
  emptyStore,
  reopenDecision,
  resolve,
  type Artifacts,
  type CardAnswer,
  type DecisionStore,
  type DeltaSummary,
  type ResolveResult,
  type RoomProgram,
} from '@lausd-pa/engine';
import { dossierJson, kb, PROJECT_ID, roomProgramV1 } from './data.ts';

export type View = 'dashboard' | 'queue' | 'artifacts';

export interface PendingImport {
  label: string;
  roomProgram: unknown;
}

export interface AppState {
  phase: 'load' | 'importing' | 'workspace';
  /** The active room program (v1 bundled, or whatever was imported/applied). */
  roomProgram: unknown;
  programLabel: string;
  store: DecisionStore;
  view: View;
  selectedRoomId: string | null;
  pendingImport: PendingImport | null;
  /** Card ids answered this session — drives the "snap" animation. */
  lastAnswered: string | null;
}

export type Action =
  | { type: 'open_project' }
  | { type: 'import_finished' }
  | { type: 'set_view'; view: View }
  | { type: 'select_room'; roomId: string | null }
  | { type: 'answer_card'; result: ResolveResult; cardId: string; answer: CardAnswer }
  | { type: 'clear_answered' }
  | { type: 'reopen_decision'; decisionId: string }
  | { type: 'load_store'; store: DecisionStore }
  | { type: 'stage_import'; pending: PendingImport }
  | { type: 'cancel_import' }
  | { type: 'apply_import'; nextResolved: ResolveResult }
  | { type: 'reset_demo' };

const STORAGE_KEY = `lausd-pa:${PROJECT_ID}`;

interface PersistedState {
  schema_version: 1;
  store: DecisionStore;
  programLabel: string;
  roomProgram: unknown;
}

function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.schema_version !== 1 || !parsed.store) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persist(state: AppState): void {
  try {
    const payload: PersistedState = {
      schema_version: 1,
      store: state.store,
      programLabel: state.programLabel,
      roomProgram: state.roomProgram,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage unavailable (private mode etc.) — the session still works.
  }
}

export function clearPersisted(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function initialState(): AppState {
  const persisted = loadPersisted();
  return {
    phase: 'load',
    roomProgram: persisted?.roomProgram ?? roomProgramV1,
    programLabel: persisted?.programLabel ?? 'room_program.json (v1)',
    store: persisted?.store ?? emptyStore(PROJECT_ID),
    view: 'dashboard',
    selectedRoomId: null,
    pendingImport: null,
    lastAnswered: null,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'open_project':
      return { ...state, phase: 'importing' };
    case 'import_finished':
      return { ...state, phase: 'workspace' };
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
      if (!state.pendingImport) return state;
      const livingIds = new Set(action.nextResolved.decision_points.map((d) => d.id));
      const store = archiveOrphans(
        state.store,
        livingIds,
        `room removed in ${state.pendingImport.label}`,
      );
      return {
        ...state,
        roomProgram: state.pendingImport.roomProgram,
        programLabel: state.pendingImport.label,
        store,
        pendingImport: null,
        view: 'queue',
      };
    }
    case 'reset_demo': {
      clearPersisted();
      return {
        ...initialState(),
        roomProgram: roomProgramV1,
        programLabel: 'room_program.json (v1)',
        store: emptyStore(PROJECT_ID),
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

export function useEngine(state: AppState): EngineView {
  const result = useMemo(
    () => resolve({ dossier: dossierJson, roomProgram: state.roomProgram, kb, store: state.store }),
    [state.roomProgram, state.store],
  );
  const artifacts = useMemo(() => buildArtifacts(kb, result), [result]);
  const pending = useMemo(() => {
    if (!state.pendingImport) return null;
    const nextResolved = resolve({
      dossier: dossierJson,
      roomProgram: state.pendingImport.roomProgram,
      kb,
      store: state.store,
    });
    const delta = computeDelta(state.roomProgram as RoomProgram, nextResolved, state.store);
    return { result: nextResolved, delta };
  }, [state.pendingImport, state.roomProgram, state.store]);
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
