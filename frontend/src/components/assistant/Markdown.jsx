import React from 'react';

// Small, safe Markdown renderer for assistant replies: paragraphs, headings,
// bullet/numbered lists, tables, **bold** and `code`. It builds React elements
// (no innerHTML), so model output can never inject markup into the page.

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

function inline(text, key) {
  const out = [];
  let last = 0;
  let match;
  let i = 0;
  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    out.push(token.startsWith('**')
      ? <strong key={`${key}-${i++}`}>{token.slice(2, -2)}</strong>
      : <code key={`${key}-${i++}`}>{token.slice(1, -1)}</code>);
    last = INLINE.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
const isTableDivider = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^\s*#{1,4}\s+/;

export const Markdown = ({ text }) => {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;

    if (!line.trim()) {
      i += 1;
    } else if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const head = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={key} className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>{head.map((c, j) => <th key={j}>{inline(c, `${key}h${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, `${key}r${ri}c${j}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const pattern = ordered ? NUMBERED : BULLET;
      const items = [];
      while (i < lines.length && pattern.test(lines[i])) items.push(lines[i++].replace(pattern, ''));
      const List = ordered ? 'ol' : 'ul';
      blocks.push(<List key={key}>{items.map((t, j) => <li key={j}>{inline(t, `${key}i${j}`)}</li>)}</List>);
    } else if (HEADING.test(line)) {
      blocks.push(<p key={key} className="md-heading">{inline(line.replace(HEADING, ''), key)}</p>);
      i += 1;
    } else {
      // Always take the current line, so a stray "| ..." line can't stall the loop.
      const para = [lines[i++]];
      while (i < lines.length && lines[i].trim() && !isTableRow(lines[i]) && !BULLET.test(lines[i])
        && !NUMBERED.test(lines[i]) && !HEADING.test(lines[i])) {
        para.push(lines[i++]);
      }
      blocks.push(
        <p key={key}>
          {para.map((p, j) => (
            <React.Fragment key={j}>
              {j > 0 && <br />}
              {inline(p, `${key}p${j}`)}
            </React.Fragment>
          ))}
        </p>,
      );
    }
  }
  return <div className="md">{blocks}</div>;
};
