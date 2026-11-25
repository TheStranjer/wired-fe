# wired-fe

The web frontend for Wired, a fediverse server ([wired-be](https://github.com/TheStranjer/wired-be)). It also works against Mastodon and Pleroma servers. It looks and behaves like a 1990s IRC or Battle.net client: a command line you post from, numbered windows, hotkeys for everything.

What it does today: sign in with OAuth (password login, invite sign-up, password reset, third-party app authorization and external-login consent), read home, local, federated, notification, thread, DM, hashtag, profile and search windows, and post, reply, favourite, boost and follow from the command line, with several accounts at once. Every action is a command, a hotkey and a click.

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

`pnpm e2e` runs the flows, the axe-core accessibility checks and the review screenshots against `dist/`; the PNGs land in `test-results/screens/<theme>-<screen>.png` (gitignored) for a human to look at.

## Configuration

The build reads one JSON configuration file (decision 3): the `WIRED_CONFIG` environment variable names it if set, otherwise `wired.config.json` if it exists (deployments keep their own; it is gitignored), otherwise `wired.config.example.json`. It is validated at build time and injected into the bundle as a constant; there is no runtime config fetch.

| Field               | Meaning                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `appName`           | The name shown in the UI                                                                           |
| `instances.mode`    | `same-origin` \| `fixed` \| `list` \| `open` (decision 3)                                          |
| `instances.origin`  | The one instance origin, for mode `fixed`                                                          |
| `instances.origins` | The origins the user may pick from, for mode `list`                                                |
| `basePath`          | Optional. The path the bundle is hosted under, e.g. `/fe/` (starts and ends with `/`); default `/` |

## Output

`pnpm build` writes `dist/`: `index.html`, one `wired.[hash].js`, one `wired.[hash].css`, and the files from `public/`. Serve it from any static host. For the usual same-origin deployment, put a reverse proxy in front of wired-be and `dist/`: see [Deploying in front of wired-be](#deploying-in-front-of-wired-be). Sending API, OAuth, ActivityPub and well-known paths to the backend and everything else to `dist/` is not enough; some paths belong to both.

### Permalinks and the SPA fallback

WiredFE routes by hash (decision 4): `/#/notice/<id>`, `/#/@user@host`, `/#/users/<id>`, and `/#/tag/<name>` open a thread, a profile or a hashtag window for the active account. wired-be redirects browsers to path routes on `FRONTEND_BASE_URL` instead (`/notice/<id>`, `/<nickname>`, `/users/<nickname>`, `/authorize_interaction?uri=`, `/registration/<token>`, `/password_reset/<token>`, `/oauth/authorize`, `/oauth/external/register`, `/oauth/external/consent`). On startup WiredFE rewrites those paths to the matching hash route with `history.replaceState`; `/registration/<token>` opens the sign-up overlay (username, email, password, agreement, optional reason), `/password_reset/<token>` opens the new-password overlay (two password fields; `/forgot <email|nick>` asks for the reset letter, no login needed), and the OAuth paths have no window and are only kept as a hash.

#### Remote follow and interaction links

When someone on another server clicks "follow" or "interact" for a user of this instance, their server sends the browser to the instance's WebFinger subscribe template. wired-be's template must be `{FRONTEND_BASE_URL}/#/authorize_interaction?uri={uri}` (a wired-be change, tracked separately). The path form `{FRONTEND_BASE_URL}/authorize_interaction?uri={uri}` (Mastodon's) also works: startup rewrites it to the hash form. The old `acct=` parameter is accepted in place of `uri=`, and a leading `acct:` is stripped. WiredFE searches the value with `resolve=true` as the active account: an account opens its profile window with `Type /follow to follow @<acct>` printed in it, a post opens its thread window, and no result prints `Could not find <value>`. With nobody signed in it prints the `/connect` hint and keeps the link for after login.

For that the static host must serve `index.html` for unknown paths (SPA fallback), e.g. nginx `try_files $uri /index.html;`. The bundle refers to its JS and CSS relatively, so the page loaded at `/notice/<id>` asks for `/notice/wired.<hash>.js`; the host must answer `/<any path>/wired.<hash>.js` and `.css` with the root files, or the page has no script. The next section gives the complete rules for a same-origin proxy.

#### Hosting under a sub-path

To serve WiredFE at `https://host/fe/`, set `"basePath": "/fe/"` in the build config and `FRONTEND_BASE_URL=https://host/fe` in wired-be. On startup WiredFE strips `basePath` before matching, so `/fe/notice/<id>` opens the thread, `/fe/oauth/authorize?...` the consent overlay, and `/fe/` and `/fe/index.html` are the page itself; the rewrite keeps the base (`/fe/#/notice/<id>`). The host must serve `index.html` for unknown paths under `/fe/` (nginx `location /fe/ { try_files $uri /fe/index.html; }`) and answer the nested asset requests (`/fe/<any path>/wired.<hash>.js` and `.css`) with the files in `/fe/` (`rewrite ^/fe/.+/(wired\..+)$ /fe/$1 last;`). Without `basePath` the bundle only recognises redirect paths at the origin root.

## Deploying in front of wired-be

The same-origin setup (`"mode": "same-origin"`) serves WiredFE and wired-be from one origin. A proxy that only splits "API paths" from "everything else" breaks login and profiles, because several paths belong to both sides. Apply these rules in this order; the first match wins.

1. **Nested assets go to `dist/`.** The bundle's asset URLs are relative, so the consent page at `/oauth/authorize` requests `/oauth/wired.<hash>.js` and a thread at `/notice/<id>` requests `/notice/wired.<hash>.js`. Both sit under paths the backend owns, so this rule must run before any backend rule. It maps `/<any path>/wired.<hash>.*` and `/<any path>/images/<file>` to the same file at the root of `dist/`. wired-be's default avatar, banner, thumbnail and mascot URLs (`/images/avi.png` and so on, decision 9) are covered by it too.
2. **The browser's consent pages go to `dist/index.html`.** `GET /oauth/authorize`, `GET /oauth/external/register` and `GET /oauth/external/consent` without `Accept: application/json` are WiredFE's own pages: wired-be redirects the browser to them on `FRONTEND_BASE_URL`, and the consent page renders there.
3. **The same three paths go to the backend otherwise.** The consent page's own `GET /oauth/authorize` carries `Accept: application/json`, and its `POST` has to reach wired-be, as does every other method.
4. **ActivityPub requests go to the backend.** `/users/<nick>` and `/notice/<id>` answer `Accept: application/activity+json` or `application/ld+json` from wired-be, and answer browsers from `dist/index.html` (the SPA fallback), which opens the profile or thread.
5. **Backend-only paths go to the backend:** `/api/*`, `/oauth/*`, `/.well-known/*`, `/nodeinfo/*`, `/inbox`, `/media/*`, `/emoji/*`, `/proxy/*`, `/schemas/*`, `/contexts/*`, `/activities/*`, `/internal/*`, `/quote_authorizations/*`, `/objects/*`, `/relay*`, and `/users/<nick>/inbox`, `outbox`, `followers`, `following` and `collections/*`.
6. **Streaming goes to the backend.** WebSocket upgrades (`Connection: Upgrade`, `/api/v1/streaming` under rule 5) need the upgrade headers passed through.
7. **Everything else is `dist/`**, with `index.html` for unknown paths: `/<nickname>`, `/authorize_interaction`, `/registration/<token>`, `/password_reset/<token>`, and the app itself.

Leave `FRONTEND_BASE_URL` unset in wired-be. It then equals `BASE_URL`, which is right for same-origin: redirects land on the shared origin and the rules above split them. If you send all of `/oauth/*` to the backend instead, wired-be redirects the browser to itself and the consent page never loads.

### nginx

```nginx
map $http_accept $ap_accept {
    default 0;
    "~*(?:activity\+json|ld\+json)" 1;
}

# 1 when the request is a browser GET of a page, 0 for the JSON call or a POST.
map "$request_method:$http_accept" $fe_page {
    default 0;
    "~*^(?:GET|HEAD):(?!.*json)" 1;
}

map $http_upgrade $connection_upgrade {
    default upgrade;
    "" close;
}

upstream wired_be {
    server 127.0.0.1:4000;  # wired-be's address
}

server {
    listen 80;
    server_name wired.example;
    root /srv/wired-fe/dist;
    client_max_body_size 40m;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;

    # 1. Nested assets and default images: the file in dist/, else the backend
    #    (so an unrelated /media/images/x still reaches wired-be).
    location ~ ^/(?:[^/]+/)*(?<asset>wired\.[^/]+|images/[^/]+)$ {
        try_files /$asset @backend;
    }

    # 2 and 3. Consent pages: the browser gets the app, the JSON call and POST the backend.
    location ~ ^/oauth/(?:authorize|external/(?:register|consent))$ {
        if ($fe_page) {
            rewrite ^ /index.html last;
        }
        proxy_pass http://wired_be;
    }

    # 5. Backend-only paths.
    location ~ ^/(?:(?:api|oauth|\.well-known|nodeinfo|media|emoji|proxy|schemas|contexts|activities|internal|quote_authorizations|objects)/|relay|inbox$|users/[^/]+/(?:inbox|outbox|followers|following|collections/)) {
        proxy_pass http://wired_be;
    }

    # 4. Profiles and permalinks: ActivityPub to the backend, browsers to the app.
    location ~ ^/(?:users|notice)/[^/]+$ {
        error_page 418 = @backend;
        if ($ap_accept) {
            return 418;
        }
        try_files $uri /index.html;
    }

    location @backend {
        proxy_pass http://wired_be;
    }

    # 7. The app and the SPA fallback.
    location / {
        try_files $uri /index.html;
    }
}
```

Terminate TLS in this server (or in front of it) and set wired-be's `BASE_URL` to the public `https://` origin. The `Upgrade` headers apply to every proxied location, which covers rule 6. For a sub-path, prefix every location with the base (`/fe/`) as described under [Hosting under a sub-path](#hosting-under-a-sub-path).

### Caddy

```caddy
wired.example {
	root * /srv/wired-fe/dist
	encode zstd gzip

	# 1. Nested assets and default images: /oauth/wired.<hash>.js -> /wired.<hash>.js
	@fe_assets path_regexp feasset ^/(?:[^/]+/)+((?:wired\.[^/]+)|(?:images/[^/]+))$
	# 2. Browser GETs of the consent pages: the app. The JSON call and POST fall through to rule 5.
	@fe_pages {
		method GET HEAD
		path /oauth/authorize /oauth/external/register /oauth/external/consent
		not header Accept *json*
	}
	# 4. ActivityPub representations of /users/<nick> and /notice/<id>.
	@ap header_regexp Accept (activity\+json|ld\+json)
	# 5. Backend-only paths.
	@be path /api/* /oauth/* /.well-known/* /nodeinfo/* /inbox /media/* /emoji/* /proxy/* /schemas/* /contexts/* /activities/* /internal/* /quote_authorizations/* /objects/* /relay* /users/*/inbox /users/*/outbox /users/*/followers /users/*/following /users/*/collections/*
	# 6. Streaming.
	@upgrade header Connection *Upgrade*

	route {
		rewrite @fe_assets /{re.feasset.1}
		rewrite @fe_pages /index.html
		reverse_proxy @ap 127.0.0.1:4000
		reverse_proxy @be 127.0.0.1:4000
		reverse_proxy @upgrade 127.0.0.1:4000
		# 7. The app and the SPA fallback.
		try_files {path} /index.html
		file_server
	}
}
```

Caddy passes WebSocket upgrades and the `Host` header through by itself and adds the `X-Forwarded-*` headers.

### Checking it

With the proxy up and an account on the instance:

- `curl -sI https://wired.example/oauth/authorize` answers with the app's `index.html` (`text/html`), not a redirect.
- `curl -s -H 'Accept: application/json' 'https://wired.example/oauth/authorize?client_id=x'` comes from wired-be (JSON error or app details).
- `curl -s -H 'Accept: application/activity+json' https://wired.example/users/<nick>` is the actor JSON; the same URL in a browser opens the profile window.
- `https://wired.example/oauth/wired.<hash>.js` (any `<hash>` from `dist/`) answers with the script.
- `https://wired.example/images/avi.png` is the default avatar.
- `/connect` ends on a consent overlay, and a `/notice/<id>` link opens the thread.

## Contributing

Read [AGENTS.md](AGENTS.md) (rules, allowed commands, conventions) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (numbered decisions).
