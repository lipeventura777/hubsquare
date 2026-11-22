# Assinatura do instalador (SignPath Foundation)

O `release.yml` já tem os passos da assinatura, **comentados**. Eles só podem ser ligados depois
que o HubSquare for aceito pelo SignPath Foundation, e isso só acontece com o repositório público
(veja `CODE_SIGNING_POLICY.md`). Até lá, os releases saem sem assinatura e o Windows mostra o aviso
do SmartScreen.

## O que precisa existir antes

1. O repositório público no GitHub e o pedido aprovado em <https://signpath.org>.
2. No SignPath: a organização, o projeto `hubsquare`, a política de assinatura `release-signing`
   (com aprovação manual: cada release é aprovado à mão, como diz a política) e o GitHub como
   fonte confiável do projeto.
3. No GitHub (Settings › Secrets and variables › Actions):
   - segredo `SIGNPATH_API_TOKEN`: o token de um usuário de CI do SignPath com permissão de
     enviar pedidos de assinatura;
   - variável `SIGNPATH_ORGANIZATION_ID`: o id da organização no SignPath (não é segredo).

Nenhum desses valores entra no repositório, nem em exemplos.

## Como ligar

1. No `.github/workflows/release.yml`, tire o `#` dos três passos entre as linhas de traços
   "Assinatura pelo SignPath Foundation":
   - **Guardar o instalador sem assinatura:** sobe o `.exe` como artefato do Actions (é o que o
     SignPath baixa);
   - **Assinar pelo SignPath:** manda o pedido e espera a aprovação e a assinatura;
   - **Usar o instalador assinado:** troca o `.exe` pelo assinado e **recalcula** o `latest.yml`
     (sha512 e tamanho), o `.blockmap` e o `SHA256SUMS.txt`.
2. Confira que `project-slug` e `signing-policy-slug` são os nomes usados no SignPath.
3. Rode `actionlint .github/workflows/release.yml` e faça uma tag de teste num fork ou numa versão
   de pré-lançamento antes de usar numa versão de verdade.

## Por que recalcular o latest.yml

O atualizador do app (electron-updater) confere o sha512 do instalador baixado com o do
`latest.yml`. A assinatura muda os bytes do `.exe`, então o `latest.yml` gerado pelo
`npm run dist` deixa de bater e toda atualização seria recusada. O terceiro passo resolve isso com
o mesmo gerador de `.blockmap` do electron-builder.

Depois de ligar a assinatura, dá para pôr `publisherName` em `win` no `electron-builder.yml` (o
nome do certificado do SignPath): o atualizador passa a recusar instaladores que não tenham essa
assinatura. Só faça isso depois do primeiro release assinado publicado, senão quem está numa
versão sem assinatura não consegue atualizar para a assinada.
