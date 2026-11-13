# HubSquare

App de desktop para Minecraft Java no PC, com duas áreas:

- **ServSquare:** cria, configura e liga um servidor para jogar com amigos (tudo o que existia até a Fase 26).
- **PlaySquare:** launcher que prepara o jogo de cada jogador com os mesmos mods, packs e endereço do servidor, e também serve como launcher geral para jogar sozinho.

Uso: eu e meus amigos, talvez público um dia. Tudo é escrito como se fosse público: nenhum segredo no código, no repositório ou no instalador. Sem prazo, construído fase por fase.

Este arquivo é a fonte de verdade do projeto.

## Nome e áreas

- Nome do app: HubSquare. Áreas: ServSquare (servidor) e PlaySquare (launcher).
- Mesmo app e mesmo instalador para quem hospeda e para os amigos.
- Modo do app (Fase M6), em `modo-app.json` na pasta de dados: "completo" (as duas áreas) ou "amigo" (só o PlaySquare). Primeira abertura sem servidores: boas-vindas com as duas escolhas (aberto por um convite `hubsquare://convite/...` ou `.hubsquare`, sugere o amigo com o convite já colado); quem já tem servidores salvos fica no completo sem ver nada novo. No amigo, os serviços do ServSquare (manifesto do convite, painel do celular, avisos de atualização de servidor) não sobem nem religam, e fechar a janela sem nada rodando fecha o app. Trocar é em Ajustes do jogo (voltar ao amigo só com o servidor desligado) e nunca apaga dados do ServSquare. O instalador registra o link `hubsquare://` e a extensão `.hubsquare`. Regras em `src/shared/modoRegras.ts`.
- O jogo abre pelo Minecraft Launcher oficial; o app não faz login na conta da Microsoft. NUNCA criar modo sem conta original (offline/pirata).

## Regras de trabalho

- Fazer só o que a fase pede.
- Explicar em português simples o que cada arquivo novo faz.
- Parar e perguntar antes de apagar arquivos ou instalar dependência que a fase não liberou.

## Stack

- Electron + TypeScript + React + Vite (electron-vite) + Tailwind CSS.
- Instalador: electron-builder.
- Só Windows por enquanto.

## Segurança do Electron

- `contextIsolation` ligado, `nodeIntegration` desligado.
- O renderer fala com o processo principal só por IPC, via preload tipado.

## Idioma

- Toda a interface e as mensagens em português do Brasil.
- Sem sistema de tradução.

## Escopo

- Só Minecraft Java Edition.
- Vários servidores salvos, mas só um ligado por vez.
- Tipos de servidor (loaders): Paper, Vanilla, Fabric, Forge e NeoForge.
- Cada loader é um módulo em `src/main/tipos/` com a mesma interface: listar versões, instalar e montar o comando de inicialização. Um loader novo não pode exigir reescrever o resto.
- Loaders só de fontes oficiais (PaperMC, Mojang, FabricMC, MinecraftForge, NeoForged).
- Trocar de loader: só com o servidor desligado, com backup antes, sem apagar a pasta do servidor (só os arquivos do loader são substituídos).
- User-Agent único (`userAgent()` em `src/main/rede.ts`): `HubSquare/<versão> (github.com/lipeventura777/hubsquare)`, em todas as chamadas (Modrinth, Hangar, PaperMC, Adoptium, GitHub). Nunca e-mail ou outro dado pessoal no código, no repositório ou no User-Agent.
- Mods e plugins do Modrinth (API v2, hash conferido). A lista do que o app instalou fica em `servsquare-mods.json` na pasta do servidor.
- Explorar (Mods › Explorar): todos os tipos do Modrinth (mods, plugins, modpacks, resource packs, shaders, datapacks), com filtros, ordenação e página de detalhes. Cada tipo vai para um lugar: mods e plugins do servidor na pasta mods/plugins; datapacks na pasta datapacks do mundo ativo; resource pack do servidor no `server.properties` (`resource-pack` com a URL oficial do CDN do Modrinth, `resource-pack-sha1` e `require-resource-pack` opcional); shaders, resource packs e mods só do jogador nunca na pasta do servidor, só no Pacote pros amigos (pastas shaderpacks, resourcepacks e mods do .mrpack); modpacks criam um servidor novo. O que o Explorar instalou fica em `servsquare-explorar.json` na pasta do servidor. Descrições em markdown passam pelo marked + DOMPurify.
- Fontes do Explorar (Fase 24): Modrinth, CurseForge e Hangar (só em servidores Paper). CurseForge é opcional: cada usuário cola a própria chave da API em Opções › Integrações; ela fica só em `curseforge.json` na pasta de dados, criptografada com safeStorage, e nunca no código, no repositório ou no instalador. Os termos da API do CurseForge proíbem guardar ou fazer cache dos dados dela: o app guarda só o id do projeto e do arquivo instalados (em `servsquare-mods.json`). Arquivo que o autor não deixa outros apps baixarem (`allowModDistribution` falso ou sem `downloadUrl`) aparece como "Baixe pelo site" com o link da página, sem espelhos nem raspagem; no Hangar, versões só com link externo também. Downloads só dos CDNs oficiais (cdn.modrinth.com, edge/mediafilez.forgecdn.net, hangarcdn.papermc.io), com hash conferido. Modpacks do CurseForge são instalados pelo `manifest.json` (o app não atualiza esses packs). Cada mod/plugin anota a fonte, e Atualizações confere cada um na sua.
- Instalados (Mods › Instalados): tudo o que o servidor tem (mods/plugins, datapacks de cada mundo, resource pack do servidor, Pacote pros amigos, modpack de origem e "Outros"). Remover só mexe na pasta do servidor ativo: mods, plugins e datapacks saem só com o servidor desligado (ligado, ficam para quando ele desligar); o que sai vai para `removidos` dentro da pasta de backups do servidor por 7 dias, com "Desfazer" e "Removidos recentemente".
- Mods personalizáveis (Fase 25): etiquetas, notas, versões travadas, a versão anterior de cada mod e os perfis ficam em `servsquare-organizacao.json` na pasta do servidor; a cópia do .jar anterior fica em `mods-anteriores` nos backups do servidor. Configs dos mods: formulário para .toml, .json, .json5, .yml e .properties feito pelo próprio app (sem biblioteca), que ao salvar troca só o trecho do valor, mantendo comentários e ordem byte a byte; o que ele não entende fica só leitura, para o "Editar como texto". Antes de salvar ou de "Restaurar padrão", uma cópia vai para `configs` nos backups do servidor (30 últimas). Com o servidor ligado, sempre o aviso de reiniciar. Problemas vêm do que o .jar declara (fabric.mod.json, mods.toml, plugin.yml) e do Modrinth; travamentos cruzam o relatório com os mods.
- Comandos (Fase 26): a sintaxe de cada versão vem do próprio servidor. O app baixa uma vez o server.jar oficial da Mojang da versão e roda o gerador de relatórios (`--reports`): a árvore de comandos, os itens e os efeitos da versão, e do .jar o en_us.json (modelos das respostas), com o pt_br.json oficial para traduzir. Fica em `jogo/<versão>/comandos` na pasta de dados. Comando que não existe na versão fica escondido. A tela manda a ação (não o texto), e o comando é montado e validado no processo principal (nomes, ids, números com limites, uma linha só). Ações destrutivas e atalhos com kill/clear/ban pedem confirmação; atalhos (`atalhos.json`) só rodam com o servidor ligado. Histórico e favoritos do console em `console.json`. O painel do celular continua sem enviar comandos.
- Modpacks: formato .mrpack do Modrinth (downloads só de cdn.modrinth.com, github.com, raw.githubusercontent.com e gitlab.com, com hash conferido). A pasta do servidor guarda `servsquare-modpack.json` (índice do pack + hash do que ele instalou) e `servsquare-modpack.mrpack` (cópia do pack). Server packs em .zip (ex.: do CurseForge) entram por "Importar de arquivo .zip".
- Desempenho: "Usar configuração otimizada do Java" usa as flags do Aikar (documentação do PaperMC), ligado por padrão em servidores novos. Chunky, spark e BlueMap/Dynmap vêm do Modrinth pela mesma lógica da tela Mods; termos e downloads extras dos plugins só com o clique do usuário. O mapa fica só na rede local e no Radmin, nunca exposto na internet.
- Painel pelo celular (Integrações › Celular): desligado por padrão; servidor HTTP no processo principal escutando só nos IPs da rede local, do Radmin e do Tailscale (nunca 0.0.0.0, sem túnel, sem UPnP); PIN de 6 a 8 dígitos guardado só como hash scrypt com salt em `celular.json` (pasta de dados); sessão por cookie (7 dias), CSRF e bloqueio de 15 min após 5 PINs errados. O painel não manda comandos ao console nem mexe em arquivos, mods, configurações ou jogadores.
- Ícone e MOTD (Opções › Gerais): server-icon.png de 64×64 recortado no app; MOTD em até 2 linhas com códigos §. O server.properties é gravado com acentos e § como `\uXXXX` (lido certo em UTF-8 ou ISO-8859-1) e o MOTD é conferido lendo de volta.
- Avisos de atualização: ao abrir o app e a cada 6 h (opção ligada por padrão em Opções › Gerais) o app só verifica build nova do mesmo Minecraft, Minecraft novo, mods/plugins e modpack. Atualizar a build é só com clique, servidor desligado e backup antes; Minecraft novo é só aviso com link para Software. Servidores de modpack não recebem aviso de build (o pack decide o loader).
- Instalações do PlaySquare (Fase P1): índice em `instalacoes.json` (pasta de dados); cada uma com pasta própria em `Documentos/ServSquare/jogo/<instalação>`. Cada servidor do ServSquare ganha a sua instalação automaticamente (mesmo nome, ícone, versão e loader), com os mods do Pacote pros amigos (no próprio PC, os mods sem licença aberta também vão, copiados da pasta do servidor) e o servidor (`localhost:<porta>`) no topo do `servers.dat`. O app só troca ou remove o que ele mesmo pôs em mods, resourcepacks e shaderpacks (anotado em `hubsquare-instalacao.json`); mundos, prints e configurações nunca são apagados. Apagar manda a pasta para a Lixeira.
- Launcher oficial: detectado pela Store/Xbox (`Microsoft.MinecraftJavaEdition` ou o pacote antigo do launcher) ou pelo instalador clássico. O app só grava um perfil `hubsquare-<id>` no `launcher_profiles.json` (e no `launcher_profiles_microsoft_store.json`, se existir), com backup antes em `Documentos/ServSquare/backups/launcher` (10 últimos), e só com o launcher fechado. Loaders cliente: Fabric pelo perfil da meta oficial; Forge e NeoForge pelo instalador oficial com `--installClient` (o perfil que ele cria é desfeito). O app nunca faz login, nunca abre o jogo sem o launcher e nunca redistribui arquivos do jogo.
- Correção P1 (instalar agora, jogar depois): abrir o launcher oficial está desligado pela opção interna `ABRIR_LAUNCHER_LIGADO` (`src/main/launcherOficial.ts`); nada do PlaySquare abre o launcher, a Microsoft Store ou links externos. O botão principal é INSTALAR (ATUALIZAR quando já instalada e o servidor ou a instalação mudou): monta a pasta completa da instalação (mods, packs, shaders, configs e `servers.dat`) sem tocar na `.minecraft` nem no `launcher_profiles`. Depois de instalada: "Abrir pasta da instalação" e "Exportar para Modrinth App / Prism Launcher" (gera um `.mrpack`: o que é do Modrinth vai como link + hash, o resto e as configs em `overrides`). O JOGAR aparece desativado como "Em breve". Diagnóstico e proposta em `docs/pendencias/abrir-launcher.md`.
- Telas e integração (Fase P5): PlaySquare › Servidores lista os servidores das instalações (meus e de convites) com status, jogadores, recado, versão do pacote e Jogar, atualizando a cada 30 s só com a tela aberta. Capturas de tela lê a pasta `screenshots` de cada instalação; apagar é sempre com confirmação e vai para a Lixeira. Ajustes do jogo (`ajustes-jogo.json`): memória padrão das instalações novas, resolução da janela (campo `resolution` do perfil do launcher), avisos escondidos e pasta das instalações novas (as antigas não mudam de lugar). Launcher: só o oficial (Modrinth App e Prism não têm integração oficial). Atalho na área de trabalho só quando o jogador pede, por instalação: abre o HubSquare com `--jogar=<id>` no Jogar dela. "Testar no meu jogo" (ServSquare › Mods) sincroniza a instalação do servidor e abre o Jogar com ela; "Gerenciar no ServSquare" torna o servidor ativo (se nenhum outro estiver ligado) e abre o Painel; os dois usam a animação da troca de área.
- Tela Jogar (Fase P4): o botão JOGAR só prepara a instalação e abre o launcher oficial; nunca liga nem desliga o servidor. Só o dono (instalação de um servidor deste PC) tem o botão separado "Ligar servidor e jogar", que liga pelo ServSquare, espera ficar pronto e só então prepara o jogo. Status do servidor: para o dono, o estado do ServSquare; para o amigo, o mesmo "ping" da lista de Multijogador no primeiro endereço do manifesto, e o recado do dono (ServSquare › Servidores, guardado no `servsquare-convite.json` e enviado no manifesto, sem subir a versão). O app percebe que o jogo abriu e fechou procurando o Java com o `--gameDir` da instalação (para "Jogando" e o tempo da sessão) e, se apareceu um relatório de travamento, mostra os suspeitos da Fase 25. Memória sugerida pelo número de mods e pela memória do PC; com o servidor no mesmo PC, o jogo fica com o que sobra (2 GB para o Windows). Fundos: por instalação (`hubsquare-fundo.*` na pasta dela; modpacks usam a imagem em destaque da galeria do Modrinth), padrão do usuário em `fundo-jogo` (pasta de dados) e, sem nenhum, a arte geométrica do app (nada da Mojang).
- Conteúdo do jogador (Fase P3): Explorar e Conteúdo do PlaySquare são os mesmos componentes da tela Mods, apontados para a instalação escolhida. No processo principal, os canais `mods:`, `explorar:` e `instalados:` têm uma versão `play:` que roda o mesmo código com a instalação no lugar do servidor (`InfoServidor.jogador`). Tudo o que o jogador instala é "meu" e a sincronização nunca tira (ela só mexe no que anotou em `hubsquare-instalacao.json`). O que veio do servidor e é obrigatório não sai nem desliga pelo PlaySquare. Cada item tem uma frase de compatibilidade (vai ou não funcionar e por quê); avisos escondidos ficam em `ajustes-jogo.json` (pasta de dados) e voltam em Ajustes do jogo. Shaders instalam o Iris (Fabric/NeoForge) ou o Oculus (Forge) junto; resource packs e shaders trazem os mods que exigem. Os resource packs do servidor ficam ligados por cima, na ordem do dono (só a linha `resourcePacks` do options.txt muda). Na primeira vez em Jogar, o app pergunta se copia o options.txt da .minecraft. Mods proibidos (Mods › Proibidos para jogadores) são um combinado entre amigos: o PlaySquare não abre o servidor com eles ativos, mas não é antitrapaça.
- Convites (Fase P2): cada servidor tem um manifesto (Minecraft, loader, arquivos do jogador só como link oficial + hash, recomendados opcionais, mods proibidos, mods sem link, endereços de conexão e uma versão que sobe quando jogo, loader, arquivos ou proibidos mudam; endereços não contam). Ele é servido só de leitura em `GET /convite/<token>/manifesto.json` (porta 8788 por padrão), escutando só nos IPs da rede local, do Radmin e do Tailscale, e em 127.0.0.1 quando o dono cadastra um túnel do playit para o convite; nada mais responde ali. Token de 80 bits, 20 erros → IP bloqueado por 15 min. O convite (código `endereço#token`, link `hubsquare://convite/...` ou arquivo `.hubsquare` com uma cópia do manifesto) não expira; revogar troca o token e mantém o id. Estado do dono em `servsquare-convite.json` na pasta do servidor. No amigo, cada convite vira uma instalação; o app guarda o manifesto aplicado e o disponível na pasta dela, confere ao abrir o PlaySquare e ao jogar, e não deixa jogar desatualizado ("Atualizar e jogar"). Sem resposta do servidor, usa o último manifesto baixado e avisa. Pedidos para entrar (Fase M4): ao aceitar, o amigo informa o nick (conferido em api.mojang.com, lembrado em `ajustes-jogo.json`); a única rota de escrita, `POST /convite/<token>/pedido` (corpo de até 1 KB: nick, UUID e recado de até 100 caracteres), SÓ guarda pedidos pendentes em `servsquare-pedidos.json` (máximo 20, sem UUID repetido, mesmos erros e bloqueio de IP do manifesto); `GET /convite/<token>/pedido/<uuid>` responde só sobre aquele UUID. O dono aprova em Jogadores (ligado: `whitelist add`; desligado: `whitelist.json` com o UUID) ou recusa. "Aprovar automaticamente quem usar este convite" vem desligado; revogar apaga os pendentes. No amigo, o pedido fica em `hubsquare-pedido.json` e é reenviado ao abrir o PlaySquare se o dono estava desligado.
- Downloads manuais (Fase D): arquivos do CurseForge que o autor não deixa outros apps baixarem vão para a janela "Downloads necessários" (ao instalar mod ou modpack, ao criar servidor de modpack e ao instalar ou atualizar uma instalação de convite; e pelo botão "Downloads pendentes (N)" em Mods e Conteúdo). O app só abre a página oficial do arquivo no navegador (exceção à regra de não abrir links externos do PlaySquare), nunca baixa por conta própria. Reconhece o arquivo baixado pelo tamanho + SHA-1 (MD5 quando não há SHA-1) do CurseForge; nome sozinho nunca basta e arquivos temporários (.crdownload, .part, .tmp) e vazios são ignorados. Vigia (fs.watch) a pasta Downloads e as pastas de Ajustes do jogo só enquanto há pendências; só move dali o arquivo cujo hash bate. Pendências em `downloads-pendentes.json` e cópia de cada arquivo em `downloads-manuais/<sha1>` (com `indice.json`), na pasta de dados, para reusar neste PC. Esses arquivos nunca entram no Pacote pros amigos, nos convites (o manifesto leva só nome, tamanho, hash e a página oficial, em `manuais`) nem no .mrpack exportado; no PC do amigo o mesmo assistente aparece.
- Conserto ao ligar: quando o servidor fecha enquanto liga, o app lê o console daquela tentativa. Java: segue só a linha `Fix:` do Fabric (ou o `class file version`) e guarda em `javaDosMods` no `servsquare.json`. Mods que faltam: procura primeiro no índice do modpack do servidor (arquivos marcados como só do jogador, id confirmado dentro do .jar) e liga de novo uma vez. O que continua faltando é procurado no Modrinth (o id do erro não é o slug: o candidato é baixado numa pasta temporária só para conferir o id de dentro do .jar) e vira download do assistente da Fase D, com a página do Modrinth e o hash; a tela Jogar mostra, para o dono, o que faltou, quem pede e o link.
- Correção (instalação de modpacks): analisar um pack só lista e lê o índice (`tar -tf`/`-xOf`, sem extrair); a extração acontece ao criar, no `tar.exe` (outro processo, em streaming), com "X de Y arquivos" e Cancelar. Downloads pela fila de `filaDownloads.ts` (6 ao mesmo tempo, 3 tentativas com espera de 1 s e 2 s), primeiro para `cache-modpacks/<hash>` na pasta de dados (conferido; apagado depois que a instalação dá certo, ou depois de 7 dias), o que permite "Tentar de novo só os que falharam" e continuar depois de fechar o app. Hash dos arquivos grandes num worker (`hashTrabalhador.ts`). Progresso para a tela no máximo a cada 250 ms. Servidor em `.modpack-<id>` e instalação em `.instalando-<id>`: só viram de verdade no fim; cancelar ou falhar apaga. Erros sem tratamento vão para `logs/erros.log` (pasta de dados) e para a tela, sem fechar o app. Reprodução pelo terminal: `npm run repro:modpack -- <servidor|jogador|cancelar|cancelar-jogador|queda>` (pastas de teste em `.teste/`, fora do git).
- Passar o servidor (Fase M7): "Passar para outro amigo" (menu do servidor, só desligado) gera um `.hubserver` (zip feito com o tar.exe): `hubserver.json` (id fixo, nome, tipo, versão, loader, RAM e os mods/plugins só como link oficial do Modrinth + hash; baixados à mão só como página oficial + hash; os sem link só pelo nome) mais mundos (pastas com level.dat), server.properties (senha do RCON, `management-server-secret` e `server-ip` em branco), whitelist, ops, banidos, ícone e as pastas config, defaultconfigs e plugins sem nenhum .jar. Arquivo de config com senha, token, chave ou caminho deste PC fica no PC (aparece em "Fica neste PC"). Nunca vão: .jar, servsquare.json, convite, pedidos, túnel, PIN, chave do CurseForge, backups, logs. Regras em `src/main/passarRegras.ts`. O `servsquare.json` ganha `idFixo` (o mesmo servidor em qualquer PC; sem ele vale o id do índice) e `emprestado: {com, desde}` ("Com <nome> desde <data>"; ligar pede "Ligar mesmo assim"). Receber (Servidores ou primeiro passo do assistente): o zip é conferido (nada de .jar, programas ou caminhos para fora), extraído numa pasta temporária e vira servidor só no fim (`.recebendo-<id>`), com loader, Java e mods pela fila de downloads e os manuais na janela Downloads necessários; quem recebe vira o dono (convites próprios). Mesmo id fixo neste PC: "Atualizar o meu servidor com este mundo" (só com o mesmo tipo e versão; backup protegido antes, com os mundos e os arquivos trocados; mundos e arquivos soltos são trocados, configs vão por cima, o server.properties mantém os valores deste PC e os mods que faltam são baixados; tira o "emprestado") ou "Criar uma cópia" (id fixo novo). O manifesto do convite leva `servidorId` (fora do hash, não sobe a versão): no PlaySquare, convite de outro dono com o mesmo `servidorId` só troca o convite e o endereço da instalação que já existe.
- Relatório de erro (Fase M8): "Gerar relatório de erro" (Opções › Gerais › Ajuda, Ajustes do jogo › Ajuda e "Ver detalhes" de toda mensagem de erro) grava `HubSquare-relatorio-AAAA-MM-DD_HH-MM.zip` na Área de Trabalho, com "Abrir pasta"; nunca envia nada. Antes de salvar, a lista do que vai, com caixas para tirar itens, e a escolha do servidor e da instalação. Leva: LEIA-ME.txt (resumo), erros.log, o fim (2 MB) do latest.log do servidor, do servsquare-acoes.log e do latest.log da instalação, os 3 crash-reports mais recentes de cada lado (1 MB), sistema.json (versões, Windows, RAM, Javas), config dos servidores (servsquare.json + server.properties) e o índice das instalações, mods.json (arquivo, versão, SHA-1), a versão do convite/manifesto e o último diagnóstico da M5 (só em memória). Nunca mundos nem arquivos de mods. Limpeza em `src/main/relatorioRegras.ts`: os segredos lidos do próprio PC (tokens dos convites e das instalações, celular.json inteiro, curseforge.json e a chave, segredo do playit) são trocados por `[removido]` onde quer que apareçam; depois campos de segredo (`token`, `password`, `pin`, `salt`, `cookie`...), cabeçalhos Cookie/Authorization, Bearer, JWT, `--accessToken` e tokens de convite; a pasta do usuário vira `%USERPROFILE%`; o IP público é mascarado. Se algum segredo conhecido sobrar, nada é gravado. Guia em `docs/como-ler-relatorio.md`; `npm run ler-relatorio -- <arquivo.zip>` imprime o resumo e os erros mais recentes.
- Fora do plano: Simple Voice Chat. Editor completo do `server.properties` fica para depois.

## Plano das próximas fases

- **Fase 15 — Loaders:** Fabric, Forge e NeoForge na tela Software e no assistente.
- **Fase 16 — Mods:** tela Mods, com busca e instalação de mods (Fabric/Forge/NeoForge) e plugins (Paper) pelo Modrinth.
- **Fase 17 — Modpacks:** importar modpack `.mrpack` e gerar o "Pacote pros amigos" (o que cada amigo precisa instalar para entrar).
- **Fase 18 — Desempenho:** pré-geração do mundo, flags do Java, diagnóstico de lag e mapa do mundo no navegador.
- **Fase 19 — Automação:** desligar quando ficar vazio, reinício agendado e backup agendado.
- **Fase 20 — Integrações:** painel pelo celular. (A integração com o Discord saiu do plano.)
- **Fase 21 — Acabamento:** ícone do servidor, editor de MOTD e avisos de atualização (do app e do loader).
- **Fase 23 — Explorar completo:** abas por tipo de conteúdo, filtros, ordenação, grade/lista e página de detalhes, com cada tipo indo para o lugar certo.
- **Fase 26 — Central de comandos:** tela Comandos com 7 abas, atalhos com estrela no Painel e console com autocompletar, histórico e favoritos.
- **Fase 25 — Mods personalizáveis:** painel lateral com configuração e versões, ações em lote, perfis, verificação de problemas, travamento × mods, etiquetas e lista em JSON.
- **Fase 24 — CurseForge e Hangar:** fontes novas no Explorar, chave do CurseForge em Opções › Integrações e atualizações conferidas na fonte de cada item.
- **Fase 23.2 — Instalados e backups:** aba Instalados com todos os adicionais, remoção com desfazer por 7 dias, e backups apagáveis um a um, com proteção.

### PlaySquare

- **Fase P0 — Nome e áreas:** o app vira HubSquare, troca Serv/Play no topo da barra lateral, PlaySquare com telas vazias.
- **Fase P1 — Instalações:** instalações do jogo e abrir o jogo pelo Minecraft Launcher oficial.
- **Fase P2 — Convites:** convites e sincronização com o ServSquare (mesmos mods, packs e endereço).
- **Fase P3 — Conteúdo do jogador:** mods, resource packs e shaders de cada instalação.
- **Fase P4 — Tela Jogar:** banner, botão JOGAR, status do servidor e experiência.
- **Fase P5 — Telas extras:** Servidores, Capturas de tela, Ajustes do jogo e atalhos.
- **Fase P6 — Polimento:** acabamento visual e aviso de atualização do app.

## Telas

- ServSquare: Servidores, Painel, Opções, Console, Comandos, Registro de eventos, Jogadores (com detalhes, inventário e estatísticas), Software, Arquivos, Mundos, Cópias de segurança, Conexão e Aparência.
- PlaySquare: Jogar (abre por padrão), Instalações, Explorar, Conteúdo, Servidores, Capturas de tela e Ajustes do jogo.
- A ordem, as abas e o visual de cada tela estão no `DESIGN.md`.

## Pastas e Java

- Servidores em `Documentos/ServSquare/servidores`, com opção de mudar.
- Mesmo com o nome HubSquare, as pastas continuam as do ServSquare, para nada se perder na atualização: dados do app em `%APPDATA%/ServSquare` (o app aponta para ela com `app.setPath`) e servidores e backups em `Documentos/ServSquare`. O `appId` do instalador continua `com.servsquare.app`, para instalar por cima.
- Java baixado automaticamente (Eclipse Temurin, pela API do Adoptium) e guardado na pasta de dados do app.
- A versão do Java vem do campo `javaVersion` do JSON da versão do Minecraft.

## Criação do servidor

- Primeira abertura: assistente passo a passo (tipo, versão, nome, configurações, EULA, pronto).
- Versão do Minecraft: o usuário escolhe numa lista; a mais nova já vem selecionada.
- EULA: o usuário precisa aceitar explicitamente (caixa de seleção + link para o EULA). Nunca aceitar sozinho.
- Importar mundo existente: sim.
- Importar servidor ou mundo de um arquivo `.zip` (por exemplo, baixado do Aternos).

## Configurações (tela simples)

- Modo de jogo, dificuldade, máximo de jogadores, MOTD, PvP, RAM.
- RAM sugerida automaticamente pela memória do PC, com barra para ajustar.
- Whitelist gerenciada pelo app, ligada por padrão.

## Painel

- Console na tela principal com campo de comando.
- Botões rápidos: dar OP, expulsar, mudar horário, clima.
- Lista de jogadores online com ações.
- Uso de CPU e RAM do servidor.
- Aviso dentro do app quando alguém entra ou sai (nunca notificação do Windows).

## Backup

- Um backup a cada vez que o servidor desliga.
- Guardar os N últimos (padrão 10, campo "manter os últimos" na tela Automação), contando todos os backups. Backups protegidos (cadeado) nunca são apagados pela rotação nem pelo "Apagar selecionados".
- Cada backup tem um tipo (ao desligar, agendado, antes de atualizar etc.), anotado com a proteção em `servsquare-backups.json` na pasta de backups do servidor. Apagar todos os backups de um servidor exige digitar o nome dele.
- Backup agendado (Automação): com o servidor ligado, via `save-off`, `save-all flush`, cópia e `save-on`; o `session.lock` fica fora do zip.

## Automação

- Desligar quando vazio, reinício agendado e backup agendado rodam no app (só com ele aberto, inclusive na bandeja). Desligar e reiniciar são sempre do jeito normal, com backup; o reinício só acontece depois de avisar no chat 5 min e 1 min antes.
- O que a automação faz fica em `servsquare-acoes.log` e aparece em Registro de eventos › Ações do app.

## Inicialização e bandeja

- Nunca iniciar com o Windows.
- Ao fechar a janela, o app vai para a bandeja e mantém o servidor ligado (no modo amigo, sem nada rodando, fecha de verdade).

## Conexão

- Túnel playit.gg por padrão: o app baixa o agente e abre o login uma vez só.
- Radmin VPN e rede local sempre disponíveis.
- Abrir porta como opção avançada.
- UPnP como tentativa extra, sem depender dele.
- Teste se o servidor é acessível de fora, com mensagem simples.
- Botão "Copiar endereço".
- Diagnóstico de conexão (Fase M5): "Testar tudo" (Conexão e Painel) e "Não consigo entrar" (Jogar e Servidores do PlaySquare) conferem em ordem e param no primeiro problema essencial (`src/shared/diagnosticoRegras.ts`), com uma frase e o conserto quando existe (ligar o servidor, religar o túnel, liberar o Java no Firewall, atualizar a instalação, ver os pedidos), sempre com o clique. Só lê: nunca muda rede, firewall ou servidor sozinho, nunca abre porta. "Copiar resultado" sem tokens e sem IP público completo.

### Radmin VPN

- Detectar o IP do adaptador do Radmin (geralmente `26.x.x.x`), com botão de copiar.
- Avisar se o Radmin estiver fechado ou desconectado.
- Criar regra no firewall liberando o Java (pede permissão de administrador).
- Não controlar o Radmin, só detectar.

## Visual

- Toda interface segue o `DESIGN.md` (guia de design na raiz do projeto); ele vence quando discordar do código.
- Inspirado no layout do Minecraft Launcher: barra lateral escura, botão grande de ligar.
- Sem logos, texturas, fontes ou marcas da Mojang/Minecraft.
- Conteúdo do jogo (skins, ícones e nomes de itens) só nas regras da seção 1 do `DESIGN.md`: baixado em tempo de uso de fontes oficiais, guardado em cache na pasta de dados, nunca no repositório nem no instalador, só como conteúdo e sempre com fallback próprio.
- Painéis de vidro sobre um fundo de bioma em pixel art original (Dia claro, Dia, Noite, Mar e Nether; Fase V1), Vidro leve para PCs fracos, imagem de fundo personalizada e cor de destaque por área. Todo texto com 4,5:1 (`src/shared/contrasteRegras.ts`).

## Erros

- Mensagem em português simples: o que aconteceu + o que fazer.
- Detalhe técnico escondido em "Ver detalhes".

## Testes

- **Toda fase termina com `npm test` e `npm run test:e2e` passando.** Cada função nova ganha pelo menos um fluxo de ponta a ponta em `tests/e2e/`.
- `npm test`: regras puras (`*Regras.ts`) com `node:test`. `npm run test:e2e`: o app compilado aberto pelo Playwright, sem internet (servidor simulado em `tests/e2e/simulado.ts`). `npm run test:e2e:lento`: Paper e Java de verdade, com cache em `.teste/cache`.
- Isolamento: cada teste roda numa pasta nova em `.teste/e2e/`, apagada no fim. `HUBSQUARE_DADOS` troca todas as pastas do usuário (dados, Documentos, Downloads, Área de Trabalho e `.minecraft`); `HUBSQUARE_DOWNLOADS` manda todo pedido à internet para o servidor simulado (`urlDeVerdade` em `rede.ts`). A rodada falha se as pastas reais mudarem, se o app for à internet no modo rápido ou se tentar abrir a Microsoft Store. O launcher, links e "Abrir pasta" são só anotados, nunca abertos.
- Falhas: print, log da tela e do processo principal e o `erros.log` do app em `.teste/resultados/`.
