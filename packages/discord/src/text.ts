// The panel's and the post's words. Every one can be replaced through the `text` option, for
// another language or another tone. `{kind}` is the collection's `name` option ("post",
// "guide"), `{date}` a date, `{setting}` the name of the webhook setting.

export interface DiscordText {
  /** The panel's heading in the entry editor. */
  panelTitle: string;
  /** The switch under Plugins > Discord. */
  settingOn: string;
  settingOnNote: string;
  /** The small line above the post's title: "New {kind}". */
  newLabel: string;
  /** The same for an update: "Updated {kind}". */
  updateLabel: string;
  notConnected: string;
  off: string;
  waiting: string;
  notPosted: string;
  posted: string;
  updatePosted: string;
  failed: string;
  gaveUp: string;
  postNow: string;
  postAgain: string;
  postUpdate: string;
  updateLater: string;
  updateNote: string;
  done: string;
  notDone: string;
  tooMany: string;
  skip: string;
  skipNote: string;
  skipped: string;
  unskip: string;
}

export const DEFAULT_TEXT: DiscordText = {
  panelTitle: 'Discord',
  settingOn: 'Post newly published entries to Discord',
  settingOnNote:
    "Leave this off until the site's first entries are in, so they are not all posted at once. After you switch it on, only entries published for the first time are posted.",
  newLabel: 'New {kind}',
  updateLabel: 'Updated {kind}',
  notConnected:
    'Posting to Discord is not set up on this site (it needs the {setting} setting), so nothing is posted from here.',
  off: 'Posting to Discord is switched off, so nothing is posted. An admin can switch it on under Plugins > Discord.',
  waiting:
    'When this {kind} is first published, a short post goes to Discord, with its title, summary and picture and a link to it.',
  notPosted:
    'This {kind} was published before posting to Discord began, so it has not been posted. To share it now, press "Post to Discord".',
  posted: 'Posted to Discord on {date}.',
  updatePosted: 'An update was posted to Discord on {date}.',
  failed:
    'Posting to Discord did not work. The site tries again every 15 minutes, or you can press "Post again".',
  gaveUp:
    'Posting to Discord did not work after several tries. Press "Post again". If it still does not work, tell the site\'s administrator.',
  postNow: 'Post to Discord',
  postAgain: 'Post again',
  postUpdate: 'Post an update',
  updateLater: 'An update can be posted a day after the last post.',
  updateNote:
    'Post an update only for a real change, such as a new section. Corrections and small edits are never posted on their own.',
  done: 'Posted to Discord.',
  notDone:
    'It could not be posted just now. The site tries again in 15 minutes, or you can press the button again in a minute.',
  tooMany: 'Many posts went out this hour, so this one waits. The site tries again later.',
  skip: "Don't post this one",
  skipNote:
    "For anything that shouldn't be announced. For a new entry: save it as a draft, choose this, then publish. Everything else is still posted.",
  skipped: "This {kind} won't be posted to Discord, not even when it is first published.",
  unskip: 'Post it after all',
};

/** Fills `{name}` in a template; an unknown name is left as it is. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
