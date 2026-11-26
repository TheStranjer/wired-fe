# AGENTS.md

Rules for anyone (human or AI) changing this codebase. Read `docs/ARCHITECTURE.md` too: it holds the numbered decisions these rules refer to.

## What this is

WiredFE is the web frontend for Wired, a fediverse server (backend: [wired-be](https://github.com/TheStranjer/wired-be)). It also works against Mastodon and Pleroma/Akkoma servers, with fewer features.

It should feel like the 1990s internet of _Serial Experiments Lain_: part tiling window manager, part terminal, part modern social client. Concretely:

- **A tiling desktop.** The screen is a desktop of panes split side by side or stacked; any pane can be torn off into a floating window dragged around inside the viewport (decision 12). Thin lime borders, little ornament.
- **Any view in any pane.** Feeds, a composer, a thread, a DM, notifications, a profile, search: each is a window kind and can be shown in any pane or float (decision 13).
- **Feeds are what the user says.** A feed mixes any sources from any signed-in accounts into one stream (decision 14).
- **Posts look like posts.** Cards with avatar, name, body, inline images and an action bar by default; the IRC-line rendering stays as a per-window choice (decision 15).
- **The command line is always there, never required.** The input line at the bottom can do everything the GUI does (`/vsplit feed main`, `/float`, `/desktop 3`, `/fav a3`); plain text posts to the focused window; `//text` posts a literal leading slash.
- **Everything is reachable three ways** (command, hotkey, click) from one registry (decision 6); never wire one without the others.
- **Two hotkey modes**, plus key sequences: tmux-style `Ctrl+B %` and vim-style `w v` are the default layout keys, all rebindable (decision 18).
- **Every post has a short label** (`[a3]`) so commands can refer to it.
- **Multi-account and multi-instance from day one.** The active account is always visible. `/as @me@other.example <text>` acts as another account for one command.
- **Pseudomonochrome** (decision 16). Effects stay opt-in, honour `prefers-reduced-motion`, and never flash.
- **Your desk follows you** (decision 17).

When a design choice is unclear, pick what a tiling-WM and IRC power user would expect, then make it reachable by mouse.

## The gate

`scripts/ci.sh` runs every check: frozen-lockfile install, Prettier, TypeScript, ESLint, Stylelint, byte-size limits, Vitest with coverage thresholds, diff coverage (every statement, function and branch arm on a line changed since `master` must run in a test, and `v8 ignore`, `c8 ignore` and `istanbul ignore` comments are banned), knip, the production build, a bundle size report (informational, no cap), and Playwright end-to-end tests against the built bundle. It keeps going after a failure, so one run reports everything that's broken, and exits 0 only when all checks pass. `.github/workflows/ci.yml` runs this same script. A change is not done until `scripts/ci.sh` exits 0, so write code that passes every check, including the Vitest tests and coverage thresholds and the ESLint and Stylelint rules. **Do not run the tests or the linters locally.** CI runs them for you; running them yourself only wastes time. To add a check, add it to the script, not the workflow.

## Commands you may run

You may run only the commands below, from the repository root. Anything not listed is forbidden; if you think you need one, stop and say so instead of improvising. Where a dedicated file-read or search tool exists, use it instead of the shell equivalents.

| Purpose                        | Allowed                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| Single checks                  | `pnpm exec tsc -b`, `pnpm exec knip`                                                         |
| Formatting                     | `pnpm exec prettier --write .`, `pnpm exec prettier --check .`                               |
| Build                          | `pnpm exec vite build`, `pnpm exec size-limit`                                               |
| Dependencies                   | `pnpm add <pkg>`, `pnpm add -D <pkg>`, `pnpm remove <pkg>`, `pnpm install --frozen-lockfile` |
| Read files (if no tool exists) | `ls`, `cat`, `head`, `tail` (never `-f`), `wc`, `diff`, `find` (read-only), `grep`/`rg`      |
| Git, read-only                 | `git status`, `git diff`, `git log`, `git show`, `git branch`                                |
| Git, write                     | `git switch -c <branch>`, `git add <paths>`, `git commit`                                    |

Everything else is forbidden. In particular, never run:

- **Tests and linters (CI runs them)**: `scripts/ci.sh`, `vitest` (with or without `run`), `playwright test`, `eslint`, `stylelint`. Write the code and tests so they pass, and leave the running to CI.
- **Long-lived processes**: `pnpm dev`, `vite`, `vite dev`, `vite preview` on its own, `vitest` without `run` (watch mode), `playwright test --ui`, `&`, `nohup`, `screen`, `tmux`. Every command runs in the foreground, once, and finishes by itself. Playwright starts and stops its own preview server. To see the UI, write a Playwright test.
- **Process hunting or control**: `pgrep`, `pkill`, `kill`, `killall`, `ps`, `top`, `lsof`, `fuser`, `jobs`, `wait`.
- **Sleeping and polling**: `sleep`, `timeout`, `watch`, retry loops, `while`/`until`/`for` loops that re-check a condition.
- **Other package managers and runners**: `npm`, `npx`, `yarn`, `bun`, `pnpm dlx`, `pnpm exec` of anything not in the table. Never add a dependency by editing `package.json` by hand.
- **Network and system changes**: `curl`, `wget`, `ssh`, `sudo`, `apt`, `pacman`, `mise install`/`mise use`, `playwright install`, editing anything outside the repository.
- **Destructive or history-rewriting commands**: `rm` in any form, `git push`, `git reset --hard`, `git checkout -- <path>`, `git clean`, `git stash`, `git rebase`, `git commit --amend`, `--force`, `--no-verify`.
- **Escape hatches**: `eval`, `bash -c`, `sh -c`, `xargs` into other commands, `node`/`python`/`perl` one-liners, and `sed -i`/`awk` to edit files. Edit files with the editing tool.

### How to run what you may run

- **Run each command once and read its whole output.** Don't re-run to see whether a failure is flaky. If output is long, redirect it to a file under `node_modules/.tmp/` and read that.
- **Two strikes.** If the same fix fails twice, stop and report what you tried and what the output said.
- **Don't weaken the gate.** Never edit `scripts/ci.sh`, `scripts/check-file-sizes.sh`, `.github/workflows/ci.yml`, `eslint.config.js`, `tooling/eslint/`, `stylelint.config.js`, `knip.json`, the coverage thresholds in `vite.config.ts`, or the strictness flags in `tsconfig*.json` to make a failure go away. Never skip, delete or loosen a failing test. Fix the code. Making checks stricter is welcome. The only exception is a ticket that explicitly asks for one of these files to change.
- **Stay in the repo**, leave no scratch files in it, and commit only when asked. Non-interactive commands only (`git commit -m`).

## Linting and limits

- ESLint (typescript-eslint `strictTypeChecked`, `@eslint-react` strict, react-hooks, jsx-a11y strict, import-x, boundaries, Vitest) must pass with zero warnings. Inline `eslint-disable` comments are switched off and do nothing; `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck` are banned.
- **Size limits are hard**: 200 lines per file (400 for tests), 50 lines per function, 15 statements, complexity 10, depth 3, 3 parameters; plus byte limits per file in `scripts/check-file-sizes.sh`. When you hit one, split the module along a real seam. Don't compress code to fit.
- **Bundle size**: there is no cap. `.size-limit.json` only reports the gzipped JS and CSS sizes. Keep the bundle small anyway.
- **Coverage**: 95% statements/functions/lines, 90% branches, over `src/`.
- **knip** fails on unused files, exports and dependencies. Delete dead code; don't export things "for later".

## Layout

Layers are enforced by `eslint-plugin-boundaries` (`tooling/eslint/layers.js`). A file outside a known layer is a lint error. Lower layers never import higher ones.

```text
src/
  app/            composition root: main.tsx, <App>, providers, window layout
  features/<x>/   one vertical slice per window kind or flow: timeline, thread, compose, notifications, profile, login...
  views/          rendering shared by every window: lines, buffers, timeline loading
  ui/             presentational components: no data fetching, no account state
  keys/           keymap, modes (insert/navigation), rebinding
  windows/        window list and desktop layout state: windows, panes, floats, desktops (pure)
  state/          pure app state: windows, line buffers, accounts, settings; reducer and React context
  commands/       the command registry, parser, completion, /help
  accounts/       multi-account store, OAuth app registration and login, token storage
  capabilities/   backend detection -> one typed Capabilities object (decision 5)
  api/            HTTP and streaming clients, valibot schemas, backend adapters
  i18n/           message catalogs (locales/*.json), typed t(), useT(), locale resolution; imports lib and config only
  config/         typed access to build-time configuration
  storage/        the only module that touches localStorage: namespaced, versioned, validated
  lib/            pure helpers with no React and no I/O
  theme/          tokens.css, global.css, fonts, effects
  test/           test setup and shared test helpers
tooling/          build and lint tooling (Node, not shipped)
e2e/              Playwright tests against the production build
```

## Conventions

### TypeScript

- `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `erasableSyntaxOnly`. No `any`, no non-null assertions, no enums (use string-literal unions), no namespaces, no classes for data.
- `type`, not `interface`. Type-only imports use `import type`.
- Exported functions declare their return types.
- Handle every union member: `switch` on a discriminant must be exhaustive.
- Data from the network is `unknown` until a valibot schema has parsed it, in `src/api` only.

### Naming

| Thing                          | Style                             | Example                 |
| ------------------------------ | --------------------------------- | ----------------------- |
| Component files and components | `PascalCase`                      | `StatusLine.tsx`        |
| Other modules                  | `camelCase`                       | `parseCommand.ts`       |
| Test files                     | next to the module, `.test.ts(x)` | `parseCommand.test.ts`  |
| CSS modules                    | next to the component             | `StatusLine.module.css` |
| CSS classes                    | `camelCase`                       | `.unreadCount`          |
| Functions, variables           | `camelCase`                       | `activeWindow`          |
| Types                          | `PascalCase`                      | `Capabilities`          |
| Module-level constants         | `SCREAMING_SNAKE_CASE`            | `MAX_WINDOWS`           |
| Commands                       | lowercase words                   | `/dm`, `/fav`, `/win`   |

- Named exports only; default exports are for tool config files.
- Every module starts with a `/** ... */` comment saying what it is for. Exported functions, types and constants get doc comments.

### React

- Function components and hooks only. Components render; logic lives in plain functions in the same slice or in `lib/`, where it can be unit-tested without a DOM.
- No inline `style`; CSS modules with theme tokens. No colors or font names outside `src/theme/tokens.css` (Stylelint enforces this).
- Accessibility is not optional: the scrollback is a log region, every action has an accessible name, ASCII art is `aria-hidden` with a text alternative, focus is always visible.

### Translated text

- User-facing text of our own goes through `t()` / `useT()` (decision 19); English lives in `src/i18n/locales/en.json`. **Never hand-edit a non-English locale file**: Prism owns them. A hand translation goes in `.prism/exceptions.json`.
- Edit only `en.json`. After a change to it lands on master, `.github/workflows/prism.yml` runs Prism, which translates changed keys into `es`, `ru`, `ja`, `zh-Hans` and `de`, backfills missing keys, prunes removed ones, and pushes the result. Those files are not Prettier-formatted (`.prettierignore`).
- Never call `t()` at module load: constants become functions, a command's static `summary` and `usage` become getters. Whole sentences per key; never concatenate translated fragments.

### Security

- Status, bio and display-name HTML comes from arbitrary remote servers and is hostile. It is rendered only through the one sanitizing component; `dangerouslySetInnerHTML` is banned everywhere else.
- No third-party origins at runtime: no CDNs, web fonts, analytics or embeds. Everything ships in the bundle. The build writes a strict CSP (`tooling/csp.ts`).
- `fetch`, `WebSocket`, `localStorage` and `sessionStorage` are banned outside their owning modules (`src/api`, the storage module). Tokens are never logged.
- Never commit secrets or `.env` files.

### Dependencies

- Add with `pnpm add` (exact versions are pinned automatically). `pnpm-workspace.yaml` refuses versions younger than a week and blocks dependency install scripts; don't loosen either.
- Every new runtime dependency adds to the bundle size. Prefer a small module in `lib/` over a package, and say why in the commit when you do add one.

## Testing

- Unit tests (Vitest + Testing Library) sit next to the code. Test behaviour through the public function or the rendered UI (`getByRole` before `getByText`; never test IDs or class names).
- **Never wait on real time.** No `setTimeout` sleeps or arbitrary delays in tests: use `vi.useFakeTimers()`, or await the specific promise or element (`findBy...`).
- No real network in tests. API tests use recorded fixtures per backend (Wired, Mastodon, Pleroma) and assert that each adapter maps them to the same internal shape.
- Every code path you add or change is covered: every statement, function and branch arm on a changed line runs in a test, including success, error and edge cases. `scripts/ci.sh` enforces this with a diff-coverage check against `master` (100%, no exceptions); coverage-ignore comments are banned.
- End-to-end tests (Playwright) run against `dist/`. Use them for whole flows and anything that needs a real browser (CSP, focus, keyboard).
