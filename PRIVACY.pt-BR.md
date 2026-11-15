# Política de privacidade

**Português (Brasil)** · [English](PRIVACY.md)

Atualizada em: 15/11/2026

O HubSquare é um app de desktop que roda no seu PC. Ele **não tem conta própria, análise de uso, telemetria nem anúncios**. O HubSquare não envia dados pessoais para quem o desenvolve nem para mais ninguém.

## O que o app guarda no seu PC

Tudo fica no seu computador, nestas pastas:

- `%APPDATA%\ServSquare` — ajustes do app (idioma, aparência, modo do app, índice das instalações), o Java baixado, caches, logs (`logs\erros.log`), os ajustes do painel do celular (o PIN só como hash scrypt com salt) e, se você colar uma, a sua chave da API do CurseForge (criptografada pelo `safeStorage` do Windows).
- `Documentos\ServSquare` — seus servidores, mundos, backups e instalações do jogo.
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
| CurseForge (`api.curseforge.com`, `edge.forgecdn.net`, `mediafilez.forgecdn.net`, `media.forgecdn.net`) | só se você colar a sua própria chave da API |
| playit.gg | só se você usar o túnel do playit.gg (o app baixa o agente oficial; o login é no site deles) |
| GitHub (`api.github.com`, `github.com`, `raw.githubusercontent.com`, `gitlab.com`) | ver se há versão nova do HubSquare e arquivos de modpacks guardados lá |
| ipify (`api.ipify.org`) | só para descobrir o seu IP público ao testar ou mostrar a conexão por porta aberta |
| spark (`spark.lucko.me`, `spark-usercontent.lucko.me`) | só no diagnóstico de lag: o plugin spark do servidor envia o relatório para lá e o app lê de volta |

Todo pedido se identifica com o User-Agent `HubSquare/<versão> (github.com/lipeventura777/hubsquare)`. Nenhum e-mail, nome ou outro dado pessoal vai nele.

## Entre você e seus amigos

- **Convites** e o **painel do celular** só escutam nos endereços da rede local, do Radmin VPN e do Tailscale (nunca na internet aberta, a não ser que você mesmo crie um túnel do playit.gg). O convite mostra a sua lista de mods e os seus endereços de conexão para quem tiver o código.
- **Pedidos para entrar** levam o nick do Minecraft do amigo, o UUID e um recado curto opcional, guardados só no PC do dono.
- **Relatórios de erro** são salvos como `.zip` na sua Área de Trabalho e nunca são enviados. Senhas, tokens, PIN, chaves e o seu nome de usuário do Windows saem antes de gravar.

## Crianças

O HubSquare não coleta dados de ninguém, inclusive de crianças.

## Contato

Dúvidas: abra uma issue em <https://github.com/lipeventura777/hubsquare/issues>.
