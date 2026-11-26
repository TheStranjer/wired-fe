/**
 * Test that the refusal of a tree with no line runner follows the language
 * (decision 19, WFE-321).
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useLineRunner } from './LineRunnerContext';
import { installFakeLocale } from '../test/i18n';

describe(useLineRunner, () => {
  it('refuses in the language in use', async () => {
    installFakeLocale({ views: { runner: { unavailable: 'NO LINE' } } });
    const { result } = renderHook(() => useLineRunner());

    await expect(result.current(['/feed list'])).resolves.toStrictEqual({
      ok: false,
      message: 'NO LINE',
    });
  });
});
