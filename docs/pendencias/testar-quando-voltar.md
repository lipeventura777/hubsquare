# Testar quando voltar (correção: instalação de modpacks)

Tudo abaixo já passou pelo terminal (`npm run repro:modpack -- <modo>`), com o mesmo código do
app. O que falta é olhar a **interface**, que o terminal não vê.

Antes: o servidor **COBBLEVERSE** que ficou da tentativa de 12/11 (02:00) está completo
(11.364 arquivos, 6,6 GB) e pode ser usado ou apagado pelo app. No Temp do Windows ficaram
`servsquare-baixando-…` e `servsquare-mrpack-…` de uma análise do CurseForge abandonada às 01:48;
dá para apagar à mão.

## ServSquare › Servidores › Criar a partir de um modpack

1. **Abrir arquivo .mrpack** com o `COBBLEVERSE 1.0.0.mrpack` da pasta Downloads.
   - [ ] A análise leva **segundos** (antes: quase 2 minutos sem nenhum aviso).
2. **Criar servidor** (EULA marcado).
   - [ ] A frase muda sozinha: "Extraindo o modpack: X de 11232 arquivos" → Java → Fabric →
     "Baixando X de 127 arquivos: nome.jar" → "Copiando as configurações do modpack: X de 11209
     arquivos" → "Guardando uma cópia do modpack no servidor".
   - [ ] A barra anda e a janela **nunca** fica "Não está respondendo"; dá para clicar em outras
     coisas (ex.: arrastar a janela) enquanto instala.
3. **Cancelar** no meio (botão ao lado da frase).
   - [ ] Volta para a tela sem mensagem de erro vermelha.
   - [ ] Em Servidores **não** aparece servidor novo; em `Documentos\ServSquare\servidores` não
     sobra pasta `.modpack-…`.
   - [ ] Clicar em **Criar servidor** de novo funciona (e os mods já baixados não são baixados de
     novo: a etapa "Baixando" passa rápido).
4. Queda de internet de verdade: desligue o Wi-Fi/cabo durante "Baixando…" por uns 30 s e ligue.
   - [ ] Aparece o erro no padrão do app (faixa vermelha), com a **lista dos arquivos** que
     falharam e o botão **"Tentar de novo só os que falharam"**.
   - [ ] O botão termina a instalação baixando só o que faltou.
5. **Voltar** na etapa Confirmar: a pasta temporária do pack é apagada (nada em
   `%TEMP%\servsquare-mrpack-…`).
6. Repita 1–3 com um modpack do **CurseForge** (busca do Explorar ou o `COBBLEVERSE-1.7.42-CF.zip`
   pela busca do CurseForge, se a chave estiver configurada).

## PlaySquare

7. **Instalações › + Nova instalação › De um modpack** (ex.: COBBLEVERSE).
   - [ ] Etapa com "X de Y arquivos" e o botão **Cancelar** acima da lista.
   - [ ] Cancelar: nenhuma instalação nova; em `Documentos\ServSquare\jogo` não sobra
     `.instalando-…` nem pasta vazia.
8. **Explorar › modpack › Criar instalação com este modpack**: mesma coisa (etapa, Cancelar, e
   "Tentar de novo só os que falharam" se a internet cair).

## Erros sem tratamento

9. [ ] Se algum erro escapar, ele aparece num quadro no canto de baixo à direita (padrão de erro,
   com "Ver detalhes" e "Fechar") e o app continua aberto. O texto técnico fica em
   `%APPDATA%\ServSquare\logs\erros.log`.

## Para decidir

- Num dos testes o PC entrou em **suspensão por inatividade** no meio da instalação (45 min
  parado; o Windows registrou "System Idle"). Ao acordar, a instalação continuou e terminou certo.
  Se quiser, dá para o app impedir a suspensão só enquanto instala um modpack
  (`powerSaveBlocker` do Electron). Não fiz porque é funcionalidade nova.

## O que o terminal não cobre

- Aparência (cores, tema claro/escuro, animação da barra) da etapa com Cancelar.
- O tempo real no seu disco C: com o antivírus do Windows lendo os 11 mil arquivos.

# Testar quando voltar (Fase M1: JOGAR pelo launcher oficial)

Pelo terminal já passou: detecção (só Store, só clássico, os dois, nenhum, marcador do Xbox
recusado), o script do PowerShell da detecção neste PC (acha `Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft`
e o clássico pelo registro) e a criação do perfil numa cópia do `launcher_profiles.json`
(`node --import ./tests/ts-sem-extensao.mjs .teste/m1/provar-perfis.ts`: os 5 perfis antigos
ficaram idênticos). O que só dá para ver na tela:

1. PlaySquare › Jogar, instalação do seu servidor, com o launcher **fechado** › **JOGAR**.
   - [ ] A barra mostra "Criando a instalação no Minecraft Launcher" → "Abrindo o Minecraft Launcher".
   - [ ] Abre o **Minecraft Launcher** (nunca a Microsoft Store).
   - [ ] Aparece "Clique em JOGAR no launcher: a instalação X já está selecionada".
   - [ ] No launcher, a instalação do servidor já vem selecionada; clicar em JOGAR entra com os mods,
     e em Multijogador o servidor é o primeiro da lista.
2. Com o launcher **aberto**, clicar em JOGAR.
   - [ ] Aparece "Feche o Minecraft Launcher" com o botão **Já fechei**; fechar e clicar continua.
3. [ ] No launcher, em Instalações, seus perfis antigos (1.18, 1.21.5, última versão, snapshot)
   continuam lá. Cópia de antes de cada mudança em `Documentos\ServSquare\backups\launcher`.
4. [ ] Servidor desligado: aparece também **Ligar servidor e jogar**; ele liga, espera e abre o launcher.
5. [ ] Instalação que mudou (ex.: um mod novo no servidor): o botão diz **ATUALIZAR E JOGAR**.
6. [ ] Debaixo do JOGAR aparecem, pequenos, "Abrir pasta da instalação" e "Exportar para Modrinth
   App / Prism Launcher".
7. [ ] Atalho da área de trabalho (`--jogar=<id>`) abre o HubSquare no Jogar daquela instalação;
   o JOGAR segue o mesmo caminho acima.
8. [ ] Se algo falhar ao abrir, o motivo aparece em `%APPDATA%\ServSquare\logs\erros.log`
   (linhas "Jogar: ...").

# Testar quando voltar (Fase M2: aviso de versão nova)

Pelo terminal já passou: as regras (versão igual, maior, menor, pré-lançamento, pulada, lembrar
depois, sem rede, 304, limite e 404) e o pedido real ao GitHub (release achado num repositório
público; o `hubsquare` ainda privado responde 404 e não mostra nada; sem rede, nada). O que só dá
para ver na tela, depois que o repositório estiver público:

1. Publique um release de teste com versão maior que a do app instalado (ex.: `v1.0.1`, seguindo
   `docs/como-lancar-versao.md`).
   - [ ] Ao abrir o HubSquare (ou em até 6 h), aparece no canto "HubSquare 1.0.1 disponível" com as
     novidades formatadas.
   - [ ] **Baixar** abre a página do release no navegador e nada é baixado sozinho.
   - [ ] **Lembrar depois** some o aviso; ele volta no dia seguinte.
   - [ ] **Pular esta versão** some e não volta para essa versão; um `v1.0.2` volta a avisar.
2. [ ] Opções › Gerais e PlaySquare › Ajustes do jogo têm "Avisar quando sair versão nova do
   HubSquare"; desligado, o aviso não aparece.
3. [ ] Sem internet, o app abre normal, sem aviso e sem erro.

# Testar quando voltar (Fase V1: vidro e biomas)

Pelo terminal já passou: contraste de 4,5:1 nos cinco biomas (`tests/contrasteRegras.test.ts`),
migração das preferências (`tests/aparenciaRegras.test.ts`), o fluxo da Aparência (migra, troca
de bioma, vidro leve, bioma no banner) e os prints de 12 telas nos cinco biomas em
`.teste/prints-v1/`. O que só dá para ver na tela:

1. [ ] Ao abrir pela primeira vez depois de atualizar: o seu tema antigo virou o bioma certo
   (claro → Dia claro, escuro → Dia), a sua imagem de fundo e as suas cores continuam.
2. [ ] Aparência › Tema: passar pelos cinco biomas e, em cada um, por todas as telas (ServSquare
   e PlaySquare), diálogos, menus ⋮, listas de seleção, avisos, console, editor de arquivos e
   telas de erro. Todo texto legível, nada "invisível" sobre o fundo.
3. [ ] Aparência › Fundo › "Usar em todo o app" com uma imagem sua (uma bem clara e uma bem
   escura): o vidro fica mais opaco sozinho e o texto continua legível.
4. [ ] "Vidro leve": some o desfoque e o app fica mais leve; o resto igual.
5. [ ] PlaySquare › Jogar › Fundo: bioma próprio da instalação, imagem sua e a capa de um
   modpack; o nome sempre numa placa de vidro legível.
6. [ ] Brilho do JOGAR, quadradinho online com brilho e títulos com brilho na Noite e no Nether.
7. [ ] Desempenho num PC mais fraco (o desfoque pesa); se travar, testar com "Vidro leve".

# Testar quando voltar (Fase V2: fundos vivos)

Pelo terminal já passou: regras de pausa, ritmo e economia (`tests/animacaoRegras.test.ts`), o
fundo animando e parando ao minimizar (`tests/e2e/conferir-animacao.e2e.ts`), o contraste com as
cores novas das partículas e a medição de CPU/GPU (`npm run desempenho:fundo`, tabela em
`.teste/resultados-desempenho/fundo.md`). O que só dá para ver com você na frente:

1. [ ] Cada bioma animado (Aparência › Tema): Dia e Dia claro (nuvens, grama, folhas, pássaros),
   Noite (estrelas girando e piscando, estrela cadente, vaga-lumes, janelas), Mar (raios, bolhas,
   algas, cardumes, areia) e Nether (brasas, lava, névoa de calor). Nada pisca de um jeito estranho.
2. [ ] "Animação do fundo": completa, leve e desligada mudam na hora.
3. [ ] PlaySquare › Jogar: trocar de instalação (uma com bioma próprio e outra sem) faz a
   transição suave entre biomas; com uma imagem sua, só as partículas por cima (e somem ao
   desligar "Partículas sobre a minha imagem").
4. [ ] Abrir o jogo pelo JOGAR: o fundo do HubSquare para enquanto joga e volta ao fechar.
   Conferir que o jogo não perde FPS com o app aberto (F3 no jogo, com e sem o HubSquare aberto).
5. [ ] Minimizar, mandar para a bandeja e deixar sem foco por 30 s: o fundo para; ao voltar, segue.
6. [ ] Instalar um modpack: o fundo fica parado até terminar.

# Testar quando voltar (Fase M4: whitelist pelo convite)

Pelo terminal já passou: as regras dos pedidos (`tests/pedidosRegras.test.ts`), o fluxo completo
entre duas instâncias (aceitar, pedir, aprovar, nick no `whitelist.json`), o nick inexistente e a
segurança da rota (token errado, corpo grande, caracteres estranhos, 21º pedido, repetido,
bloqueio do IP). O que só dá para ver com um amigo de verdade:

1. [ ] Mande o convite para um amigo pelo Radmin. Ele, em Entrar com convite, põe o nick e um
   recado. Aparece para você o aviso "<nick> pediu para entrar" e o pedido em Jogadores.
2. [ ] Aprove com o servidor **ligado** (vai pelo `whitelist add`) e, numa outra vez, **desligado**
   (vai para o `whitelist.json`). Nos dois casos o amigo entra no jogo sem ser barrado.
3. [ ] Na tela Jogar dele aparece "Aguardando o dono aprovar" e, depois, "Aprovado".
4. [ ] Com o HubSquare fechado no seu PC, o amigo aceita o convite pelo arquivo `.hubsquare`: o
   pedido fica "vai quando o dono abrir o HubSquare" e chega quando você abre.
5. [ ] "Aprovar automaticamente quem usar este convite" ligado: o amigo entra sem você aprovar.
   Revogar o convite: os pedidos pendentes somem.

# Testar quando voltar (Fase M5: diagnóstico de conexão)

Pelo terminal já passou: as regras (ordem, pulo depois de uma essencial, texto copiado sem token
e sem IP público), o dono com o servidor desligado, o amigo com o servidor do dono desligado, a
instalação desatualizada (com o conserto), o nick não aprovado, tudo certo depois de aprovar, e,
com o Paper de verdade, o servidor ligado e o túnel do playit sem configurar. O que só dá para ver
com você e um amigo:

1. [ ] **Radmin desligado:** feche o Radmin VPN e rode "Testar tudo" (método Radmin) e, no PC do
   amigo, "Não consigo entrar": os dois param no Radmin com a frase de abrir o Radmin.
2. [ ] **Servidor desligado:** "Testar tudo" mostra "Ligar o servidor"; clicar liga, e "Conferir de
   novo" segue para as próximas. O amigo vê "O servidor não respondeu".
3. [ ] **Tudo certo:** servidor ligado, túnel do playit rodando (ou Radmin conectado com o Java
   liberado) e o nick do amigo aprovado: os dois lados mostram "Tudo certo".
4. [ ] **Túnel caído de verdade:** com o servidor ligado e o playit vinculado, feche o
   `playitd.exe` pelo Gerenciador de Tarefas: "Testar tudo" mostra "Religar o túnel" e o
   conserto volta o túnel.
5. [ ] **Firewall:** sem a regra do Java (Conexão › Radmin ou Rede local), o conserto "Liberar o
   Java no Firewall" pede administrador e depois passa.
6. [ ] "Copiar resultado" e colar num chat: sem o código do convite e sem o seu IP público inteiro.

# Testar quando voltar (Fase M6: modo amigo)

Pelo terminal já passou: as regras (primeira abertura, convite, servidores salvos, voltar ao
amigo, fechar de verdade), a primeira abertura no modo amigo (só o PlaySquare, nenhuma porta do
app além das que o teste usa para controlar o Electron, e fechar a janela sai do app), a abertura
por convite com ele já colado e a troca para o completo e de volta (o convite escuta no completo e
para no amigo; o servidor continua guardado). O que só dá para ver com você:

1. [ ] **Instalar do zero numa pasta de teste:** gere o instalador (`npm run dist`), instale numa
   conta do Windows sem o HubSquare (ou apague só uma cópia de teste de `%APPDATA%\ServSquare`,
   nunca a sua) e escolha "Só vou jogar com amigos": só o PlaySquare aparece.
2. [ ] Dois cliques num arquivo `.hubsquare` e um link `hubsquare://convite/...` (num chat):
   abrem o HubSquare com o convite colado (o registro vem do instalador).
3. [ ] No modo amigo, `netstat -ano | findstr 8788` (e a porta do celular) não mostra nada do
   HubSquare.
4. [ ] O seu PC (com servidores) abre direto no completo, sem boas-vindas, igual a antes.
5. [ ] "Também quero hospedar servidores" e "Usar só o PlaySquare" trocam com a transição; com
   o servidor ligado, voltar ao amigo é recusado com a mensagem de desligar antes.

# Testar quando voltar (Fase M7: passar o servidor)

Pelo terminal já passou: as regras (o que vai e o que fica, server.properties sem segredos,
conferência do pacote, mesmo servidor, nome do amigo) e o fluxo completo com três PCs de teste:
o dono passa para a Bia (o arquivo aberto não tem senha, token, caminho do PC nem .jar), ligar
pede "Ligar mesmo assim", a Bia recebe pelo assistente e vira dona com o mesmo id, o amigo entra
com o convite da Bia e a instalação dele continua a mesma (só o endereço muda), a Bia muda o mundo
e devolve, e o dono atualiza o dele (backup protegido com o mundo antigo, nada de cópia). O que só
dá para ver com você:

1. [ ] **COBBLEVERSE:** com ele desligado, Servidores › ⋯ › "Passar para outro amigo…". Confira o
   tamanho, a lista "Fica neste PC" (nenhuma config importante deveria cair lá à toa) e o tempo
   para gerar. Abra o .hubserver com o 7-Zip: nenhum .jar, e o `hubserver.json` com os mods do
   Modrinth como link.
2. [ ] **Importar em outro PC** (ou numa conta do Windows sem o HubSquare): "Receber servidor
   (.hubserver)" no primeiro passo do assistente, EULA, e ver o NeoForge, o Java e os mods
   baixando pela fila; os do CurseForge na janela Downloads necessários. Ligar e entrar no mundo.
3. [ ] Devolver o arquivo e escolher "Atualizar o meu servidor com este mundo": o mundo de volta,
   o backup com cadeado em Cópias de segurança, e o "Com <nome>" some do card.
4. [ ] Um amigo com a instalação do seu convite entra com o convite do novo dono: a mesma
   instalação (sem baixar tudo de novo), com o endereço novo.
5. [ ] O "Ligar mesmo assim" no botão grande da barra lateral e no Jogar ("Ligar servidor e jogar").

# Testar quando voltar (Fase M8: relatório de erro)

Pelo terminal já passou: as regras de limpeza e um relatório gerado pela tela com segredos falsos
plantados (PIN, sal, cookie, chave do CurseForge, segredo do playit, token do convite, senha do
RCON, IP público, Bearer, accessToken, a pasta do usuário, mundo e .jar): nenhum aparece no .zip, o
item desmarcado não vai, "Abrir pasta" abre a Área de Trabalho e o `npm run ler-relatorio` resume.
O que só dá para ver com você:

1. [ ] Gerar um relatório de verdade no seu PC (Opções › Gerais › Ajuda) com o COBBLEVERSE e uma
   instalação escolhidos; abrir o .zip e conferir que nada pessoal ficou (procure o seu nome de
   usuário, o seu e-mail e o IP público). Tempo para gerar com 300+ mods (hash de cada um).
2. [ ] O botão "Gerar relatório de erro" dentro de "Ver detalhes" de uma mensagem de erro aberta
   num diálogo (um diálogo por cima do outro).
3. [ ] O diálogo nos cinco biomas e em janela estreita (os dois selects lado a lado).
4. [ ] Rodar `npm run ler-relatorio -- <arquivo>` num relatório de um amigo de verdade.

# Testar quando voltar (Correção M1: jogo abre com os mods)

Pelo terminal já passou: a causa (instalação de um servidor apagado, pasta de mods vazia), as regras do perfil (gameDir com espaços, acentos e OneDrive), do options.txt (existente, vazio e inexistente) e do shader, e o perfil gerado numa cópia do seu launcher_profiles.json (`node --import ./tests/ts-sem-extensao.mjs .teste/m1c/perfil.ts "<instalação>"`). O que só dá para ver com você:

1. [ ] Em PlaySquare › Jogar, escolha a instalação **COBBLEVERSE** (a do servidor que existe) e clique em JOGAR. Abra o jogo pelo launcher e confira o menu Mods (ou a linha "Loading N mods" em `Documentos\ServSquare\jogo\COBBLEVERSE\logs\latest.log`): N deve ser o número de mods do pack, não 4.
2. [ ] Em Opções › Pacotes de recursos, os packs do servidor aparecem ativados, por cima dos seus.
3. [ ] JOGAR na instalação antiga **COBBLEVERSE-1 7 42-CF** agora mostra o erro "O servidor da instalação ... não existe mais" em vez de abrir o jogo vazio. Pode apagar essa instalação em Instalações.
4. [ ] A pasta `%APPDATA%\.minecraft\mods` continua igual (nada foi copiado para lá).

# Testar quando voltar (Fase V3: abas Serv/Play e acabamento)

Pelo terminal já passou: as abas nos cinco biomas (nenhuma corta letras, cantos pelos tokens, clique e setas do teclado), a contagem de mods da memória (instalação ainda não instalada conta os do servidor), o nome com pontos e os prints antes/depois em `.teste/prints-v3/`. O que só dá para ver com você:

1. [ ] Trocar Serv/Play várias vezes, com o mouse e com as setas: o fundo desliza sem pular, o nome nunca aparece cortado, o anel de foco aparece só pelo teclado. Repetir com "Reduzir animações" ligado (a troca fica na hora) e com a barra recolhida.
2. [ ] Jogar › COBBLEVERSE: "Memória do jogo" mostra "Sugerido: … (141 mods …)" (97 do servidor + 44 só do jogador), e não 0. Ao trocar de instalação, aparece "Contando mods…" por um instante.
3. [ ] Nome das instalações: uma instalação de servidor de modpack com a versão "esmagada" (ex.: "…-1 7 42-…") aparece com os pontos; nomes escolhidos por você continuam iguais; as pastas no disco não mudam. Importar um .zip "Pack-1.2.3.zip" sugere "Pack-1.2.3".
4. [ ] Jogar com o dono e o servidor desligado: o status "Servidor …" não fica mais por cima do botão "Ligar servidor e jogar".
5. [ ] As telas que os testes não fotografam (lista no fim de `docs/design/acabamento-v3.md`), nos cinco biomas.
