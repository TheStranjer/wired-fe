// @ts-check
/**
 * Rules applied to every linted file on top of the shared presets.
 * See AGENTS.md "Linting" for why these exist and why none may be loosened.
 */

/** Hard size limits. Split the code instead of raising them. */
/** @type {import('eslint').Linter.RulesRecord} */
const SIZE = {
  'max-lines': ['error', { max: 200, skipBlankLines: false, skipComments: false }],
  'max-lines-per-function': ['error', { max: 50, skipBlankLines: false, skipComments: false }],
  'max-statements': ['error', 15],
  'max-depth': ['error', 3],
  'max-params': ['error', 3],
  'max-nested-callbacks': ['error', 3],
  complexity: ['error', 10],
};

/** Plain JavaScript hygiene. */
/** @type {import('eslint').Linter.RulesRecord} */
const HYGIENE = {
  curly: ['error', 'all'],
  eqeqeq: ['error', 'always'],
  'no-console': 'error',
  'no-alert': 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-param-reassign': ['error', { props: true }],
  'no-nested-ternary': 'error',
  'no-implicit-coercion': 'error',
  'no-else-return': ['error', { allowElseIf: false }],
  'prefer-template': 'error',
  'object-shorthand': ['error', 'always'],
};

/** The selector of the ban that src/ui/RemoteHtml.tsx alone may lift. */
const DANGEROUS_HTML_SELECTOR = "JSXAttribute[name.name='dangerouslySetInnerHTML']";

/**
 * The no-restricted-syntax selector objects, without the leading "error".
 * Exported so REMOTE_HTML_RULES can re-apply every ban except the
 * dangerouslySetInnerHTML one to the single sanctioned HTML sink.
 * @public
 * @type {{ readonly selector: string; readonly message: string }[]}
 */
export const RESTRICTED_SYNTAX = [
  {
    selector: DANGEROUS_HTML_SELECTOR,
    message: 'Render remote HTML only through the sanitizing component (see AGENTS.md).',
  },
  {
    selector: "JSXAttribute[name.name='style']",
    message: 'Style with CSS modules and theme tokens, not inline styles.',
  },
  { selector: 'TSEnumDeclaration', message: 'Use a union of string literals.' },
  { selector: 'ForInStatement', message: 'Use Object.keys/entries or for...of.' },
];

/** Architectural bans: things that must go through one owning module. */
/** @type {import('eslint').Linter.RulesRecord} */
const BANS = {
  'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX],
  'no-restricted-globals': [
    'error',
    { name: 'fetch', message: 'HTTP goes through src/api.' },
    { name: 'WebSocket', message: 'Streaming goes through src/api.' },
    { name: 'localStorage', message: 'Persistence goes through the storage module.' },
    { name: 'sessionStorage', message: 'Persistence goes through the storage module.' },
  ],
  'no-restricted-properties': [
    'error',
    { object: 'window', property: 'fetch', message: 'HTTP goes through src/api.' },
    { object: 'window', property: 'localStorage', message: 'Use the storage module.' },
    { object: 'window', property: 'sessionStorage', message: 'Use the storage module.' },
  ],
};

/** TypeScript rules beyond strict-type-checked. */
/** @type {import('eslint').Linter.RulesRecord} */
const TYPESCRIPT = {
  '@typescript-eslint/ban-ts-comment': [
    'error',
    { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false },
  ],
  '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
  '@typescript-eslint/consistent-type-imports': 'error',
  '@typescript-eslint/consistent-type-exports': 'error',
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  '@typescript-eslint/strict-boolean-expressions': [
    'error',
    { allowString: false, allowNumber: false, allowNullableObject: false },
  ],
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
  '@typescript-eslint/prefer-readonly': 'error',
  '@typescript-eslint/no-shadow': 'error',
  '@typescript-eslint/no-import-type-side-effects': 'error',
  '@typescript-eslint/promise-function-async': 'error',
  '@typescript-eslint/require-array-sort-compare': 'error',
};

/** Import hygiene. */
/** @type {import('eslint').Linter.RulesRecord} */
const IMPORTS = {
  'import-x/no-cycle': 'error',
  'import-x/no-default-export': 'error',
  'import-x/no-mutable-exports': 'error',
  'import-x/no-relative-packages': 'error',
  'import-x/no-useless-path-segments': 'error',
  'import-x/no-extraneous-dependencies': 'error',
  'import-x/first': 'error',
  'import-x/newline-after-import': 'error',
  'import-x/order': [
    'error',
    {
      groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
    },
  ],
};

/** @type {import('eslint').Linter.RulesRecord} */
export const BASE_RULES = { ...SIZE, ...HYGIENE, ...BANS, ...TYPESCRIPT, ...IMPORTS };

/**
 * Test files: longer files and functions, the full Vitest rule set.
 * @type {import('eslint').Linter.RulesRecord}
 */
export const TEST_RULES = {
  'max-lines': ['error', { max: 400, skipBlankLines: false, skipComments: false }],
  'max-lines-per-function': 'off',
  'max-statements': 'off',
  'vitest/prefer-expect-assertions': 'off',
  'vitest/no-hooks': 'off',
  'vitest/require-hook': 'off',
  'vitest/prefer-importing-vitest-globals': 'off',
  'vitest/require-mock-type-parameters': 'off',
  'vitest/prefer-lowercase-title': 'off',
  'vitest/valid-title': ['error', { allowArguments: true }],
};

/**
 * Rules for src/ui/RemoteHtml.tsx, the one place raw HTML renders (AGENTS.md
 * Security, decision 10): every syntax ban still applies except the
 * dangerouslySetInnerHTML one.
 * @type {import('eslint').Linter.RulesRecord}
 */
export const REMOTE_HTML_RULES = {
  'no-restricted-syntax': [
    'error',
    ...RESTRICTED_SYNTAX.filter((entry) => entry.selector !== DANGEROUS_HTML_SELECTOR),
  ],
};
