import { describe, expect, it } from 'vitest';

import { connectSources, contentSecurityPolicy, cspPlugin, withPolicy } from './csp';

describe(connectSources, () => {
  it('allows only the page origin when the backend is same-origin', () => {
    expect(connectSources({ mode: 'same-origin' })).toStrictEqual(["'self'"]);
  });

  it('allows the fixed origin and its websocket twin', () => {
    expect(connectSources({ mode: 'fixed', origin: 'https://wired.example' })).toStrictEqual([
      "'self'",
      'https://wired.example',
      'wss://wired.example',
    ]);
  });

  it('allows every listed origin and its websocket twin, in order', () => {
    expect(
      connectSources({
        mode: 'list',
        origins: ['https://wired.example', 'http://localhost:4000'],
      }),
    ).toStrictEqual([
      "'self'",
      'https://wired.example',
      'wss://wired.example',
      'http://localhost:4000',
      'ws://localhost:4000',
    ]);
  });

  it('allows any secure origin in a list with allowCustom', () => {
    expect(
      connectSources({ mode: 'list', origins: ['https://wired.example'], allowCustom: true }),
    ).toStrictEqual(["'self'", 'https:', 'wss:']);
  });

  it('allows any secure origin in open mode', () => {
    expect(connectSources({ mode: 'open' })).toStrictEqual(["'self'", 'https:', 'wss:']);
  });
});

describe(contentSecurityPolicy, () => {
  const policy = contentSecurityPolicy({ mode: 'same-origin' });

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

  it('restricts connect-src to the page origin in same-origin mode', () => {
    expect(policy).toContain("connect-src 'self';");
  });

  it('opens connect-src to every secure origin in open mode', () => {
    expect(contentSecurityPolicy({ mode: 'open' })).toContain("connect-src 'self' https: wss:");
  });

  it('keeps the other directives regardless of mode', () => {
    expect(contentSecurityPolicy({ mode: 'open' })).toContain("script-src 'self';");
    expect(contentSecurityPolicy({ mode: 'open' })).toContain("object-src 'none'");
  });
});

describe(cspPlugin, () => {
  it('only applies to builds', () => {
    expect(cspPlugin({ mode: 'same-origin' }).apply).toBe('build');
  });
});

describe(withPolicy, () => {
  it('puts the policy directly after the charset declaration', () => {
    const html = withPolicy('<head>\n    <meta charset="utf-8" />\n    <title>x</title>', {
      mode: 'same-origin',
    });
    const lines = html.split('\n').map((line) => line.trim());

    expect(lines[1]).toBe('<meta charset="utf-8" />');
    expect(lines[2]).toContain('http-equiv="Content-Security-Policy"');
    expect(lines[3]).toBe('<title>x</title>');
  });

  it('writes the connect-src the mode asks for', () => {
    const html = withPolicy('<meta charset="utf-8" />', {
      mode: 'fixed',
      origin: 'https://w.example',
    });

    expect(html).toContain('<meta http-equiv="Content-Security-Policy" content="default-src');
    expect(html).toContain("connect-src 'self' https://w.example wss://w.example");
  });

  it('refuses a page without a charset declaration', () => {
    expect(() => withPolicy('<head></head>', { mode: 'same-origin' })).toThrow('must contain');
  });
});
