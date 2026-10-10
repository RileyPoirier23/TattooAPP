// Tiny, safe markdown renderer for admin-editable pages. Builds React elements (no raw HTML).
import React from 'react';

function inline(text: string, keyBase: string): React.ReactNode[] {
  // **bold**, *italic*, [link](url)
  const out: React.ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[2]) out.push(<strong key={key}>{m[2]}</strong>);
    else if (m[4]) out.push(<em key={key}>{m[4]}</em>);
    else if (m[6]) {
      const href = /^(https?:|mailto:|tel:|\/(?!\/))/i.test(m[7]) ? m[7] : '#';
      const external = /^https?:/i.test(href);
      out.push(
        <a key={key} href={href} className="text-brand-primary underline" {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {m[6]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Fills in {{siteName}}, {{siteUrl}} and {{contact}} like the server does for published pages (used for previews). */
export function fillPageTokens(body: string, s: { siteName: string; contactEmail: string }, siteUrl: string): string {
  const contact = s.contactEmail ? `[${s.contactEmail}](mailto:${s.contactEmail})` : '[our contact form](/contact)';
  return body.replaceAll('{{siteName}}', s.siteName).replaceAll('{{siteUrl}}', siteUrl).replaceAll('{{contact}}', contact);
}

export const Markdown: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        const key = `b${bi}`;
        if (/^#{1,3}\s/.test(lines[0]) && lines.length === 1) {
          const level = lines[0].match(/^#+/)![0].length;
          const content = inline(lines[0].replace(/^#+\s*/, ''), key);
          if (level === 1) return <h2 key={key} className="text-2xl font-bold mt-8 mb-3 text-brand-dark dark:text-white">{content}</h2>;
          if (level === 2) return <h3 key={key} className="text-xl font-bold mt-6 mb-2 text-brand-dark dark:text-white">{content}</h3>;
          return <h4 key={key} className="text-lg font-semibold mt-4 mb-2 text-brand-dark dark:text-white">{content}</h4>;
        }
        if (lines.every(l => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={key} className="list-disc pl-6 space-y-1 my-3">
              {lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ''), `${key}-${li}`)}</li>)}
            </ul>
          );
        }
        if (lines.every(l => /^\s*\d+[.)]\s+/.test(l))) {
          return (
            <ol key={key} className="list-decimal pl-6 space-y-1 my-3">
              {lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*\d+[.)]\s+/, ''), `${key}-${li}`)}</li>)}
            </ol>
          );
        }
        // A heading followed by text in the same block.
        if (/^#{1,3}\s/.test(lines[0])) {
          return (
            <React.Fragment key={key}>
              <h3 className="text-xl font-bold mt-6 mb-2 text-brand-dark dark:text-white">{inline(lines[0].replace(/^#+\s*/, ''), key)}</h3>
              <p className="my-3 leading-relaxed">
                {lines.slice(1).map((l, li) => (
                  <React.Fragment key={li}>
                    {li > 0 && <br />}
                    {inline(l, `${key}-${li}`)}
                  </React.Fragment>
                ))}
              </p>
            </React.Fragment>
          );
        }
        return (
          <p key={key} className="my-3 leading-relaxed">
            {lines.map((l, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, `${key}-${li}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};
