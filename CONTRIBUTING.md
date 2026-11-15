# Contributing to HubSquare

Thanks for your interest! Bug reports, ideas and pull requests are welcome. (Em português: issues e PRs em português também são bem-vindos.)

## Before you start

- Read [PROJETO.md](PROJETO.md) (project rules, in Portuguese) and [DESIGN.md](DESIGN.md) (visual guide). The short version:
  - Windows only, Minecraft: Java Edition only, official sources only, every download checked by hash.
  - The game only opens through the official Minecraft Launcher. No offline/cracked mode, ever.
  - Never accept the Minecraft EULA for the user.
  - No secrets in the code, the repository or the installer.
- How the code is organized: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Setup

```bash
npm ci
npm run dev
```

Node.js 22 or newer on Windows.

## Every change must

1. Keep the app in **both languages**: every visible text goes into `src/shared/i18n/pt-BR.ts` **and** `src/shared/i18n/en-US.ts`, used with `t('key')`. Never hard-code visible text; `npm run lint` fails if you do.
2. Pass `npm run build`, `npm run lint`, `npm test` and `npm run test:e2e`.
3. Add at least one test: pure logic goes in a `*Regras.ts` file with a `node:test` test in `tests/`; each new feature gets an end-to-end flow in `tests/e2e/`.

The end-to-end tests never touch your real folders or the internet: `HUBSQUARE_DADOS` points every user folder to `.teste/e2e/`, and `HUBSQUARE_DOWNLOADS` sends every request to the simulated server in `tests/e2e/simulado.ts`.

## Pull requests

- Keep each PR focused on one thing and describe what changed and how you tested it (the PR template asks for this).
- Don't add dependencies without discussing it in an issue first.
- By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).

## Reporting security problems

Please don't open a public issue: see [SECURITY.md](SECURITY.md).
