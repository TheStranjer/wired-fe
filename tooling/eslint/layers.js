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
  { type: 'ui', pattern: 'src/ui' },
  { type: 'keys', pattern: 'src/keys' },
  { type: 'windows', pattern: 'src/windows' },
  { type: 'commands', pattern: 'src/commands' },
  { type: 'accounts', pattern: 'src/accounts' },
  { type: 'capabilities', pattern: 'src/capabilities' },
  { type: 'api', pattern: 'src/api' },
  { type: 'config', pattern: 'src/config' },
  { type: 'lib', pattern: 'src/lib' },
  { type: 'theme', pattern: 'src/theme' },
  { type: 'test-support', pattern: 'src/test' },
];

/** What a layer may import: the layer types listed here and nothing else. */
const ALLOWED = {
  app: [
    'app',
    'feature',
    'ui',
    'keys',
    'windows',
    'commands',
    'accounts',
    'capabilities',
    'config',
    'lib',
    'theme',
  ],
  feature: [
    'ui',
    'keys',
    'windows',
    'commands',
    'accounts',
    'capabilities',
    'api',
    'config',
    'lib',
  ],
  ui: ['ui', 'lib'],
  keys: ['keys', 'windows', 'commands', 'lib', 'config'],
  windows: ['windows', 'lib'],
  commands: ['commands', 'windows', 'accounts', 'capabilities', 'api', 'config', 'lib'],
  accounts: ['accounts', 'capabilities', 'api', 'config', 'lib'],
  capabilities: ['capabilities', 'api', 'lib'],
  api: ['api', 'config', 'lib'],
  config: ['config', 'lib'],
  lib: ['lib'],
  theme: [],
  'test-support': ['test-support', 'api', 'lib'],
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
