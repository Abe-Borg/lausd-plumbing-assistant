// Small shared pieces: completeness meter, citation chips (click → distilled
// text popover with doc/section/version + verification badge), DRAFT badge.

import type { Citation } from '@lausd-pa/kb';

export function Meter({
  resolved,
  total,
  size = 'normal',
}: {
  resolved: number;
  total: number;
  size?: 'normal' | 'large';
}) {
  const pct = total === 0 ? 100 : Math.round((resolved / total) * 100);
  return (
    <div className={`meter meter-${size}`} title={`${resolved} of ${total} decisions resolved`}>
      <div className="meter-track">
        <div
          className={`meter-fill${pct === 100 ? ' meter-done' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="meter-label">
        {pct}%{size === 'large' ? ` · ${resolved}/${total} decisions` : ''}
      </span>
    </div>
  );
}

export function DraftBadge({ title }: { title?: string }) {
  return (
    <span className="draft-badge" title={title ?? 'Awaiting human verification — see OPEN-QUESTIONS.md'}>
      DRAFT
    </span>
  );
}

export function CitationChips({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  // De-duplicate by doc+section.
  const seen = new Set<string>();
  const unique = citations.filter((c) => {
    const key = `${c.doc}|${c.section}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    <span className="citation-chips">
      {unique.map((c, i) => (
        <details key={i} className="citation">
          <summary className="citation-chip">
            {c.doc} {c.section.length > 28 ? `${c.section.slice(0, 28)}…` : c.section}
          </summary>
          <div className="citation-pop">
            <div className="citation-pop-head">
              {c.doc} · {c.section}
              {c.page !== undefined ? ` · p.${c.page}` : ''} · version {c.doc_version}
            </div>
            {c.note ? (
              <p className="citation-pop-note">
                “{c.note}” <span className="citation-distilled">distilled — verify against source</span>
              </p>
            ) : (
              <p className="citation-pop-note citation-distilled">
                Section reference (full text lives in the source document).
              </p>
            )}
          </div>
        </details>
      ))}
    </span>
  );
}
