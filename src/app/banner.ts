/**
 * The startup banner (WFE-135, AGENTS.md "Accessibility"): WIRED spelled in
 * five lines of block letters — `█` and spaces only, 19 columns wide, the
 * same word as the pixel-art default assets of decision 9. The art lives
 * here alone: src/app/startup.ts prints it, one decorative line at a time,
 * under the `WIRED // <appName>` text alternative the reader hears.
 */

/** The five lines of block letters, oldest printed first. */
export const BANNER: readonly string[] = [
  '█ █ █ █ ██  ███ ██',
  '█ █ █ █ █ █ █   █ █',
  '█ █ █ █ ██  ██  █ █',
  '██ ██ █ █ █ █   █ █',
  '██ ██ █ █ █ ███ ██',
];
