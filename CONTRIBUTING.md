# Contributing to HubSquare

HubSquare is maintained by one person, in spare time. Bug reports, ideas and small pull requests are welcome; answers may take a few days. Issues and PRs in Portuguese are welcome too (issues e PRs em português também são bem-vindos).

## Before you start

- For anything bigger than a small fix, open an [issue](https://github.com/lipeventura777/hubsquare/issues/new/choose) first, so we agree on the idea before you spend time on code.
- Read [PROJETO.md](PROJETO.md) (project rules, in Portuguese). The short version:
  - Windows only, Minecraft: Java Edition only, official sources only, every download checked by hash.
  - The game only opens through the official Minecraft Launcher. No offline/cracked mode, ever.
  - Never accept the Minecraft EULA for the user.
  - No secrets in the code, the repository or the installer.
- How the code is organized: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Setup

You need [Node.js](https://nodejs.org) 22 or newer, on Windows.

```bash
npm ci
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | opens the app in development mode |
| `npm run build` | type-checks and compiles to `out/` |
| `npm run lint` | ESLint plus the check for hard-coded UI text (`scripts/checar-textos.mjs`) |
| `npm test` | unit tests for the pure rules (`tests/*.test.ts`, `node:test`) |
| `npm run test:e2e` | builds and opens the app with Playwright, offline (simulated internet) |
| `npm run test:e2e:lento` | slow end-to-end tests with real Paper and Java downloads |
| `npm run dist` | builds the installer and `SHA256SUMS.txt` in `release/` |
| `npm run format` | formats the code with Prettier |
| `npm run icone` | regenerates the icons, PNGs and `docs/marca/` from the two logos in `build/logo/` |
| `npm run ler-relatorio -- <file.zip>` | prints the summary of an error report |
| `npm run repro:modpack -- <mode>` | reproduces modpack installs from the terminal |

## Every change must

1. Keep the app in **both languages**: every visible text goes into `src/shared/i18n/pt-BR.ts` **and** `src/shared/i18n/en-US.ts`, used with `t('key')`. `npm run lint` fails on hard-coded text.
2. Pass `npm run build`, `npm run lint`, `npm test` and `npm run test:e2e`. The end-to-end tests never touch your real folders or the internet (`HUBSQUARE_DADOS` and `HUBSQUARE_DOWNLOADS`).
3. Add at least one test: pure logic in a `*Regras.ts` file with a test in `tests/`; each new feature gets an end-to-end flow in `tests/e2e/`.
4. Not add dependencies without discussing it in an issue first.

## Pull requests

Keep each PR focused on one thing; the PR template asks what changed and how you tested it. By contributing, you agree that your contribution is licensed under the [GNU General Public License v3.0 or later](LICENSE). The HubSquare name, logo and visual identity are not covered by the license: forks and modified redistributions must use a different name and logo (see [TRADEMARK.md](TRADEMARK.md)).

## Security problems

Please don't open a public issue: see [SECURITY.md](SECURITY.md).
