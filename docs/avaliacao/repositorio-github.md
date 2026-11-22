# GitHub repository settings / Configurações do repositório no GitHub

Paste these in **Settings › General** (description, website) and in the **About** gear on the repository page (topics).
Cole estes em **Settings › General** (descrição, site) e na engrenagem do **About** na página do repositório (tópicos).

## Description / Descrição (até 350 caracteres)

```
Windows app to host a Minecraft Java server and launch the game with the same mods for your friends. Paper, Fabric, Forge, NeoForge; mods from Modrinth, CurseForge and Hangar; invites, backups, playit.gg/Radmin. English and Portuguese. Not an official Minecraft product.
```

## Website

```
https://github.com/lipeventura777/hubsquare/releases/latest
```

## Topics / Tópicos

```
minecraft minecraft-server minecraft-launcher minecraft-java electron typescript react windows modrinth curseforge paper fabric forge neoforge modpack server-manager open-source
```

## Releases (Fase L1)

- **Secrets and variables › Actions:** secret `CURSEFORGE_API_KEY` (the official CurseForge key; only the release build reads it). Later, for signing: secret `SIGNPATH_API_TOKEN` and variable `SIGNPATH_ORGANIZATION_ID` (`docs/assinatura.md`). Never put these values in the repository.
- **Actions › General › Workflow permissions:** read and write (the release workflow creates the draft release with `GITHUB_TOKEN`).
- **Publishing a version:** set `version` in `package.json`, add its section to `CHANGELOG.md`, then push the tag `vX.Y.Z`. The workflow builds and creates a **draft** release with the installer, `latest.yml`, `.blockmap` and `SHA256SUMS.txt`; check it and click **Publish**. Only published releases reach the app's updater.

## Other settings / Outros ajustes

- **Features:** Issues on; Discussions optional.
- **Security › Private vulnerability reporting:** on (SECURITY.md points to it).
- **Branch protection (main):** require the `CI` workflow to pass before merging pull requests.
- **Social preview:** upload `docs/imagens/en-painel.png`.
- **License:** GitHub reads `GPL-3.0` from `LICENSE`; nothing to set. The HubSquare name and logo are not covered by it.
