# Configurar a página do repositório no GitHub

Tudo o que se configura à mão na página do [repositório público](https://github.com/lipeventura777/hubsquare). Nada aqui roda sozinho.

## 1. Seção About (descrição, site e topics)

Na página do repositório, clique na engrenagem ao lado de **About** (coluna da direita).

**Description** (até 350 caracteres). Use uma das duas; o README principal é em português:

```
App para Windows que cria e liga um servidor de Minecraft Java no seu PC e prepara o jogo dos amigos com os mesmos mods. Paper, Vanilla, Fabric, Forge e NeoForge; mods do Modrinth e do Hangar; convites, backups, playit.gg e Radmin VPN. Grátis e de código aberto. Não é um produto oficial do Minecraft.
```

```
Windows app to host a Minecraft Java server on your PC and get your friends' game ready with the same mods. Paper, Vanilla, Fabric, Forge and NeoForge; mods from Modrinth and Hangar; invites, backups, playit.gg and Radmin VPN. Free and open source. Not an official Minecraft product.
```

**Website:**

```
https://github.com/lipeventura777/hubsquare/releases/latest
```

**Topics** (cole um por vez, ou separados por espaço):

```
minecraft minecraft-server minecraft-launcher minecraft-java electron typescript react windows modrinth paper fabric forge neoforge modpack server-manager playit radmin open-source
```

Na mesma janela, deixe marcado **Releases** e desmarque **Packages** e **Deployments** (o projeto não usa).

## 2. Prévia social (a imagem que aparece quando alguém compartilha o link)

1. Abra **Settings** (aba no topo do repositório) › **General**.
2. Role até **Social preview** e clique em **Edit › Upload an image…**.
3. Escolha `docs/assets/social-preview.png` (1280 × 640, já pronto). O GitHub só aceita PNG, JPG ou GIF; o `social-preview.svg` é a fonte para editar depois.
4. Confira a prévia e salve. Pode levar alguns minutos para aparecer em outros sites.

## 3. Outros ajustes

- **Settings › General › Features:** Issues ligado; Discussions opcional; Wikis desligado (a documentação fica no repositório).
- **Settings › Code security › Private vulnerability reporting:** ligado (o [SECURITY.md](../SECURITY.md) aponta para ele).
- **Issues › Labels:** crie as etiquetas `modpack`, `security`, `i18n` e `ignore-for-release`, usadas pelos modelos de issue e pelas notas automáticas ([.github/release.yml](../.github/release.yml)). `bug`, `enhancement`, `documentation`, `dependencies` e `question` já vêm no GitHub.
- **Settings › Branches:** proteja o `main` exigindo o workflow `CI` antes de juntar um pull request.
- **Settings › Secrets and variables › Actions:** o segredo `CURSEFORGE_API_KEY` só quando a chave oficial chegar; depois, para a assinatura, o segredo `SIGNPATH_API_TOKEN` e a variável `SIGNPATH_ORGANIZATION_ID` ([assinatura.md](assinatura.md)). Nunca escreva esses valores no repositório.
- **Settings › Actions › General › Workflow permissions:** leitura e escrita (o workflow de release cria o rascunho com o `GITHUB_TOKEN`).
- **Sponsor:** quando escolher a plataforma de doação, descomente a linha dela no [.github/FUNDING.yml](../.github/FUNDING.yml) e ligue **Settings › General › Features › Sponsorships**.
- **Licença:** o GitHub lê a `GPL-3.0` do [LICENSE](../LICENSE); não precisa configurar nada.

## 4. Nota de cada versão

Use o [RELEASE_TEMPLATE.md](RELEASE_TEMPLATE.md) e o passo a passo de [como-lancar-versao.md](como-lancar-versao.md).
