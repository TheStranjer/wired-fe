/**
 * The MSW scaffolding the registration tests share (AGENTS.md "Testing"): the
 * four endpoints of an invite sign-up — app registration, the app token,
 * `POST /api/v1/accounts` and `verify_credentials` — answered the way a
 * healthy instance answers unless a test replaces one answer, and a record of
 * what the account request carried. Test wiring only; no assertion lives here.
 */
import { HttpResponse, type JsonBodyType, http } from 'msw';

import { server } from './server';

/** The instance the registration tests sign up on. */
export const ORIGIN = 'https://wired.example';

/** The account the instance reports for the new token. */
const NEW_ACCOUNT_WIRE = {
  id: '109',
  username: 'lain',
  acct: 'lain',
  fqn: 'lain@wired.example',
  display_name: 'Lain',
  created_at: '2024-03-01T00:00:00.000Z',
  note: '<p>hi</p>',
  url: `${ORIGIN}/users/lain`,
  avatar: `${ORIGIN}/avi.png`,
  header: `${ORIGIN}/banner.png`,
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
};

/** One answer: a JSON body and its status. */
type Answer = { readonly body: JsonBodyType; readonly status?: number };

/** The answers a test may replace; each defaults to the healthy one. */
type RegistrationAnswers = {
  readonly app?: Answer;
  readonly appToken?: Answer;
  readonly accounts?: Answer;
  readonly verify?: Answer;
};

/** What the account request carried, filled in when it arrives. */
type RegistrationRequest = {
  auth: string | null;
  body: unknown;
};

/** The JSON response of {@link answer}. */
function respond(answer: Answer): Response {
  return HttpResponse.json(answer.body, { status: answer.status ?? 200 });
}

/** Answers the sign-up endpoints with {@link answers} over the healthy defaults; returns the account request as it was seen. */
export function mockRegistration(
  answers: RegistrationAnswers = {},
  origin: string = ORIGIN,
): RegistrationRequest {
  const seen: RegistrationRequest = { auth: null, body: null };
  server.use(
    http.post(`${origin}/api/v1/apps`, () =>
      respond(answers.app ?? { body: { client_id: 'cid', client_secret: 'csecret' } }),
    ),
    http.post(`${origin}/oauth/token`, () =>
      respond(answers.appToken ?? { body: { access_token: 'app-token' } }),
    ),
    http.post(`${origin}/api/v1/accounts`, async ({ request }) => {
      seen.auth = request.headers.get('Authorization');
      seen.body = await request.json();
      return respond(answers.accounts ?? { body: { access_token: 'user-token' } });
    }),
    http.get(`${origin}/api/v1/accounts/verify_credentials`, () =>
      respond(answers.verify ?? { body: NEW_ACCOUNT_WIRE }),
    ),
  );
  return seen;
}
