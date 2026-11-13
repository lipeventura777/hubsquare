# HubSquare

App de desktop para **Minecraft Java Edition** no Windows, para jogar com os amigos. Tem duas áreas:

- **ServSquare** — cria, configura e liga um servidor no seu PC: Paper, Vanilla, Fabric, Forge e NeoForge; mods, plugins e modpacks do Modrinth (e, opcionalmente, do CurseForge e do Hangar); backups automáticos; desligar quando vazio, reinício e backup agendados; conexão por túnel do playit.gg, Radmin VPN ou rede local; painel pelo celular na rede de casa.
- **PlaySquare** — prepara o jogo de cada amigo com os mesmos mods, packs e endereço do servidor (por convite), e também serve para jogar sozinho. O jogo abre pelo **Minecraft Launcher oficial**, com a sua conta.

O HubSquare não faz login na conta da Microsoft e não tem modo sem conta original. Você precisa ter o Minecraft: Java Edition.

## Instalar

1. Abra a página de [**Releases**](https://github.com/lipeventura777/hubsquare/releases/latest) e baixe o `HubSquare-Setup-<versão>.exe`.
2. Execute o instalador e escolha a pasta (ou deixe a padrão).

Quando sair uma versão nova, o próprio app avisa (dá para desligar em Opções › Gerais ou em Ajustes do jogo). Ele só abre a página para baixar; nada é instalado sozinho.

### Aviso do Windows (SmartScreen)

O instalador ainda não tem assinatura digital, então o Windows pode mostrar **"O Windows protegeu o computador"**. Para continuar, clique em **Mais informações › Executar assim mesmo**.

Se o navegador avisar que o arquivo "não é baixado com frequência", escolha **Manter**.

## Rodar o código

Precisa do [Node.js](https://nodejs.org) 22 ou mais novo, no Windows.

```bash
npm install
npm run dev
```

| Comando | O que faz |
|---|---|
| `npm test` | roda os testes |
| `npm run build` | confere os tipos e compila |
| `npm run dist` | gera o instalador em `release/` |

Stack: Electron + TypeScript + React + Vite (electron-vite) + Tailwind CSS; instalador com electron-builder. Como lançar uma versão: [docs/como-lancar-versao.md](docs/como-lancar-versao.md).

## Privacidade

- Nenhuma chave ou segredo vem no app. A chave do CurseForge, se você quiser usar, é sua: fica só no seu PC, criptografada.
- O app só fala com os sites oficiais (Mojang, PaperMC, FabricMC, Forge, NeoForged, Adoptium, Modrinth, CurseForge, Hangar, playit.gg e GitHub, para saber se há versão nova).
- Nenhum arquivo do jogo, mod ou servidor faz parte deste repositório: tudo é baixado na hora, das fontes oficiais.

## Licença

[MIT](LICENSE).

## Aviso

Não é um produto oficial do Minecraft. Não aprovado pela Mojang nem pela Microsoft, nem associado a elas.
