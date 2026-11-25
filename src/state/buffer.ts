/**
 * One window's line buffer: the scrollback's content as pure state
 * (AGENTS.md "Windows, like IRC buffers"). A buffer holds its lines oldest
 * first — client messages, posts, notifications — the window's label book,
 * the navigation mode's selection, the content warnings standing open, and
 * how far paging into older history has got. Every transition is a pure
 * function returning a new buffer; nothing here mutates the one it was
 * given, so the app reducer can compose these freely.
 */

import type { PageCursor } from '../api/pagination';
import type { Notification } from '../api/schemas/notification';
import type { Status } from '../api/schemas/status';
import { EMPTY_LABEL_BOOK, type LabelBook } from '../windows/labels';

/** How a client message is emphasised: the levels src/ui/SystemLine draws. */
export type LineLevel = 'info' | 'warn' | 'error';

/** One client message in the scrollback: command output, a warning, an error. */
export type SystemLineData = {
  readonly kind: 'system';
  /** Identity stable for the life of the buffer, e.g. `sys:12`. */
  readonly key: string;
  /** The moment the client produced the message. */
  readonly date: Date;
  readonly level: LineLevel;
  readonly text: string;
  /** The text is decorative ASCII art (WFE-135): assistive technology skips
   * the whole line. Omitted for ordinary client messages. */
  readonly decorative?: boolean;
};

/** One post in the scrollback, as a timeline or thread line. */
export type PostLineData = {
  readonly kind: 'post';
  /** Identity stable for the life of the buffer; the status carries its own id. */
  readonly key: string;
  readonly status: Status;
  /** The key of the account that fetched this line (decision 14); null when unknown,
   * and commands then act as the window's account. */
  readonly accountKey: string | null;
};

/** One notification in the scrollback, the notifications window's line. */
export type NotificationLineData = {
  readonly kind: 'notification';
  /** Identity stable for the life of the buffer; the notification carries its own id. */
  readonly key: string;
  readonly notification: Notification;
  /** The key of the account that fetched this line (decision 14); null when unknown,
   * and commands then act as the window's account. */
  readonly accountKey: string | null;
};

/** Anything that can sit on a line of a window's scrollback. */
export type LineData = SystemLineData | PostLineData | NotificationLineData;

/** Where the window's own content stands: never fetched, fetching, shown, failed. */
export type BufferLoad = 'idle' | 'loading' | 'loaded' | 'error';

/** One window's scrollback as pure state. */
export type Buffer = {
  /** The lines, oldest first; never more than SCROLLBACK_LIMIT of them. */
  readonly lines: readonly LineData[];
  /** The window's post labels (src/windows/labels); the buffer carries the book. */
  readonly labels: LabelBook;
  /** The line navigation mode sits on, null while none does. */
  readonly selectedKey: string | null;
  /** Keys of the lines whose content warning is currently open. */
  readonly revealed: ReadonlySet<string>;
  readonly load: BufferLoad;
  /** The cursor that fetches the next older page, null while none is known. */
  readonly olderCursor: PageCursor | null;
  /** Whether the older end of the history is reached. */
  readonly exhausted: boolean;
  /** Bumped to ask the window to load older items; kept until handled. */
  readonly olderRequests: number;
};

/** The most lines one buffer holds; older lines drop off the top to make room. */
export const SCROLLBACK_LIMIT = 1000;

/** The buffer of a window that has shown nothing and fetched nothing. */
export const EMPTY_BUFFER: Buffer = {
  lines: [],
  labels: EMPTY_LABEL_BOOK,
  selectedKey: null,
  revealed: new Set<string>(),
  load: 'idle',
  olderCursor: null,
  exhausted: false,
  olderRequests: 0,
};

/**
 * The lines a buffer may hold: at most {@link SCROLLBACK_LIMIT} of them,
 * newest kept and oldest dropped. A list already within the limit comes
 * back as it is.
 */
export function capLines(lines: readonly LineData[]): readonly LineData[] {
  if (lines.length <= SCROLLBACK_LIMIT) {
    return lines;
  }
  return lines.slice(lines.length - SCROLLBACK_LIMIT);
}

/**
 * Append a client message at the bottom of the scrollback, keyed `sys:<seq>`,
 * and cap the result. `seq` is the caller's client-message counter, so keys
 * stay unique for the life of the buffer.
 */
export function appendSystem(
  buffer: Buffer,
  line: {
    readonly date: Date;
    readonly level: LineLevel;
    readonly text: string;
    readonly decorative?: boolean;
  },
  seq: number,
): Buffer {
  const entry: SystemLineData = { kind: 'system', key: `sys:${String(seq)}`, ...line };
  return { ...buffer, lines: capLines([...buffer.lines, entry]) };
}

/**
 * Empty the scrollback, what `/clear` and Ctrl+L do to a window. The lines
 * fall away and the selection and open content warnings with them; the label
 * book, the load state and the paging into older history all stay.
 */
export function clearBuffer(buffer: Buffer): Buffer {
  return { ...buffer, lines: [], selectedKey: null, revealed: new Set<string>() };
}
