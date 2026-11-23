# Política de privacidade

**Português (Brasil)** · [English](PRIVACY.md)

Atualizada em: 21/11/2026

O HubSquare é um app de desktop que roda no seu PC. Ele **não tem conta própria, análise de uso, telemetria nem anúncios**. O HubSquare não envia dados pessoais para quem o desenvolve nem para mais ninguém.

## O que o app guarda no seu PC

Tudo fica no seu computador, nestas pastas:

- `%APPDATA%\HubSquare` — ajustes do app (idioma, aparência, modo do app, índice das instalações), o Java baixado, caches, logs (`logs\erros.log`), os ajustes do painel do celular (o PIN só como hash scrypt com salt) e a atualização do app já baixada (em `%LOCALAPPDATA%\hubsquare-updater`, até ser instalada).
- `Documentos\HubSquare` — seus servidores, mundos, backups e instalações do jogo.
- `.minecraft\launcher_profiles.json` — só um perfil `hubsquare-<id>`, com backup antes.

Desinstalar o app não apaga seus servidores nem mundos. Você pode apagar essas pastas quando quiser.

## Serviços com que o app fala

O HubSquare só usa a internet para fazer o que você pede, e só com estes serviços oficiais. Cada um tem a sua política de privacidade.

| Serviço | Para quê |
|---|---|
| Mojang / Minecraft (`piston-meta.mojang.com`, `piston-data.mojang.com`, `resources.download.minecraft.net`, `api.mojang.com`, `sessionserver.mojang.com`, `textures.minecraft.net`) | lista de versões, servidor oficial, ícones e nomes de itens, conferir um nick, skins |
| PaperMC (`fill.papermc.io`) e Hangar (`hangar.papermc.io`, `hangarcdn.papermc.io`) | builds do Paper e plugins |
| FabricMC (`meta.fabricmc.net`) | loader Fabric |
| MinecraftForge (`maven.minecraftforge.net`, `files.minecraftforge.net`) e NeoForged (`maven.neoforged.net`) | loaders Forge e NeoForge |
| Eclipse Adoptium (`api.adoptium.net`, `github.com`) | Java (Eclipse Temurin) |
| Modrinth (`api.modrinth.com`, `cdn.modrinth.com`) | buscar e baixar mods, plugins, modpacks e packs |
| CurseForge (`api.curseforge.com`, `edge.forgecdn.net`, `mediafilez.forgecdn.net`, `media.forgecdn.net`) | só nas versões que trazem a chave oficial do HubSquare (até lá o CurseForge aparece como "em breve") |
| playit.gg | só se você usar o túnel do playit.gg (o app baixa o agente oficial; o login é no site deles) |
| GitHub (`api.github.com`, `github.com`, `objects.githubusercontent.com`, `release-assets.githubusercontent.com`, `raw.githubusercontent.com`, `gitlab.com`) | ver se há versão nova do HubSquare (ao abrir e a cada 6 horas, com a atualização automática ligada) e baixá-la dos releases do projeto (`latest.yml` e o instalador, com o sha512 conferido); arquivos de modpacks guardados lá. Nada sobre você vai junto: só o User-Agent do app |
| ipify (`api.ipify.org`) | só para descobrir o seu IP público ao testar ou mostrar a conexão por porta aberta |
| spark (`spark.lucko.me`, `spark-usercontent.lucko.me`) | só no diagnóstico de lag: o plugin spark do servidor envia o relatório para lá e o app lê de volta |

Todo pedido se identifica com o User-Agent `HubSquare/<versão> (github.com/lipeventura777/hubsquare)`. Nenhum e-mail, nome ou outro dado pessoal vai nele.

## Entre você e seus amigos

- **Convites** e o **painel do celular** só escutam nos endereços da rede local, do Radmin VPN e do Tailscale (nunca na internet aberta, a não ser que você mesmo crie um túnel do playit.gg). O convite mostra a sua lista de mods e os seus endereços de conexão para quem tiver o código.
- **Pedidos para entrar** levam o nick do Minecraft do amigo, o UUID e um recado curto opcional, guardados só no PC do dono.
- **Relatórios de erro** são salvos como `.zip` na sua Área de Trabalho. Senhas, tokens, PIN, chaves e o seu nome de usuário do Windows saem antes de gravar. O relatório leva: um resumo (LEIA-ME), o log de erros do app, o fim dos logs do servidor e do jogo, os relatórios de travamento mais recentes, dados do sistema (versão do app e do Windows, memória, Javas instalados), as configurações dos servidores e das instalações, a lista de mods (nome, versão e hash, nunca os arquivos), a versão do convite e o último diagnóstico de conexão. Nunca leva mundos, arquivos de mods nem chaves.
- **Relatar problema** (Engrenagem › Sobre, o menu da bandeja ou "Ver detalhes" de um erro) só abre o seu próprio programa de e-mail (um link `mailto:` para suporte.hubsquare@gmail.com) ou uma issue nova do GitHub no navegador, os dois já preenchidos com a sua descrição, a versão do app, o Windows e o idioma. Nada sai do seu PC até **você** clicar em enviar no e-mail ou na issue; o app nunca envia nada sozinho e não tem servidor de envio. O `.zip` só vai se você anexar. Segredos e o seu nome de usuário do Windows também saem da descrição antes de abrir o link.

## Crianças

O HubSquare não coleta dados de ninguém, inclusive de crianças.

## Contato

Dúvidas: abra uma issue em <https://github.com/lipeventura777/hubsquare/issues>.

---

NÃO É UM PRODUTO OFICIAL MINECRAFT. NÃO APROVADO NEM ASSOCIADO À MOJANG OU À MICROSOFT.
