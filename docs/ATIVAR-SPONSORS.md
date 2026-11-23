# Ativar o GitHub Sponsors no projeto

Faça isto **depois** que a sua página do GitHub Sponsors estiver no ar (veja [GITHUB-SPONSORS.md](GITHUB-SPONSORS.md)).

## O comando

Na pasta do projeto, no terminal:

```bash
npm run ativar:sponsors -- <seu-usuario> <url-da-pagina>
```

Exemplo (troque pelo seu usuário):

```bash
npm run ativar:sponsors -- lipeventura777 https://github.com/sponsors/lipeventura777
```

## O que o comando faz

1. Confere os dois valores. Ele **recusa** qualquer coisa que não seja uma URL `https://github.com/sponsors/<usuario>` com o mesmo usuário que você digitou.
2. Troca os marcadores `[USUARIO_GITHUB]` e `[LINK_PAGINA_APOIO]` e liga `GITHUB_SPONSORS_ATIVO` em `src/shared/apoioRegras.ts`.
3. Descomenta a seção "Support the project" do `README.en.md`.
4. Ativa a linha `github:` do `.github/FUNDING.yml`.
5. Roda `npm run lint` e `npm test`. **Se algum falhar, devolve todos os arquivos como estavam** e mostra o erro.

Se já estiver ativo, o comando para com um aviso e não muda nada.

## Depois

- [ ] Abra o `README.en.md` e confira a seção "Support the project". A imagem `docs/assets/sponsors-apoie-en.png` precisa estar na pasta.
- [ ] Abra o app em inglês: Engrenagem › Sobre mostra "Support the project" com o botão do GitHub Sponsors e o bloco recolhido "Brazilian? Pix (Brazil only)".
- [ ] Faça o commit e publique como de costume.

Para **desligar** de novo: ponha `GITHUB_SPONSORS_ATIVO = false` em `src/shared/apoioRegras.ts`, comente o bloco do `README.en.md` entre `<!-- SPONSORS-EN-INICIO` e `SPONSORS-EN-FIM -->` e comente a linha `github:` do `FUNDING.yml`.
