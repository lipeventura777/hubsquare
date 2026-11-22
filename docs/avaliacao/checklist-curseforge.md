# CurseForge review checklist

**English** · [Português (Brasil)](#checklist-do-curseforge-pt-br)

Source of the requirements: the [CurseForge 3rd Party API Terms and Conditions](https://support.curseforge.com/en/support/solutions/articles/9000207405-curse-forge-3rd-party-api-terms-and-conditions) (modified 14 Aug 2024), the [About the API / how to apply](https://support.curseforge.com/en/support/solutions/articles/9000208346-about-the-curseforge-api-and-how-to-apply-for-a-key) page (modified 3 Dec 2024) and the [REST API docs](https://docs.curseforge.com/rest-api/), read on 2026-11-15. Anything those pages don't state is marked **to check** (never assumed).

## Requirements and where they are met

| # | Requirement | Status | Where |
|---|---|---|---|
| 1 | The API key is unique, non-transferable and must not be shared with third parties (Terms 2.2) | Met — HubSquare's official key exists only as the `CURSEFORGE_API_KEY` secret on GitHub and is injected only when the release is built (`electron.vite.config.ts`); it is never in the repository, the Actions logs or error messages, and it is never shown in the app. Without it, CurseForge shows as "coming soon". Users no longer paste keys | `src/main/chaveCurseForge.ts`, `.github/workflows/release.yml`, Options › Integrations, PRIVACY.md |
| 2 | Files whose author does not allow third-party distribution are never downloaded by the app | Met — `allowModDistribution: false` or no `downloadUrl` shows "Download from the website"; the "Downloads needed" assistant only opens the official page and picks up the file the user downloaded (matched by size + SHA-1/MD5) | `src/main/curseforge.ts` (`podeBaixar`), `src/main/downloadsManuais.ts`, `src/renderer/src/mods/DownloadsNecessarios.tsx` |
| 3 | Downloads only from CurseForge's own CDN, verified | Met — only `edge.forgecdn.net` / `mediafilez.forgecdn.net`, hash checked | `src/shared/fontes.ts`, `src/main/filaDownloads.ts` |
| 4 | Do not conceal identity or location (no proxy/VPN for API access) (Terms 3.1) | Met — API calls go straight from the user's PC; every request carries `User-Agent: HubSquare/<version> (github.com/lipeventura777/hubsquare)` | `src/main/rede.ts` (`userAgent()`) |
| 5 | Pagination limits: max 50 per page, `index + pageSize <= 10,000` (API docs) | Met | `src/shared/paginaRegras.ts` (`LIMITE_CURSEFORGE`), `tests/paginaRegras.test.ts` |
| 6 | Do not save or cache any data obtained through the API (Terms 3.1 e) | **To check** — the app keeps the CurseForge **project and file IDs** of what it installed (`hubsquare-mods.json`) to offer updates; for files that must be downloaded by hand it keeps the **file name, size, hash and official page** while the download is pending (`downloads-pendentes.json`), and an invite manifest carries name, size, hash and page of those files. No search results, descriptions or images are stored. Ask CurseForge whether IDs/hashes of files the user installed count as "caching" | `src/main/mods.ts`, `src/main/downloadsManuais.ts`, `src/main/convites.ts`, PROJETO.md |
| 7 | Attribution / branding (logo or link back) | **To check** — not required on the pages read. The app labels each item with its source ("CurseForge") and links to its CurseForge page | `src/renderer/src/mods/Explorar.tsx`, `DetalhesProjeto.tsx` |
| 8 | User-Agent / identification | **To check** — not required on the pages read; the app sends it anyway (item 4) | `src/main/rede.ts` |
| 9 | Rate limits / quotas | **To check** — no number published; Terms 2.3 say a quota may require a license. The app only calls the API on user actions, downloads at most 6 files at a time and pages at most 50 results | `src/main/filaDownloads.ts`, `src/shared/paginaRegras.ts` |
| 10 | Whether end users may use their own personal keys in a third-party app | No longer applies — HubSquare uses its own official key (Phase L1) | Options › Integrations |
| 11 | Not a product that "competes, directly or indirectly" with CurseForge (Terms 3.1) | **To check** — HubSquare is a server manager and launcher setup tool that also reads CurseForge; ask CurseForge whether this is acceptable | — |
| 12 | Modpacks from CurseForge installed from `manifest.json`, without mirrors or scraping | Met — files listed in the manifest go through the same rules (2, 3); the app does not update CurseForge modpacks | `src/main/modpacks.ts`, PROJETO.md |
| 13 | Data privacy (Terms 3.2) | Met — no data about users is sent anywhere | PRIVACY.md |

## Only you can do this

- [ ] Read and accept the [CurseForge API Terms](https://support.curseforge.com/en/support/solutions/articles/9000207405-curse-forge-3rd-party-api-terms-and-conditions) yourself.
- [ ] **Apply for a developer key** for HubSquare (form linked from the "About the API" page), describing how the app respects authors' distribution choice (item 2) — that is a stated review criterion. When it arrives, save it as the `CURSEFORGE_API_KEY` secret on GitHub (Settings › Secrets and variables › Actions); the next tagged release ships with CurseForge on.
- [ ] Ask CurseForge about items 6, 10 and 11 and keep their answer in `docs/avaliacao/`.
- [ ] Make the repository public (Settings › General › Change visibility) so they can review the code.
- [ ] Fill in any form with the public links: code <https://github.com/lipeventura777/hubsquare>, privacy <https://github.com/lipeventura777/hubsquare/blob/main/PRIVACY.md>.

---

## Checklist do CurseForge (pt-BR)

Fontes: os mesmos termos e páginas acima, lidos em 15/11/2026. O que elas não dizem está marcado como **conferir**.

| # | Exigência | Situação | Onde |
|---|---|---|---|
| 1 | A chave da API é única, intransferível e não pode ser passada a terceiros (Termos 2.2) | Atendida — a chave oficial do HubSquare existe só como o segredo `CURSEFORGE_API_KEY` no GitHub e entra só no build do release (`electron.vite.config.ts`); nunca no repositório, nos logs do Actions ou em mensagens de erro, e nunca aparece no app. Sem ela, o CurseForge aparece como "em breve". O usuário não cola mais chave | `src/main/chaveCurseForge.ts`, `.github/workflows/release.yml`, Opções › Integrações, PRIVACY |
| 2 | Arquivos que o autor não deixa outros apps distribuírem nunca são baixados pelo app | Atendida — `allowModDistribution: false` ou sem `downloadUrl` aparece como "Baixe pelo site"; a janela "Downloads necessários" só abre a página oficial e pega o arquivo que o usuário baixou (tamanho + SHA-1/MD5) | `src/main/curseforge.ts`, `src/main/downloadsManuais.ts`, `DownloadsNecessarios.tsx` |
| 3 | Downloads só do CDN do próprio CurseForge, conferidos | Atendida — só `edge.forgecdn.net` / `mediafilez.forgecdn.net`, com hash | `src/shared/fontes.ts`, `src/main/filaDownloads.ts` |
| 4 | Não esconder identidade nem local (sem proxy/VPN para a API) (Termos 3.1) | Atendida — os pedidos saem direto do PC do usuário, com `User-Agent: HubSquare/<versão> (github.com/lipeventura777/hubsquare)` | `src/main/rede.ts` |
| 5 | Paginação: até 50 por página e `index + pageSize <= 10.000` | Atendida | `src/shared/paginaRegras.ts`, `tests/paginaRegras.test.ts` |
| 6 | Não guardar nem fazer cache de dados da API (Termos 3.1 e) | **Conferir** — o app guarda os **ids do projeto e do arquivo** do que instalou (`hubsquare-mods.json`), e, para arquivos de download manual, **nome, tamanho, hash e página oficial** enquanto o download está pendente (`downloads-pendentes.json`); o manifesto do convite leva nome, tamanho, hash e página desses arquivos. Nenhum resultado de busca, descrição ou imagem é guardado. Perguntar ao CurseForge se ids/hashes do que o usuário instalou contam como "cache" | `src/main/mods.ts`, `src/main/downloadsManuais.ts`, `src/main/convites.ts` |
| 7 | Atribuição / marca (logo ou link) | **Conferir** — não exigido nas páginas lidas. O app mostra a fonte ("CurseForge") e o link da página de cada item | `Explorar.tsx`, `DetalhesProjeto.tsx` |
| 8 | User-Agent / identificação | **Conferir** — não exigido nas páginas lidas; o app manda mesmo assim | `src/main/rede.ts` |
| 9 | Limites de pedidos / cota | **Conferir** — nenhum número publicado; os Termos 2.3 dizem que uma cota pode exigir licença. O app só chama a API quando o usuário age, baixa no máximo 6 arquivos por vez e pede no máximo 50 resultados por página | `src/main/filaDownloads.ts`, `src/shared/paginaRegras.ts` |
| 10 | Se o usuário final pode usar a própria chave num app de terceiros | Não se aplica mais — o HubSquare usa a chave oficial dele (Fase L1) | Opções › Integrações |
| 11 | Não ser um produto que "concorre, direta ou indiretamente" com o CurseForge (Termos 3.1) | **Conferir** — o HubSquare é um gerenciador de servidor e preparador do jogo que também lê o CurseForge; perguntar se é aceitável | — |
| 12 | Modpacks do CurseForge pelo `manifest.json`, sem espelhos nem raspagem | Atendida — os arquivos seguem as regras 2 e 3; o app não atualiza packs do CurseForge | `src/main/modpacks.ts` |
| 13 | Privacidade (Termos 3.2) | Atendida — nenhum dado de usuário é enviado | PRIVACY.pt-BR.md |

### Só você pode fazer

- [ ] Ler e aceitar os [Termos da API do CurseForge](https://support.curseforge.com/en/support/solutions/articles/9000207405-curse-forge-3rd-party-api-terms-and-conditions).
- [ ] **Pedir a chave de desenvolvedor** do HubSquare (formulário na página "About the API"), explicando como o app respeita a escolha de distribuição dos autores (item 2), que é um critério da análise. Quando chegar, guarde como o segredo `CURSEFORGE_API_KEY` no GitHub (Settings › Secrets and variables › Actions); o próximo release com tag já sai com o CurseForge ligado.
- [ ] Perguntar ao CurseForge sobre os itens 6, 10 e 11 e guardar a resposta em `docs/avaliacao/`.
- [ ] Deixar o repositório público (Settings › General › Change visibility).
- [ ] Preencher os formulários com os links públicos: código <https://github.com/lipeventura777/hubsquare>, privacidade <https://github.com/lipeventura777/hubsquare/blob/main/PRIVACY.md>.
