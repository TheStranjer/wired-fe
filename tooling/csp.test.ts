import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy, cspPlugin, withPolicy } from './csp';

describe(contentSecurityPolicy, () => {
  const policy = contentSecurityPolicy();

  it('denies everything by default', () => {
    expect(policy.startsWith("default-src 'none'")).toBe(true);
  });

  it('allows scripts and styles only from the page origin', () => {
    expect(policy).toContain("script-src 'self';");
    expect(policy).toContain("style-src 'self';");
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).not.toContain('unsafe-eval');
  });

  it('lets remote media load from any https origin', () => {
    expect(policy).toContain("img-src 'self' https: data: blob:");
  });

  it('forbids plugins, base rewriting and form posts', () => {
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'none'");
    expect(policy).toContain("form-action 'none'");
  });
});

describe(cspPlugin, () => {
  it('only applies to builds', () => {
    expect(cspPlugin().apply).toBe('build');
  });
});

describe(withPolicy, () => {
  it('puts the policy directly after the charset declaration', () => {
    const html = withPolicy('<head>\n    <meta charset="utf-8" />\n    <title>x</title>');
    const lines = html.split('\n').map((line) => line.trim());

    expect(lines[1]).toBe('<meta charset="utf-8" />');
    expect(lines[2]).toContain('http-equiv="Content-Security-Policy"');
    expect(lines[3]).toBe('<title>x</title>');
  });

  it('refuses a page without a charset declaration', () => {
    expect(() => withPolicy('<head></head>')).toThrow('must contain');
  });
});
