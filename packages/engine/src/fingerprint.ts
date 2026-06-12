// Content-derived hashing for decision fingerprints and stable IDs (plan §9).
// No randomness, no timestamps — FNV-1a 64-bit over a canonical JSON encoding
// (object keys sorted recursively), hex-encoded.

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;

export function fnv1a64(text: string): string {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    // Work on UTF-16 code units; stable for any JS string.
    const unit = text.charCodeAt(i);
    hash ^= BigInt(unit & 0xff);
    hash = (hash * FNV_PRIME) & MASK64;
    hash ^= BigInt(unit >> 8);
    hash = (hash * FNV_PRIME) & MASK64;
  }
  return hash.toString(16).padStart(16, '0');
}

export function fingerprint(inputs: Record<string, unknown>): string {
  return fnv1a64(canonicalJson(inputs));
}
