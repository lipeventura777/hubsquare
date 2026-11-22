# Testar quando voltar

## Logo: esconder e cores pelo fundo

- [ ] Aparência › Tema › Logo: com "Acompanhar o fundo", trocar o bioma do app (Aparência › Fundo)
  por alguns, inclusive Nether, Cerejeira e Geodo de Ametista: a logo da barra lateral muda de cor
  junto com o fundo, combina com ele e continua legível (contorno visível, H e S legíveis).
- [ ] Pôr uma imagem como fundo do app (de preferência bem colorida): a logo pega as cores dela.
- [ ] Dar a um servidor um fundo próprio (Painel › Fundo) diferente do app: nas telas daquele
  servidor a logo segue o fundo dele; em Servidores e Aparência volta ao do app.
- [ ] "Oficiais": a logo volta ao verde e azul de sempre em qualquer fundo.
- [ ] "Mostrar logo na barra lateral" desligado: a logo some, as abas Serv/Play sobem sem deixar
  buraco e continuam funcionando; em Sobre a logo continua lá.
- [ ] Com "Reduzir animações" ligado, a cor da logo troca na hora.

## Logo nova (cubo chunk)

- [ ] Instalar o HubSquare (`npm run dist`, o .exe em `release/`) e conferir a logo nova no
  instalador (ícone da janela e do arquivo), no atalho da área de trabalho, no menu Iniciar, na
  barra de tarefas, na bandeja (barra clara e escura do Windows) e na janela do app.
- [ ] No Explorador, um arquivo `.hubsquare` mostra a logo nova. O `.hubserver` continua sem
  ícone próprio (não tem associação; fica para depois).
- [ ] Se o Windows mostrar o ícone antigo em algum lugar, rodar `ie4uinit.exe -show` para limpar
  o cache de ícones (ou reiniciar o Explorador).
- [ ] Abrir o painel do celular: o favicon e o ícone da tela inicial são a logo nova.
- [ ] GitHub: subir `docs/marca/social-preview.png` em Settings › General › Social preview e,
  se quiser, `docs/marca/avatar.png` como foto do perfil ou da organização.

## Fase L1: atualização automática e release

- [ ] Pôr o segredo `CURSEFORGE_API_KEY` no GitHub só quando a chave oficial chegar (sem ele, o
  CurseForge aparece "em breve": conferir em Mods › Explorar › CurseForge e em Opções ›
  Integrações).
- [ ] Release de teste: subir a versão no package.json (ex.: 1.5.0-beta.1 não vale, o aviso
  ignora pré-lançamentos; use uma versão normal num fork ou num repositório de teste), pôr a
  seção no CHANGELOG, criar a tag `vX.Y.Z` e conferir no Actions que o release em rascunho tem o
  .exe, o latest.yml, o .blockmap e o SHA256SUMS.txt, com as novidades do CHANGELOG. Publicar o
  rascunho.
- [ ] Instalar a versão anterior, abrir o app e esperar o aviso "Versão X pronta" (pode levar um
  minuto). "Ver novidades" mostra o texto do release.
- [ ] Com o servidor **ligado**: "Reiniciar e atualizar" mostra "Esperando o servidor desligar" e
  não fecha nada. Desligar o servidor: aparece a espera do backup e, quando termina, o app fecha,
  instala e abre de novo na versão nova.
- [ ] Sem nada rodando: "Reiniciar e atualizar" fecha, instala e reabre. Servidores, mundos e
  ajustes continuam lá.
- [ ] "Ao fechar": o aviso some; fechar o app pela bandeja (Sair) instala a versão.
- [ ] "Pular esta versão": fechar o app não instala.

## Fase R1: relatar problema

- [ ] Engrenagem › Sobre › Relatar problema › Bug, escrever algo e **Enviar por e-mail**: o
  programa de e-mail abre com o assunto "[HubSquare <versão>] Bug: ..." e o corpo com versão,
  Windows e idioma; a pasta da Área de Trabalho abre com o .zip selecionado; anexar e conferir que
  o anexo vai (pode mandar para você mesmo).
- [ ] O mesmo com **Abrir no GitHub**: a issue nova abre no modelo de bug, com a etiqueta "bug";
  arrastar o .zip para a issue e conferir que ele sobe (pode fechar sem enviar).
- [ ] Menu da bandeja › Relatar problema...: a janela abre com o diálogo.
- [ ] Um erro qualquer › Ver detalhes › Relatar problema: abre o mesmo diálogo.

## Fase P8: animações limpas

- [ ] Navegar rápido entre cinco telas (ex.: Painel, Opções, Mods, Mundos, Jogadores) e ver se algo
  pisca ou pula.
- [ ] Trocar ServSquare ↔ PlaySquare algumas vezes: a área nova entra do lado da aba escolhida.
- [ ] Aparência › Animações › "Reduzir animações" ligado: nada desliza, só aparece com fade.

## Fase F1: Forge antigo (1.7.10 a 1.12.1)

Pelo terminal já passou: o cliente da Naruto Storm Online preparado (versão, 18 bibliotecas
conferidas e perfil, `forge-cliente`) e um servidor só com o Forge 1.7.10 e outro com o 1.12.1
chegando ao "Done" com Java 8 (`forge-limpo`). O servidor do pack instala e liga com Java 8, mas
trava em mods só do jogador que o pack põe soltos em `overrides/mods` (Resource Loader, Damage
Indicators): fica para uma fase própria. Falta o launcher oficial de verdade e o jogo abrindo.

1. **Naruto Storm Online:** PlaySquare › Jogar, escolha a instalação.
   - [ ] Embaixo do JOGAR aparece "Esta versão usa Java 8, que o HubSquare baixa sozinho."
   - [ ] JOGAR prepara (barra "Preparando as bibliotecas do Forge (X de 18)") e abre o launcher
     oficial com o perfil da instalação selecionado.
   - [ ] No launcher, JOGAR: o jogo abre com Java 8 (o próprio launcher baixa o dele, sem pedir
     nada) e o título mostra "Minecraft 1.7.10".
   - [ ] Menu principal › **Mods**: aparecem o Forge e os mods do pack (Naruto, etc.).
   - [ ] Entrar num mundo e sair sem travar.
2. **Forge 1.12.1 limpa:** PlaySquare › Instalações › + Nova instalação › Forge › 1.12.1.
   - [ ] O aviso do Java 8 aparece abaixo da versão.
   - [ ] JOGAR abre o launcher e o jogo; o menu **Mods** mostra Minecraft Forge 14.22.1.2478.
3. **Servidor Forge 1.7.10 limpo:** ServSquare › Criar › Do zero › Forge › 1.7.10.
   - [ ] O aviso do Java 8 aparece abaixo da versão; liga e o console mostra "Done".
   - [ ] Entrar no servidor pelo jogo da instalação do servidor (Testar no meu jogo).
   - [ ] (Esperado, por enquanto) Criar da Naruto Storm Online liga e trava em "Resource Loader":
     são mods só do jogador soltos no pack.
4. **Nada mudou no 1.12.2 em diante:** JOGAR numa instalação Forge 1.20.1 ou 1.12.2 continua igual.

## Fase E3: erros de download, Forge antigo e porta do servidor

Já passou nos testes (`tests/redeRegras.test.ts` e `tests/e2e/portaEForge.e2e.ts`); falta ver no
seu PC, com as suas instalações e servidores.

1. **Naruto Storm Online (Forge 1.7.10):** PlaySquare › Jogar, escolha a instalação e clique em JOGAR.
   - [ ] Aparece "Forge antigo (antes da 1.12.2) ainda não é suportado." com "O suporte chega numa
     próxima versão." embaixo, na hora, sem barra de download.
   - [ ] A instalação continua na lista (nada apagado).
   - [ ] Criar uma instalação ou um servidor com um modpack de Forge 1.7.10 mostra a mesma mensagem.
2. **Porta 25570:** ServSquare › Opções do servidor, "Porta do servidor" = 25570, Salvar.
   - [ ] Conexão mostra os endereços com `:25570` (Radmin e rede local) e a porta 25570 para o playit.
   - [ ] Ligar o servidor; no console aparece "Starting Minecraft server on *:25570".
   - [ ] Num outro PC (ou no PlaySquare de um amigo), entrar pelo convite: o endereço do convite tem
     `:25570` e o jogo entra.
   - [ ] Voltar a porta para 25565 depois do teste.
3. **Porta ocupada:** com outro servidor de Minecraft aberto na mesma porta, clicar em LIGAR.
   - [ ] Aparece "A porta <n> já está em uso por outro programa." e o botão "Trocar a porta nas
     Opções" abre as Opções.

## Fase E2: nome HubSquare com migração (instalar por cima da 1.4.0)

Tudo abaixo já passou nos testes com pastas falsas (`tests/e2e/migracao.e2e.ts`). O que falta é
o instalador de verdade e as suas pastas de verdade, que os testes nunca tocam.

Antes: deixe a 1.4.0 instalada como está (hoje em `E:\Nova pasta\HubSquare`), feche o servidor,
o jogo e o Minecraft Launcher. Se quiser uma rede de segurança extra, copie
`%APPDATA%\ServSquare` e `Documentos\ServSquare` para outro lugar antes.

1. **Instalar por cima:** rode `release/HubSquare-Setup-<versão>.exe` (de `npm run dist`).
   - [ ] A pasta sugerida é `E:\Nova pasta\HubSquare` (a mesma da 1.4.0).
   - [ ] A instalação termina sem erro e sem pedir para desinstalar nada à mão.
   - [ ] Configurações › Aplicativos › Aplicativos instalados: só **um** HubSquare, na versão nova.
   - [ ] Um só atalho HubSquare na Área de Trabalho e no menu Iniciar; os atalhos "Jogar" que você
     criou para instalações continuam abrindo o app.
2. **Primeira abertura:**
   - [ ] Nenhum aviso de migração no canto de baixo à esquerda.
   - [ ] `%APPDATA%\HubSquare` e `Documentos\HubSquare` existem; `%APPDATA%\ServSquare` e
     `Documentos\ServSquare` não existem mais (foram movidas, não copiadas).
   - [ ] `%APPDATA%\HubSquare\migracao-hubsquare.json` tem a data e as duas pastas movidas.
   - [ ] O idioma e a aparência continuam os seus.
3. **ServSquare:**
   - [ ] **Servidores:** todos os servidores, com nome, tipo e versão.
   - [ ] **Cópias de segurança:** os backups antigos aparecem, com os cadeados.
   - [ ] **Mods › Instalados:** os mods, com fonte e etiquetas; Registro de eventos › Ações do app
     com as ações antigas.
   - [ ] Opções › Integrações: a chave do CurseForge continua guardada (se você tinha uma).
4. **PlaySquare:**
   - [ ] **Instalações:** todas, com imagem e fundo.
   - [ ] **Fundos:** o fundo do app, o de cada instalação e o de cada servidor iguais a antes;
     Aparência › Fundo › Minhas imagens com as imagens.
   - [ ] **JOGAR no Cobbleverse:** o launcher abre o perfil e o jogo carrega com os mods. No
     `launcher_profiles.json`, o `gameDir` do perfil `hubsquare-…` aponta para
     `Documentos\HubSquare\jogo\…`.
   - [ ] Capturas de tela continuam lá.
5. **Se aparecer o aviso de migração:** feche o servidor, o jogo e o launcher e abra de novo; ele
   tenta sozinho. O motivo fica em `%APPDATA%\ServSquare\logs\erros.log` (linha "Migração para
   HubSquare").
