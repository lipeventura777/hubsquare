# Microsoft / Mojang review checklist

**English** · [Português (Brasil)](#checklist-da-microsoft-e-da-mojang-pt-br)

Sources: the user's requirements for this phase, the [Minecraft Usage Guidelines](https://www.minecraft.net/en-us/usage-guidelines) and the [Minecraft EULA](https://www.minecraft.net/en-us/eula). On 2026-11-15 both minecraft.net pages **timed out** and could not be read, so every rule that depends on their exact wording is marked **to check**.

## Requirements and where they are met

| # | Requirement | Status | Where |
|---|---|---|---|
| 1 | The product name does not use "Minecraft" | Met — HubSquare (areas ServSquare and PlaySquare) | `package.json`, `electron-builder.yml` |
| 2 | Disclaimer "NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT." | Met (exact wording **to check** against the Usage Guidelines) — in the app (gear › About, both languages), README (en + pt-BR), THIRD_PARTY_NOTICES | `src/renderer/src/aparencia/AbaSobre.tsx`, key `sobre.avisoMojang`, `README.md` |
| 3 | No Mojang/Minecraft logos, textures, fonts or brand assets in the app or repository | Met — own pixel art, fonts Inter and Pixelify Sans (OFL). Game icons/names are downloaded at run time from official files and cached only in the user's data folder | DESIGN.md section 1, `THIRD_PARTY_NOTICES.md` |
| 4 | The server EULA is never accepted for the user | Met — every path that creates a server requires the user to check "I have read and accept the Minecraft EULA" (with a link); `eula.txt` is written only after that and records it | `src/renderer/src/assistente/Assistente.tsx`, `servidores/CriarModpack.tsx`, `ImportarZip.tsx`, `PassarServidor.tsx`; checks in `src/main/servidor.ts`, `importarZip.ts`, `modpacks.ts`, `passarServidor.ts` |
| 5 | Third-party EULA-related downloads (BlueMap) need the user's consent | Met — explicit checkbox before BlueMap downloads game assets | `src/renderer/src/desempenho/TelaDesempenho.tsx` |
| 6 | The game only opens through the official Minecraft Launcher, with the user's account; no sign-in by the app, no offline/cracked mode | Met | `src/main/launcherOficial.ts`, PROJETO.md |
| 7 | No redistribution of game files | Met — server and client files are downloaded from Mojang when the user asks; nothing from the game is in the repository or the installer | `.gitignore`, `electron-builder.yml`, `src/main/mojang.ts` |
| 8 | Free, no ads, no paid features (monetization rules) | Met (rules **to check** against the Usage Guidelines) | — |
| 9 | Public privacy policy link | Met once the repository is public: <https://github.com/lipeventura777/hubsquare/blob/main/PRIVACY.md> | `PRIVACY.md`, `PRIVACY.pt-BR.md` |
| 10 | Executable details: product name, version, description, author, copyright | Met | `package.json`, `electron-builder.yml` (`copyright`) |
| 11 | Icon with every common size | Met — `build/icon.ico` (16, 20, 24, 32, 40, 48, 64, 96, 128, 256) | `scripts/gerar-icone.mjs` |
| 12 | Installer with the license and the right name, in both languages | Met | `electron-builder.yml` (`nsis.license`, `multiLanguageInstaller`) |
| 13 | SHA-256 checksums for each release | Met — `npm run dist` writes `release/SHA256SUMS.txt` | `scripts/checksums.mjs` |
| 14 | Code signing (SmartScreen) | **Not yet** — policy ready for SignPath Foundation | `CODE_SIGNING_POLICY.md` |
| 15 | Microsoft Store / Defender submission requirements | **To check** — depends on which Microsoft review you submit to | — |
| 16 | Uninstaller that removes the app | Met — standard NSIS uninstaller (keeps the user's worlds) | `electron-builder.yml` |

## Only you can do this

- [ ] Read the [Minecraft Usage Guidelines](https://www.minecraft.net/en-us/usage-guidelines) and the [EULA](https://www.minecraft.net/en-us/eula) and confirm items 2 and 8 (the pages didn't load from here).
- [ ] Make the repository public, so the privacy policy and code signing policy links work.
- [ ] Apply to [SignPath Foundation](https://signpath.org) (needs: OSI license, public repo, code signing policy page, MFA on GitHub and SignPath, manual approval of each release). After acceptance, set up signing and sign the `.exe`.
- [ ] If you submit the installer to Microsoft (Defender false-positive review or the Store), fill in their form with the links: code <https://github.com/lipeventura777/hubsquare>, privacy <https://github.com/lipeventura777/hubsquare/blob/main/PRIVACY.md>, checksums from `SHA256SUMS.txt`.
- [ ] Create the release on GitHub with the `.exe` and `SHA256SUMS.txt`.

---

## Checklist da Microsoft e da Mojang (pt-BR)

Fontes: o pedido desta fase, as [Regras de uso do Minecraft](https://www.minecraft.net/en-us/usage-guidelines) e o [EULA do Minecraft](https://www.minecraft.net/en-us/eula). Em 15/11/2026 as duas páginas do minecraft.net **não abriram** (tempo esgotado), então o que depende do texto exato delas está marcado como **conferir**.

| # | Exigência | Situação | Onde |
|---|---|---|---|
| 1 | O nome do produto não usa "Minecraft" | Atendida — HubSquare (áreas ServSquare e PlaySquare) | `package.json`, `electron-builder.yml` |
| 2 | Aviso "NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT." (e em português) | Atendida (texto exato a **conferir** nas Regras de uso) — no app (engrenagem › Sobre, nas duas línguas), README (en e pt-BR) e THIRD_PARTY_NOTICES | `AbaSobre.tsx`, chave `sobre.avisoMojang`, `README.md` |
| 3 | Sem logos, texturas, fontes ou marcas da Mojang/Minecraft | Atendida — pixel art própria, fontes Inter e Pixelify Sans (OFL). Ícones e nomes do jogo são baixados na hora, dos arquivos oficiais, e ficam só na pasta de dados | DESIGN.md seção 1 |
| 4 | O EULA do servidor nunca é aceito pelo usuário sem ele ver e confirmar | Atendida — todo caminho que cria servidor exige marcar "Li e aceito o EULA do Minecraft" (com link); o `eula.txt` só é gravado depois disso e anota o aceite | `Assistente.tsx`, `CriarModpack.tsx`, `ImportarZip.tsx`, `PassarServidor.tsx`; conferências em `src/main/servidor.ts`, `importarZip.ts`, `modpacks.ts`, `passarServidor.ts` |
| 5 | Downloads de terceiros ligados ao EULA (BlueMap) pedem o aceite do usuário | Atendida — caixa explícita antes de o BlueMap baixar arquivos do jogo | `TelaDesempenho.tsx` |
| 6 | O jogo só abre pelo Minecraft Launcher oficial, com a conta do usuário; o app não faz login e não tem modo offline/pirata | Atendida | `src/main/launcherOficial.ts`, PROJETO.md |
| 7 | Nada do jogo é redistribuído | Atendida — servidor e cliente vêm da Mojang quando o usuário pede; nada do jogo no repositório nem no instalador | `.gitignore`, `electron-builder.yml` |
| 8 | Grátis, sem anúncios e sem nada pago | Atendida (regras a **conferir** nas Regras de uso) | — |
| 9 | Link público da política de privacidade | Atendida quando o repositório ficar público: <https://github.com/lipeventura777/hubsquare/blob/main/PRIVACY.md> | `PRIVACY.md`, `PRIVACY.pt-BR.md` |
| 10 | Detalhes do .exe: nome, versão, descrição, autor e copyright | Atendida | `package.json`, `electron-builder.yml` |
| 11 | Ícone com todos os tamanhos comuns | Atendida — 16, 20, 24, 32, 40, 48, 64, 96, 128, 256 | `scripts/gerar-icone.mjs` |
| 12 | Instalador com a licença e o nome certo, nas duas línguas | Atendida | `electron-builder.yml` |
| 13 | Checksums SHA-256 de cada versão | Atendida — `npm run dist` grava `release/SHA256SUMS.txt` | `scripts/checksums.mjs` |
| 14 | Assinatura de código (SmartScreen) | **Ainda não** — política pronta para a SignPath Foundation | `CODE_SIGNING_POLICY.md` |
| 15 | Exigências da Microsoft Store / Defender | **Conferir** — depende de qual análise da Microsoft você vai pedir | — |
| 16 | Desinstalador | Atendida — desinstalador padrão do NSIS (mantém os mundos) | `electron-builder.yml` |

### Só você pode fazer

- [ ] Ler as [Regras de uso](https://www.minecraft.net/en-us/usage-guidelines) e o [EULA](https://www.minecraft.net/en-us/eula) e confirmar os itens 2 e 8 (as páginas não abriram daqui).
- [ ] Deixar o repositório público, para os links da privacidade e da política de assinatura funcionarem.
- [ ] Pedir a assinatura na [SignPath Foundation](https://signpath.org) (pede: licença OSI, repositório público, página da política de assinatura, verificação em duas etapas no GitHub e na SignPath, aprovação manual de cada versão). Depois de aceito, configurar e assinar o `.exe`.
- [ ] Se for mandar o instalador para a Microsoft (análise de falso positivo do Defender ou Store), preencher o formulário com os links: código <https://github.com/lipeventura777/hubsquare>, privacidade <https://github.com/lipeventura777/hubsquare/blob/main/PRIVACY.md> e os checksums do `SHA256SUMS.txt`.
- [ ] Criar a release no GitHub com o `.exe` e o `SHA256SUMS.txt`.
