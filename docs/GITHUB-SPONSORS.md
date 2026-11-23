# GitHub Sponsors: como ativar (só você pode criar a conta)

O Pix já funciona para quem tem banco no Brasil. O GitHub Sponsors serve para o resto do mundo. Esta página tem o que você precisa fazer e os textos prontos para colar. Quando a conta existir, siga o [ATIVAR-SPONSORS.md](ATIVAR-SPONSORS.md): um comando troca os marcadores e liga o botão no app e no README.

**Regra que não muda:** a doação é totalmente opcional e não desbloqueia nada de novo no app. O HubSquare é e continuará gratuito. Nenhum nível do Sponsors dá recurso, remove aviso ou dá vantagem dentro do app.

## Checklist

- [ ] Abra https://github.com/sponsors e clique em **Get sponsored** (entrar na lista de espera / criar o perfil de quem recebe).
- [ ] Complete o perfil do GitHub (nome, foto, país). Ative a verificação em duas etapas, se ainda não estiver.
- [ ] Conecte a conta onde você vai receber. O próprio GitHub mostra os passos e o que pede (dados pessoais e de pagamento). Isso é feito só no site do GitHub, nunca dentro do app.
- [ ] Cole o **texto do perfil** abaixo (em português e em inglês) e escolha uma foto.
- [ ] Crie os **3 níveis** sugeridos abaixo.
- [ ] Espere a aprovação do GitHub (pode levar um tempo) e publique o perfil.
- [ ] Com a página no ar, copie o endereço dela (`https://github.com/sponsors/<seu-usuario>`) e siga o [ATIVAR-SPONSORS.md](ATIVAR-SPONSORS.md).

## Texto do perfil: português (Brasil)

> Oi! Eu sou o Felipe Segantini Ventura, de São Paulo, e mantenho o **HubSquare**: um app gratuito e de código aberto (GPL-3.0) para Windows que cria e liga um servidor de Minecraft Java no seu PC e prepara o jogo dos amigos com os mesmos mods.
>
> Eu faço isso nas horas vagas. Se o app ajuda você e quiser contribuir com os custos e com o tempo, a doação é bem-vinda.
>
> **A doação é totalmente opcional e não desbloqueia nada de novo no app. O HubSquare é e continuará gratuito.** Quem doa não recebe nenhum recurso, aviso a menos ou vantagem dentro do app; o agradecimento é no README do projeto, se você quiser.

## Texto do perfil: inglês

> Hi! I'm Felipe Segantini Ventura, from São Paulo, Brazil, and I maintain **HubSquare**: a free, open-source (GPL-3.0) Windows app that creates and runs a Minecraft Java server on your PC and gets your friends' game ready with the same mods.
>
> I build it in my spare time. If the app helps you and you'd like to chip in toward the costs and the time, donations are welcome.
>
> **Donating is entirely optional and unlocks nothing new in the app. HubSquare is and will stay free.** Donors don't get any feature, removed notice or advantage inside the app; the thank-you is a mention in the project README, if you want it.

## Níveis sugeridos (todos simbólicos)

Valores em dólar, que é o que o GitHub mostra para quem está fora do Brasil. Nenhum nível dá vantagem no app.

| Nível | Valor | O que a pessoa recebe |
| --- | --- | --- |
| Obrigado | US$ 3 por mês (ou uma vez) | Um agradecimento de coração. |
| Apoiador | US$ 7 por mês | O nome (ou apelido) na lista de apoiadores do README, se a pessoa quiser. |
| Parceiro | US$ 15 por mês | O mesmo agradecimento no README, com um link, se a pessoa quiser. |

## O que muda quando você ativar

O comando `npm run ativar:sponsors -- <usuario> <url>` faz tudo isto sozinho (detalhes no [ATIVAR-SPONSORS.md](ATIVAR-SPONSORS.md)):

- troca os marcadores `[USUARIO_GITHUB]` e `[LINK_PAGINA_APOIO]` e liga `GITHUB_SPONSORS_ATIVO` em `src/shared/apoioRegras.ts`;
- no app em inglês, o item **Support the project** passa a aparecer em Engrenagem › Sobre, com o botão do GitHub Sponsors e o Pix recolhido em "Brazilian? Pix (Brazil only)";
- no app em português, o botão do Sponsors aparece ao lado do Pix;
- a seção "Support the project" do `README.en.md` deixa de estar comentada;
- a linha `github:` do `.github/FUNDING.yml` é ativada (o botão **Sponsor** do repositório passa a levar ao seu perfil);
- o lint e os testes rodam; se algo falhar, tudo volta como estava.

Depois, é só conferir o README e fazer o commit. Você também precisa pôr a imagem `docs/assets/sponsors-apoie-en.png` (já criada por você) na pasta, se ainda não estiver.
