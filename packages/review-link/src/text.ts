// The panel's words. Every one can be replaced through the `text` option, for another language
// or another tone. `{days}` and `{date}` are filled in when the panel is drawn.

export interface ReviewLinkText {
  /** The panel's heading in the entry editor. */
  panelTitle: string;
  /** What the panel is for. `{days}`: how long a link works. */
  about: string;
  make: string;
  makeAnother: string;
  /** Shown above a new link. `{date}`: when it stops working. */
  made: string;
  copy: string;
  rules: string;
  saveFirst: string;
  notConnected: string;
  failed: string;
}

export const DEFAULT_TEXT: ReviewLinkText = {
  panelTitle: 'Review link',
  about:
    'A private link to this draft for someone without an account, such as an outside reviewer. It works for {days} days.',
  make: 'Make a review link',
  makeAnother: 'Make another link',
  made: 'Review link made. It works until {date}.',
  copy: 'Copy the link and send it only to the reviewer. It is not kept here: to send it again, make another one.',
  rules:
    "Anyone with the link can read the draft, as it is each time they open it, until the link ends. It can't be ended early, except by changing the site's preview secret, which ends every preview and review link at once.",
  saveFirst: 'Save the draft first, so it has an address.',
  notConnected:
    "Review links are not set up on this site: it needs the EMDASH_PREVIEW_SECRET setting. The site's administrator can add it.",
  failed: 'The link could not be made just now. Try again in a minute.',
};

/** Fills `{name}` in a template; an unknown name is left as it is. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
