# Acabamento V3: abas Serv/Play e ronda de detalhes

Ronda feita pelos prints dos testes de ponta a ponta (sem abrir o app à mão), nos cinco biomas: Dia claro, Dia, Noite, Mar e Nether.
- Prints das telas: `.teste/prints-v1/<bioma>-NN-<tela>.png`, gerados por `tests/e2e/prints.e2e.ts`.
- Prints da barra lateral antes e depois: `.teste/prints-v3/<antes|depois>-<bioma>-<serv|play>.png`, gerados por `tests/e2e/trocaArea.e2e.ts`. Rode com `PRINTS_V3=antes` para os do código antigo.

A pasta `.teste/` fica fora do git: os prints existem só na máquina onde os testes rodaram.

| Tela | Problema | Print | Situação | Por quê |
| --- | --- | --- | --- | --- |
| Barra lateral › troca Serv/Play | Aba selecionada com cantos retos e cor sólida, diferente dos painéis e cards arredondados | `prints-v3/antes-*-serv.png` → `depois-*-serv.png` | Corrigido | Trilho com `--raio-item` e 4px de espaço; abas com `--raio-item − 4px` (cantos paralelos, inclusive no Mar); selecionada com destaque translúcido, contorno de 1px e brilho |
| Barra lateral › troca Serv/Play | A aba de fora aparecia cortada ("PlayS") | `prints-v3/antes-*-serv.png` | Corrigido | O nome curto agora é um texto próprio, não um recorte em porcentagem; o teste confere que nenhuma aba corta letras nos cinco biomas |
| Barra lateral › troca Serv/Play | Sem setas do teclado, sem foco visível próprio, abas de 40px | `prints-v3/depois-*` | Corrigido | Setas trocam de aba (o foco acompanha), anel de foco de 2px na cor de destaque, abas com 44px, hover e pressionado; o fundo desliza em 200 ms com ease-out e para com "Reduzir animações" |
| Barra lateral › cartão do servidor | Nome cortado ("Servido…") sem o nome inteiro na dica | `prints-v1/*-02-painel.png` | Corrigido | A dica mostra "<nome> · Ver todos os servidores" |
| Barra lateral | Barra de rolagem padrão do Windows (com setinhas) na lista de itens, diferente do vidro | `prints-v1/diaClaro-06-backups.png` | Depois | Estilizar a rolagem vale para o app inteiro (`::-webkit-scrollbar`) e precisa ser vista nos cinco biomas na tela |
| Jogar | Status "Servidor …" do servidor ficava por cima do botão "Ligar servidor e jogar" | `prints-v1/diaClaro-10-jogar.png` | Corrigido | Grade da barra de ação com `minmax(0,1fr)` e o nome encolhendo com reticências e dica |
| Jogar › Memória do jogo | "Sugerido: 4 GB (0 mods…)" numa instalação com centenas de mods | — | Corrigido (tarefa 2) | Contava só a pasta, vazia antes de instalar; agora soma os mods que a instalação vai receber (do servidor, os só do jogador do modpack ou os do convite). Enquanto carrega: "Contando mods…" |
| Instalações e Jogar | Nome "COBBLEVERSE-1 7 42-CF" (pontos viraram espaços) | — | Corrigido (tarefa 3) | Servidores aceitam ponto no nome; sugestões de .zip e de modpack mantêm os pontos; instalações antigas de servidores de modpack recuperam a versão com pontos. Pastas no disco não mudam |
| Painel › banner | Card "Chame seus amigos!" com cantos retos (usava `bg-panel/92`, que não pega o canto do vidro) | `prints-v1/dia-02-painel.png` | Corrigido | `rounded-(--raio-item)` |
| Todas | 26 textos cortados (nomes de mods, servidores, jogadores, versões, caminhos) sem o nome inteiro ao passar o mouse | — | Corrigido | `title` com o mesmo valor nos `truncate` de conteúdo simples |
| Todas › botões | Cantos dos botões como números soltos (10/12/14px) | — | Corrigido | Agora pelo token `--raio-pequeno` (mesmos valores) |
| Todas › botões | Estados de hover, foco, pressionado e desligado | `prints-v1/*` | Conferido | Já existem no componente base (`estilos.ts`) e no `:focus-visible` global |
| Todas › ícones | Padrão pedido: 20px e traço 1,8 | `prints-v1/*` | Depois | Os ícones do app são pixel art preenchido (grade 16×16, sem traço), em 14, 16 ou 20px conforme o lugar. Padronizar é redesenhar o conjunto |
| Cópias de segurança | Sem nenhum backup: mensagem sem ação | `prints-v1/diaClaro-06-backups.png` | Depois | A ação natural ("Fazer backup agora") seria uma função nova |
| Conexão › playit.gg | O texto diz "aprove o ServSquare" (nome antigo do app) | `prints-v1/nether-07-conexao.png` | Depois | É o nome com que o agente do playit se apresenta no site; mudar só o texto confundiria quem vê "ServSquare" lá. Conferir na tela qual nome aparece |
| Aparência | Amostra de cor com `rounded-[6px]` e cores em hex no código (cor sugerida, cores do MOTD, QR do celular) | — | Conferido | São conteúdo (cores do jogo e do QR), não superfícies; ficam como estão |
| Todas › contraste | Texto abaixo de 4,5:1 | — | Conferido | `tests/contrasteRegras.test.ts` passa nos cinco biomas; nada novo apareceu nos prints |
| Telas não fotografadas pelos testes (Comandos, Registro de eventos, Jogadores, Software, Arquivos, Mundos, Desempenho, Automação, Integrações, Explorar, Conteúdo, Servidores do PlaySquare, Capturas, Ajustes do jogo) | Não conferidas por print | — | Depois | Os testes só fotografam 12 telas; as outras ficam para a conferência na tela (testar-quando-voltar.md) ou para um teste de prints maior |
