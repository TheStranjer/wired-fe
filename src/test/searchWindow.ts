/**
 * The signed-in search window the search tests share (AGENTS.md "Testing"):
 * lain's account and one `search` window keyed to a query, as /search opens
 * it, built through the real reducers so a hook or a kind sees exactly what
 * the app would have shown it, plus the search document {@link serveSearch}
 * answers the load with over MSW: two accounts, one hashtag and two posts —
 * each test may swap the document or refuse the search. Every request's query
 * parameters are recorded, not assumed. No handler answers what a test never
 * served.
 */
import { HttpResponse, http } from 'msw';

import { status } from './fixtures';
import { server } from './server';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import type { SearchResults } from '../api/endpoints/search';
import type { Account } from '../api/schemas/account';
import type { Status } from '../api/schemas/status';
import type { ApiSession } from '../api/session';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import type { WindowRef } from '../windows/model';
import { windowId } from '../windows/model';

/** The instance a search test signs in to and is answered by. */
const ORIGIN = 'https://wired.example';

/** lain: the account the search window belongs to and fetches with. */
const SEARCH_ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};

/** The query the window searches for, as /search leaves it. */
export const SEARCH_QUERY = 'lain';

/** The search window, its id, and the id of the same ref without a target. */
export const SEARCH_REF: WindowRef = {
  kind: 'search',
  accountKey: SEARCH_ACCOUNT.key,
  target: SEARCH_QUERY,
};
export const SEARCH_WINDOW = windowId(SEARCH_REF);
export const SEARCH_TARGETLESS = windowId({ ...SEARCH_REF, target: null });

/** The session every served fetch arrives through. */
export const SEARCH_SESSION: ApiSession = { origin: ORIGIN, token: 'never-logged' };

/** An account on the wire: lain's fixture shape named by {@link acct}. */
function testAccount(acct: string, displayName: string): Account {
  const [username = acct] = acct.split('@');
  return { ...status('0').account, id: acct, username, acct, display_name: displayName };
}

/** lain, who has a display name, and a searcher's account without one. */
const LAIN: Account = testAccount('lain@wired.example', 'Lain Iwakura');
const NAMELESS: Account = testAccount('void@other.example', '');

/** The hashtag the document carries, as v2 answers it. */
const TAG_LAIN = { name: 'lain', url: `${ORIGIN}/tags/lain` };

/** The posts the document carries, in the API's newest-first order. */
const POST_TWO: Status = status('8', { content: '<p>present time</p>' });
const POST_ONE: Status = status('7', { content: '<p>is anyone there?</p>' });

/** The whole document {@link serveSearch} answers by default. */
export const FOUND: SearchResults = {
  accounts: [LAIN, NAMELESS],
  statuses: [POST_TWO, POST_ONE],
  hashtags: [TAG_LAIN],
};

/** What a served search may answer instead of the full document. */
export type ServeSearch = {
  /** Replace the whole document; parts left out read as empty lists. */
  readonly results?: Partial<SearchResults>;
  /** Refuse every search request. */
  readonly fail?: boolean;
};

/**
 * Answer the search load with {@link ServeSearch.results} over the full
 * {@link FOUND} document unless a test brings its own, and record each
 * request's query parameters in order.
 */
export function serveSearch(serve: ServeSearch = {}): URLSearchParams[] {
  const asked: URLSearchParams[] = [];
  const document = { ...FOUND, ...serve.results };
  server.use(
    http.get(`${ORIGIN}/api/v2/search`, ({ request }) => {
      asked.push(new URL(request.url).searchParams);
      return serve.fail === true
        ? HttpResponse.json({ error: 'Boom' }, { status: 500 })
        : HttpResponse.json(document);
    }),
  );
  return asked;
}

/** The signed-in state with the search window open; {@link loaded} pre-loads it. */
export function searchState(loaded = false): AppState {
  const withWindow = coreReducer(
    coreReducer(initialAppState(), {
      type: 'accounts',
      accounts: [SEARCH_ACCOUNT],
      activeKey: SEARCH_ACCOUNT.key,
    }),
    {
      type: 'windows',
      action: { type: 'open', ref: SEARCH_REF, title: `search/${SEARCH_QUERY}` },
    },
  );
  return loaded
    ? appReducer(withWindow, { type: 'load', windowId: SEARCH_WINDOW, load: 'loaded' })
    : withWindow;
}

/** {@link state} with a second search window open, this one with nothing to target. */
export function withTargetless(state: AppState): AppState {
  return coreReducer(state, {
    type: 'windows',
    action: { type: 'open', ref: { ...SEARCH_REF, target: null }, title: 'search/-' },
  });
}
