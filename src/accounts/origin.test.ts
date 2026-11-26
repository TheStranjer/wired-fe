/**
 * Tests for normalizing typed instance input and resolving the instance
 * origin in each of the four build modes (decision 3).
 */
import { describe, expect, it } from 'vitest';

import { type OriginChoice, normalizeTypedOrigin, resolveInstanceOrigin } from './origin';
import type { InstancesConfig } from '../config/schema';

const LIST_ORIGINS = ['https://wired.example', 'https://pleroma.example'];

const LIST: InstancesConfig = { mode: 'list', origins: LIST_ORIGINS };

/** Resolves on a `list` build and returns the choice. */
function resolveList(typed: string): OriginChoice {
  return resolveInstanceOrigin(LIST, 'https://fe.example', typed);
}

/** Resolves on a `list` build that also allows custom instances. */
function resolveCustom(typed: string): OriginChoice {
  return resolveInstanceOrigin(
    { mode: 'list', origins: LIST_ORIGINS, allowCustom: true },
    'https://fe.example',
    typed,
  );
}

describe(normalizeTypedOrigin, () => {
  it('prepends https:// to a bare host', () => {
    expect(normalizeTypedOrigin('wired.example')).toStrictEqual({
      ok: true,
      value: 'https://wired.example',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeTypedOrigin('  wired.example  ')).toStrictEqual({
      ok: true,
      value: 'https://wired.example',
    });
  });

  it('drops a path and trailing slash', () => {
    expect(normalizeTypedOrigin('https://wired.example/')).toStrictEqual({
      ok: true,
      value: 'https://wired.example',
    });
  });

  it('lowercases an upper-case scheme and host', () => {
    expect(normalizeTypedOrigin('HTTPS://Wired.Example')).toStrictEqual({
      ok: true,
      value: 'https://wired.example',
    });
  });

  it('strips a leading @user@ mention', () => {
    expect(normalizeTypedOrigin('@lain@wired.example')).toStrictEqual({
      ok: true,
      value: 'https://wired.example',
    });
  });

  it('accepts http:// on localhost', () => {
    expect(normalizeTypedOrigin('http://localhost:4000')).toStrictEqual({
      ok: true,
      value: 'http://localhost:4000',
    });
  });

  it('accepts http:// on 127.0.0.1', () => {
    expect(normalizeTypedOrigin('http://127.0.0.1:4000')).toStrictEqual({
      ok: true,
      value: 'http://127.0.0.1:4000',
    });
  });

  it('rejects http:// on a non-local host', () => {
    expect(normalizeTypedOrigin('http://wired.example')).toStrictEqual({
      ok: false,
      error: 'Only https instances are supported',
    });
  });

  it('rejects other schemes', () => {
    expect(normalizeTypedOrigin('ftp://wired.example')).toStrictEqual({
      ok: false,
      error: 'Only https instances are supported',
    });
  });

  it('rejects empty input', () => {
    expect(normalizeTypedOrigin('')).toStrictEqual({
      ok: false,
      error: 'Enter an instance, like wired.example',
    });
  });

  it('rejects whitespace-only input', () => {
    expect(normalizeTypedOrigin('   ')).toStrictEqual({
      ok: false,
      error: 'Enter an instance, like wired.example',
    });
  });

  it('rejects a mention with no host after it', () => {
    expect(normalizeTypedOrigin('@lain@')).toStrictEqual({
      ok: false,
      error: 'Enter an instance, like wired.example',
    });
  });

  it('rejects something that is not a host', () => {
    expect(normalizeTypedOrigin('not a host')).toStrictEqual({
      ok: false,
      error: 'Enter an instance, like wired.example',
    });
  });
});

describe(resolveInstanceOrigin, () => {
  it('same-origin takes the page origin and ignores typed input', () => {
    const instances: InstancesConfig = { mode: 'same-origin' };

    expect(resolveInstanceOrigin(instances, 'https://fe.example', 'junk')).toStrictEqual({
      ok: true,
      value: 'https://fe.example',
    });
  });

  it('fixed takes the configured origin and ignores typed input', () => {
    const instances: InstancesConfig = { mode: 'fixed', origin: 'https://wired.example' };

    expect(resolveInstanceOrigin(instances, 'https://fe.example', '')).toStrictEqual({
      ok: true,
      value: 'https://wired.example',
    });
  });

  it('list accepts a listed host typed bare', () => {
    expect(resolveList('wired.example')).toStrictEqual({
      ok: true,
      value: 'https://wired.example',
    });
  });

  it('list accepts a listed host typed with scheme and slash', () => {
    expect(resolveList('https://pleroma.example/')).toStrictEqual({
      ok: true,
      value: 'https://pleroma.example',
    });
  });

  it('list rejects a valid origin that is not listed', () => {
    expect(resolveList('https://evil.example')).toStrictEqual({
      ok: false,
      error: 'That instance is not available here',
    });
  });

  it('list rejects unparsable input', () => {
    expect(resolveList('')).toStrictEqual({
      ok: false,
      error: 'That instance is not available here',
    });
  });

  it('list with allowCustom still accepts a listed host', () => {
    expect(resolveCustom('wired.example')).toStrictEqual({
      ok: true,
      value: 'https://wired.example',
    });
  });

  it('list with allowCustom accepts an unlisted valid host', () => {
    expect(resolveCustom('@lain@other.example')).toStrictEqual({
      ok: true,
      value: 'https://other.example',
    });
  });

  it('list with allowCustom forwards normalization failures', () => {
    expect(resolveCustom('http://other.example')).toStrictEqual({
      ok: false,
      error: 'Only https instances are supported',
    });
    expect(resolveCustom('')).toStrictEqual({
      ok: false,
      error: 'Enter an instance, like wired.example',
    });
  });

  it('list with allowCustom false still refuses an unlisted host', () => {
    const instances: InstancesConfig = {
      mode: 'list',
      origins: LIST_ORIGINS,
      allowCustom: false,
    };

    expect(resolveInstanceOrigin(instances, 'https://fe.example', 'other.example')).toStrictEqual({
      ok: false,
      error: 'That instance is not available here',
    });
  });

  it('an empty list with allowCustom accepts any valid host', () => {
    const instances: InstancesConfig = { mode: 'list', origins: [], allowCustom: true };

    expect(resolveInstanceOrigin(instances, 'https://fe.example', 'other.example')).toStrictEqual({
      ok: true,
      value: 'https://other.example',
    });
  });

  it('open accepts any valid typed instance', () => {
    const instances: InstancesConfig = { mode: 'open' };

    expect(
      resolveInstanceOrigin(instances, 'https://fe.example', '@lain@other.example'),
    ).toStrictEqual({ ok: true, value: 'https://other.example' });
  });

  it('open forwards normalization failures', () => {
    const instances: InstancesConfig = { mode: 'open' };

    expect(
      resolveInstanceOrigin(instances, 'https://fe.example', 'http://wired.example'),
    ).toStrictEqual({ ok: false, error: 'Only https instances are supported' });
  });

  it('open rejects empty input', () => {
    const instances: InstancesConfig = { mode: 'open' };

    expect(resolveInstanceOrigin(instances, 'https://fe.example', '')).toStrictEqual({
      ok: false,
      error: 'Enter an instance, like wired.example',
    });
  });
});
