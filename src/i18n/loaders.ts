/**
 * The non-English catalogs, one lazy loader per file in `locales/` (decision
 * 19). Vite turns each `import()` into a same-origin chunk, so the strict CSP
 * holds and a reader fetches only their own language. `en.json` is left out:
 * it is imported statically as the source and the fallback.
 */

/** The loaders by file path (`./locales/es.json`), each resolving to the parsed JSON. */
export const LOADERS: Readonly<Record<string, () => Promise<unknown>>> = import.meta.glob(
  ['./locales/*.json', '!./locales/en.json'],
  { import: 'default' },
);
