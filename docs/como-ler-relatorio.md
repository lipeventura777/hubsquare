# Como ler um relatório de erro do HubSquare

O relatório é um `.zip` que o amigo gera em **Opções › Gerais › Ajuda**, em **PlaySquare › Ajustes do jogo › Ajuda** ou pelo botão em "Ver detalhes" de qualquer erro. Ele fica na Área de Trabalho, com o nome `HubSquare-relatorio-AAAA-MM-DD_HH-MM.zip`. O app nunca envia esse arquivo: o amigo manda por conta própria.

Nada de segredo vai junto:
- Tokens de convite, PIN e hash do PIN, sessões e cookies do celular, chave do CurseForge, segredo do playit, senha do RCON e `Bearer`/`--accessToken` aparecem como `[removido]`.
- O nome do usuário do Windows nos caminhos vira `%USERPROFILE%`.
- O IP público aparece como `187.45.•••.•••`. Os IPs da casa, do Radmin (26.x) e do Tailscale (100.64/10) ficam inteiros.
- Mundos e arquivos de mods nunca vão.

## Por onde começar

1. Rode `npm run ler-relatorio -- <arquivo.zip>` na pasta do projeto. O script imprime:
   - o LEIA-ME;
   - os 5 últimos erros do app;
   - as linhas de erro dos logs do servidor e do jogo;
   - cada travamento com a exceção;
   - o último diagnóstico e a contagem de mods.
2. Leia o **LEIA-ME.txt**. Ele mostra a versão do app e do Windows, o servidor e a instalação escolhidos, o último erro do app, o último diagnóstico de conexão e a lista do que veio. Um item que falta foi tirado pelo amigo ou não existia.
3. Siga pelo tipo de problema:
   - **O app mostrou uma mensagem de erro:** `erros.log`.
   - **O servidor não liga ou caiu:** `servidor/latest.log`, depois `travamentos/servidor-*` e `mods.json`.
   - **O jogo não abre ou fecha sozinho:** `jogo/latest.log`, depois `travamentos/jogo-*` e `mods.json` (lado da instalação).
   - **O amigo não consegue entrar:** `diagnostico.txt` (a primeira linha com ✗ é o problema), depois `manifesto.json` e `config/instalacoes.json`.

## O que cada arquivo mostra

| Arquivo | O que tem |
| --- | --- |
| `LEIA-ME.txt` | Resumo: versões, o que foi escolhido, último erro, último diagnóstico e a lista de arquivos. |
| `erros.log` | Erros do app que não foram tratados e falhas do Jogar (pasta de dados › logs). Até 2 MB, do fim. Cada entrada começa com `[data ISO]`. |
| `servidor/latest.log` | O fim do log do servidor escolhido (até 2 MB). Procure `ERROR`, `Exception` e `Caused by`. |
| `servidor/servsquare-acoes.log` | O que a automação do app fez (desligar vazio, reinício, backup agendado). |
| `jogo/latest.log` | O fim do log do jogo da instalação escolhida (até 2 MB). |
| `travamentos/servidor-*.txt`, `travamentos/jogo-*.txt` | Os 3 relatórios de travamento mais recentes de cada lado (até 1 MB cada). `Description:` e a primeira exceção dizem o que aconteceu. A Fase 25 também cruza com os mods. |
| `sistema.json` | Versão do app e do Electron, Windows, memória total e livre (GB) e os Javas que o app já baixou. |
| `config/servidores.json` | O `servsquare.json` de cada servidor (tipo, versão, loader, RAM, Java dos mods, automação, emprestado) e o `server.properties` em linhas, sem segredos. |
| `config/instalacoes.json` | O índice das instalações do PlaySquare (versão, loader, origem; o token do convite sai). |
| `mods.json` | Mods e plugins do servidor e da instalação escolhidos: arquivo, título e versão (quando o app instalou) e SHA-1. Dá para achar o mod no Modrinth pelo hash. |
| `manifesto.json` | Versão do convite do servidor e, na instalação, a versão aplicada e a disponível. Aplicada menor que disponível quer dizer instalação desatualizada. |
| `diagnostico.txt` | O último "Testar tudo" ou "Não consigo entrar" desta sessão do app (some ao fechar o app). |

## Dicas

- Mod que falta no servidor ou no jogo: compare os hashes de `mods.json` dos dois lados.
- `class file version` ou `Fix:` do Fabric no log do servidor: Java errado. Confira `javaDosMods` em `config/servidores.json` e os Javas em `sistema.json`.
- Se um caminho aparece como `%USERPROFILE%\Documents\ServSquare\...`, é a pasta padrão do app.
