// @ts-check
/**
 * Stylelint configuration. Colors and font stacks live only in
 * src/theme/tokens.css; every other stylesheet uses var(--...), so themes can
 * be swapped by redefining tokens.
 */

/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],
  reportNeedlessDisables: true,
  reportInvalidScopeDisables: true,
  reportDescriptionlessDisables: true,
  rules: {
    // CSS module class names are read from TypeScript as styles['fooBar'].
    'selector-class-pattern': [
      '^[a-z][a-zA-Z0-9]*$',
      { message: 'Use camelCase class names (CSS modules).' },
    ],
    'selector-max-id': [0, { ignoreContextFunctionalPseudoClasses: [':root'] }],
    'selector-max-compound-selectors': 3,
    'selector-max-specificity': '0,3,0',
    'max-nesting-depth': 2,
    'declaration-no-important': true,
    'color-named': 'never',
    'color-no-hex': true,
    'function-disallowed-list': [
      'rgb',
      'rgba',
      'hsl',
      'hsla',
      'hwb',
      'lab',
      'lch',
      'oklab',
      'oklch',
    ],
    'declaration-property-value-disallowed-list': { 'font-family': ['/^(?!var\\()/'] },
  },
  overrides: [
    {
      files: ['src/theme/tokens.css'],
      rules: { 'color-no-hex': null, 'function-disallowed-list': null },
    },
    {
      // The document root: the only place an id selector (#root) is allowed.
      files: ['src/theme/global.css'],
      rules: { 'selector-max-id': 1, 'selector-max-specificity': null },
    },
  ],
};
