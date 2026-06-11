// Regenerates data/taxonomy.json from contracts/room-type-taxonomy.md (the
// published controlled vocabulary). Run from packages/kb:
//
//   node scripts/generate-taxonomy.mjs
//
// The integrity test re-parses the markdown and fails if the committed JSON has
// drifted, so the contract doc stays the single source of truth.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

export function parseTaxonomyMarkdown(markdown) {
  const entries = [];
  for (const line of markdown.split('\n')) {
    // Data rows look like: | `code` | Display name | aliases | Water | hooks |
    const m = line.match(/^\|\s*`([a-z0-9_]+)`\s*\|/);
    if (!m) continue;
    const cells = line.split('|').map((c) => c.trim());
    // cells[0] is the empty string before the leading pipe.
    const code = m[1];
    const display_name = cells[2] ?? '';
    const aliasCell = cells[3] ?? '';
    const water_class_raw = cells[4] ?? '';
    const aliases =
      aliasCell === '—' || aliasCell === ''
        ? []
        : aliasCell.split(',').map((a) => a.trim()).filter((a) => a.length > 0);
    entries.push({ code, display_name, aliases, water_class_raw });
  }
  return entries;
}

const md = readFileSync(join(repoRoot, 'contracts', 'room-type-taxonomy.md'), 'utf8');
const entries = parseTaxonomyMarkdown(md);

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const out = join(here, '..', 'data', 'taxonomy.json');
  writeFileSync(out, JSON.stringify(entries, null, 2) + '\n');
  console.log(`Wrote ${entries.length} taxonomy entries to ${out}`);
}
