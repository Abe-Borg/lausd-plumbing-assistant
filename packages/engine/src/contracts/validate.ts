// Import validation per contracts/dossier-contract.md v0.1 (plan §4.3).
//
// The contract's "If missing" column is normative. That yields three behavior tiers:
//   1. Hard blockers — missing/invalid `project.project_id`, missing `rooms`,
//      mismatched project_ids, duplicate room_ids, or an invalid present value on a
//      project-level ★ field → the whole import is refused (ok: false).
//   2. Room refusals — a room without a usable `room_id` or `name_as_drawn` (or with
//      an invalid value on a room-level ★ field) is refused *individually* and
//      surfaced in `refusedRooms`; the rest of the import proceeds.
//   3. Degradations — a missing ★-but-degradable field (school_level, project_type,
//      planned_capacity, classroom_count, building floors, room_number, building_id,
//      floor) produces a warning carrying the contract's stated degradation; the
//      engine's later stages implement that behavior (queueing, fallbacks, flags).
// Invalid values on *optional* fields are downgraded to warnings and treated as
// absent ("producer does not know"), per conventions 5/6 in contracts/README.md.

import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';
import { dossierSchema, roomProgramEnvelopeSchema, roomSchema } from './schemas.ts';
import type {
  Dossier,
  ImportIssue,
  ImportResult,
  RefusedRoom,
  RoomProgram,
  RoomRecord,
} from './types.ts';

export const SUPPORTED_CONTRACT_VERSION = '0.1';

const DOSSIER_REF = 'contracts/dossier-contract.md › Deliverable 1 (dossier.json)';
const ROOMS_REF = 'contracts/dossier-contract.md › Deliverable 2 (room_program.json)';
const CONVENTIONS_REF = 'contracts/README.md › Conventions';

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validateDossierSchema: ValidateFunction = ajv.compile(dossierSchema);
const validateRoomEnvelopeSchema: ValidateFunction = ajv.compile(roomProgramEnvelopeSchema);
const validateRoomSchema: ValidateFunction = ajv.compile(roomSchema);

/** Room-level ★ fields whose *invalid present value* refuses the room (plan §4.3). */
const ROOM_STAR_FIELDS = ['room_id', 'room_number', 'name_as_drawn', 'building_id', 'floor'];

function isAbsent(v: unknown): boolean {
  return v === undefined || v === null;
}

function describeAjvError(e: ErrorObject): string {
  const where = e.instancePath || '(root)';
  switch (e.keyword) {
    case 'required':
      return `${where}/${(e.params as { missingProperty: string }).missingProperty} is required`;
    case 'enum': {
      const allowed = ((e.params as { allowedValues: unknown[] }).allowedValues ?? [])
        .filter((v) => v !== null)
        .join(' | ');
      return `${where} must be one of: ${allowed}`;
    }
    case 'type':
      return `${where} must be of type ${(e.params as { type: string }).type}`;
    case 'minimum':
      return `${where} must be ≥ ${(e.params as { limit: number }).limit}`;
    case 'maximum':
      return `${where} must be ≤ ${(e.params as { limit: number }).limit}`;
    case 'minLength':
      return `${where} must not be empty`;
    default:
      return `${where} ${e.message ?? 'is invalid'}`;
  }
}

function issue(
  severity: 'error' | 'warning',
  code: string,
  path: string,
  message: string,
  contract_ref: string,
  degradation?: string,
): ImportIssue {
  return degradation
    ? { severity, code, path, message, contract_ref, degradation }
    : { severity, code, path, message, contract_ref };
}

interface DegradableFieldSpec {
  field: string;
  code: string;
  degradation: string;
}

/** Project-level ★ fields that degrade per the contract instead of blocking. */
const PROJECT_DEGRADABLE: DegradableFieldSpec[] = [
  {
    field: 'school_level',
    code: 'dossier.project.school_level.missing',
    degradation:
      'All age-dependent decisions queue per room. Practically everything depends on this — treat as required.',
  },
  {
    field: 'project_type',
    code: 'dossier.project.project_type.missing',
    degradation:
      'Engine assumes new_construction (the strictest rule set) and flags the assumption project-wide.',
  },
  {
    field: 'planned_capacity',
    code: 'dossier.project.planned_capacity.missing',
    degradation:
      'Fixture-count tabulation cannot be produced; all fixture-count decisions queue.',
  },
  {
    field: 'classroom_count',
    code: 'dossier.project.classroom_count.missing',
    degradation:
      'Staff fixture counts (2 adults per classroom, SDG 2.1-J) queue; the engine will offer to derive the count from the room program once room typing is complete.',
  },
];

function checkContractVersion(
  fileLabel: string,
  declared: unknown,
  contractRef: string,
  warnings: ImportIssue[],
): void {
  if (isAbsent(declared)) {
    warnings.push(
      issue(
        'warning',
        `${fileLabel}.contract_version.missing`,
        '/contract_version',
        `${fileLabel}: contract_version not stated — validating as ${SUPPORTED_CONTRACT_VERSION}. Producers should state the version they target.`,
        CONVENTIONS_REF,
      ),
    );
  } else if (declared !== SUPPORTED_CONTRACT_VERSION) {
    warnings.push(
      issue(
        'warning',
        `${fileLabel}.contract_version.unsupported`,
        '/contract_version',
        `${fileLabel}: targets contract version ${String(declared)}; this build implements ${SUPPORTED_CONTRACT_VERSION} and will validate against it. Field changes may be missed.`,
        CONVENTIONS_REF,
      ),
    );
  }
}

function validateDossier(
  input: unknown,
  errors: ImportIssue[],
  warnings: ImportIssue[],
): Dossier | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    errors.push(
      issue(
        'error',
        'dossier.not_object',
        '',
        'dossier.json: the file is not a JSON object — see the contract for the expected shape.',
        DOSSIER_REF,
      ),
    );
    return null;
  }

  checkContractVersion('dossier', (input as Record<string, unknown>).contract_version, DOSSIER_REF, warnings);

  validateDossierSchema(input);
  const schemaErrors = validateDossierSchema.errors ?? [];
  let blocked = false;
  for (const e of schemaErrors) {
    // Anything the dossier schema flags is on a typed/★ field (the schema does not
    // constrain unknown fields), so an invalid present value blocks the import.
    // Missing required `project`/`project_id` also lands here.
    blocked = true;
    errors.push(
      issue(
        'error',
        'dossier.invalid',
        e.instancePath || '/',
        `dossier.json: ${describeAjvError(e)} — see ${DOSSIER_REF}.`,
        DOSSIER_REF,
      ),
    );
  }
  if (blocked) return null;

  const dossier = input as Dossier;
  const project = dossier.project;

  if (isAbsent(project.project_id) || project.project_id === '') {
    errors.push(
      issue(
        'error',
        'dossier.project.project_id.missing',
        '/project/project_id',
        'dossier.json: project.project_id is missing. It is the sole hard requirement (with rooms) — import refused. See the contract.',
        DOSSIER_REF,
      ),
    );
    return null;
  }

  for (const spec of PROJECT_DEGRADABLE) {
    if (isAbsent(project[spec.field])) {
      warnings.push(
        issue(
          'warning',
          spec.code,
          `/project/${spec.field}`,
          `dossier.json: project.${spec.field} is missing (★). Proceeding degraded — see ${DOSSIER_REF}.`,
          DOSSIER_REF,
          spec.degradation,
        ),
      );
    }
  }

  // span schools must say which grades they span, else per-room age bands queue.
  if (project.school_level === 'span' && (isAbsent(project.grade_min) || isAbsent(project.grade_max))) {
    warnings.push(
      issue(
        'warning',
        'dossier.project.grade_span.missing',
        '/project/grade_min',
        'dossier.json: school_level is "span" but grade_min/grade_max are missing — rooms without their own age_band will queue.',
        DOSSIER_REF,
        'Rooms without an explicit age_band queue an age-band card.',
      ),
    );
  }

  const buildings = dossier.buildings ?? null;
  if (buildings === null || buildings.length === 0) {
    warnings.push(
      issue(
        'warning',
        'dossier.buildings.missing',
        '/buildings',
        'dossier.json: no buildings declared — rooms cannot anchor to a building; per-building outputs will be unavailable.',
        DOSSIER_REF,
        'Per-building artifacts and per-floor rules degrade to campus scope with flags.',
      ),
    );
  } else {
    buildings.forEach((b, i) => {
      if (isAbsent(b.building_id) || b.building_id === '') {
        warnings.push(
          issue(
            'warning',
            'dossier.building.building_id.missing',
            `/buildings/${i}/building_id`,
            `dossier.json: buildings[${i}] has no building_id (★) — rooms can't anchor to it. See ${DOSSIER_REF}.`,
            DOSSIER_REF,
            "Rooms referencing this building float; per-building outputs exclude them with a warning.",
          ),
        );
      }
      if (isAbsent(b.floors)) {
        warnings.push(
          issue(
            'warning',
            'dossier.building.floors.missing',
            `/buildings/${i}/floors`,
            `dossier.json: buildings[${i}]${b.building_id ? ` (${b.building_id})` : ''} has no floors (★). See ${DOSSIER_REF}.`,
            DOSSIER_REF,
            'Multi-story triggers (per-floor isolation valves, per-floor fixture coverage) queue.',
          ),
        );
      }
    });
  }

  return dossier;
}

function validateRoom(
  raw: unknown,
  index: number,
  warnings: ImportIssue[],
): { room: RoomRecord } | { refused: RefusedRoom } {
  const path = `/rooms/${index}`;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      refused: {
        index,
        issues: [
          issue(
            'error',
            'room.not_object',
            path,
            `room_program.json: rooms[${index}] is not an object — room refused. See ${ROOMS_REF}.`,
            ROOMS_REF,
          ),
        ],
      },
    };
  }

  const obj = raw as Record<string, unknown>;
  const refusalIssues: ImportIssue[] = [];

  validateRoomSchema(obj);
  for (const e of validateRoomSchema.errors ?? []) {
    const topField = e.instancePath.split('/')[1] ?? '';
    if (ROOM_STAR_FIELDS.includes(topField)) {
      // Invalid present value on a ★ field → the room is refused (plan §4.3).
      refusalIssues.push(
        issue(
          'error',
          `room.${topField}.invalid`,
          `${path}${e.instancePath}`,
          `room_program.json: rooms[${index}] ${describeAjvError(e)} — room refused. See ${ROOMS_REF}.`,
          ROOMS_REF,
        ),
      );
    } else {
      // Invalid value on an optional field → treated as "producer does not know".
      warnings.push(
        issue(
          'warning',
          `room.${topField || 'field'}.invalid_ignored`,
          `${path}${e.instancePath}`,
          `room_program.json: rooms[${index}] ${describeAjvError(e)} — value ignored (treated as unknown). See ${ROOMS_REF}.`,
          ROOMS_REF,
          'The dependent decisions queue in the exception queue instead of trusting an invalid value.',
        ),
      );
    }
  }

  if (isAbsent(obj.room_id) || obj.room_id === '') {
    refusalIssues.push(
      issue(
        'error',
        'room.room_id.missing',
        `${path}/room_id`,
        `room_program.json: rooms[${index}] has no room_id (★ stable ID) — import refused for the room. See ${ROOMS_REF}.`,
        ROOMS_REF,
      ),
    );
  }
  if (isAbsent(obj.name_as_drawn) || obj.name_as_drawn === '') {
    refusalIssues.push(
      issue(
        'error',
        'room.name_as_drawn.missing',
        `${path}/name_as_drawn`,
        `room_program.json: rooms[${index}] has no name_as_drawn (★) — it is the classification evidence and the audit trail; import refused for the room. See ${ROOMS_REF}.`,
        ROOMS_REF,
      ),
    );
  }

  if (refusalIssues.length > 0) {
    return {
      refused: {
        index,
        ...(typeof obj.room_id === 'string' && obj.room_id !== '' ? { room_id: obj.room_id } : {}),
        ...(typeof obj.room_number === 'string' ? { room_number: obj.room_number } : {}),
        ...(typeof obj.name_as_drawn === 'string' ? { name_as_drawn: obj.name_as_drawn } : {}),
        issues: refusalIssues,
      },
    };
  }

  const room = obj as unknown as RoomRecord;

  if (isAbsent(room.room_number) || room.room_number === '') {
    warnings.push(
      issue(
        'warning',
        'room.room_number.missing',
        `${path}/room_number`,
        `room_program.json: room ${room.room_id} has no room_number (★) — falling back to room_id on deliverables, flagged. See ${ROOMS_REF}.`,
        ROOMS_REF,
        'Deliverables show the room_id in place of a drawn room number.',
      ),
    );
  }
  if (isAbsent(room.building_id) || room.building_id === '') {
    warnings.push(
      issue(
        'warning',
        'room.building_id.missing',
        `${path}/building_id`,
        `room_program.json: room ${room.room_id} has no building_id (★) — room floats; per-building outputs exclude it with a warning. See ${ROOMS_REF}.`,
        ROOMS_REF,
        'Per-building artifacts exclude this room, with a warning.',
      ),
    );
  }
  if (isAbsent(room.floor)) {
    warnings.push(
      issue(
        'warning',
        'room.floor.missing',
        `${path}/floor`,
        `room_program.json: room ${room.room_id} has no floor (★). See ${ROOMS_REF}.`,
        ROOMS_REF,
        'Per-floor rules for this room queue.',
      ),
    );
  }

  return { room };
}

/**
 * Validate a dossier.json + room_program.json pair as one import.
 * Pure; never throws on bad data — everything comes back as issues.
 */
export function validateImport(dossierInput: unknown, roomProgramInput: unknown): ImportResult {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const refusedRooms: RefusedRoom[] = [];

  const dossier = validateDossier(dossierInput, errors, warnings);

  // --- room_program envelope ---
  let roomProgram: RoomProgram | null = null;
  if (typeof roomProgramInput !== 'object' || roomProgramInput === null || Array.isArray(roomProgramInput)) {
    errors.push(
      issue(
        'error',
        'room_program.not_object',
        '',
        'room_program.json: the file is not a JSON object — see the contract for the expected shape.',
        ROOMS_REF,
      ),
    );
  } else {
    checkContractVersion(
      'room_program',
      (roomProgramInput as Record<string, unknown>).contract_version,
      ROOMS_REF,
      warnings,
    );
    validateRoomEnvelopeSchema(roomProgramInput);
    const envelopeErrors = validateRoomEnvelopeSchema.errors ?? [];
    if (envelopeErrors.length > 0) {
      for (const e of envelopeErrors) {
        errors.push(
          issue(
            'error',
            'room_program.invalid',
            e.instancePath || '/',
            `room_program.json: ${describeAjvError(e)} — import refused (project_id and rooms are the hard requirements). See ${ROOMS_REF}.`,
            ROOMS_REF,
          ),
        );
      }
    } else {
      const envelope = roomProgramInput as RoomProgram;
      if ((envelope.rooms as unknown[]).length === 0) {
        errors.push(
          issue(
            'error',
            'room_program.rooms.empty',
            '/rooms',
            'room_program.json: rooms is empty — nothing to import. See the contract.',
            ROOMS_REF,
          ),
        );
      } else {
        const keptRooms: RoomRecord[] = [];
        (envelope.rooms as unknown[]).forEach((raw, i) => {
          const result = validateRoom(raw, i, warnings);
          if ('refused' in result) refusedRooms.push(result.refused);
          else keptRooms.push(result.room);
        });

        // Stable IDs are sacred: a duplicated room_id poisons decision persistence.
        const seen = new Map<string, number>();
        for (const r of keptRooms) {
          seen.set(r.room_id, (seen.get(r.room_id) ?? 0) + 1);
        }
        const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
        if (dupes.length > 0) {
          errors.push(
            issue(
              'error',
              'room_program.room_id.duplicate',
              '/rooms',
              `room_program.json: duplicate room_id values (${dupes.join(', ')}) — stable IDs must be unique (convention 4); import refused.`,
              CONVENTIONS_REF,
            ),
          );
        }

        if (envelope.ids_stable === false) {
          warnings.push(
            issue(
              'warning',
              'room_program.ids_stable.false',
              '/ids_stable',
              'room_program.json: producer declares ids_stable: false — decision persistence across re-imports is degraded and the import is flagged. (Matching heuristics are a future feature.)',
              CONVENTIONS_REF,
              'Re-imports may re-queue decisions that would otherwise persist.',
            ),
          );
        }

        roomProgram = { ...envelope, rooms: keptRooms };
      }
    }
  }

  // --- cross-file consistency (shared stable-ID space, convention 4) ---
  if (dossier && roomProgram && roomProgram.project_id !== dossier.project.project_id) {
    errors.push(
      issue(
        'error',
        'import.project_id.mismatch',
        '/project_id',
        `room_program.json project_id "${roomProgram.project_id}" does not match dossier.json project_id "${dossier.project.project_id}" — the files are not from the same export set; import refused.`,
        CONVENTIONS_REF,
      ),
    );
  }

  if (dossier && roomProgram) {
    const knownBuildings = new Set(
      (dossier.buildings ?? []).map((b) => b.building_id).filter((id): id is string => !!id),
    );
    const knownRooms = new Set(roomProgram.rooms.map((r) => r.room_id));
    roomProgram.rooms.forEach((room) => {
      const i = (roomProgram as RoomProgram).rooms.indexOf(room);
      if (room.building_id && !knownBuildings.has(room.building_id)) {
        warnings.push(
          issue(
            'warning',
            'room.building_id.unknown',
            `/rooms/${i}/building_id`,
            `room_program.json: room ${room.room_id} references building "${room.building_id}" which is not in dossier.json buildings — room floats; per-building outputs exclude it with a warning.`,
            ROOMS_REF,
            'Per-building artifacts exclude this room, with a warning.',
          ),
        );
      }
      for (const adj of room.adjacent_room_ids ?? []) {
        if (!knownRooms.has(adj)) {
          warnings.push(
            issue(
              'warning',
              'room.adjacent.unknown_ref',
              `/rooms/${i}/adjacent_room_ids`,
              `room_program.json: room ${room.room_id} lists adjacent room "${adj}" which is not in the room program — adjacency-dependent selections will queue with "confirm adjacency".`,
              ROOMS_REF,
              'Adjacency-dependent rules treat the reference as unknown.',
            ),
          );
        }
      }
    });
  }

  const ok = errors.length === 0 && dossier !== null && roomProgram !== null;
  return {
    ok,
    errors,
    warnings,
    dossier: ok ? dossier : null,
    roomProgram: ok ? roomProgram : null,
    refusedRooms,
  };
}
