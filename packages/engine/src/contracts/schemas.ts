// JSON Schemas mirroring contracts/dossier-contract.md v0.1.
//
// Division of labor with validate.ts:
//   - Schemas check *types and enum values* of whatever is present. A present-but-
//     invalid ★ field is an import error (plan §4.3).
//   - Schemas only `require` the hard blockers (project.project_id; room_program
//     project_id + rooms). Every other ★ field's absence is handled in validate.ts
//     per the contract's normative "If missing" column.
//   - Unknown fields are ignored, never errors (contracts/README.md convention 5),
//     so `additionalProperties` stays open everywhere.
//   - `null` means "producer does not know" (convention 6): optional fields admit
//     null; validate.ts treats null exactly like absence.

const schoolLevels = ['eec', 'elementary', 'middle', 'high', 'span', 'adult_ed'] as const;
const projectTypes = [
  'new_construction',
  'comprehensive_modernization',
  'repair_expansion',
  'addition',
  'replacement_in_kind',
] as const;
const ageBands = ['preK_K', 'elementary', 'secondary_adult'] as const;
const roomScopes = ['new', 'modernized', 'untouched'] as const;
const foodService = ['none', 'serving_only', 'full_kitchen'] as const;

export const CONTRACT_ENUMS = { schoolLevels, projectTypes, ageBands, roomScopes, foodService };

const nullableString = { type: ['string', 'null'] };
const nullableBool = { type: ['boolean', 'null'] };
const nullableInt = { type: ['integer', 'null'] };

export const dossierSchema = {
  $id: 'dossier.schema.json',
  type: 'object',
  required: ['project'],
  properties: {
    contract_version: nullableString,
    project: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id: { type: 'string', minLength: 1 },
        name: nullableString,
        school_name: nullableString,
        lausd_project_id: nullableString,
        school_level: { type: ['string', 'null'], enum: [...schoolLevels, null] },
        grade_min: nullableInt,
        grade_max: nullableInt,
        project_type: { type: ['string', 'null'], enum: [...projectTypes, null] },
        planned_capacity: { type: ['integer', 'null'], minimum: 0 },
        classroom_count: { type: ['integer', 'null'], minimum: 0 },
        jurisdiction: {
          type: ['object', 'null'],
          properties: { city: nullableString, is_city_of_la: nullableBool },
        },
        water_purveyor: {
          type: ['object', 'null'],
          properties: { name: nullableString, is_ladwp: nullableBool },
        },
        street_pressure_psi: { type: ['number', 'null'], minimum: 0 },
        sewer_connection_known: nullableBool,
        gas: {
          type: ['object', 'null'],
          properties: {
            has_service: nullableBool,
            pressure_class: { type: ['string', 'null'], enum: ['low_8in_wc', 'medium_3psi', null] },
          },
        },
      },
    },
    buildings: {
      type: ['array', 'null'],
      items: {
        type: 'object',
        properties: {
          building_id: { type: 'string', minLength: 1 },
          name: nullableString,
          floors: { type: ['integer', 'null'], minimum: 0 },
          has_basement_or_subterranean_parking: nullableBool,
          is_existing: nullableBool,
        },
      },
    },
    campus_features: {
      type: ['object', 'null'],
      properties: {
        food_service: { type: ['string', 'null'], enum: [...foodService, null] },
        pool: nullableBool,
        science_labs: nullableBool,
        auto_shop: nullableBool,
        wood_shop: nullableBool,
        ceramics: nullableBool,
        agriculture: nullableBool,
        athletic_fields: nullableBool,
        eec_onsite: nullableBool,
        laundry: nullableBool,
        film_or_photo_lab: nullableBool,
        culinary_arts: nullableBool,
        parking_subterranean: nullableBool,
      },
    },
  },
} as const;

export const roomProgramEnvelopeSchema = {
  $id: 'room_program.envelope.schema.json',
  type: 'object',
  required: ['project_id', 'rooms'],
  properties: {
    contract_version: nullableString,
    project_id: { type: 'string', minLength: 1 },
    ids_stable: nullableBool,
    rooms: { type: 'array' },
  },
} as const;

// Validated one room at a time so each room collects its own issues and a bad
// room refuses only itself (contract: "Import refused for the room").
export const roomSchema = {
  $id: 'room.schema.json',
  type: 'object',
  properties: {
    room_id: { type: 'string', minLength: 1 },
    room_number: nullableString,
    name_as_drawn: { type: 'string', minLength: 1 },
    room_type_code: nullableString,
    room_type_confidence: { type: ['number', 'null'], minimum: 0, maximum: 1 },
    building_id: nullableString,
    floor: nullableInt,
    age_band: { type: ['string', 'null'], enum: [...ageBands, null] },
    occupant_load: { type: ['integer', 'null'], minimum: 0 },
    area_sf: { type: ['number', 'null'], minimum: 0 },
    is_outdoor: nullableBool,
    scope: { type: ['string', 'null'], enum: [...roomScopes, null] },
    ada_designated: nullableBool,
    adjacent_room_ids: { type: ['array', 'null'], items: { type: 'string' } },
    notes: nullableString,
  },
} as const;
