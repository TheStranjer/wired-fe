/**
 * Guards the theme tokens (WFE-303): every `var(--name)` a stylesheet uses must
 * resolve in every theme, because an unresolved `var()` silently drops the
 * whole declaration (a missing border, say) and no linter sees it.
 */

import { describe, expect, it } from 'vitest';

const MODULE_CSS = import.meta.glob<string>('../**/*.module.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const THEME_CSS = import.meta.glob<string>('./*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const SOURCES = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
const TOKENS = THEME_CSS['./tokens.css'] ?? '';

const REFERENCE = /var\(\s*(--[\w-]+)/g;
const DECLARATION = /(--[\w-]+)\s*:/g;
const RUNTIME_PROPERTY = /setProperty\(\s*'(--[\w-]+)'/g;
const BLOCK = /([^{}]+)\{([^{}]*)\}/g;
const ROOT = ':root';
const THEME_SELECTOR = /^:root\[data-theme='(\w+)'\]$/;

/** The custom property names `pattern` captures in `text`, in order. */
function names(pattern: RegExp, text: string): string[] {
  return Array.from(text.matchAll(pattern), (match) => match[1] ?? '');
}

/** `css` without its comments. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The custom properties each `tokens.css` block declares, keyed by `:root` or theme name. */
function declaredByBlock(css: string): Map<string, Set<string>> {
  const blocks = new Map<string, Set<string>>();
  for (const [, selector = '', body = ''] of stripComments(css).matchAll(BLOCK)) {
    const trimmed = selector.trim();
    const key = trimmed === ROOT ? ROOT : THEME_SELECTOR.exec(trimmed)?.[1];
    if (key !== undefined) {
      blocks.set(key, new Set(names(DECLARATION, body)));
    }
  }
  return blocks;
}

/** Every custom property each theme resolves: the `:root` block plus its own. */
function resolvedPerTheme(css: string): Map<string, Set<string>> {
  const blocks = declaredByBlock(css);
  const base = blocks.get(ROOT) ?? new Set<string>();
  const themes = new Map<string, Set<string>>();
  for (const [key, declared] of blocks) {
    if (key !== ROOT) {
      themes.set(key, new Set([...base, ...declared]));
    }
  }
  themes.set('wired', base);
  return themes;
}

/** The `var()` references in `css` that no theme, local declaration or {@link runtime} name defines. */
function unresolved(
  css: string,
  themes: Map<string, Set<string>>,
  runtime: ReadonlySet<string>,
): string[] {
  const text = stripComments(css);
  const local = new Set(names(DECLARATION, text));
  const missing: string[] = [];
  for (const name of new Set(names(REFERENCE, text))) {
    if (local.has(name) || runtime.has(name)) {
      continue;
    }
    for (const [theme, defined] of themes) {
      if (!defined.has(name)) {
        missing.push(`${name} (${theme})`);
      }
    }
  }
  return missing;
}

/** The `--color-*` tokens of the `:root` block that some other block does not declare. */
function missingColors(blocks: Map<string, Set<string>>): string[] {
  const colors = [...(blocks.get(ROOT) ?? [])].filter((name) => name.startsWith('--color-'));
  const missing: string[] = [];
  for (const [key, declared] of blocks) {
    for (const name of colors) {
      if (!declared.has(name)) {
        missing.push(`${name} (${key})`);
      }
    }
  }
  return missing;
}

/** Every unresolved reference in `sheets`, as `path: name (theme)`. */
function unresolvedIn(
  sheets: Record<string, string>,
  themes: Map<string, Set<string>>,
  runtime: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  for (const [path, css] of Object.entries(sheets)) {
    for (const name of unresolved(css, themes, runtime)) {
      problems.push(`${path}: ${name}`);
    }
  }
  return problems;
}

describe('theme tokens', () => {
  const themes = resolvedPerTheme(TOKENS);
  const runtime = new Set(Object.values(SOURCES).flatMap((code) => names(RUNTIME_PROPERTY, code)));

  it('finds the three themes', () => {
    expect([...themes.keys()].sort()).toStrictEqual(['bnet', 'lain', 'wired']);
  });

  it('defines every color token in every theme block', () => {
    expect(missingColors(declaredByBlock(TOKENS))).toStrictEqual([]);
  });

  it('defines the popup border token', () => {
    const lacking = [...themes]
      .filter(([, defined]) => !defined.has('--color-border-popup'))
      .map(([theme]) => theme);

    expect(lacking).toStrictEqual([]);
  });

  it('resolves every var() in every stylesheet in every theme', () => {
    const sheets = { ...MODULE_CSS, ...THEME_CSS };

    expect(Object.keys(sheets).length).toBeGreaterThan(10);
    expect(unresolvedIn(sheets, themes, runtime)).toStrictEqual([]);
  });

  it('flags a reference no theme defines', () => {
    const css = '.a { border: 1px solid var(--color-nope); color: var(--color-fg); }';

    expect(unresolved(css, themes, runtime).sort()).toStrictEqual([
      '--color-nope (bnet)',
      '--color-nope (lain)',
      '--color-nope (wired)',
    ]);
  });

  it('accepts a property declared in the same file or set at runtime', () => {
    expect(unresolved('.a { --x: 1; top: var(--x); }', themes, runtime)).toStrictEqual([]);
    expect(unresolved('.a { top: var(--float-x); }', themes, runtime)).toStrictEqual([]);
  });
});
