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
    'commands',
    'accounts',
    'capabilities',
    'config',
    'lib',
    'theme',
  ],
  feature: ['ui', 'keys', 'commands', 'accounts', 'capabilities', 'api', 'config', 'lib'],
  ui: ['ui', 'lib'],
  keys: ['keys', 'commands', 'lib', 'config'],
  commands: ['commands', 'accounts', 'capabilities', 'api', 'config', 'lib'],
  accounts: ['accounts', 'capabilities', 'api', 'config', 'lib'],
  capabilities: ['capabilities', 'api', 'lib'],
  api: ['api', 'config', 'lib'],
  config: ['config', 'lib'],
  lib: ['lib'],
  theme: [],
  'test-support': ['test-support', 'api', 'lib'],
};

/** The policies for the `boundaries/dependencies` rule. */
export const LAYER_POLICIES = Object.entries(ALLOWED).map(([type, types]) => ({
  from: { element: { type } },
  allow: { to: { element: { types } } },
}));
