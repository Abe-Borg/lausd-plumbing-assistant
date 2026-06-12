// App shell: load screen → workspace (dashboard / queue / artifacts) with the
// room-detail drawer. The project loads at runtime from dossier.json +
// room_program.json picks; state persists to localStorage per project_id;
// decisions can be downloaded/loaded as JSON (plan §3).

import { useRef } from 'react';
import type { DecisionStore } from '@lausd-pa/engine';
import { sample } from './data.ts';
import { downloadJson, projectIdOf, useAppState, useEngine, type View } from './state.ts';
import { ArtifactsView } from './components/ArtifactsView.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { DeltaScreen } from './components/DeltaScreen.tsx';
import { LoadScreen } from './components/LoadScreen.tsx';
import { QueueView } from './components/QueueView.tsx';
import { RoomDetail } from './components/RoomDetail.tsx';
import { Meter } from './components/shared.tsx';

export function App() {
  const [state, dispatch] = useAppState();
  const engine = useEngine(state);
  const storeFileInput = useRef<HTMLInputElement>(null);
  const programFileInput = useRef<HTMLInputElement>(null);

  const stageProgramFile = (file: File) => {
    file.text().then((text) => {
      try {
        const parsed: unknown = JSON.parse(text);
        dispatch({ type: 'stage_import', pending: { label: file.name, roomProgram: parsed } });
      } catch {
        alert('Not a valid room_program JSON file.');
      }
    });
  };

  const project = state.project;
  if (state.phase !== 'workspace' || project === null || engine === null) {
    return (
      <LoadScreen
        importing={state.phase === 'importing'}
        roomCount={engine?.result.rooms.length ?? 0}
        project={project}
        hasDecisions={Object.keys(state.store.decisions).length > 0}
        onOpen={(p) => dispatch({ type: 'open_project', project: p })}
        onImported={() => dispatch({ type: 'import_finished' })}
      />
    );
  }

  const projectId = projectIdOf(project);
  const p = project.dossier.project;
  const { result, artifacts } = engine;
  const views: { id: View; label: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'queue', label: 'Queue', badge: result.cards.length },
    { id: 'artifacts', label: 'Artifacts' },
  ];

  const loadStoreFile = (file: File) => {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as DecisionStore;
        if (parsed.project_id !== projectId) {
          alert(`Decisions file is for project "${parsed.project_id}", not "${projectId}".`);
          return;
        }
        dispatch({ type: 'load_store', store: parsed });
      } catch {
        alert('Not a valid decisions JSON file.');
      }
    });
  };

  return (
    <div className="app">
      <header className="topbar no-print">
        <div className="topbar-title">
          <strong>{p.school_name ?? p.name ?? projectId}</strong>
          <span className="topbar-program">{project.programLabel}</span>
        </div>
        <nav className="topbar-nav">
          {views.map((v) => (
            <button
              key={v.id}
              className={state.view === v.id ? 'nav-active' : ''}
              onClick={() => dispatch({ type: 'set_view', view: v.id })}
            >
              {v.label}
              {v.badge !== undefined && v.badge > 0 && <span className="nav-badge">{v.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <Meter resolved={result.completeness.resolved} total={result.completeness.total} />
          <details
            className="menu"
            onClick={(e) => {
              // Close the menu once an item inside it is chosen.
              if ((e.target as HTMLElement).tagName === 'BUTTON') {
                e.currentTarget.removeAttribute('open');
              }
            }}
          >
            <summary>⋯</summary>
            <div className="menu-pop">
              {projectId === sample.projectId && (
                <button
                  onClick={() =>
                    dispatch({
                      type: 'stage_import',
                      pending: {
                        label: 'room_program.v2.json (DD revision)',
                        roomProgram: sample.roomProgramV2,
                      },
                    })
                  }
                >
                  Import sample DD revision (room_program.v2.json)
                </button>
              )}
              <button onClick={() => programFileInput.current?.click()}>
                Import room program from file…
              </button>
              <button
                onClick={() =>
                  downloadJson(`decisions-${projectId}.json`, state.store)
                }
              >
                Download decisions JSON
              </button>
              <button onClick={() => storeFileInput.current?.click()}>Load decisions JSON…</button>
              <button onClick={() => dispatch({ type: 'back_to_load' })}>Switch project…</button>
              <button
                onClick={() => {
                  if (confirm('Clear all saved decisions for this project and close it?')) {
                    dispatch({ type: 'reset_project' });
                  }
                }}
              >
                Clear project data…
              </button>
            </div>
          </details>
          <input
            ref={storeFileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadStoreFile(f);
              e.target.value = '';
            }}
          />
          <input
            ref={programFileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) stageProgramFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <main className="main">
        {state.view === 'dashboard' && (
          <Dashboard
            result={result}
            onGoQueue={() => dispatch({ type: 'set_view', view: 'queue' })}
            onGoArtifacts={() => dispatch({ type: 'set_view', view: 'artifacts' })}
            onSelectRoom={(roomId) => dispatch({ type: 'select_room', roomId })}
          />
        )}
        {state.view === 'queue' && (
          <QueueView
            result={result}
            lastAnswered={state.lastAnswered}
            onAnswer={(res, cardId, answer) =>
              dispatch({ type: 'answer_card', result: res, cardId, answer })
            }
            onSnapDone={() => dispatch({ type: 'clear_answered' })}
            onAllClear={() => dispatch({ type: 'set_view', view: 'artifacts' })}
          />
        )}
        {state.view === 'artifacts' && <ArtifactsView result={result} artifacts={artifacts} />}
      </main>

      {state.pendingImport && engine.pending && (
        <DeltaScreen
          label={state.pendingImport.label}
          delta={engine.pending.delta}
          nextResolved={engine.pending.result}
          onApply={() => dispatch({ type: 'apply_import', nextResolved: engine.pending!.result })}
          onCancel={() => dispatch({ type: 'cancel_import' })}
        />
      )}

      {state.selectedRoomId && (
        <RoomDetail
          result={result}
          roomId={state.selectedRoomId}
          onClose={() => dispatch({ type: 'select_room', roomId: null })}
          onReopen={(decisionId) => {
            dispatch({ type: 'reopen_decision', decisionId });
            dispatch({ type: 'select_room', roomId: null });
            dispatch({ type: 'set_view', view: 'queue' });
          }}
        />
      )}
    </div>
  );
}
