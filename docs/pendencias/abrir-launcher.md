# Pendência: abrir o jogo pelo Minecraft Launcher

**Situação:** religado na Fase M1 (`ABRIR_LAUNCHER_LIGADO = true` em `src/main/launcherOficial.ts`). A escolha do launcher é `escolherLauncher` em `src/main/launcherRegras.ts`: só aceita o app `Microsoft.4297127D64EC6_…!Minecraft` ou um `MinecraftLauncher.exe` clássico; o marcador do Xbox e links `ms-windows-store:` são recusados (e conferidos de novo antes de abrir). Falta só a conferência na tela (`testar-quando-voltar.md`). Para desligar de novo, basta voltar a opção para `false`.

## O bug

Ao clicar em Jogar, abria a página da Microsoft Store para instalar o "Minecraft: Java Edition", em vez de abrir o launcher que já estava instalado.

## Causa provável (confirmada lendo os pacotes do Windows)

`detectarLauncher()` procura dois pacotes da Store, nesta ordem, e fica com o **primeiro** que existir:

1. `Microsoft.MinecraftJavaEdition`
2. `Microsoft.4297127D64EC6` (o Minecraft Launcher de verdade)

No seu PC os **dois** existem, e o primeiro **não é o launcher**: é um "stub", um marcador que o app Xbox / Game Pass instala.

- O `MicrosoftGame.Config` dele aponta para `MCPlaceholderStub.exe` (Id `Game`), com `Description="MCPlaceholderStub"` e `StoreId 9PJ8266BHFWN`.
- Abrir `shell:AppsFolder\Microsoft.MinecraftJavaEdition_8wekyb3d8bbwe!Game` roda esse marcador, e ele abre a página da Store em vez do jogo.

Ou seja: o app escolheu o pacote errado. O launcher estava instalado, mas o app nunca chegou a olhar para ele. A forma de abrir (`explorer.exe shell:AppsFolder\...`) está certa para apps da Store; o problema é o pacote.

## Onde o launcher está no seu PC

| O quê | Onde | Observação |
|---|---|---|
| Minecraft Launcher (Store) | `Microsoft.4297127D64EC6_8wekyb3d8bbwe`, versão 2.6.2.0, em `C:\Program Files\WindowsApps\Microsoft.4297127D64EC6_2.6.2.0...` | Id do app: `Minecraft` (`GameLaunchHelper.exe`). É o launcher de verdade. |
| Marcador do Xbox (não é launcher) | `Microsoft.MinecraftJavaEdition_8wekyb3d8bbwe`, versão 1.0.5.0 | `MCPlaceholderStub.exe`: abre a Store. |
| Launcher clássico | `C:\Program Files (x86)\Minecraft Launcher\MinecraftLauncher.exe` | Também existe. |
| Pasta do jogo | `%APPDATA%\.minecraft` (`launcher_profiles.json`, contas `_microsoft_store`) | As duas versões usam esta pasta. |

## Proposta de correção (para quando eu pedir)

1. **Nunca usar o marcador.** Tirar `Microsoft.MinecraftJavaEdition` da lista, ou recusar qualquer pacote cujo `MicrosoftGame.Config` aponte para `MCPlaceholderStub.exe`.
2. **Ordem de preferência:** primeiro `Microsoft.4297127D64EC6!Minecraft` (Store); se não houver, `MinecraftLauncher.exe` clássico em Program Files (x86) ou Program Files.
3. **Conferir antes de abrir:** se nenhum dos dois existir, mostrar o diálogo "Falta o Minecraft Launcher" com o link oficial (como já existe). Nunca abrir a Store sozinho.
4. **Teste:** neste PC (que tem os três), o app deve abrir o launcher da Store. Em outro PC só com o clássico, o clássico. Em um PC só com o marcador, o diálogo de "falta o launcher".
5. Depois de corrigido e testado, mudar `ABRIR_LAUNCHER_LIGADO` para `true`. As telas voltam a mostrar o JOGAR e o "Ligar servidor e jogar" do dono.

## Investigação pelo terminal (Fase M1, 12/11/2026)

| Pergunta | Resultado neste PC |
|---|---|
| Pacote do launcher (Store) | `Microsoft.4297127D64EC6`, família `Microsoft.4297127D64EC6_8wekyb3d8bbwe`, versão 2.6.2.0, app `Minecraft` (`GameLaunchHelper.exe` → `Minecraft.exe`) |
| AUMID (`Get-StartApps`) | `Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft` ("Minecraft Launcher"). O marcador aparece como `Microsoft.MinecraftJavaEdition_8wekyb3d8bbwe!Game` ("Minecraft: Java Edition") |
| `shell:AppsFolder\<AUMID>` | Abre o launcher: 7 processos `Minecraft.exe` da pasta do pacote 4297127D64EC6, nenhum da Store |
| Launcher clássico | `C:\Program Files (x86)\Minecraft Launcher\MinecraftLauncher.exe`; registro em `HKCU\SOFTWARE\Mojang\InstalledProducts\Minecraft Launcher` (`InstallLocation` = `C:\Program Files (x86)\`, `InstallExe` = `MinecraftLauncher.exe`: o .exe fica em `InstallLocation\Minecraft Launcher\`) |
| Arquivo de perfis | Os dois launchers leem `%APPDATA%\.minecraft\launcher_profiles.json`. Não existe `launcher_profiles_microsoft_store.json` neste PC (só contas, entitlements e UI têm o sufixo `_microsoft_store`) |
| Quando ele regrava | Ao **abrir** (o arquivo mudou com o launcher aberto); ao fechar pelo botão, não mudou. Por isso o app grava o perfil com o launcher fechado e só depois abre. O perfil `hubsquare-…` que já estava lá continuou depois da regravação |
| Instalação selecionada | Não há campo de "selecionado" nos arquivos; com `profileSorting: ByLastPlayed`, o launcher mostra primeiro a de `lastUsed` mais recente. O app grava `lastUsed` = agora |

Conclusão: confirma a correção proposta. Implementado na Fase M1.

## Correção M1: o jogo abria sem mods (13/11/2026)

**Causa confirmada pelo terminal:** o perfil `hubsquare-86ac…` estava certo (`gameDir` absoluto, bem escapado, Documentos sem OneDrive) e o jogo rodou na pasta da instalação `COBBLEVERSE-1 7 42-CF`. Mas a `mods\` dessa pasta estava vazia: a instalação apontava para um servidor que não existe mais em `servidores.json`, e o JOGAR, sem achar o servidor, seguia em silêncio e abria o launcher com a pasta vazia (o Fabric carregou só 4 mods, os dele).

**Correção:** o JOGAR (e o INSTALAR) param com uma mensagem quando o servidor da instalação sumiu, e conferem que todos os mods, resource packs e shaders esperados estão na pasta antes de abrir o launcher. O perfil é montado por `montarPerfil` (gameDir absoluto, gravado por JSON). Os resource packs do servidor continuam ativados por `ativarPacks` (só a linha `resourcePacks`). Com shader na pasta, o `iris.properties` (Fabric/NeoForge) ou `oculus.properties` (Forge) da instalação ganha um pack escolhido, sem trocar a escolha do jogador.
