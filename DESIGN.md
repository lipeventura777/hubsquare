# HubSquare — Guia de Design

> Fonte de verdade da interface. Leia junto com o `CLAUDE.md` antes de criar ou mudar qualquer tela.
> Quando este guia e o código discordarem, o guia vence. Se faltar alguma regra, pergunte antes de inventar.
> Versão 2: vários servidores, novas telas (Jogadores, Software, Arquivos, Mundos, Registro de eventos) e sistema de animações.
> Versão 3: aba Explorar completa da tela Mods (tipos de conteúdo, filtros e página de detalhes).
> Versão 3.1: aba Instalados com todos os adicionais, Removidos recentemente e backups protegidos.
> Versão 3.2: fontes CurseForge e Hangar no Explorar e Opções › Integrações.
> Versão 3.3: mods personalizáveis (painel lateral do mod, problemas, perfis, travamento, etiquetas).
> Versão 3.4: tela Comandos (central de comandos) e console com autocompletar, histórico e favoritos.
> Versão 3.5: camadas flutuantes (seção 8.1).
> Versão 4: o app vira HubSquare, com as áreas ServSquare e PlaySquare (troca de área, accent por área, barra lateral do PlaySquare e tela Jogar; seções 3.1 e 6.1.1 a 6.1.3).
> Versão 4.1: tela Instalações do PlaySquare (seção 6.1.4).
> Versão 4.2: convites (Conexão › Convites, seção 6.22.7) e "Entrar com convite" / "Atualizar e jogar" no PlaySquare (seção 6.1.4).
> Versão 4.3: conteúdo do jogador no PlaySquare (Explorar, Conteúdo, frase de compatibilidade e Ajustes do jogo, seção 6.1.5) e Mods › Proibidos para jogadores.
> Versão 4.4: tela Jogar completa (seção 6.1.3: estados do JOGAR, Ligar servidor e jogar, status, memória, sessão e fundos) e o recado do dono em Servidores.
> Versão 4.5: Servidores, Capturas de tela e Ajustes do jogo do PlaySquare, atalho na área de trabalho e atalhos entre as áreas (seção 6.1.6).
> **Versão 5 (visual 4, Fase V1):** painéis de vidro fosco sobre um fundo de bioma em pixel art, com cinco biomas (seções 3, 4, 5 e 7). Substitui os temas claro/escuro e os cantos retos.
> **Versão 5.1 (Fase V2):** fundos vivos (seção 7.1): motor único, pausa automática, modo leve e economia.
> **Versão 5.2 (Fase M4):** pedidos para entrar pelo convite (seção 6.22.8).
> **Versão 5.3 (Fase M5):** diagnóstico de conexão (seção 6.22.9).
> **Versão 5.4 (Fase M6):** boas-vindas e modo amigo (seção 6.10.1).
> **Versão 5.5 (Fase M7):** passar o servidor (seção 6.15).
> **Versão 5.6 (Fase M8):** relatório de erro (seção 6.9.1).
> **Versão 5.7 (Fase V3):** troca Serv/Play arredondada (seção 6.1.1) e acabamento (`docs/design/acabamento-v3.md`).

---

## 1. Referência e regra de ouro

O visual é **inspirado no Minecraft Launcher** (prints em `docs/design/referencias/`, só para consulta).

**Copiamos a estrutura:**
- barra lateral feita de "blocos" empilhados;
- cabeçalho com título pequeno em caixa alta e abas;
- banner grande no topo da tela principal;
- barra de ação com um botão verde gigante no centro;
- telas de ajustes em lista simples (seções, caixas de seleção e botões coloridos);
- botões com "relevo" (borda inferior mais escura); desde o visual 4, painéis de vidro com cantos arredondados sobre um fundo de bioma em pixel art original (seções 5 e 7).

**NUNCA copiamos:** logos, texturas, artes, capturas do jogo, a fonte do Minecraft, ícones de itens/blocos, ou os nomes "Minecraft" e "Mojang" como marca visual.
A pasta `docs/design/referencias/` **nunca** entra no build nem no instalador.

**Conteúdo do jogo (exceção controlada).** Algumas telas mostram *dados* do jogo:
- cabeça da skin do jogador;
- ícones e nomes traduzidos de itens e blocos.

Isso é permitido só quando:
1. o arquivo é baixado **em tempo de uso**, de fontes oficiais da Mojang (perfil/skin pela API de sessão; ícones e idioma a partir dos assets da versão), e guardado em cache na pasta de dados do app;
2. **nunca** é colocado no repositório nem no instalador;
3. aparece **só como conteúdo** (na lista de jogadores, no inventário, nas estatísticas), nunca como decoração, logo ou identidade visual do app;
4. existe um **fallback próprio**: quadrado com a inicial (cabeça) ou bloco com "?" (item).

Corações, comida, XP e os demais ícones de interface são **desenhos próprios**.

---

## 2. Mapa da tela principal (Painel)

```
┌────────────┬──────────────────────────────────────────────────────────────┐
│ ■ Meu Serv ▾│ SERVIDOR                     CPU 13% │ RAM 2,1 GB │ 2/10   │
│ ● Online    │ Painel   Console   Backups                                  │
├────────────┤──────────────────────────────────────────────────────────────┤
│▌■ PAINEL    │                                          ┌────────────────┐│
│ ■ CONFIG.   │          BANNER (imagem do usuário)       │ Chame seus     ││
│ ■ JOGADORES │          NOME DO SERVIDOR (pixel)         │ amigos!        ││
│ ■ CONEXÃO   │          MOTD                             │ 26.1.2.3:25565 ││
│             │                                           │ [Copiar]       ││
│             │                         [Fulano entrou ✕] └────────────────┘│
│             ├──────────────────────────────────────────────────────────────┤
│             │ [■ Paper  26.3 ▾]        [   LIGAR   ][⋮]     26.1.2.3 ⧉    │
│             ├──────────────────────────────────────────────────────────────┤
│             │ [Dia][Noite][Tempo limpo][Chuva]                             │
│             │ ┌──────────── Console (2/3) ───────────┐┌─ Jogadores (1/3) ─┐│
│             │ │ [12:01 INFO] Done (3.2s)!             ││ ■ Fulano    [⋯]   ││
│             │ │ > _                                   ││ ■ Ciclano   [⋯]   ││
│ ■ APARÊNCIA │ └───────────────────────────────────────┘└───────────────────┘│
│ v1.0.0      │                                                              │
└────────────┴──────────────────────────────────────────────────────────────┘
```

| Área | Equivalente no launcher | No ServSquare |
| --- | --- | --- |
| Topo da barra lateral | Conta Microsoft (avatar + nome) | Cartão do servidor (ícone + nome + status) |
| Itens da barra lateral | Java, Bedrock, Dungeons… | Painel, Opções, Console, Comandos, Registro de eventos, Jogadores, Software, Mods, Arquivos, Mundos, Cópias de segurança, Desempenho, Automação, Integrações, Conexão (lista completa na seção 6.1; o desenho acima é simplificado) |
| Rodapé da barra lateral | Novidades, Ajustes, versão | Aparência (engrenagem), recolher «, versão do app |
| Banner | Arte do jogo + logo | Imagem do usuário + nome do servidor |
| Painel à direita do banner | "Experimente o seu Realm" | Card "Chame seus amigos" com endereço |
| Aviso verde no banner | "Give the gift…" | Aviso de entrada/saída de jogador |
| Seletor à esquerda | "Última versão 26.3" | Tipo e versão do servidor |
| Botão central | JOGAR | LIGAR / DESLIGAR |
| Direita da barra de ação | Nome do usuário + copiar | Endereço ativo + copiar |
| Cards de notícias | Novidades | Console + jogadores (Painel), backups (aba Backups) |
| Faixa FPS/GPU/CPU no topo | Overlay | CPU, RAM e jogadores do servidor |

---

## 3. Tokens (vidro e biomas)

Todos os tokens ficam num lugar só: `src/renderer/src/assets/tokens.css`, lido pelo Tailwind (`main.css › @theme`) e pelo teste de contraste. Um conjunto por bioma em `[data-bioma="…"]`. Componentes **só** usam as variáveis, nunca hex direto.

**Superfícies (iguais em todos os biomas, os valores vêm do bioma):**

| Variável | Valor | Uso |
| --- | --- | --- |
| `--bg-app` | `transparent` | O fundo de bioma aparece atrás |
| `--bg-sidebar`, `--bg-panel` | `rgb(var(--vidro-rgb) / var(--vidro-alfa))` | Barra lateral, cabeçalho, área de conteúdo, cards, diálogos, menus |
| `--bg-panel-2`, `--bg-tile` | `rgb(var(--vidro-2-rgb) / var(--vidro-alfa))` | Campos, cartões internos |
| `--bg-tile-active` | idem com `+0,18` | Hover e item ativo |
| `--bg-console` | `rgb(var(--console-rgb) / .88)` | Console e editores: vidro quase opaco, sempre escuro |
| `--vidro-desfoque` | `blur(var(--vidro-blur)) saturate(150%)` | `backdrop-filter`; "Vidro leve" troca por `none` |
| `--raio-painel` / `--raio-item` / `--raio-pequeno` | 22 / 16 / 12px (Mar: 28 / 20) | Painéis / cards e listas / campos e botões |

**Por bioma:** `--fundo-base`, `--vidro-rgb`, `--vidro-2-rgb`, `--vidro-alfa` (opacidade mínima), `--vidro-blur`, `--vidro-borda`, `--vidro-brilho` (1px na borda de cima, por dentro), `--vidro-sombra`, `--console-rgb`, `--text`, `--text-muted`, `--accent-padrao`, `--border`, `--brilho-titulo`, `--brilho-topo` e as cores de texto `--accent-legivel`, `--perigo-legivel`, `--atencao-legivel`, `--online-legivel`.

**Cores fixas (todos os biomas):** `--danger` `#c42b2b`, `--warning` `#e8c22b`, `--highlight` `#7e3ff2`, `--secondary` `#d0d1d4` (com as `-shadow`), status (`--status-online` `#52a535` etc.), `--text-on-light` `#0f172a`, `--text-on-dark` `#ffffff`.

**Contraste (regra em `src/shared/contrasteRegras.ts`):** todo texto com pelo menos **4,5:1**. O pior fundo é a paleta inteira do bioma (ou uma amostra da imagem do usuário, já com o escurecimento). Se o vidro do bioma não chega lá, a tela sobe `--vidro-alfa` até chegar e recalcula as cores "-legivel" (clareando num vidro escuro, escurecendo no claro). As classes `text-accent`, `text-danger`, `text-warning` e `text-online` usam essas versões. O nome no banner fica numa **placa de vidro** com pelo menos 70% de opacidade, que dá 4,5:1 sobre qualquer imagem. `tests/contrasteRegras.test.ts` confere os cinco biomas a cada mudança.

### 3.1 Accent por área
- Cada área tem a própria cor de destaque (Aparência › Tema: "Cor do ServSquare" e "Cor do PlaySquare").
- **Padrão: a cor do bioma** (`--accent-padrao`). Uma cor escolhida pelo usuário vale em todos os biomas.
- Existe um `--accent` só: ao entrar numa área, ele recebe a cor dela. Hover (−15% de luminosidade) e sombra (−35%) são calculados; o texto sobre o accent é o que der mais contraste (`#0f172a` acima de luminância 0,198, senão branco).

---

## 4. Tipografia

| Papel | Fonte | Tamanho / peso | Onde |
| --- | --- | --- | --- |
| Corpo | Inter (licença OFL, arquivo local) | 14px / 400 | Texto geral |
| Lista de ajustes | Inter | 13px / 400 | Rótulos de opções |
| Rótulo pequeno | Inter | 12px / 700, caixa alta, `letter-spacing: .02em` | Título acima das abas, cabeçalho de seção |
| Barra lateral | Inter | 13px / 700 | Itens (máx. 2 linhas) |
| Abas | Inter | 16px / 400; ativa 700 | Abas do cabeçalho |
| Display (pixel) | Pixelify Sans (OFL, arquivo local) | 22–48px | Títulos grandes, nomes das áreas, nome no banner, JOGAR/LIGAR |
| Console | Cascadia Mono → Consolas → monospace | 13px | Console e "Ver detalhes" |

- Fontes em `src/renderer/src/assets/fonts/` com o arquivo de licença. O app nunca baixa fonte da internet.
- Texto em pixel: sombra dura (`--sombra-texto`); na Noite e no Nether, com brilho da cor do bioma (`--brilho-titulo`).

---

## 5. Espaçamento, forma e vidro

- Grade base de **4px**. Espaços comuns: 8, 10, 12, 16, 24, 40.
- **Vidro:** fundo translúcido, `backdrop-filter: blur(20px) saturate(150%)` (Dia claro: 24px), borda de 1px clara translúcida, brilho de 1px na borda de cima (`inset`) e sombra suave embaixo. Vidro dentro de vidro não desfoca de novo.
- **Cantos:** 22px nos painéis (barra lateral, cabeçalho, área de conteúdo, diálogos), 16px em cards e listas flutuantes, 12px em campos e botões, 14px no botão grande. Mar: 28px nos painéis.
- **Layout:** o mesmo de antes, com os painéis flutuando 10px afastados das bordas: barra lateral de vidro com a troca Serv/Play no topo, cabeçalho de vidro, área de conteúdo de vidro (todo texto fica sobre vidro), banner com o nome numa placa de vidro, barra de ação de vidro e os cards embaixo.
- Medidas fixas: barra lateral **180px**; cabeçalho **80px**; barra de ação **64px**; card do banner **340px**.
- **Relevo de botão:** `border-bottom: 3px solid var(--x-shadow)` + brilho `inset 0 1px 0`. Pressionado: desce 2px e a borda afina.
- **JOGAR / LIGAR (botão grande de destaque):** cor de destaque sólida, texto escuro, sombra por dentro embaixo (`inset 0 -5px 0 var(--accent-shadow)`, efeito de bloco) e brilho da mesma cor em volta.
- **Status online:** quadradinho com brilho (`box-shadow` da cor do status).

---

## 6. Componentes

### 6.1 Barra lateral
- **Topo — cartão do servidor ativo** (72px):
  - barra vertical de 4px na esquerda com a cor do status;
  - nome em 16px;
  - tipo e versão em 12px `--text-muted` (ex.: "Paper 26.3");
  - à direita, botão redondo de 28px que liga (accent, ▶) ou desliga (danger, ■).
  - Clicar no nome abre a tela **Servidores**.
- **Itens, nesta ordem:** Painel, Opções, Console, Comandos, Registro de eventos ›, Jogadores, Software, Mods, Arquivos, Mundos, Cópias de segurança, Desempenho, Automação, Integrações, Conexão.
  - Itens de telas que ainda não existem abrem a tela "Em breve" (seção 6.23).
  - Cada item tem ícone pixel de 20px em `--accent` e rótulo de 14px em negrito.
  - Altura de 44px no modo compacto (padrão) e 56px no modo bloco.
  - "Registro de eventos" tem uma seta › que abre um submenu: Logs, Relatórios de travamento e Ações do app.
- **Item ativo:** fundo `--bg-tile-active` + barra vertical de 3px em `--accent` na borda esquerda.
- **Selos à direita do rótulo:**
  - ⚠ em `--warning` (ex.: Cópias de segurança quando o último backup falhou ou nunca houve um);
  - quadradinho de 6px em `--accent` para novidade (ex.: Jogadores quando alguém entra).
- **Rodapé** (preso embaixo): engrenagem (Aparência) à esquerda, botão « que recolhe a barra para 56px (só ícones, com dica no hover) à direita e, abaixo, a versão do app em 11px.
- No ServSquare, o cartão do servidor fica logo abaixo da troca de área (seção 6.1.1).

### 6.1.1 Troca de área (Serv / Play)
- O app (HubSquare) tem duas áreas: **ServSquare** (servidor) e **PlaySquare** (launcher). A troca fica no canto superior esquerdo, acima de tudo na barra lateral, com borda inferior de 2px `--border`.
- **Trilho** de vidro (`--bg-panel-2`) com cantos `--raio-item` e 4px de espaço interno; dentro, **duas abas** de 44px (fonte pixel de 15px) com cantos `--raio-item − 4px` (paralelos ao trilho em todos os biomas).
  - A **selecionada** mostra o nome inteiro ("ServSquare"/"PlaySquare"), com fundo `--accent` translúcido (20%), contorno interno de 1px em `--accent` e brilho suave da mesma cor. Esse fundo desliza para o lado dela, animando largura e posição em 200 ms com `--ease-out`; com "Reduzir animações" (ou `prefers-reduced-motion`), a troca é na hora. Na barra aberta, a escolhida tem 100px e a outra 52px.
  - A **outra** mostra só o nome curto inteiro ("Serv"/"Play"; nunca recortado), em `--text-muted`, com hover `--bg-tile-active` e pressionado descendo 1px.
  - `role="tablist"`/`tab` com `aria-selected`; setas esquerda e direita trocam de aba e o foco vai junto; foco do teclado com anel de 2px em `--accent`.
  - Com a barra recolhida (56px), as abas ficam uma em cima da outra, só com o nome curto em 11px. O nome inteiro aparece na dica.
- O app sempre abre no ServSquare. Cada área lembra a própria tela enquanto o app está aberto. O PlaySquare começa em **Jogar**.
- **Cor de destaque por área:** cada área tem um accent próprio (seção 3.1). Ao trocar de área, `--accent` e as cores derivadas passam a ser as da área aberta.
- A troca de área tem uma **transição própria**, diferente da troca de página (seção 8).

### 6.1.2 Barra lateral do PlaySquare
- Mesma estrutura da barra do ServSquare (itens, item ativo, rodapé com Aparência e recolher), sem o cartão do servidor.
- **Itens, nesta ordem:** Jogar, Instalações, Explorar, Conteúdo, Servidores, Capturas de tela, Ajustes do jogo.
- Telas que ainda não existem mostram "Em breve" (seção 6.23).
- A faixa de CPU, RAM e jogadores do cabeçalho (seção 6.2) é só do ServSquare.

### 6.1.3 Tela Jogar (PlaySquare)
Inspirada no launcher oficial, de cima para baixo:
- **Banner grande** com o fundo da instalação selecionada e o nome dela em fonte pixel. Mesmo tratamento do banner do Painel (seção 6.3): gradiente escuro embaixo para o texto ficar legível.
  - **Fundo padrão:** arte original do app (nunca arte da Mojang no instalador). O usuário pode escolher qualquer imagem, e cada instalação pode usar a capa do modpack ou a imagem do servidor ligado a ela.
- **Barra de ação** logo abaixo do banner (mesma altura e relevo da seção 6.4):
  - à esquerda, o **seletor de instalação** (ícone, nome e versão; abre uma lista flutuante, seção 8.1);
  - no centro, o botão grande **JOGAR** em `--accent` (o do PlaySquare), com o mesmo relevo do LIGAR;
  - à direita, o **status do servidor** ligado à instalação: bolinha de status (cores da seção 3), nome do servidor e jogadores online. Sem servidor ligado, essa parte fica vazia.
- **Cards das instalações** embaixo, no lugar das notícias do launcher oficial, no padrão da seção 6.6: imagem, nome, versão do Minecraft, loader e último uso ("há 2 dias").
  - **Hover:** o card sobe 2px e a imagem dá um zoom leve (1,03), em `--dur-fast`.
  - **Clique:** o card afunda 1px (como um botão com relevo) e vira a instalação selecionada. O banner troca a imagem com crossfade em `--dur-base`.
  - Com "Reduzir animações", hover e clique só mudam a borda (seção 8).
- **Detalhes da Fase P4:**
  - **Banner:** 42vh (mínimo 260px), nome em pixel de 36px no canto inferior esquerdo com o ícone da instalação (64px, pixelado) e "Loader versão" embaixo. O fundo é o da instalação, senão o fundo padrão escolhido pelo usuário, senão `banner-padrao`; a imagem nova entra com crossfade (`--dur-base`). Botão secundário pequeno **Fundo** no canto superior direito com: imagem para esta instalação, usar o padrão nesta instalação, escolher o fundo padrão (todas) e voltar à arte do app.
  - **JOGAR:** botão primário grande (mínimo 220px). Estados: **JOGAR**, **ATUALIZAR E JOGAR**, **PREPARANDO…** e **ABRINDO O LAUNCHER…** (com o brilho diagonal do LIGANDO e os pontos animados) e **JOGANDO · 12:34** (tempo da sessão; não clicável). Abaixo, em 11px `--text-muted`: "Só abre o jogo pelo Minecraft Launcher. O servidor não liga nem desliga por aqui."
  - **Preparando:** faixa logo abaixo da barra com a etapa (o arquivo atual), "X MB de Y MB · velocidade/s · falta m:ss" em monoespaçada e a barra de progresso.
  - **Ligar servidor e jogar:** botão secundário ao lado do JOGAR, só para o dono e só com o servidor desligado.
  - **Status do servidor** (à direita): bolinha de status, nome, "3/20 online" ou "Servidor desligado", até 8 cabeças dos jogadores (seção 6.13), o endereço em monoespaçada e, com o servidor desligado, o recado do dono entre aspas.
  - **Memória:** card com a barra "Memória do jogo", a sugestão (mods + memória do PC) com "Usar a sugestão" e, quando o servidor roda no mesmo PC, quanto sobra; se não couber, aviso em `--warning`.
  - **Sessão encerrada:** card com o tempo jogado e "Fechar". Se o jogo travou, o relatório com os mods suspeitos em caixas de seleção e **Desativar e tentar de novo** (mesma lógica da Fase 25).

### 6.1.4 Tela Instalações (PlaySquare)
- Título pixel "Instalações" e, à direita, o botão primário **+ Nova instalação**. Logo abaixo, uma linha em `--text-muted` explica que cada instalação tem a própria pasta e que o jogo abre pelo launcher oficial.
- **Cards** no padrão da seção 6.6 (`CardImagem`), em grade que quebra linha:
  - imagem (ícone do servidor, capa do modpack ou imagem escolhida; sem imagem, o padrão geométrico do app);
  - etiqueta com o loader (Vanilla, Fabric, Forge, NeoForge), nome e versão do Minecraft;
  - origem ("Do seu servidor", "Modpack X", "Criada do zero") e último uso ("Jogada há 2 dias") em 12px `--text-muted`;
  - botão **JOGAR** (primário, ocupa a largura) e menu ⋯ com Editar, Trocar imagem, Duplicar, Abrir pasta e Apagar….
- Ações longas (Jogar, criar de modpack, duplicar) mostram a barra de progresso (seção 8) em cima da lista, com a etapa por escrito.
- **Nova instalação:** diálogo com duas opções no topo, **Do zero** (nome, loader, versão do Minecraft com a mais nova escolhida e RAM) e **De um modpack** (busca no Modrinth, lista com ícone, nome, versão e descrição).
- **Editar:** nome e RAM. A versão e o loader só mudam nas instalações do zero; nas de servidor, uma linha explica que elas seguem o servidor.
- **Apagar:** confirmação em `--danger`, dizendo que a pasta vai para a Lixeira.
- **Depois de Jogar:** diálogo com a frase do que fazer no launcher. Sem launcher: link oficial para baixar e "tentar de novo". Launcher aberto: pede para fechar e tentar de novo.
- **Entrar com convite** (botão secundário ao lado de + Nova instalação): diálogo com um campo para colar o código ou o link e o botão "Abrir arquivo de convite (.hubsquare)".
- **Card de convite:** origem "Convite do servidor X" (com "fora do ar agora" quando o servidor não respondeu). Quando o servidor mudou os mods, o botão vira **ATUALIZAR E JOGAR**.
- **Atualizar e jogar:** diálogo com a versão (ex.: "Versão 3 → 4"), as listas **Entra** e **Sai** em monoespaçada, os recomendados como caixas de seleção, o aviso dos mods sem link e a frase "Seus mods, mundos, prints e configurações ficam como estão". Não há como jogar desatualizado.
- **Mods proibidos:** diálogo com a lista dos arquivos, "Abrir pasta" e "Tirei, tentar de novo".

### 6.1.5 Explorar, Conteúdo e Ajustes do jogo (PlaySquare)
- **Mesmos componentes** da tela Mods do ServSquare (Explorar e a aba Instalados), nunca cópias. No topo, uma faixa com o **seletor de instalação** (nome · versão) e a frase "Tudo o que você instalar aqui é seu".
- **Explorar:** os filtros já vêm com a versão e o loader da instalação ("Fabric (da instalação)"). Abas de Mods, Modpacks, Resource packs e Shaders (sem plugins e datapacks); só o Modrinth. O botão principal diz **Instalar no meu jogo** (modpack: **Criar instalação com este modpack**).
- **Frase de compatibilidade:** no card de ação dos detalhes, logo acima dos botões, e na descrição de cada card de Conteúdo. Começa com ✓ em `--status-online` ("Vai funcionar: compatível com Fabric 26.3"), ✓ em `--warning` (funciona, com aviso: shaders) ou ✕ em `--danger` ("Não vai funcionar: ..."). Avisos que não impedem a instalação têm o link discreto **Não mostrar de novo**; os de loader e de versão aparecem sempre e desativam o botão.
- **Conteúdo:** as mesmas abas, filtros, remover com desfazer e o painel de configs do mod. Abas: Mods, Shaders e resource packs, Outros. Cada card tem a etiqueta **Do servidor** (`--accent`) ou **Meu** (neutra). Itens obrigatórios do servidor não têm caixa de seleção nem interruptor. Em convites com recomendados, uma seção "Recomendados pelo servidor" com caixas de seleção e "Salvar escolha" fica acima das abas.
- **Ajustes do jogo:** seção "Avisos de compatibilidade" com os avisos escondidos e "Mostrar de novo" em cada um.
- **Primeira vez em Jogar:** diálogo "Copiar suas configurações do jogo?" com "Copiar e jogar" (primário) e "Não, começar do padrão".

### 6.1.6 Servidores, Capturas de tela, Ajustes do jogo e atalhos (PlaySquare)
- **Servidores:** título pixel e uma lista (cards de largura total, `anim-item`) com os servidores das instalações, os meus e os de convites. Cada linha tem: ícone (48px), bolinha de status, nome, "Seu servidor" ou "Convite", "3/20 online" ou "Servidor desligado", versão do Minecraft, versão do pacote ("Pacote versão 4 (nova: 5)"), endereço em monoespaçada, até 10 cabeças e o recado do dono (desligado). À direita: **Gerenciar no ServSquare** (só nos meus, secundário pequeno) e **Jogar** / **Atualizar e jogar** (primário). Atualiza a cada 30 s, só com a tela aberta.
- **Capturas de tela:** filtro "Todas as instalações" / uma instalação à direita do título; grade de miniaturas 16:9 com a instalação e a data, com o mesmo hover e clique dos cards da tela Jogar. Clicar abre o diálogo com o print grande (fundo `--bg-console`) e **Copiar**, **Abrir pasta**, **Usar como fundo** (destaque) e **Apagar…** (perigo, sempre com confirmação; vai para a Lixeira).
- **Ajustes do jogo:** seções Memória padrão (caixa "Usar a sugestão do app" ou barra), Janela do jogo (caixa "Deixar o launcher decidir" ou largura × altura), Launcher (só o oficial, com a explicação), Avisos de compatibilidade e Pasta das instalações (caminho em monoespaçada, Abrir pasta, Escolher outra pasta, Voltar ao padrão).
- **Atalho na área de trabalho:** item "Criar atalho na área de trabalho" no menu ⋯ de cada instalação, nunca automático; ao criar, aviso de sucesso com o nome do atalho. O atalho abre o HubSquare no Jogar daquela instalação.
- **Atalhos entre áreas** ("Testar no meu jogo" em ServSquare › Mods, faixa no topo das abas Instalados e Explorar; "Gerenciar no ServSquare" em PlaySquare › Servidores): usam a mesma transição da troca Serv/Play (seção 8) e a aba de área acompanha.

### 6.2 Cabeçalho da página
- Linha 1: título da seção em rótulo pequeno (ex.: `SERVIDOR`, `CONFIGURAÇÕES`).
- Linha 2: abas. A aba ativa fica em negrito, com sublinhado de 3px × 24px em `--accent`, alinhado ao início do texto.
- Canto superior direito, só com o servidor ligado: faixa `CPU 13% │ RAM 2,1 GB │ 2/10`, com rótulos em `--text-muted` e valores em `--text` negrito.

| Tela | Abas |
| --- | --- |
| Servidores | (sem abas) |
| Painel | (sem abas) |
| Opções | Gerais · Integrações · Avançado |
| Console | (sem abas) |
| Comandos | Mundo · Regras do jogo · Jogadores · Itens · Efeitos · Mensagens · Atalhos |
| Registro de eventos | Logs · Relatórios de travamento · Ações do app |
| Jogadores | Todos · Online · Whitelist · Operadores · Banidos · IPs banidos |
| Detalhes do jogador | Visão geral · Inventário · Estatísticas |
| Software | (sem abas) |
| Mods | Instalados · Explorar · Atualizações |
| Arquivos | (sem abas; caminho atual no lugar das abas) |
| Mundos | (sem abas) |
| Cópias de segurança | (sem abas) |
| Desempenho | Visão geral · Pré-gerar mundo · Diagnóstico · Mapa |
| Automação | Desligar quando vazio · Reinício · Backup agendado |
| Integrações | Celular |
| Conexão | playit.gg · Radmin VPN · Rede local · Avançado |
| Aparência | Tema · Fundo · Animações |

### 6.3 Banner (aba Painel)
- Altura: 50% da janela, mínimo 300px.
- Fundo: imagem do usuário (`object-fit: cover`) com gradiente escuro embaixo. Sem imagem, usar um fundo padrão original feito em CSS (blocos geométricos em tons do accent).
- No centro: nome do servidor em display 48px; MOTD em 16px logo abaixo.
- À direita, o **card "Chame seus amigos"**:
  - 340px, fundo `--bg-panel` a 92%;
  - título em display 22px;
  - uma linha de texto;
  - endereço em monoespaçada;
  - botão `--highlight` "Copiar endereço".
  - Com o servidor desligado: "Ligue o servidor para gerar o endereço".
- **Aviso de jogador** (canto inferior direito do banner): fundo `--accent`, texto 12px, botão ✕. Some em 5s. No máximo 3 empilhados.

### 6.4 Barra de ação
- **Esquerda — seletor do servidor** (280×48): borda 1px `--accent`, ícone 32px, "Paper" em 13px negrito e "26.3" em 12px `--text-muted`, chevron. Abre os detalhes do servidor. Fica desabilitado com o servidor ligado.
- **Centro — botão principal** (232×52, display 24px, caixa alta):

  | Estado | Texto | Cor | Clicável |
  | --- | --- | --- | --- |
  | Desligado | LIGAR | `--accent` | sim |
  | Ligando | LIGANDO… | `--warning` | não |
  | Ligado | DESLIGAR | `--danger` | sim |
  | Desligando | DESLIGANDO… | `--warning` | não |

  Ao lado, um botão quadrado 44×52 `--secondary` com "⋮", que abre o menu: Reiniciar, Abrir pasta do servidor.
- **Direita:** endereço ativo em 13px + ícone de copiar (como o nome de usuário no launcher).

### 6.5 Área abaixo do banner (aba Painel)
- **Linha de comandos rápidos:** botões pequenos `--secondary` com Dia, Noite, Tempo limpo e Chuva.
- **Grade de 2 colunas** (2fr / 1fr, espaço de 16px):
  - **Console:** fundo `--bg-console`, monoespaçada 13px.
    - Cores das linhas: INFO em `--text-muted`, WARN em `--warning`, ERROR em `--danger`.
    - Campo de comando embaixo com prefixo `>`, cantos retos, foco com borda `--accent`.
  - **Jogadores:** lista com a cabeça do jogador em 28px (seção 6.13), o nome e um botão `⋯` com as ações: OP, tirar OP, modo de jogo, expulsar. Clicar no nome abre os Detalhes do jogador.
- O item **Console** da barra lateral mostra o console em tela cheia.

### 6.6 Cards (estilo "notícias")
- Usados na aba Backups e na aba Mundo.
- Largura 300px, imagem 16:9 em cima (miniatura ou padrão geométrico) e uma etiqueta `--accent` no canto inferior esquerdo (ex.: "Backup", "Mundo atual").
- Data e tamanho à direita, em 12px.
- Borda 1px `--border`; no hover, `--text-muted`.

### 6.7 Telas de ajustes (Configurações, Conexão › Avançado, Aparência)
Seguem **exatamente** o padrão da tela "Ajustes" do launcher:
- Coluna alinhada à esquerda, largura máxima de 720px, margem interna de 40px.
- Seções separadas por 40px. Cada seção começa com o cabeçalho em rótulo pequeno e margem de 16px.
- **Linha de opção** (32px): caixa de seleção quadrada de 16px com borda 1px `#8a8a8a`. Marcada: fundo `--accent` com ✓ branco. Rótulo em 13px.
- **Campo de texto e select:** altura 36px, fundo `--bg-panel-2`, borda 1px `--border`, foco com borda `--accent`.
- **Slider (RAM):** trilho de 4px em `--bg-panel-2`, preenchimento `--accent`, alça retangular 14×24 com relevo. O valor aparece ao lado ("4 GB").

**Botões:**

| Tipo | Fundo | Texto | Uso |
| --- | --- | --- | --- |
| Primário | `--accent` | `--accent-text` | Salvar, Próximo, Ligar |
| Secundário | `--secondary` | `#1b1b1b` | Cancelar, Voltar, ações neutras |
| Perigo | `--danger` | `#ffffff` | Remover, Desligar, Restaurar |
| Atenção | `--warning` | `#1b1b1b` | Avisos que pedem ação |
| Destaque | `--highlight` | `#ffffff` | Copiar endereço, ação em destaque |

Botões têm 32px (pequeno) ou 40px (normal) de altura, margem interna de 18px dos lados e texto em 13px negrito.

### 6.8 Diálogo de confirmação
- Largura 440px, fundo `--bg-panel`, borda 2px `--border`, fundo da página escurecido a 60%.
- Título em display 20px e texto em 14px.
- Botões alinhados à direita: Cancelar (secundário) e a ação (perigo ou primário).

### 6.9 Mensagem de erro
- Painel com fundo `--danger` a 12%, barra de 4px `--danger` à esquerda, título em negrito ("O que aconteceu") e texto ("O que fazer").
- Link "Ver detalhes" abre um bloco monoespaçado com o erro técnico e um botão "Copiar".

### 6.9.1 Relatório de erro (Fase M8)
- **Onde:** seção "Ajuda" em ServSquare › Opções › Gerais e em PlaySquare › Ajustes do jogo (frase em `--text-muted` e o botão secundário "Gerar relatório de erro"), e o mesmo botão (pequeno) ao lado de "Copiar" no bloco "Ver detalhes" de toda mensagem de erro (6.9).
- **Diálogo** (vidro, seção 6.8), título "Relatório de erro": a frase "Junta num .zip ... Nada é enviado: o arquivo fica só na sua Área de Trabalho.", dois selects lado a lado (Servidor e Instalação do jogo, com "Nenhum"/"Nenhuma") e "Vai no relatório": uma caixa de seleção por item (nome + descrição em `--text-muted`), todas marcadas. Embaixo, em 12px `--text-muted`: "Sempre vai um LEIA-ME.txt com o resumo. Nunca vão mundos nem arquivos de mods." Ação primária: "Salvar na Área de Trabalho".
- **Pronto:** aviso de sucesso com o nome do arquivo e o botão pequeno "Abrir pasta"; a ação vira "Fechar".

### 6.10 Assistente de primeira vez
- Sem barra lateral, fundo `--bg-app`.
- No topo, a barra de etapas: quadrados numerados ligados por uma linha.
  - Etapa atual: `--accent`.
  - Etapa concluída: `--accent` com ✓.
  - Etapa futura: `--bg-panel-2`.
- Conteúdo centralizado (720px), seguindo o padrão de ajustes.
- Embaixo, a barra de ação: Voltar (secundário) à esquerda e Próximo (primário, display) à direita. Na última etapa, o botão vira "CRIAR SERVIDOR".

### 6.10.1 Boas-vindas e modo amigo (Fase M6)
- **Primeira abertura** (sem servidores salvos e sem escolha): tela cheia sobre o bioma, um painel de vidro (`--raio-painel`) com o título "Bem-vindo ao HubSquare" em fonte pixel, a frase "Como você vai usar o app? Dá para mudar depois em PlaySquare › Ajustes do jogo." e dois cartões grandes lado a lado (um embaixo do outro em janela estreita): **"Vou hospedar servidores"** (completo) e **"Só vou jogar com amigos"** (amigo), cada um com título em pixel e uma frase em `--text-muted`.
- **Aberto por um convite:** o cartão do amigo vem primeiro, com borda `--accent` e a etiqueta "sugerido", e uma faixa em `--bg-panel-2`: "Você abriu um convite...". Escolhendo o amigo, o PlaySquare abre em Instalações com o "Entrar com convite" já colado.
- **Modo amigo:** a barra lateral é a do PlaySquare, sem a troca Serv/Play, com a cor do PlaySquare. Sem servidor, nunca aparece o assistente.
- **Ajustes do jogo › Modo do app:** uma frase dizendo o modo atual; no amigo, "Também quero hospedar servidores" (primário); no completo, "Usar só o PlaySquare (modo amigo)" (secundário), recusado com o servidor ligado. Embaixo: "Trocar não apaga nada...". Trocar usa a transição de área.

### 6.11 Ícones
- Estilo pixel, desenhados numa grade de 16×16 e mostrados a 28px (barra lateral) ou 16px (botões).
- Usar ícones próprios em SVG ou uma biblioteca livre de ícones pixel. Perguntar antes de instalar.
- Nunca usar texturas, itens ou blocos do jogo como ícones de interface (a exceção do conteúdo do jogo está na seção 1).
- Ícones de status do jogador são desenhos próprios em pixel 9×9, mostrados a 20px:
  - coração (cheio, meio, vazio) em `#e03c3c`;
  - comida (cheia, meia, vazia) em `#e8892b`;
  - escudo (armadura).

### 6.12 Card de painel (padrão das telas novas)
- Fundo `--bg-panel`, borda 1px `--border`, cantos retos.
- Faixa de título com 48px de altura: texto de 14px em negrito à esquerda, ações opcionais à direita e divisória de 1px `--border` embaixo.
- Corpo com margem interna de 16px. Entre cards, 16px.
- Grade das telas de detalhe: 2fr / 1fr, que vira uma coluna abaixo de 1100px de largura.
- **Título de página:** em display 28px `--accent`, com 24px de margem embaixo. Usado em telas sem banner: Servidores, Detalhes do jogador, Jogadores.

### 6.13 Cabeça do jogador
- Quadrado de 28px (listas), 40px (cards) ou 72px (detalhe), com `image-rendering: pixelated`.
- Mostra o rosto da skin (8×8) com a camada do chapéu por cima.
- Bolinha de status de 8px no canto inferior direito: `--status-online` ou `--status-offline`.
- Fallback: quadrado com a cor gerada a partir do nome e a inicial em display.

### 6.14 Botões-bloco (atalhos grandes)
- Grade de 4 colunas (2 abaixo de 900px), altura de 72px, ícone de 24px + rótulo de 15px em negrito.
- Usam as cores e o relevo de botão: Whitelist e Operadores em `--accent`; Jogadores banidos e IPs banidos em `--danger`.
- Ficam dentro de um card de painel.

### 6.15 Card de jogador e card de servidor
- **Card de jogador** (grade de 4 colunas): 72px de altura, cabeça de 40px, nome em 16px negrito, botão redondo → de 28px à direita em `--secondary`.
- **Card de servidor** (largura máxima de 560px, centralizado):
  - barra de 4px na esquerda com a cor do status;
  - nome em 18px negrito;
  - tipo e versão em 13px `--text-muted`;
  - botão redondo de 40px ▶/■ à direita.
  - Ações no topo da tela: ✎ (editar) e "+ Criar" (primário), que abre um menu: "Do zero (assistente)" e "A partir de um modpack". Embaixo: "Importar de arquivo .zip" (secundário), que também aceita server packs do CurseForge, e "Receber servidor (.hubserver)" (secundário).
  - **Passar o servidor (Fase M7):** no menu ⋯ do card, "Passar para outro amigo…" (só desligado). O diálogo traz o aviso amarelo "Enquanto seu amigo hospeda, não ligue este servidor aqui, ou os dois mundos vão se separar.", o campo "Quem vai hospedar?", o tamanho, e as listas "Vai no arquivo" e "Fica neste PC" (`--text-muted`) antes do botão "Gerar arquivo .hubserver". Depois, o card mostra "· Com <nome> desde <data>" em negrito na linha do tipo; ligar mostra o erro com "Ligar mesmo assim" (perigo).
  - **Receber:** diálogo "Receber servidor" com o resumo do arquivo. Se é o mesmo servidor (mesmo id fixo), duas opções de rádio: "Atualizar o meu servidor com este mundo (backup protegido antes)" (botão "Fazer backup e atualizar", perigo) e "Criar uma cópia". Servidor novo ou cópia pedem nome e o EULA. O primeiro passo do assistente também tem "Receber servidor (.hubserver)", para quem ainda não tem servidor.

### 6.16 Interruptor (toggle)
- Trilho de 44×22 com cantos retos e alça quadrada de 18px com relevo.
- Ligado: trilho `--accent` com ✓. Desligado: trilho `--danger` com ✕.
- **Linha de controle:** fundo `--bg-panel-2`, altura de 48px, ícone + rótulo de 15px em negrito à esquerda e o interruptor à direita. Linhas separadas por 8px.

### 6.17 Barras do jogador
- **XP:** trilho de 12px `--bg-panel-2` com preenchimento `--accent` e "Nível 24" centralizado acima, em 13px negrito.
- **Vida e fome:** 10 ícones (6.11) em linha.
  - Botões de ação à esquerda: Matar e Deixar faminto (`--warning`).
  - Botões de ação à direita: Curar e Alimentar (primário).
  - Com o jogador offline, as ações ficam desabilitadas com a dica "Disponível com o jogador online".
- **Seletor de modo de jogo:** select no canto superior direito do cabeçalho do jogador.

### 6.18 Inventário
- Grade de slots de 48px com fundo `--bg-panel-2`, borda interna em relevo invertido (escura em cima, clara embaixo) e 4px de espaço.
- Layout:
  - armadura em uma coluna à esquerda;
  - segunda mão;
  - 27 slots do inventário (3 linhas de 9);
  - 9 slots da barra rápida separados por 8px.
  - Abaixo, uma faixa recolhível com o Baú do Ender.
- No slot: ícone de 32px pixelado e a quantidade no canto inferior direito, em display 14px com sombra dura.
  - Itens com durabilidade mostram uma barra de 3px embaixo (verde → amarelo → vermelho).
  - Item sem ícone: bloco "?" próprio.
- Hover: dica com o nome traduzido, quantidade, encantamentos e o id técnico em `--text-muted`.

### 6.19 Lista de estatísticas
- **Linha de destaques:** 4 colunas com ícone de 40px em `--text-muted`, título de 18px em negrito `--accent` e valor de 14px. Itens: Tempo de jogo, Abates de jogadores, Mortes, KDR.
- **Colunas de ranking** (Distância percorrida, Blocos quebrados, Itens usados, Entidades mortas):
  - título de 18px em negrito `--accent`;
  - linha "Total";
  - até 15 linhas com ícone de 20px + nome traduzido + valor alinhado à direita, em fonte monoespaçada com separador de milhar pt-BR.
  - Sem dados: "Sem dados" em `--text-muted`.
- Botão "Mostrar tudo" (primário) expande todas as colunas.

### 6.20 Zona de perigo
- Card de painel com borda superior de 2px `--danger`.
- Opções em "pílulas" quadradas com caixa de seleção, e "Selecionar todos".
- Botão de perigo à direita, desabilitado até marcar algo.
- Antes de executar, sempre abre o diálogo de confirmação dizendo exatamente o que será apagado e que um backup será feito antes.

### 6.21 Acordeão (seções recolhíveis)
- Linha de 52px: ícone de 20px + título de 16px em negrito + botão redondo de 28px em `--accent` com chevron, que gira 180° ao abrir.
- Conteúdo com margem interna de 12px e divisória entre as linhas.
- Exemplos:
  - Posição atual: X/Y/Z com 2 casas decimais, dimensão e botão "Teleportar" (destaque, pequeno);
  - Local de renascimento;
  - Local da última morte.

### 6.22 Gerenciador de arquivos
- Barra de caminho em migalhas (Servidor › plugins › config.yml), clicáveis.
- Tabela com ícone por tipo, nome, tamanho, data e menu ⋯ (Abrir, Renomear, Baixar, Apagar).
- Pastas aparecem primeiro. Arrastar arquivos do Windows para a tabela faz upload.
- **Editor de texto:** monoespaçada de 13px, números de linha, fundo `--bg-console`, barra com Salvar (primário) e Cancelar, aviso "Alterações não salvas" e Ctrl+S.

### 6.22.1 Tela Mods
- Vale para mods (Fabric, Forge, NeoForge) e plugins (Paper); o texto troca "mods" por "plugins". No Vanilla, um estado vazio explica que é preciso trocar o software.
- **Explorar:** funciona em qualquer servidor, até no Vanilla.
  - No topo, abas dos tipos (Mods · Plugins · Modpacks · Resource packs · Shaders · Datapacks) no desenho das abas do cabeçalho (6.2), em 14px, com linha 1px `--border` embaixo.
  - Logo abaixo, a frase de **para onde vai** o tipo, numa faixa `--bg-panel` com borda esquerda de 4px `--accent`.
  - Barra: botão secundário "« Filtros" (recolhe/abre o painel; a escolha fica salva), campo de busca + "Procurar" (primário), seleção "Ordenar: Relevância/Downloads/Seguidores/Mais recentes/Atualizados recentemente" e o par de botões pequenos "Grade | Lista" (o ativo em primário; a escolha fica salva).
  - Filtros ativos: etiquetas `--bg-panel-2` com borda 1px `--border` e "×", e o link "Limpar filtros" em `--accent`.
  - Painel de filtros à esquerda (240px, card `--bg-panel`): Versão do Minecraft (padrão: a do servidor; "Todas"), Loader (padrão: o do servidor), Onde roda (rádio: Qualquer lugar, Só no servidor, Só no jogador, Servidor e jogador; só em mods, plugins e datapacks), Outros ("Só código aberto", "Esconder o que já está instalado") e as categorias reais do Modrinth, agrupadas, com caixas de seleção. Títulos dos grupos em rótulo pequeno.
  - Resultados: "N resultados no Modrinth" em 12px `--text-muted`. Grade de cards (1 coluna; 2 a partir de 900px; 3 a partir de 1300px), cada um com fundo `--bg-panel`, borda 1px `--border` (hover `--text-muted`), ícone de 56px, nome 14px negrito, "por autor · downloads · seguidores" em 12px `--text-muted`, descrição em 2 linhas e etiquetas (Instalado em `--accent`, "⚠ Só do jogador" em `--warning`, até 3 categorias em `--bg-panel-2`). Lista: card único com divisórias, ícone de 40px e descrição em 1 linha. O card inteiro abre os detalhes.
  - Carregamento infinito; enquanto carrega, esqueletos (6.23) no formato dos cards.
- **Detalhes do projeto:** substitui a lista (que fica guardada) com "‹ Voltar ao Explorar" (secundário pequeno). Cabeçalho com ícone de 72px, nome em display 22px, resumo e "por autor · downloads · seguidores · onde roda".
  - Card de ação: a frase de para onde vai (borda esquerda `--accent`), o botão principal com os estados Instalar → Instalando... (barra de progresso) → Instalado (desabilitado) ou Atualizar, e as ações extras: "Remover do mundo" (perigo, com confirmação) nos datapacks; "Parar de usar no servidor" e a caixa "Obrigatório para entrar" no resource pack do servidor; "Adicionar ao Pacote pros amigos" em `--highlight` (ou "Tirar do Pacote pros amigos"). Shaders e itens só do jogador usam o botão principal em `--highlight`. Modpacks: "Criar servidor com este modpack" abre o fluxo de 6.22.2 já na etapa Confirmar.
  - Duas colunas a partir de 1100px. Esquerda: galeria (imagem grande de até 420px e miniaturas de 112×64 com borda 2px `--accent` na escolhida), card "Descrição" e card "Versões para <versão>" com uma linha por versão (número, etiqueta Estável/Beta/Alfa, data, loaders) que abre o changelog. Direita (300px): cards Licença, Links (Código-fonte, Wiki, Discord do projeto, Relatar problemas, Página no Modrinth) e Dependências (ícone de 28px, nome e etiqueta "necessário"/"opcional").
  - Descrição e changelog: markdown do Modrinth sanitizado (sem scripts, estilos, formulários nem iframes), links em `--accent` sublinhado que abrem no navegador. Imagens só do CDN do Modrinth; as de outros sites viram o link "[imagem: …]".
- **Instalar:** diálogo de confirmação com a lista dos arquivos (nome, versão, etiqueta "necessário" nas dependências, tamanho), avisos em `--warning` e problemas em `--danger`.
- **Instalados:** usa as mesmas peças do Explorar (abas, barra com "« Filtros", busca, ordenação e Grade | Lista, etiquetas de filtro, painel de filtros, cards, detalhes e esqueleto); nada de componente novo para a mesma função.
  - Abas com contador (`--bg-panel-2`, 12px): Mods ou Plugins, Datapacks, Resource pack do servidor, Pacote pros amigos, Modpack (só quando houver) e Outros (o que o app não reconhece). Embaixo, a frase da aba na faixa com borda `--accent`.
  - Card: ícone, nome, "versão · fonte (Modrinth, CurseForge, Hangar ou Manual) · tamanho · data", uma linha de detalhe (mundo e se está ativo, obrigatório ou não, pasta no pacote, caminho) e etiquetas: "Será removido ao desligar", "Entra ao desligar" e "Muda ao desligar" em `--warning`; "Atualização disponível" e "Mundo ativo" em `--accent`; "Desativado" e "Obrigatório" em `--bg-panel-2`. À direita (ou embaixo, na grade): caixa de seleção, interruptor (6.16) nos mods/plugins e "Remover" (perigo pequeno).
  - Filtros: Fonte, Situação (Todos/Ativos/Desativados), Mundo (datapacks) e "Só com atualização". Ordenação: Nome, Data de instalação, Tamanho. Acima dos cards: "Selecionar todos" e "Remover selecionados (N)" (perigo pequeno).
  - Remover: diálogo (6.8) com "Isto sai:" (nome — onde está), os dependentes em `--warning` com o botão "Remover todos (N)" (ou Cancelar), e as frases do que acontece (servidor ligado, server.properties, Pacote pros amigos, 7 dias). Depois, faixa de sucesso com "Desfazer" (secundário pequeno).
  - **Removidos recentemente:** card de painel no fim da aba, uma linha por item (nome, aba, "removido em … · some em N dias") e "Restaurar" (secundário pequeno).
  - Detalhes: os do Explorar, com "‹ Voltar aos Instalados", o "Remover" na linha de botões e o card "No servidor" (onde, fonte, versão, tamanho, data). Sem fonte conhecida: o mesmo cabeçalho e card de ação, só com o card "No servidor".
- **Atualizações:** card com "Atualizar todos" (primário) na faixa de título e "Atualizar" (secundário) por linha, com "versão atual → nova".
- Mudanças com o servidor ligado: faixa de atenção "Reinicie o servidor para aplicar…" no topo, com botão "Reiniciar", e etiqueta `--warning` na linha afetada.
- Ícones de projeto vêm do CDN do Modrinth (conteúdo de terceiros, não do jogo). Sem ícone: quadrado com a inicial, como a cabeça do jogador (6.13).

### 6.22.1.2 Fontes do Explorar e Opções › Integrações
- **Seletor de fonte:** no topo do Explorar, rótulo pequeno "FONTE" e o par de botões pequenos Modrinth · CurseForge · Hangar (o ativo em primário, como "Grade | Lista"). Hangar só em servidores Paper.
- As abas, os filtros e a ordenação mudam com a fonte: CurseForge tem Mods, Plugins, Modpacks e Datapacks, uma categoria por vez, sem "Onde roda" nem "Só código aberto"; Hangar tem só Plugins. A ordenação "Seguidores" vira "Avaliação" (CurseForge) ou "Estrelas" (Hangar), e o card troca "seguidores" por "curtidas" ou "estrelas".
- **CurseForge sem chave:** faixa de atenção com a frase do porquê e o botão "Configurar" (atenção pequeno), que abre Opções › Integrações; a lista fica escondida.
- **Baixe pelo site:** quando o autor não deixa outros apps baixarem, o botão principal dos detalhes vira o link "Baixe pelo site" (visual de botão primário) para a página do arquivo. Em listas (diálogo de instalação, modpack, atualizações), linhas em `--warning` "⚠ … — baixe pelo site" com o link sublinhado.
- **Opções › Integrações:** padrão das telas de ajustes (6.7). Seção "CurseForge" com o texto do que a chave libera, faixa de sucesso "Chave do CurseForge guardada." com "Remover chave" (perigo, com confirmação), passo a passo numerado com os links da página de pedido e dos termos, e o campo de senha + "Salvar" (primário; "Conferindo..." enquanto testa a chave). A chave nunca aparece na tela depois de salva.

### 6.22.1.2.1 Downloads necessários (Fase D)
- **Janela:** diálogo (6.8) mais largo (680px), título em display "Downloads necessários" e a frase do porquê em `--text-muted`. Abre sozinha quando uma instalação deixa algo faltando; "Fechar" guarda o que falta.
- **Progresso:** "X de Y prontos" em negrito com a barra de progresso (8) embaixo e, à direita, "Abrir todas" (primário pequeno; abre até 5 páginas, depois vira "Abrir as próximas N"). Tudo pronto: faixa de sucesso e o botão vira "Concluir" (primário).
- **Linha:** fundo `--bg-panel-2` com borda esquerda de 4px na cor do status, ícone de 40px, nome em negrito, nome exato do arquivo em monoespaçada 12px, tamanho e "Para: servidor/instalação". Status à direita: Aguardando (`--text-muted`), Detectado, conferindo… (`--warning`), Pronto ✓ (`--status-online`), Arquivo diferente (`--danger`, com o motivo embaixo). O status entra com o selo (fade + escala 0,9 → 1) a cada troca. Botões: "Abrir página de download" (primário pequeno), "Já baixei, escolher arquivo" (secundário pequeno) e a área "ou arraste o arquivo aqui" (borda tracejada `--border`); arrastar por cima da linha mostra o contorno `--accent`.
- **Botão nas telas:** faixa de atenção "Faltam N arquivos…" com "Downloads pendentes (N)" (atenção pequeno) no topo de Mods e de Conteúdo, só enquanto falta algo.
- **Ajustes do jogo:** seção "Downloads manuais" com as pastas extras (monoespaçada, "Tirar") e "Adicionar pasta".

### 6.22.1.3 Mods personalizáveis (aba Instalados)
- **Filtros a mais:** "Só com problema", Categoria (as do projeto na fonte) e Etiqueta (cor). Com mods selecionados, a barra ganha "Ativar", "Desativar" e "Atualizar (N)" (primário, só se algum tem atualização), antes de "Remover selecionados".
- **Card:** quadrado de 16px com a cor da etiqueta, "⚠ N problemas" em `--warning`, "Versão travada" em `--bg-panel-2`; a nota do usuário aparece no lugar da descrição. Clicar num mod ou plugin abre o painel lateral (os outros tipos continuam abrindo os detalhes).
- **Faixas no topo:** travamento recente com borda esquerda `--danger` (data, causa, mods suspeitos com caixas de seleção, "Desativar e tentar de novo" em perigo e "Dispensar"); faixa de atenção "N mods têm problema" com "Ver só esses". Abaixo, "Exportar lista" e "Importar lista" (secundários pequenos).
- **Painel lateral do mod:** fixo à direita, 560px, fundo `--bg-panel` com borda esquerda 2px `--border`; cabeçalho com ícone de 48px, nome em display 18px, "versão · caminho" e o "×"; abas (peça do Explorar) Visão geral · Configuração · Versões. Esc fecha.
  - Visão geral: card "Problemas" (cada um com borda esquerda `--warning` e o botão de correção em atenção pequeno), card "Sobre" (fonte, versão, tamanho, data, categorias, interruptor ativo, "Página completa", "Remover") e card "Etiqueta e nota" (7 quadrados de cor de 28px + "Sem cor", campo de nota, "Salvar etiqueta").
  - Configuração: faixa de atenção com o servidor ligado ("só vale depois de reiniciar"); seleção do arquivo, "Editar como texto" (o editor de 6.22) e "Restaurar padrão" (perigo, com confirmação que diz onde fica a cópia). Formulário por seção (rótulo pequeno): linha de controle (6.16) para sim/não, campo monoespaçado para número e texto, área de texto "um item por linha" para listas, e as opções só de leitura em `--text-muted`; a descrição de cada opção são os comentários do arquivo. Embaixo, fixos, "Desfazer" e "Salvar".
  - Versões: linha de controle "Travar versão"; faixa com borda `--accent` "Versão anterior guardada: X" com "Voltar para a versão anterior"; card com as versões compatíveis ("Instalada" em `--accent` ou "Usar esta versão").
- **Perfis de mods:** card de painel no fim da aba Mods com a lista (nome, "N ativos · salvo em…", "Usar" em primário só com o servidor desligado, "Apagar" em perigo) e o campo "Nome do perfil" + "Salvar perfil atual".
- **Cores das etiquetas:** vermelho, laranja, amarelo, verde, azul, roxo e cinza; são conteúdo do usuário e não mudam com o tema.

### 6.22.1.4 Comandos (central de comandos)
- Só funciona com o servidor ligado: desligado, faixa de atenção no topo e os botões desabilitados (dá para montar tudo antes; na aba Atalhos dá para criar e editar).
- Antes do primeiro uso numa versão: estado vazio "Preparar os comandos desta versão" com o tamanho do download e o botão primário "Preparar comandos" (barra de progresso embaixo).
- **Ação:** botão pequeno (primário; perigo nas destrutivas) e, ao lado, o comando que vai rodar em monoespaçada 12px `--text-muted` ("/time set 6000"), ou o que falta preencher em `--warning`. Depois de rodar, uma linha por resposta: borda esquerda `--online` com "✓" (sucesso), `--danger` com "✕" (erro) ou `--border` com "•" (sem resposta reconhecida), em português quando a versão tem a tradução. Destrutivas (limpar inventário, expulsar, banir, OP) confirmam num diálogo que mostra os comandos.
- **Escolher jogadores:** botões de 36px com a cabeça de 28px (6.13) e o nome, borda 2px `--accent` quando marcados, e "Todos (N)" antes.
- **Mundo:** cards em 2 colunas (a partir de 1100px): Tempo (Dia, Meio-dia, Noite, Meia-noite e o slider 0 a 24000 com a hora), Clima (duração em minutos), Dificuldade, Spawn do mundo (x y z ou "onde está o jogador") e Borda do mundo (tamanho, tempo e centro).
- **Regras do jogo:** busca + "Ler de novo do servidor"; uma linha por regra (fundo `--bg-panel-2`) com o título em português, a descrição e o comando, e o interruptor (sim/não) ou campo + "Salvar" (número). As que têm descrição vêm primeiro.
- **Itens e Efeitos:** à esquerda, card com busca e lista em 2 colunas (ícone de 28px, nome, id em monoespaçada); à direita (420px), card "Dar"/"Aplicar". Os efeitos usam o frasco pixel do app pintado com a cor do efeito.
- **Mensagens:** card "Cor e destino" (16 quadrados de 24px com as cores do texto, "Negrito" e os jogadores; ninguém marcado = todos) e cards para Chat como o servidor, Chat colorido, Título na tela e Barra de ação, cada um com a prévia em fundo `--bg-console`.
- **Atalhos:** card "Seus atalhos" com ☆/★ (estrela em `--warning` = aparece no Painel), o botão do atalho, os comandos em monoespaçada e Editar/Apagar. O botão do atalho é `--bg-panel-2` com borda inferior de 3px e o ícone na cor escolhida (cores das etiquetas). Editor: nome, ícone, intervalo, cores, comandos um por linha (com {jogador}) e "Mostrar no Painel".
- **Painel:** os atalhos com estrela ficam no lugar dos antigos botões Dia/Noite/Tempo limpo/Chuva (que viram atalhos padrão).
- **Console:** sugestões acima do campo (lista `--bg-console`, a escolhida em `--bg-panel-2`), Tab completa e ↑/↓ escolhe; sem sugestões, ↑/↓ andam no histórico. Botão "★ Favoritos" abre favoritos e os 20 últimos do histórico, cada um com ☆/★.

### 6.22.1.1 Cópias de segurança
- Topo: "Espaço usado: X" e, à direita, seleção do tipo de backup, "Ordenar: Data/Tamanho" e, com algo marcado, "Apagar selecionados (N) · libera X" (perigo).
- Card (6.6): etiqueta "Mais recente" ou o tipo (Ao desligar, Agendado, Antes de atualizar…); linha com o cadeado em `--accent` e "Protegido · tipo"; caixa de seleção (desabilitada nos protegidos), "Proteger/Desproteger" com o ícone pixel de cadeado (secundário pequeno), "Apagar" (perigo pequeno, desabilitado nos protegidos) e "Restaurar".
- Apagar: diálogo com data, tipo e tamanho de cada um e quanto libera. Se forem todos os backups do servidor, campo para digitar o nome dele, e o botão só libera quando bater.

### 6.22.2 Modpacks e Pacote pros amigos
- **Criar a partir de um modpack:** mesmo visual do assistente (6.10), com as etapas Modpack · Confirmar · Pronto. Na primeira, busca + "Abrir arquivo .mrpack" (secundário) e a grade de cards da tela Mods (ícone, nome, "Minecraft 1.21.1 · Fabric · downloads", descrição, "Escolher"). Em Confirmar: card de painel com ícone de 72px, jogo, loader e quantidade de mods; faixa de sucesso (ou atenção, se o PC tiver pouca RAM) com a frase da RAM sugerida; nome e EULA como no assistente.
- **Atualizar o modpack:** na aba Atualizações da tela Mods, um card de painel "Modpack <nome>" com "versão atual → nova" e o botão primário "Atualizar o modpack" (desabilitado com o servidor ligado). O diálogo resume o que muda e lista cada conflito com duas opções de rádio: "Manter o meu" (padrão) e "Usar o do pack".
- **Pacote pros amigos:** botão `--highlight` no topo da aba Instalados (só em Fabric, Forge e NeoForge). Ao terminar, um diálogo mostra o arquivo salvo, os mods "baixe manualmente" em `--warning` e o texto para o Discord num bloco monoespaçado, com o botão "Copiar texto".

### 6.22.3 Tela Desempenho
- **Visão geral:** grade de 4 cards de painel (4 colunas a partir de 1300px, 2 a partir de 900px): TPS, CPU, RAM e Jogadores. Cada card tem o valor atual em display 22px e um gráfico de linha dos últimos 10 minutos: uma medida por gráfico, linha de 2px em `--accent`, linha de base em `--border`, sem segundo eixo. Ao passar o mouse, uma linha vertical em `--text-muted` e uma dica com o valor e "há N min". Abaixo, as dicas (faixas com borda esquerda `--accent`) e a seção Java com a linha de controle (6.16) "Usar configuração otimizada do Java" e "Ver as flags" num bloco monoespaçado.
- **Ferramentas (Chunky, spark, BlueMap/Dynmap):** sem a ferramenta, um card "Precisa do <nome>" com o botão primário "Instalar o <nome>" e o mesmo diálogo de instalação da tela Mods. Instalada com o servidor ligado: faixa de atenção "Reinicie o servidor para ativar…".
- **Pré-gerar mundo:** faixa de atenção sobre o peso da geração; botões pequenos de raio (500, 1.000, 2.000, 5.000) + campo "Outro"; linha com chunks, tempo e espaço estimados; barra de progresso com %, chunks, tempo restante e velocidade; Iniciar (primário), Pausar/Continuar e Cancelar (perigo, com confirmação). Perguntas do Chunky viram uma faixa de atenção com botões, nunca resposta automática.
- **Diagnóstico:** botão primário "Diagnosticar lag", barra de 60 s e um card "Resultado" com o resumo, os 3 maiores culpados numerados (número em display `--accent`, porcentagem em monoespaçada) e o link do relatório.
- **Mapa:** card de permissão com caixa de seleção antes de qualquer download pedido pelo plugin; barra de renderização; botão `--highlight` "Abrir mapa" e linhas de endereço (rede local e Radmin) com "Copiar", como na tela Conexão.

### 6.22.4 Tela Automação
- Padrão das telas de ajustes (6.7): uma seção por aba, com a linha de controle (6.16) que liga a automação, os sliders (6.7) e um texto em 13px `--text-muted` explicando o que acontece. Embaixo, "Salvar" (primário) e "Desfazer" (secundário) quando algo mudou.
- No topo de todas as abas: "As automações só funcionam com o ServSquare aberto (pode ficar na bandeja)".
- Status ao vivo em 13px: "Desliga em 12 min se ninguém entrar", "Próximo reinício: sábado, 05:00", "Próximo backup em 2 h 10 min".
- Reinício: caixas de seleção dos dias (Dom a Sáb) em linha e um campo de horário de 128px.
- **Registro de eventos › Ações do app:** lista em card com divisórias, data e hora em monoespaçada 12px `--text-muted` à esquerda e o texto à direita; as mais recentes primeiro.

### 6.22.5 Integrações › Celular e o painel no celular
- **Tela no app:** padrão de ajustes (6.7). Linha de controle "Abrir o painel no celular" (desabilitada até criar o PIN); seção PIN com dois campos (novo e repetir) e botão primário; seção Porta; um card de painel por endereço (Rede local, Radmin VPN, Tailscale) com o QR code de 160px (sempre preto no branco, para o leitor do celular) e o endereço em monoespaçada; lista de aparelhos conectados e botão de perigo "Desconectar todos os aparelhos" (com confirmação); passo a passo numerado do Tailscale.
- **Página no celular:** coluna única de até 430px com 16px de margem, tema escuro e accent do usuário. De cima para baixo: card do servidor (barra de status de 4px, seletor do servidor, tipo e versão, bolinha + texto do status); botão principal de 64px em display, com os mesmos estados e cores da barra de ação (6.4); "Reiniciar" (secundário); card do endereço com "Copiar" (`--highlight`); faixa CPU · RAM · Jogadores; jogadores com cabeça de 28px (6.13); console só de leitura com as últimas 50 linhas; rodapé com o aparelho e "Sair deste aparelho". Confirmações em diálogo (6.8). Atualiza a cada 3 s.
- Sem as fontes do app (a página não baixa nada de fora): usa Noto Sans/Pixelify Sans se o aparelho tiver, senão a fonte do sistema.

### 6.22.6 Ícone, MOTD e avisos de atualização
- **Ícone do servidor (Opções › Gerais):** prévia de 64px (`image-rendering: pixelated`), "Escolher imagem" (secundário) e "Remover ícone" (perigo, com confirmação). O recorte abre num diálogo (6.8): área quadrada de 256px com borda 1px `--border`, arrastar para mover, roda do mouse ou slider (6.7) para o zoom. Sem ícone, vale o quadrado com a inicial (como 6.13). O ícone aparece com 32px no cartão do servidor (6.1) e com 40px no card da tela Servidores (6.15).
- **Editor de MOTD:** 16 quadrados de 24px com as cores dos códigos § (cores do conteúdo do MOTD) e botões de estilo de 32px (N, I, S, R e "Limpar") em `--bg-panel-2`; dois campos (Linha 1 e Linha 2) em monoespaçada com contador "n/45" (em `--warning` quando passa); embaixo, a prévia da lista: card `--bg-console` com o ícone de 64px, nome em negrito, "0/20" e barrinhas de sinal desenhadas pelo app, e o MOTD colorido na fonte do app. Nunca a fonte, as texturas ou o visual exato do jogo.
- **Avisos de atualização:** quadradinho de novidade `--accent` (6.1) em Software (build ou Minecraft novo) e em Mods (mods, plugins ou modpack), que só some quando a atualização acontece. No Painel, abaixo do banner, um card de painel "Atualizações disponíveis" com "Verificar de novo" na faixa de título e uma linha por aviso: build nova com "Atualizar" (primário, só com o servidor desligado, confirmação e backup antes); Minecraft novo só com texto e "Abrir Software"; mods e modpack com "Ver" (abre Mods › Atualizações).
- **Opções › Gerais › Atualizações:** linha de controle "Verificar atualizações automaticamente" (ligada por padrão).

### 6.22.7 Conexão › Convites
- Faixa no topo (mesmo estilo das outras abas de Conexão) explicando o convite, com o botão primário **Convidar amigos** enquanto não há convite.
- **Convite ativo:** título "Convite (versão N da lista de mods)"; o código e o link em caixas com fonte monoespaçada e botão de destaque "Copiar" (mesmo padrão do "Copiar endereço"); linha em `--text-muted` com os endereços onde o convite responde e o aviso de que ele não expira; botões **Exportar arquivo de convite** (secundário) e **Revogar…** (perigo).
- **Revogar…:** confirmação com "Revogar e gerar outro" (perigo) e "Só revogar (sem gerar outro)".
- **Mods proibidos:** caixa de texto, um por linha, e "Salvar lista".
- **Avançado:** porta do convite e o túnel do playit.gg (opcional) com a explicação de que pelo túnel o convite passa sem criptografia.
- **Aprovar automaticamente quem usar este convite** (Fase M4): interruptor no convite ativo, desligado por padrão, com a explicação do que muda.

### 6.22.8 Pedidos para entrar (Fase M4)
- **PlaySquare › Entrar com convite:** além do código, os campos "Seu nick no Minecraft" (preenchido com o último usado) e "Recado para o dono (opcional)", até 100 caracteres. O app confere o nick na Mojang antes de criar qualquer coisa; nick que não existe mostra o erro no padrão da seção 6.9 e nada é enviado.
- **ServSquare › Jogadores:** card de painel "Pedidos para entrar (N)" no topo, só quando há pedidos. Cada linha em `--bg-panel-2`: cabeça do jogador, nick em negrito, o recado entre aspas, "Pediu em <data>" em `--text-muted` e os botões pequenos **Aprovar** (primário) e **Recusar** (perigo).
- **Aviso** no canto (camada de avisos, mesmo vidro dos outros): "<nick> pediu para entrar no servidor <nome>", com "Fechar" e "Ver" (abre Jogadores). Nunca notificação do Windows.
- **Tela Jogar do amigo:** abaixo do status do servidor, uma linha em negrito: "Aguardando o dono aprovar" (`text-warning`), "Aprovado: você está na whitelist" (`text-online`) ou "Recusado pelo dono" (`text-danger`); "Pedido para entrar vai quando o dono abrir o HubSquare" quando o dono estava desligado.

### 6.22.9 Diagnóstico de conexão (Fase M5)
- **Onde:** "Testar tudo" em Conexão (faixa do topo de cada aba) e no card "Chame seus amigos" do Painel (pequeno); "Não consigo entrar" no status do servidor da tela Jogar e em cada servidor de convite em PlaySquare › Servidores (pequeno).
- **Diálogo** (vidro, seção 6.8): primeira linha em negrito com "O que impede a entrada: <checagem>." ou "Tudo certo: nada impede a entrada."; depois a lista, uma linha por checagem em `--bg-panel-2`: ícone (✓ `text-online`, ✗ `text-danger`, ! `text-warning`, – `text-muted`), nome em negrito e a frase; o primeiro problema com borda esquerda de 4px em `--danger`; linhas puladas com o texto em `--text-muted` ("Não conferido: resolva o problema acima primeiro."). O conserto é um botão pequeno primário na própria linha, sempre com clique. Embaixo, "Copiar resultado" (secundário); a ação do diálogo é "Conferir de novo".
- **Dono, em ordem:** servidor ligado e respondendo na porta; o método escolhido (playit: vinculado, endereço e agente; Radmin/rede local: IP e Java liberado no Firewall); acesso de fora (ping no endereço que os amigos usam); Java; pedidos para entrar; vagas.
- **Amigo, em ordem:** internet; Radmin ligado quando o endereço é 26.x; o endereço existe; o servidor responde ao ping; o convite responde (aviso); instalação na versão do manifesto; mods batendo com os hashes; nick aprovado.
- **Consertos:** ligar o servidor, religar o túnel, liberar o Java no Firewall (pede administrador), atualizar a instalação (o mesmo fluxo do ATUALIZAR) e ver os pedidos (abre Jogadores).
- **Texto copiado:** "HubSquare: <título>", o problema e as linhas; sem tokens e com o IP público mascarado (`187.45.•••.•••`); IPs da casa, do Radmin e do Tailscale ficam.

### 6.23 Estados vazios e carregamento
- **Vazio:** ícone pixel de 48px em `--text-muted`, frase curta e, se fizer sentido, um botão de ação.
- **Carregando:** "esqueleto" em blocos `--bg-panel-2` com brilho animado (seção 8). Nunca um spinner girando sozinho no meio da tela.

---

## 7. Biomas e personalização

O fundo de todo o app é um **bioma em pixel art** vivo (seção 7.1). Tudo é arte original do app (`src/renderer/src/fundo/biomas.ts`), desenhada em código num canvas de 320×180 e ampliada com `image-rendering: pixelated`. Nada da Mojang.

| Bioma | Fundo | Vidro | Texto | Destaque |
| --- | --- | --- | --- | --- |
| **Dia claro** (o único claro) | Céu azul claro, sol quadrado, nuvens em blocos, morros verdes, árvores e terra | branco a 58%, blur 24px | `#0f172a` | `#22c55e` (texto escuro no botão) |
| **Dia** | Céu de `#1f4e79` ao pôr do sol `#f3c88b`, sol quadrado, nuvens, morros, árvores e terra | `rgba(12,20,28,.42)` | claro | `#4ade80` |
| **Noite** | Céu de `#070a1c` a `#3a2a6b`, lua quadrada, estrelas roxas e verde-água, janelinhas acesas ao longe | `rgba(14,10,32,.48)`, borda roxa | claro, título com brilho roxo | `#a78bfa` |
| **Mar** | Água de `#5fd3d0` a `#0a3d5c`, raios de luz, areia, algas, prismarinho e corais | mais transparente, degradê claro em cima, reflexo forte na borda, cantos de 28px | claro | `#5eead4` |
| **Nether** | Céu de `#1a0606` a `#8a2a0a`, teto de pedra, coluna de basalto, rio de lava `#f97316` | `rgba(30,6,8,.50)`, borda laranja | claro, título com brilho laranja | `#fb923c` |

As opacidades da tabela são as mínimas: a regra de contraste (seção 3) sobe o vidro onde a paleta do bioma pede (hoje fica entre 58% e 77%).

- **Aparência › Tema:** cinco cartões com miniatura do bioma; "Vidro leve" (sem desfoque, para PCs fracos); a cor de destaque de cada área ("Cor do bioma", 6 sugestões ou personalizada).
- **Imagem de fundo:** por padrão no banner. "Usar em todo o app" põe a imagem no lugar do bioma, com uma camada da cor do bioma por cima (slider de 40–90%); o contraste é recalculado com a imagem.
- **Banner de cada instalação (PlaySquare › Jogar › Fundo):** um bioma próprio, a capa do modpack ou uma imagem do usuário. Sem escolha, a imagem/capa da instalação ou o fundo padrão (o bioma do app). Sempre com o nome na placa de vidro.
- **Preferências antigas:** claro vira Dia claro, escuro vira Dia ("seguir o Windows" usa o tema do Windows na hora). Cores de destaque que eram as padrão antigas passam a seguir o bioma; cor escolhida continua. Imagem e escurecimento ficam.

---

### 7.1 Fundos vivos (Fase V2)

- **Motor único** (`src/renderer/src/fundo/motor.ts`): um canvas 2D de 320×180 atrás da interface, ampliado com `image-rendering: pixelated`. Um módulo por bioma em `biomas.ts`: camadas paradas desenhadas uma vez, camadas que rolam (parallax: as de longe mais lentas) e o que se mexe a cada quadro. Partículas num pool fixo, sem objeto novo por quadro. Sem WebGL nem biblioteca.
- **Ritmo:** no máximo 30 quadros por segundo, movimento por deltaTime (não acelera em 144 Hz). Pausado, o laço para de vez e o canvas fica no último quadro.
- **O que se mexe:**
  - **Dia e Dia claro:** nuvens em blocos em duas velocidades, grama e copas balançando com rajadas de vento, folhas e pólen voando, às vezes um bando de pássaros ao longe.
  - **Noite:** céu estrelado girando bem devagar, estrelas piscando, estrela cadente de vez em quando, vaga-lumes perto do chão, nuvens lentas passando na frente da lua, janelinhas acendendo e apagando.
  - **Mar:** raios de luz ondulando, bolhas subindo, algas balançando, cardumes passando, reflexo de luz se mexendo na areia.
  - **Nether:** brasas e cinzas subindo, lava pulsando com bolhas que estouram, névoa de calor ondulando perto da lava.
- **Aparência › Tema › Animação do fundo:** completa, leve (metade das partículas a 15 quadros) ou desligada (fundo parado). Sem escolha salva, começa em completa, ou em leve com "reduzir movimento" (Windows ou o interruptor do app). "Partículas sobre a minha imagem": com uma imagem do usuário no fundo ou no banner, só as partículas do bioma por cima.
- **Pausa automática** (`src/shared/animacaoRegras.ts`): janela minimizada ou na bandeja, sem foco por 30 s, Minecraft aberto pelo PlaySquare ("jogando") ou modpack instalando.
- **Economia:** se o desenho passar de 4 ms por quadro em média (60 quadros), cai para o leve e avisa uma vez dentro do app.
- **Tela Jogar:** o banner é o bioma vivo da instalação (ou o do app sem imagem); trocar de instalação troca o bioma com transição suave de 0,6 s.
- Toda cor nova das partículas entra na paleta do bioma e passa pelo teste de contraste (o vidro fica entre 58% e 77%).

## 8. Movimento e animações

As animações precisam ser **rápidas, curtas e com propósito**: mostrar de onde algo veio, o que mudou ou que o app está trabalhando. Nada fica se mexendo à toa.

**Tokens** (variáveis CSS, usadas por todos os componentes):

| Variável | Valor | Uso |
| --- | --- | --- |
| `--dur-instant` | 60ms | Pressionar botão |
| `--dur-fast` | 120ms | Hover, foco, cor |
| `--dur-base` | 180ms | Troca de página, interruptor, dica |
| `--dur-slow` | 280ms | Acordeão, diálogo, aviso |
| `--ease-out` | `cubic-bezier(.23,1,.32,1)` | Entrar e sair (curva forte: responde na hora) |

**Catálogo:**

| Elemento | Animação |
| --- | --- |
| Troca de página | Conteúdo entra com fade + 8px de baixo para cima (`--dur-base`). O conteúdo antigo sai só com fade (100ms). A barra lateral e o cabeçalho não se mexem. |
| Troca de área (Serv/Play) | Uma transição só. A aba e a cor de destaque mudam na hora do clique; a lista da barra lateral e o conteúdo antigos saem com fade de 100ms e os novos entram deslizando 24px de lado, com fade (`--dur-slow`). O PlaySquare vem da direita e o ServSquare da esquerda. A primeira tela da área não faz a troca de página por cima. Não anima ao abrir o app. |
| Aba de área | Só transform, recorte e cor (nada de largura): o fundo colorido desliza para o lado da área nova, os nomes vão para o centro da sua aba e o "Square" aparece por `clip-path`, tudo em `--dur-slow` com `--ease-out`. |
| Aba ativa | O sublinhado desliza até a nova aba (`--dur-base`). |
| Item ativo da barra lateral | A barra de 3px desliza até o novo item. |
| Barra lateral recolher/expandir | A largura anima (`--dur-base`, sem atraso: o conteúdo ao lado precisa se reorganizar); os rótulos somem antes de recolher e aparecem `--dur-fast` depois de expandir. |
| Listas e grades | Itens entram com fade + 6px, escalonados em 30ms, no máximo 8 itens animados. A entrada não prende o `transform`: hover e clique continuam com transição. |
| Botão | Hover clareia (`--dur-fast`); pressionar desce 2px (`--dur-instant`). |
| Botão LIGAR | Ao mudar de estado, a cor faz uma transição e o texto troca com fade. Em LIGANDO, os três pontos animam e um brilho diagonal passa a cada 1,6s, em velocidade constante (`linear`). Sem clique (ligando, preparando, jogando), o relevo não afunda. |
| Bolinha de status | "Ligando" pulsa (escala 1 → 1,4 com fade, 1,2s em loop). "Online" pulsa uma vez ao ficar online. |
| Interruptor | A alça desliza e a cor do trilho troca (`--dur-base`). O ✓/✕ troca com fade e escala 0,9 → 1 (`--dur-fast`). |
| Acordeão | A altura anima (`--dur-slow`) e o chevron gira 180°. |
| Diálogo | O fundo escurece com fade; a caixa entra com escala 0,96 → 1 + fade (`--dur-slow`). |
| Aviso de jogador e toasts | Entram deslizando 24px da direita (`--dur-slow`, por transição com `@starting-style`, que pode ser interrompida) e saem mais rápido, com fade + 8px (`--dur-fast`). A barra de tempo de 2px embaixo esvazia em 5s. |
| Barra de XP e progresso de download | O preenchimento cresce por `clip-path` (`--dur-slow`), sem escalar as listras. Downloads mostram listras diagonais deslizando (`linear`). |
| Números (stats, CPU, RAM) | Contam até o valor em 400ms na primeira vez; depois, só trocam. |
| Console | Linhas novas entram com fade de 120ms. A rolagem automática é suave, menos quando chegam mais de 20 linhas por segundo. |
| Esqueleto de carregamento | Brilho em faixa passando da esquerda para a direita, a cada 1,4s (`linear`). |
| Fundo do banner (tela Jogar) | A imagem nova entra por cima da anterior com fade + desfoque de 4px que some (`--dur-slow`); a anterior só sai depois. |
| Selo ⚠ e novidade | Entra com fade e escala 0,9 → 1 (`--dur-base`, `--ease-out`). |

**Regras:**
- Animar só `transform` e `opacity` (e `width`/`height` só no acordeão e na barra lateral).
- Nada surge do nada: entradas começam em escala 0,9 ou mais, sempre com fade. Nunca escala 0. Sem exagero (overshoot).
- Entradas e saídas usam `--ease-out`; nunca uma curva que começa devagar ("ease-in"). A saída é mais rápida que a entrada.
- Ações de teclado (Enter no console, atalhos) e coisas que acontecem a cada tecla não animam.
- Nenhuma animação de interface passa de 300ms, exceto loops de status. Movimento constante (brilhos, listras) usa `linear`.
### 8.1 Camadas e listas flutuantes
- Ordem das camadas (tokens): conteúdo → painel lateral (`--z-painel-lateral`) → avisos (`--z-avisos`) → camadas flutuantes (`--z-flutuante`). Diálogos e camadas flutuantes usam a camada do topo do navegador (`<dialog>` modal e `popover`), então nada as corta.
- Toda lista que abre por cima da tela (listas de seleção, menus ⋯/⋮, autocompletar e favoritos do console, dicas) usa o componente único `Flutuante`: fica fora da área com rolagem, cola no elemento que a abriu, vira para cima quando não cabe embaixo, não sai pelos lados, tem a altura limitada ao espaço disponível (com rolagem interna) e acompanha a rolagem e o tamanho da janela. Fecha com Esc, clique fora ou ao trocar de tela. Abrir e fechar nunca muda o tamanho nem a rolagem da página.
- Animação: entra com fade + 4px + escala 0,98 → 1 (`--dur-fast`), partindo do lado de onde surge (de cima quando abre embaixo; de baixo quando abre em cima), e sai do mesmo jeito ao contrário.
- Listas de seleção: teclado (setas, Enter/Espaço, Home/End, Esc, digitar para buscar), a opção escolhida com ✓ e negrito, a ativa com fundo `--bg-tile-active`, e a escolhida aparece visível ao abrir.
- Inputs invisíveis (`sr-only`) de caixas de seleção e rádios ficam dentro de um label `relative`, e o contêiner do app usa `overflow: clip`: o foco nunca rola a página por conta própria.

- A tela Aparência › Animações tem um interruptor "Reduzir animações". Ele liga sozinho quando o Windows pede `prefers-reduced-motion`. Com ele ligado, sai o movimento e ficam os fades: entradas viram só um fade curto (150ms), transições animam só cor e opacidade (o `transform` muda na hora) e os loops decorativos param (status vira cor fixa). A barra de tempo dos avisos continua, porque mostra quanto falta.
- Implementação: transições CSS para quase tudo. Uma biblioteca de animação (ex.: Motion) só para troca de página, listas e acordeão, e só depois de perguntar.

---

## 9. Acessibilidade

- Contraste mínimo AA (4,5:1 para texto normal).
- Foco visível em tudo: `outline: 2px solid var(--accent); outline-offset: 2px`.
- Tudo acessível pelo teclado; Enter no campo do console envia o comando.
- Área clicável mínima de 32×32px.
- Status nunca só por cor: a bolinha sempre vem acompanhada do texto ("Online").

---

## 10. Checklist para qualquer tela nova

- [ ] Usa só variáveis CSS, sem hex solto
- [ ] Superfícies de vidro (tokens da seção 3), cantos da seção 5 e relevo nos botões
- [ ] Fonte pixel só nos lugares permitidos (seção 4)
- [ ] Cabeçalho com título em caixa alta + abas
- [ ] Funciona nos cinco biomas, com imagem de fundo e com o accent trocado; texto sempre sobre vidro (4,5:1)
- [ ] Nenhum logo, textura, arte ou nome de marca do Minecraft/Mojang
- [ ] Textos em português do Brasil
- [ ] Animações usam os tokens da seção 8 e respeitam "Reduzir animações"
- [ ] Estados vazio, carregando e erro existem
- [ ] Conteúdo do jogo (skins, ícones de item) segue a seção 1 e tem fallback próprio
