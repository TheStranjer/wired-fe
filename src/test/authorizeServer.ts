/**
 * The MSW scaffolding the authorization tests share (AGENTS.md "Testing"):
 * `GET /oauth/authorize` answering the app info and `POST /oauth/authorize`
 * answering a decision, healthy unless a test replaces one answer, and a
 * record of what each carried. Test wiring only; no assertion lives here.
 */
import { HttpResponse, type JsonBodyType, http } from 'msw';

import { server } from './server';

/** The instance the authorization tests run against. */
export const ORIGIN = 'https://wired.example';

/** The request an app's redirect carries, as the address bar's query. */
export const QUERY: Readonly<Record<string, string>> = {
  client_id: 'client-1',
  redirect_uri: 'https://cool.example/cb',
  response_type: 'code',
  scope: 'read write:statuses',
  state: 'xyz',
  code_challenge: 'challenge',
  code_challenge_method: 'S256',
};

/** The healthy app-info answer. */
export const INFO = {
  app: { name: 'Cool App', website: 'https://cool.example' },
  scopes: ['read', 'write:statuses'],
  redirect_uri: 'https://cool.example/cb',
  state: 'xyz',
};

/** One answer: a JSON body and its status. */
type Answer = { readonly body: JsonBodyType; readonly status?: number };

/** The answers a test may replace. */
type AuthorizeAnswers = { readonly info?: Answer; readonly decision?: Answer };

/** What the two requests carried, filled in as they arrive. */
type AuthorizeSeen = {
  query: URLSearchParams | null;
  accept: string | null;
  auth: string | null;
  body: unknown;
};

/** The JSON response of {@link answer}. */
function respond(answer: Answer): Response {
  return HttpResponse.json(answer.body, { status: answer.status ?? 200 });
}

/** Answers `/oauth/authorize` at {@link origin} with {@link answers} over the healthy ones; returns what was seen. */
export function mockAuthorize(
  answers: AuthorizeAnswers = {},
  origin: string = ORIGIN,
): AuthorizeSeen {
  const seen: AuthorizeSeen = { query: null, accept: null, auth: null, body: null };
  server.use(
    http.get(`${origin}/oauth/authorize`, ({ request }) => {
      seen.query = new URL(request.url).searchParams;
      seen.accept = request.headers.get('Accept');
      return respond(answers.info ?? { body: INFO });
    }),
    http.post(`${origin}/oauth/authorize`, async ({ request }) => {
      seen.auth = request.headers.get('Authorization');
      seen.body = await request.json();
      return respond(
        answers.decision ?? {
          body: { redirect_uri: 'https://cool.example/cb?code=abc&state=xyz' },
        },
      );
    }),
  );
  return seen;
}
