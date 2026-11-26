/**
 * The only exceptions to `wired/no-literal-user-text` (AGENTS.md "Linting"):
 * a literal that holds a word, sits where the rule looks, and still must not
 * go through `t()`. Each entry names the file, the exact text (a template
 * writes each `${…}` as `${}`; JSX text is trimmed, its runs of whitespace
 * made one space) and why. Keep it tiny: text a reader sees belongs in
 * `src/i18n/locales/en.json`, not here.
 */

/** One excused literal. */
type UserTextException = {
  /** Repo-relative path of the file that holds the literal. */
  readonly file: string;
  /** The literal's text exactly as written. */
  readonly text: string;
  /** Why this text is not user-facing. */
  readonly reason: string;
};

/** The product name, which no language translates. */
const PRODUCT_NAME = 'The name of the product, which no language translates.';

/** Registry validation messages, which name code paths for the developer. */
const DEVELOPER_ERROR =
  'A registry validation error for the developer, naming code, not for readers.';

/** Every excused literal. */
export const USER_TEXT_ALLOWLIST: readonly UserTextException[] = [
  { file: 'src/app/App.tsx', text: 'WIRED', reason: PRODUCT_NAME },
  { file: 'src/app/AppHeader.tsx', text: 'WIRED', reason: PRODUCT_NAME },
  { file: 'src/app/StartMenu.tsx', text: '[≡ wired]', reason: PRODUCT_NAME },
  {
    file: 'src/app/windowKinds.ts',
    text: 'window kind ${} is exported by ${} and ${}',
    reason: DEVELOPER_ERROR,
  },
  {
    file: 'src/commands/registry.ts',
    text: 'Invalid ${}: /${} (in command /${})',
    reason: DEVELOPER_ERROR,
  },
  {
    file: 'src/commands/registry.ts',
    text: 'Duplicate name: /${} (already used by /${})',
    reason: DEVELOPER_ERROR,
  },
  { file: 'src/lib/registry.ts', text: '${} does not export ${}', reason: DEVELOPER_ERROR },
];
