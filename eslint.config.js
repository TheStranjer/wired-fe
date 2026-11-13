// @ts-check
/**
 * ESLint configuration. Strict on purpose: see AGENTS.md "Linting".
 * Inline `eslint-disable` comments are switched off (`noInlineConfig`), so
 * the only way to pass a rule is to satisfy it. Rule tables live in
 * tooling/eslint/.
 */
import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import boundaries from 'eslint-plugin-boundaries';
import { flatConfigs as importConfigs } from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { configs as tsConfigs } from 'typescript-eslint';

import { LAYER_POLICIES, LAYERS } from './tooling/eslint/layers.js';
import { BASE_RULES, REMOTE_HTML_RULES, TEST_RULES } from './tooling/eslint/rules.js';

const TSCONFIGS = ['tsconfig.json'];

export default defineConfig(
  globalIgnores(['dist/', 'coverage/', 'test-results/', 'playwright-report/']),
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },
  js.configs.recommended,
  tsConfigs.strictTypeChecked,
  tsConfigs.stylisticTypeChecked,
  importConfigs.recommended,
  importConfigs.typescript,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: TSCONFIGS })],
    },
    rules: BASE_RULES,
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      eslintReact.configs['strict-type-checked'],
      reactHooks.configs.flat['recommended-latest'],
      jsxA11y.configs.strict,
    ],
    languageOptions: { globals: globals.browser },
    plugins: { boundaries },
    settings: {
      'boundaries/elements': LAYERS,
      'import/resolver': { typescript: { project: TSCONFIGS } },
    },
    rules: {
      'boundaries/dependencies': ['error', { default: 'disallow', policies: LAYER_POLICIES }],
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown-dependencies': 'error',
    },
  },
  {
    // AGENTS.md "Security" bans fetch/WebSocket *outside* their owning module,
    // src/api. Inside it they must stay reachable: this layer owns the HTTP
    // entry point (apiRequest) and the streaming client. The storage bans
    // still apply here; the storage module owns those.
    files: ['src/api/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Persistence goes through the storage module.' },
        { name: 'sessionStorage', message: 'Persistence goes through the storage module.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'Use the storage module.' },
        { object: 'window', property: 'sessionStorage', message: 'Use the storage module.' },
      ],
    },
  },
  {
    // The single sanctioned HTML sink (AGENTS.md Security, decision 10):
    // every ban except dangerouslySetInnerHTML stays in force for this file.
    files: ['src/ui/RemoteHtml.tsx'],
    rules: {
      ...REMOTE_HTML_RULES,
      '@eslint-react/dom-no-dangerously-set-innerhtml': 'off',
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'tooling/**/*.test.ts'],
    extends: [vitest.configs.all],
    rules: TEST_RULES,
  },
  {
    files: ['*.config.{js,ts}', 'tooling/**/*.{js,ts}', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['*.config.{js,ts}'],
    rules: { 'import-x/no-default-export': 'off' },
  },
);
