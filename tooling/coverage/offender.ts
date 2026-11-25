/**
 * What the diff-coverage gate reports: one offender per uncovered changed
 * line, banned comment or unmapped file, printed as `path:line message`.
 */

/** One problem the gate found. */
export type Offender = {
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

/** Orders offenders by file, then line, then message. */
export function compareOffenders(a: Offender, b: Offender): number {
  if (a.file !== b.file) {
    return a.file < b.file ? -1 : 1;
  }
  if (a.line !== b.line) {
    return a.line - b.line;
  }
  if (a.message === b.message) {
    return 0;
  }
  return a.message < b.message ? -1 : 1;
}

/** The printed form: `src/x.ts:42 branch 2/2 not taken`. */
export function formatOffender(offender: Offender): string {
  return `${offender.file}:${String(offender.line)} ${offender.message}`;
}
