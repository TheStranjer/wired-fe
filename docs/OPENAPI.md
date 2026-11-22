# The Wired OpenAPI fixture

`src/api/fixtures/wired-openapi.json` is a **frozen** OpenAPI 3.0.3 document
listing the routes wired-be serves: one operation per row of wired-be's route
inventory, with an `operationId`, required string path parameters for
`:name` segments, the `oAuth2` scheme on every gated route, and a generic
`200 OK` response. It was first captured from wired-be's `GET /api/openapi`
(WBE-227), but wired-be removed that route, so the fixture is never
regenerated and nothing fetches it from a live backend. Tests read it from
disk only.

## Updating it

Edit the file by hand when the backend adds or removes a route the frontend
uses:

1. Read the rows of wired-be's `src/api/route_inventory` (path + method).
2. Add or delete the matching path item in the fixture, following the shape of
   its neighbours: keys sorted bytewise, `:name` written as `{name}`, `oAuth2`
   security on gated routes.
3. Run `pnpm exec prettier --write .`.

Routes wired-be removed (the `GET /api/openapi` route itself, the
preferred-frontend and frontend-configuration endpoints, the frontend switcher,
embed/HTML pages, OStatus and interaction pages, `manifest.json`,
`user_exists`, `check_password`, the HTML MFA pages, feeds, tag pages, mailer
unsubscribe and `instance/{name}.html`) must stay out;
`src/api/schemas/openapi.test.ts` asserts it.

`src/api/schemas/openapi.test.ts` also checks the document's entity examples
against the WFE schemas. The document carries no `components.schemas` examples,
so every entity is reported missing and those tests skip until examples are
added by hand.
