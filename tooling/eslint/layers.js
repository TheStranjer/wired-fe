// @ts-check
/**
 * Source layers and what each may import, enforced by
 * eslint-plugin-boundaries. AGENTS.md "Layout" explains each layer; keep the
 * two in sync. Lower layers never import higher ones.
 */

/** Every directory under src/ and the layer it belongs to. */
export const LAYERS = [
  { type: 'app', pattern: 'src/app' },
  { type: 'feature', pattern: 'src/features/*' },
  { type: 'views', pattern: 'src/views' },
  { type: 'ui', pattern: 'src/ui' },
  { type: 'keys', pattern: 'src/keys' },
  { type: 'windows', pattern: 'src/windows' },
  { type: 'state', pattern: 'src/state' },
  { type: 'commands', pattern: 'src/commands' },
  { type: 'accounts', pattern: 'src/accounts' },
  { type: 'capabilities', pattern: 'src/capabilities' },
  { type: 'api', pattern: 'src/api' },
  { type: 'i18n', pattern: 'src/i18n' },
  { type: 'config', pattern: 'src/config' },
  { type: 'storage', pattern: 'src/storage' },
  { type: 'lib', pattern: 'src/lib' },
  { type: 'theme', pattern: 'src/theme' },
  { type: 'test-support', pattern: 'src/test' },
];

/** What a layer may import: the layer types listed here and nothing else. */
const ALLOWED = {
  app: [
    'app',
    'feature',
    'views',
    'ui',
    'keys',
    'windows',
    'state',
    'commands',
    'accounts',
    'capabilities',
    'i18n',
    'config',
    'storage',
    'lib',
    'theme',
  ],
  feature: [
    'views',
    'ui',
    'keys',
    'windows',
    'state',
    'commands',
    'accounts',
    'capabilities',
    'api',
    'i18n',
    'config',
    'storage',
    'lib',
  ],
  views: [
    'views',
    'ui',
    'state',
    'api',
    'accounts',
    'capabilities',
    'windows',
    'i18n',
    'config',
    'lib',
  ],
  ui: ['ui', 'i18n', 'lib'],
  keys: ['keys', 'windows', 'commands', 'i18n', 'lib', 'config', 'storage'],
  windows: ['windows', 'i18n', 'lib'],
  state: ['state', 'windows', 'accounts', 'capabilities', 'api', 'i18n', 'config', 'lib'],
  commands: [
    'commands',
    'windows',
    'state',
    'accounts',
    'capabilities',
    'api',
    'i18n',
    'config',
    'storage',
    'lib',
  ],
  accounts: ['accounts', 'capabilities', 'api', 'i18n', 'config', 'storage', 'lib'],
  capabilities: ['capabilities', 'api', 'i18n', 'lib'],
  api: ['api', 'i18n', 'config', 'lib'],
  i18n: ['i18n', 'config', 'lib'],
  config: ['config', 'lib'],
  storage: ['storage', 'lib'],
  lib: ['lib'],
  theme: [],
  'test-support': [
    'test-support',
    'state',
    'commands',
    'accounts',
    'storage',
    'config',
    'windows',
    'api',
    'i18n',
    'lib',
  ],
};

/**
 * Test files may reach the shared test helpers (`server.use(...)` on the MSW
 * server, see src/test/server.ts). Production files still cannot import from
 * the test-support layer: the allowance keys on the file name, not the layer.
 */
const TEST_FILE_POLICY = {
  from: { file: { path: '**/*.test.{ts,tsx}' } },
  allow: { to: { element: { type: 'test-support' } } },
};

/** The policies for the `boundaries/dependencies` rule. */
export const LAYER_POLICIES = [
  ...Object.entries(ALLOWED).map(([type, types]) => ({
    from: { element: { type } },
    allow: { to: { element: { types } } },
  })),
  TEST_FILE_POLICY,
];
