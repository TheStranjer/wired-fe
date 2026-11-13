# wired-fe

The web frontend for Wired, a fediverse server ([wired-be](https://github.com/TheStranjer/wired-be)). It also works against Mastodon and Pleroma servers. It looks and behaves like a 1990s IRC or Battle.net client: a command line you post from, numbered windows, hotkeys for everything.

Status: scaffolding. The application itself is being built ticket by ticket.

## Requirements

- [mise](https://mise.jdx.dev/), which installs the Node and pnpm versions pinned in `mise.toml`
- Playwright's Chromium for the end-to-end tests: `pnpm exec playwright install --only-shell chromium`

## Development

```sh
mise install                       # Node and pnpm
pnpm install --frozen-lockfile     # dependencies
pnpm dev                           # dev server with hot reload
scripts/ci.sh                      # the whole gate: must exit 0 before a change is done
```

Other scripts: `pnpm build`, `pnpm preview`, `pnpm test`, `pnpm e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm format`.

## Configuration

The build reads one JSON configuration file (decision 3): the `WIRED_CONFIG` environment variable names it if set, otherwise `wired.config.json` if it exists (deployments keep their own; it is gitignored), otherwise `wired.config.example.json`. It is validated at build time and injected into the bundle as a constant; there is no runtime config fetch.

| Field               | Meaning                                                   |
| ------------------- | --------------------------------------------------------- |
| `appName`           | The name shown in the UI                                  |
| `instances.mode`    | `same-origin` \| `fixed` \| `list` \| `open` (decision 3) |
| `instances.origin`  | The one instance origin, for mode `fixed`                 |
| `instances.origins` | The origins the user may pick from, for mode `list`       |

## Output

`pnpm build` writes `dist/`: `index.html`, one `wired.[hash].js`, one `wired.[hash].css`, and the files from `public/`. Serve it from any static host. For the usual same-origin deployment, a reverse proxy sends API, OAuth, ActivityPub and well-known paths to the backend and everything else to `dist/`.

## Contributing

Read [AGENTS.md](AGENTS.md) (rules, allowed commands, conventions) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (numbered decisions).
