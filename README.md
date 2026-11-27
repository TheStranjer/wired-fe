# wired-fe

The web frontend for Wired, a fediverse server ([wired-be](https://github.com/TheStranjer/wired-be)). It also works against Mastodon and Pleroma/Akkoma servers, with fewer features. It feels like a tiling window manager crossed with a terminal and a modern social client: a desktop of panes, feeds that mix any accounts, posts drawn as cards, and a command line at the bottom that can do everything the mouse can.

What it does today: sign in with OAuth (password login, invite sign-up, password reset, third-party app authorization and external-login consent), read feeds, notifications, threads, DMs, hashtags, profiles and search, and post, reply, favourite, boost and follow, with several accounts at once. Every action is a command, a hotkey and a click.

## Using WiredFE

The command line at the bottom is always there and never required. Plain text posts to the focused window; `//text` posts a literal leading slash; `/help` lists the commands, `/help <command>` shows one, and `/help layout`, `/help feeds` and `/help sync` explain the three topics below. Press `Esc` for navigation mode (vim-style keys; `i` or `Enter` goes back to typing).

### Desktops and panes

The screen is a desktop of panes split side by side or stacked. Each pane shows one window (a feed, a composer, a thread, a DM, notifications, a profile, search, the people list). Closing a pane keeps its window open and hidden; `/close` ends the window. Desktops are numbered from 1; the status line shows them as `[1] [2]` with the active one marked.

| To                                 | Command                           | tmux keys (both modes) | Vim keys (navigation mode) | Mouse                                  |
| ---------------------------------- | --------------------------------- | ---------------------- | -------------------------- | -------------------------------------- |
| Split side by side                 | `/vsplit [view]`                  | `Ctrl+B %`             | `w v`                      | `◫▾` in the pane's title bar           |
| Split stacked                      | `/split [view]`                   | `Ctrl+B "`             | `w s`                      | `⊟▾`                                   |
| Focus a neighbour                  | `/focus left\|right\|up\|down`    | `Ctrl+B` + arrow       | `w h`, `w j`, `w k`, `w l` | click the pane                         |
| Cycle focus                        | `/focus next`                     | `Ctrl+B o`             | `w w`                      |                                        |
| Close the pane (window stays)      | `/unsplit`                        | `Ctrl+B x`             | `w c`                      | `✕`                                    |
| Keep only this pane                | `/only`                           | `Ctrl+B z`             | `w o`                      |                                        |
| Equal shares                       | `/equalize`                       |                        | `w =`                      |                                        |
| Resize                             | `/resize width\|height +N\|-N\|N` |                        |                            | drag a divider; arrows on it           |
| Swap with the neighbour            | `/swap left\|right\|up\|down`     |                        | `w x`                      |                                        |
| Tear off into a float              | `/float [view]`                   | `Ctrl+B f`             | `w f`                      | `⧉`                                    |
| Start menu: open a view as a float | `/start`                          | `Ctrl+B Space`         | `w Space`                  | `[≡ wired]` in the status line         |
| Dock a float                       | `/dock`                           | `Ctrl+B d`             | `w d`                      | `⇲`; Shift-drag over a pane            |
| Go to desktop N                    | `/desktop N`                      | `Ctrl+B N`             |                            | `Alt+1`..`Alt+9`                       |
| Previous or next desktop           | `/desktop prev`, `/desktop next`  | `Ctrl+B p`, `Ctrl+B n` |                            | `Alt+[`, `Alt+]`                       |
| New desktop                        | `/desktop new`                    | `Ctrl+B c`             |                            |                                        |
| Close desktop (windows stay)       | `/desktop close [N]`              | `Ctrl+B &`             |                            | `×` or middle-click in the status line |
| Close all empty desktops           | `/desktop prune`                  |                        |                            |                                        |
| Move the pane to a desktop         | `/mvd N [follow]`                 |                        |                            |                                        |

`Alt+[` on desktop 1 wraps to the last desktop, and `Alt+]` on the last creates a new one. `Ctrl+W`, `Ctrl+T` and `Ctrl+N` are never bound, because browsers keep them. Every key is rebindable (`/binds`, `/bind`, `/unbind`), and a binding may be a sequence of chords (`Ctrl+B %`, `w v`).

### Floats

A float is a window in a free rectangle above the panes, dragged by its title bar and kept inside the viewport. `/float` tears the focused pane off; `/float thread a3` opens a view straight into a float; `/float move <dx> <dy>` and `/float size <dw> <dh>` adjust it and `/raise` brings it to the top. Double-clicking a post, `p` or `/pop [label]` pops that post's thread out into a float.

### Feeds

A feed mixes any sources from any signed-in accounts into one stream, newest first, with a post several accounts see shown once. A source is `home`, `mentions`, `dms`, `notifications`, `local`, `federated` or `tag:<name>` of one account. Feeds stream live.

The first run makes a feed called `stream` (home, mentions, DMs and notifications of every account) and opens it alone in desktop 1. While you have not edited it, an account you sign in later is added to it; deleting it is permanent, and it is not made again.

- `/feed` lists feeds, `/feed <name>` opens one, `/feed new`, `/feed edit <name>` and the `✎` button in a feed pane's title bar open the editor, and `/feed add|rm|rename|delete` change feeds from the command line.
- `/home`, `/local`, `/federated`, `/notifications`, `/tag <name>` and `/search <text>` still open single-source windows.
- Every post has a short label like `[a3]` and commands take it: `/fav a3`, `/boost a3`, `/thread a3`, `/pop a3`. A command acts as the account that fetched that post; `/as @me@other.example <text>` acts as another account for one command.

### Cards and lines

Posts are cards by default: avatar, name, body, inline images and an action bar. A direct message is a card with a `✉ DM from → to` header and a dashed border. Sensitive media stays covered until opened, and nothing autoplays. `/display` shows or overrides, for the focused window only, `density` (`cards` or `lines`, the IRC-line look), `avatars` and `images`: `/display density lines`, `/display avatars off`, `/display reset`. `/set density lines`, `/set avatars off` and `/set images off` change the default for every window, and the `◐▾` button in a pane's title bar does the same per window.

### The composer pane and replies

`/compose [text]` (`Ctrl+E`, or `c` in navigation mode) opens a composer window, a float by default; it takes the half-typed line with it. The composer pane has the text, content warning, visibility, media and poll fields, and sends with its button or `Ctrl+Enter`. `/attach` while it is focused attaches to it.

Replies: `/reply a3 some text` posts at once. `/reply a3` with no text, the card's reply button and `Shift+r` open a composer bound to that post, with the mentions, visibility and content warning filled in and the post shown above the text; it closes itself after sending. `r` instead prefills the command line with `/reply a3 ` for a one-line answer, and `q` does the same for `/quote`.

### Placement

Every command that opens a window takes `--in here|vsplit|split|float|hidden` at the end (`/thread a3 --in float`, `/dm @alice --in vsplit`). Without it, the setting decides: `openIn` is the default (`here`, the focused pane), `openIn.<kind>` overrides it for one kind (`/set openIn.thread vsplit`; `/set openIn.thread default` takes it back), and `replyIn` places reply composers (default `split`). The composer defaults to `float` and `/people` to a split on the right. Clicks follow the same settings: a plain click uses the configured placement, **Ctrl/Cmd+click** opens a float, **Shift+click** a side-by-side split and **middle-click** a hidden window. A link in the address bar (`/#/notice/<id>`) opens in the focused pane.

### Sync

Your desktops, floats, open windows, feeds and settings are saved in this browser and synced through your server's settings store (`/api/v1/pleroma/settings/wired-fe`, served by Wired, Pleroma and Akkoma), so your desk follows you from one browser to the next.

- `/sync` shows the state. `/sync primary <handle>` picks the account whose server holds the synced copy, `/sync fallback add|rm|up <handle>` orders the accounts that take over when it has no settings store or its token no longer works, `/sync now` pulls and pushes at once, and `/sync off` and `/sync on` switch it. The choice stays in this browser. Signing an account out drops it from the list.
- Desktop browsers (Windows, macOS, Linux, ChromeOS) and mobile ones (Android, iOS, iPadOS) keep separate layouts, so a phone never rewrites your desk. The newer copy wins. A change is pushed three seconds after the last edit.
- The server caps the whole store at 1 MiB. WiredFE pushes at most 384 KiB per device class; a bigger desk leaves hidden windows, empty desktops and key overrides past 200 out of the synced copy only, and says so. If even that is too big, sync pauses and says so.
- **Mastodon has no settings store.** An account there keeps its desk in this browser only; add a Wired, Pleroma or Akkoma account to the list to sync.

### Mobile mode

On a phone or tablet only one pane shows at a time, full screen, with no dividers or float dragging. The title bar has a switcher, `‹ 2/4 ›`: the arrows step through the desktop's panes (`/focus prev`, `/focus next`) and the counter opens a menu of all of them. The layout model is the same, and the mobile layout is its own synced snapshot.

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

| Field                   | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `appName`               | The name shown in the UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `instances.mode`        | `same-origin` \| `fixed` \| `list` \| `open` (decision 3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `instances.origin`      | The one instance origin, for mode `fixed`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `instances.origins`     | The origins the user may pick from, for mode `list` (may be empty only with `allowCustom: true`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `instances.allowCustom` | Optional, for mode `list`: also let the user type any other instance; default `false`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `basePath`              | Optional. The path the bundle is hosted under, e.g. `/fe/` (starts and ends with `/`); default `/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `defaultLocale`         | Optional. The UI language when the reader has chosen none, ahead of the browser's: `en`, `es`, `ru`, `ja`, `zh-Hans` or `de`; any other code fails the build                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `publicView`            | Optional. Whether signed-out visitors may read an instance (decision 3): `true` forces it on and ignores the backend, `false` turns it off, `null` or no key leaves it to the backend's published policy, and an object `{ "<origin>": true \| false \| null }` sets each instance (an origin it omits counts as `null`). The object form is refused with `same-origin` and `open`, may only name `instances.origin` with `fixed`, and may only name `instances.origins` with `list`; `true` is refused with `open`. Instances the build does not configure (typed by the user under `allowCustom`, or any in `open` mode) never get public view |

## Output

`pnpm build` writes `dist/`: `index.html`, one `wired.[hash].js`, one `wired.[hash].css`, the lazy chunks `wired.emoji.[hash].js` and `wired.locale.[hash].js` (one per language), and the files from `public/`. Serve it from any static host. For the usual same-origin deployment, put a reverse proxy in front of wired-be and `dist/`: see [Deploying in front of wired-be](#deploying-in-front-of-wired-be). Sending API, OAuth, ActivityPub and well-known paths to the backend and everything else to `dist/` is not enough; some paths belong to both.

### Permalinks and the SPA fallback

WiredFE routes by hash (decision 4): `/#/notice/<id>`, `/#/@user@host`, `/#/users/<id>`, and `/#/tag/<name>` open a thread, a profile or a hashtag window for the active account. An id only means something on its own instance, so in a `list` or `open` build `/copy` writes the instance into the link: `/#/<host>/notice/<id>`, `/#/<host>/users/<id>`, `/#/<host>/tag/<name>`, with `<host>` the instance's host and port (`wired.example`, `localhost:4000`; `https`, or `http` for a local hostname). Such a link opens for the active account if it is on that instance, else for the first signed-in account on it; with none, WiredFE prints a line naming the host and keeps the link in the address bar. `same-origin` and `fixed` builds have one instance and keep the short links. wired-be redirects browsers to path routes on `FRONTEND_BASE_URL` instead (`/notice/<id>`, `/<nickname>`, `/users/<nickname>`, `/authorize_interaction?uri=`, `/registration/<token>`, `/password_reset/<token>`, `/oauth/authorize`, `/oauth/external/register`, `/oauth/external/consent`). On startup WiredFE rewrites those paths to the matching hash route with `history.replaceState`; `/registration/<token>` opens the sign-up overlay (username, email, password, agreement, optional reason), `/password_reset/<token>` opens the new-password overlay (two password fields; `/forgot <email|nick>` asks for the reset letter, no login needed), and the OAuth paths have no window and are only kept as a hash.

#### Remote follow and interaction links

When someone on another server clicks "follow" or "interact" for a user of this instance, their server sends the browser to the instance's WebFinger subscribe template. wired-be's template must be `{FRONTEND_BASE_URL}/#/authorize_interaction?uri={uri}` (a wired-be change, tracked separately). The path form `{FRONTEND_BASE_URL}/authorize_interaction?uri={uri}` (Mastodon's) also works: startup rewrites it to the hash form. The old `acct=` parameter is accepted in place of `uri=`, and a leading `acct:` is stripped. WiredFE searches the value with `resolve=true` as the active account: an account opens its profile window with `Type /follow to follow @<acct>` printed in it, a post opens its thread window, and no result prints `Could not find <value>`. With nobody signed in it prints the `/connect` hint and keeps the link for after login.

For that the static host must serve `index.html` for unknown paths (SPA fallback), e.g. nginx `try_files $uri /index.html;`. The bundle refers to its JS and CSS relatively, so the page loaded at `/notice/<id>` asks for `/notice/wired.<hash>.js`; the host must answer `/<any path>/wired.<hash>.js` and `.css` with the root files, or the page has no script. The lazy chunks (`wired.emoji.<hash>.js`, `wired.locale.<hash>.js`) match the same rule. The next section gives the complete rules for a same-origin proxy.

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

## Models used

So far, these LLMs have been used:

- Opus 5.5
- Sonnet 5.5
- Qwen3.8 Flash next
- DeepSeek V4 Pro
