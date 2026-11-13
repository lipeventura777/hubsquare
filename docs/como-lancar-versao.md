# Como lançar uma versão do HubSquare

O app avisa quem já tem o HubSquare instalado lendo o **último release publicado** em
`github.com/lipeventura777/hubsquare` (ao abrir e a cada 6 h, sem chave). Por isso:

- a tag precisa ser semver com `v` na frente (`v1.2.0`) e igual à versão do `package.json`;
- o texto do release vira as "novidades" do aviso (markdown);
- rascunho (`--draft`) e pré-lançamento (`--prerelease`) **não** geram aviso: servem para testar antes.

## 1. Subir a versão

```powershell
npm version 1.2.0 --no-git-tag-version   # muda package.json e package-lock.json
npm test
npm run build
npx eslint src tests
```

Regra simples: correção = último número (1.1.**1**), funcionalidade nova = do meio (1.**2**.0).

## 2. Gerar o instalador

```powershell
npm run dist
```

Sai em `release/HubSquare-Setup-1.2.0.exe`. O `.exe` **nunca** entra no git (o `.gitignore` barra).

## 3. Commit e tag

```powershell
git add package.json package-lock.json
git commit -m "Versão 1.2.0"
git tag v1.2.0
git push
git push origin v1.2.0
```

## 4. Escrever as novidades

Crie `release/novidades-1.2.0.md` (fica fora do git), em português, curto:

```markdown
## Novidades
- O JOGAR abre o Minecraft Launcher com a instalação já selecionada.

## Correções
- ...
```

## 5. Criar o release com o .exe

```powershell
gh release create v1.2.0 "release/HubSquare-Setup-1.2.0.exe" `
  --repo lipeventura777/hubsquare `
  --title "HubSquare 1.2.0" `
  --notes-file "release/novidades-1.2.0.md"
```

Para testar antes sem avisar ninguém, acrescente `--prerelease`; quando estiver bom:

```powershell
gh release edit v1.2.0 --repo lipeventura777/hubsquare --prerelease=false --latest
```

## 6. Conferir

```powershell
gh release view v1.2.0 --repo lipeventura777/hubsquare
gh api repos/lipeventura777/hubsquare/releases/latest --jq ".tag_name, .html_url, .assets[].name"
```

Quem tem uma versão mais antiga vê "HubSquare 1.2.0 disponível" em até 6 h (ou ao abrir o app).

## Nunca

- Anexar mods, mundos, servidores, `.jar`, arquivos do jogo ou qualquer segredo ao release.
- Apagar um release já publicado (quem estava nele perde o link); publique uma correção.
