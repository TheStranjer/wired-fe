# The Wired OpenAPI snapshot

`src/api/fixtures/wired-openapi.json` records what wired-be's `GET /api/openapi`
answers (WBE-227): a 3.0.3 document that `src/api/openapi.rs` generates at
request time from the `ROUTES` inventory in `src/api/route_inventory.rs` — one
operation per row with an `operationId`, required string path parameters for
`:name` segments, the `oAuth2` scheme on every gated route, and a generic
`200 OK` response. wired-be commits no copy of it, so the fixture reproduces
that function's own output exactly as its unit tests sample it —
`document("Wired", "https://wired.example")` at the crate version — captured
from wired-be at commit `01db62d` and stored with serde_json's byte-sorted
object keys. To refresh it, check out wired-be at a commit containing WBE-227
or later, serve the app (or port `document()` the same way) with
`INSTANCE_NAME=Wired` and `BASE_URL=https://wired.example`, `GET /api/openapi`,
and replace the fixture with the answer, formatted by `pnpm exec prettier
--write .`. `src/api/schemas/openapi.test.ts` then checks the document's entity
examples against the WFE schemas; the WBE-227 document carries no
`components.schemas` examples yet, so every entity is reported missing there
until a later wired-be adds them.
