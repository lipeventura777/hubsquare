# Architecture

HubSquare is an Electron app in TypeScript. Code identifiers, file names and comments are in Portuguese (the project's working language); the UI is in Portuguese and English.

## The three processes

```
┌──────────────────────────┐   IPC (typed, window.api)   ┌──────────────────────────────┐
│ Renderer (React)         │ ─────────────────────────▶ │ Main process (Node.js)       │
│ src/renderer/src         │ ◀───────────────────────── │ src/main                     │
│ screens, no Node access  │   results + events          │ files, downloads, Java,      │
└──────────────────────────┘                             │ server process, network      │
            ▲                                            └──────────────────────────────┘
            │ contextBridge                                          │
┌──────────────────────────┐                                         ▼
│ Preload src/preload      │                         official services (Mojang, Modrinth...)
└──────────────────────────┘
```

- **Main** (`src/main`): everything that touches the disk, the network or other programs. Each IPC handler is wrapped by `tentar()` (`src/main/erros.ts`), so the screen always gets `{ ok, valor }` or a readable `ErroTela` (message + hidden details).
- **Preload** (`src/preload/index.ts`): the only bridge. `contextIsolation` on, `nodeIntegration` off, `sandbox` on; the renderer only sees `window.api`, whose type (`Api`) is shared with the screens.
- **Renderer** (`src/renderer/src`): React screens. No Node APIs, no direct network calls except images from the official CDNs.

## Folders

| Folder | What's there |
|---|---|
| `src/main/` | one module per feature: `servidor.ts` (server process), `mods.ts`, `modpacks.ts`, `explorar.ts`, `instalacoes.ts` (PlaySquare), `convites.ts`, `celular.ts` (phone dashboard), `backup.ts`, `automacao.ts`, `conexao.ts`, `idioma.ts`... |
| `src/main/tipos/` | one module per server loader (Paper, Vanilla, Fabric, Forge, NeoForge), all with the same interface: list versions, install, build the start command |
| `src/shared/` | types and pure rules shared by main and renderer (`tipos.ts`, `*Regras.ts`) |
| `src/shared/i18n/` | translation: `pt-BR.ts` (base), `en-US.ts` (same keys), `index.ts` (`t()`, `tNome()`, number/date/size formatting) |
| `src/renderer/src/` | screens, grouped by area (`servidor/`, `mods/`, `playsquare/`, `conexao/`...), shared components in `componentes/`, layout in `estrutura/`, theme and backgrounds in `aparencia/` and `fundo/` |
| `tests/*.test.ts` | unit tests of the pure rules (`node:test`) |
| `tests/e2e/` | Playwright tests that open the built app with fake user folders and a simulated internet (`simulado.ts`) |
| `scripts/` | icon generator, error-report reader, hard-coded-text lint, modpack reproduction tools |
| `build/` | installer resources: icon and `installer.nsh` (passes the installer language to the app) |
| `docs/` | documentation (index in [docs/README.md](README.md)) |

## Pure rules

Anything that can be decided without the disk or the network lives in a `*Regras.ts` file (for example `conviteRegras.ts`, `modpackRegras.ts`, `idiomaRegras.ts`) and has unit tests. Main and renderer modules call these rules and do the I/O around them.

## Translation

- Every visible text is a key in `src/shared/i18n/pt-BR.ts` and `en-US.ts`, used as `t('key', { vars })`. `npm test` checks that both files have the same keys and variables; `npm run lint` fails on hard-coded UI text.
- Each process keeps its current language. Main reads `idioma.json` at startup (`src/main/idioma.ts`); the preload asks main synchronously, so the screen renders in the right language from the first frame. Changing the language updates main (tray, messages) immediately and reloads only the renderer, which reopens the same tab.
- Screen and tab names stay as Portuguese identifiers in code and are shown through `tNome()` (`nome.<identifier>` keys).

## Data on disk

- App data: `%APPDATA%\HubSquare`. Since phase E2, the 1.4.0 folders (`%APPDATA%\ServSquare` and `Documents\ServSquare`) are moved to the new names on first launch (`src/shared/migracaoRegras.ts`, `src/main/migracao.ts`); if a move fails, nothing is deleted and that session keeps using the old folders.
- Servers, backups and game installations: `Documents\HubSquare`.
- Details of each file are in [PROJETO.md](../PROJETO.md) and in [PRIVACY.md](../PRIVACY.md).

## Network rules

- One User-Agent everywhere (`userAgent()` in `src/main/rede.ts`).
- Downloads only from the official hosts allowed for each source (`src/shared/fontes.ts`, `src/main/modpackRegras.ts`), always with hash verification.
- Local servers (invite on 8788, phone dashboard on 8787) listen only on LAN, Radmin and Tailscale addresses, never `0.0.0.0`.
