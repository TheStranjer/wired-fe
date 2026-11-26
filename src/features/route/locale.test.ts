/**
 * Tests that the route slice's text follows the language in use (decision
 * 19): the line for a link that names nothing is read from the catalog.
 */
import { describe, expect, it, vi } from 'vitest';

import { openRoute } from './openRoute';
import { installFakeLocale } from '../../test/i18n';
import { SEARCH_SESSION, serveSearch } from '../../test/searchWindow';

describe('the route slice in another language', () => {
  it('words the line for an unresolved link from the catalog', async () => {
    installFakeLocale({ features: { route: { not_found: 'XX not found {value}' } } });
    serveSearch({ results: { accounts: [], statuses: [], hashtags: [] } });
    const dispatch = vi.fn();

    await openRoute(
      { kind: 'interact', value: 'nobody@nowhere.example' },
      { accountKey: 'k', session: SEARCH_SESSION, dispatch },
    );

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'print',
        level: 'info',
        text: 'XX not found nobody@nowhere.example',
      }),
    );
  });
});
