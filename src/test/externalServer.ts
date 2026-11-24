/**
 * The MSW scaffolding the external-login tests share (AGENTS.md "Testing"):
 * the four anonymous endpoints, healthy unless a test replaces one answer, and
 * a record of what each carried. Test wiring only; no assertion lives here.
 */
import { HttpResponse, type JsonBodyType, http } from 'msw';

import { server } from './server';

/** The instance the external-login tests run against. */
export const ORIGIN = 'https://wired.example';

/** The healthy registration-details answer. */
export const DETAILS = {
  nickname: 'lain',
  email: 'lain@example.com',
  name: 'Lain Iwakura',
  provider: 'github',
};

/** The healthy consent-info answer. */
export const CONSENT = {
  app: { name: 'Cool App', website: 'https://cool.example' },
  scopes: ['read', 'write:statuses'],
};

/** One answer: a JSON body and its status. */
type Answer = { readonly body: JsonBodyType; readonly status?: number };

/** The answers a test may replace. */
type ExternalAnswers = {
  readonly details?: Answer;
  readonly register?: Answer;
  readonly consent?: Answer;
  readonly decision?: Answer;
};

/** What the requests carried, filled in as they arrive. */
type ExternalSeen = {
  query: URLSearchParams | null;
  accept: string | null;
  auth: string | null;
  registered: unknown;
  decided: unknown;
};

/** The JSON response of {@link answer}. */
function respond(answer: Answer): Response {
  return HttpResponse.json(answer.body, { status: answer.status ?? 200 });
}

/** Answers the external-login endpoints at {@link origin} with {@link answers} over the healthy ones; returns what was seen. */
export function mockExternal(answers: ExternalAnswers = {}, origin: string = ORIGIN): ExternalSeen {
  const seen: ExternalSeen = {
    query: null,
    accept: null,
    auth: null,
    registered: null,
    decided: null,
  };
  server.use(
    http.get(`${origin}/oauth/registration_details`, ({ request }) => {
      seen.query = new URL(request.url).searchParams;
      seen.accept = request.headers.get('Accept');
      seen.auth = request.headers.get('Authorization');
      return respond(answers.details ?? { body: DETAILS });
    }),
    http.post(`${origin}/oauth/register`, async ({ request }) => {
      seen.registered = await request.json();
      return respond(
        answers.register ?? { body: { redirect_uri: 'https://cool.example/cb?code=abc' } },
      );
    }),
    http.get(`${origin}/oauth/external/consent`, ({ request }) => {
      seen.query = new URL(request.url).searchParams;
      return respond(answers.consent ?? { body: CONSENT });
    }),
    http.post(`${origin}/oauth/external/consent`, async ({ request }) => {
      seen.decided = await request.json();
      return respond(
        answers.decision ?? { body: { redirect_uri: 'https://cool.example/cb?code=abc' } },
      );
    }),
  );
  return seen;
}
