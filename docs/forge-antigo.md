# Forge antigo (1.7.10 a 1.12.1): pesquisa e plano da Fase F1

Pesquisa feita em 20/11/2026 com os arquivos oficiais (maven do Forge, Mojang, Adoptium e Modrinth),
numa pasta temporária, sem mexer no app. Os instaladores baixados bateram com o `.sha1` do maven.

## 1. O que a pesquisa achou

### Endereço e nome do instalador

Base: `https://maven.minecraftforge.net/net/minecraftforge/forge/<nome>/forge-<nome>-installer.jar`
(e o `.sha1` ao lado). Builds recomendados do `promotions_slim.json`:

| Minecraft | Forge | `<nome>` no maven |
|---|---|---|
| 1.7.10 | 10.13.4.1614 | `1.7.10-10.13.4.1614-1.7.10` |
| 1.8.9 | 11.15.1.2318 | `1.8.9-11.15.1.2318-1.8.9` |
| 1.9.4 | 12.17.0.2317 | `1.9.4-12.17.0.2317-1.9.4` |
| 1.10.2 | 12.18.3.2511 | `1.10.2-12.18.3.2511` |
| 1.12.1 | 14.22.1.2478 | `1.12.1-14.22.1.2478` |
| 1.12.2 (já funciona) | 14.23.5.2859 | `1.12.2-14.23.5.2859` |

O sufixo `-<versão do Minecraft>` **não segue uma regra pela versão**: o 1.7.10 build 1614 tem, o
1.7.10 build 1291 e o 1.8 build 1563 não têm. O nome certo vem do
`maven-metadata.xml` do Forge (mesmo site): a versão igual a `<mc>-<forge>` ou que começa com
`<mc>-<forge>-`. É a causa exata do erro da Naruto Storm Online (o app montava sem o sufixo).

### O que tem dentro do instalador antigo

- `install_profile.json` com duas partes:
  - `install`: `target` (id da versão, ex.: `1.7.10-Forge10.13.4.1614-1.7.10`), `path` (o Forge como
    biblioteca maven), `filePath` (o jar universal dentro do instalador) e `minecraft`.
  - `versionInfo`: o JSON da versão para o launcher, no formato antigo: `id`, `inheritsFrom` (a versão
    vanilla), `jar`, `minecraftArguments`, `mainClass` (`net.minecraft.launchwrapper.Launch`) e
    `libraries` só com `name`, às vezes `url` (base do maven), `checksums` (lista de SHA-1) e as marcas
    `clientreq`/`serverreq`. Não tem `downloads` com `sha1`/`size`, que é o formato que o launcher
    novo usa para conferir.
- `forge-<nome>-universal.jar`: o Forge em si.

### O que o instalador faz no cliente

Os instaladores de 1.7.10 a 1.12.1 só aceitam `--installServer`, `--extract` e `--offline` (conferido
nas classes do instalador). **Não existe `--installClient`**: o modo cliente é só pela janela. Pela
janela, ele grava `versions/<id>/<id>.json` (o `versionInfo`), copia o jar universal para
`libraries/net/minecraftforge/forge/<nome>/forge-<nome>.jar` e baixa as bibliotecas marcadas
`clientreq`. Desde o 1.12.2 recente (14.23.5.2851+), o instalador novo tem `--installClient`, e
esse fluxo não muda.

### Bibliotecas: o que o launcher baixa sozinho e o que o app precisa pôr

Conferido endereço por endereço (1.7.10 e 1.12.1):

| Biblioteca | Situação | Quem cuida |
|---|---|---|
| `net.minecraftforge:forge:<nome>` | **404** no endereço que o launcher calcularia (`forge-<nome>.jar`); no maven só existe `forge-<nome>-universal.jar` | **o app**, a partir do jar universal (SHA-1 conferido com o `.sha1` do maven) |
| `launchwrapper`, `asm-all`, `lzma`, `jopt-simple`, `guava`, `commons-lang3`, `vecmath`, `trove4j` (sem `url`) | existem em `libraries.minecraft.net`, com `.sha1` | o app confere e põe; o launcher acharia sozinho |
| bibliotecas Scala, `akka`, `config`, `asm-all 5.2`, `jline` (com `url` do maven do Forge) | existem, com `.sha1`… | o app confere e põe |
| …menos `scala-parser-combinators_2.11:1.0.1` e `scala-xml_2.11:1.0.2` | **sem `.sha1`** no maven | o app confere pelo `checksums` do `install_profile.json` |

Como o JSON antigo não tem hash para o launcher conferir, o plano é o app baixar e conferir **todas**
as bibliotecas e gravar o JSON da versão já no formato novo (`downloads.artifact` com `path`, `url`,
`sha1` e `size` de cada uma). O launcher acha tudo no lugar e ainda confere o hash.

### Java 8

O JSON oficial da Mojang de 1.7.10, 1.8.9, 1.10.2, 1.12.1 e 1.12.2 já declara
`"javaVersion": {"component": "jre-legacy", "majorVersion": 8}`. A versão do Forge herda isso pelo
`inheritsFrom`, então o launcher oficial usa o Java 8 dele sem `javaDir` no perfil. Para não depender
disso, o JSON gerado pelo app repete o `javaVersion` `jre-legacy`. No servidor, o `java.ts` já escolhe
o Java pelo `javaVersion` da Mojang (8) e baixa o Temurin 8.

### `--installServer` em modo silencioso

Funciona. Testado com o Temurin 8 (1.8.0_512) e `-Djava.awt.headless=true`, numa pasta vazia, em
1.7.10, 1.8.9 e 1.12.1: termina com código 0, sem janela, e deixa
`forge-<nome>-universal.jar`, `minecraft_server.<mc>.jar` e `libraries/`. O servidor da Mojang vem de
`launcher.mojang.com`, e o instalador confere o SHA-1, que bate com o JSON da Mojang. O servidor
liga com `java -jar forge-<nome>-universal.jar nogui` (não há `run.bat` nessas versões).

### Como o Prism Launcher resolve (só referência, pelo que é público do projeto)

O Prism não roda o instalador antigo no PC do jogador. O serviço de metadados dele lê o
`install_profile.json` de cada build e publica um JSON pronto, com cada biblioteca como coordenada
maven + endereço + hash, e o Forge como a biblioteca `universal` baixada direto do maven do Forge. O
Java vem do `javaVersion` da Mojang (8). O plano abaixo faz o mesmo, mas no próprio app e com os
arquivos oficiais, sem servidor de metadados de terceiros.

### O caso real

Naruto Storm Online 4.899 (Modrinth `ROWnuRE2`, versão `l97q91Y6`): `.mrpack` de 104 MB, `forge:
10.13.4.1614`, `minecraft: 1.7.10`, 7 arquivos (todos do `cdn.modrinth.com`) e 912 itens em
`overrides`.

## 2. Plano

1. **Regra pura** `src/shared/forgeAntigoRegras.ts` (testada em `tests/forgeAntigoRegras.test.ts`):
   - `nomeNoMaven(versoesDoMetadata, mc, forge)`: o nome com ou sem sufixo, ou null.
   - `ehForgeAntigo(mc)`: de 1.7.10 até antes da 1.12.2 (o 1.12.2 segue no fluxo novo).
   - `lerPerfilAntigo(texto)`: valida o `install_profile.json` e devolve o id, o `filePath`, o
     `versionInfo` e a lista de bibliotecas (caminho maven, endereço oficial e SHA-1 aceitos).
   - `montarVersaoCliente(versionInfo, conferidas)`: o JSON da versão no formato novo, com
     `javaVersion` `jre-legacy`.
   - Endereços aceitos só de `maven.minecraftforge.net` e `libraries.minecraft.net`.
2. **Servidor** (`src/main/tipos/forge.ts`): para versões antigas, o nome vem do metadata, o
   instalador roda com `--installServer` (Java 8 do `java.ts`, sem janela), e o `argumentos` usa
   `-jar forge-<nome>-universal.jar nogui` quando não há `run.bat`. O 1.12.2 em diante continua igual.
3. **Cliente** (`src/main/clienteLoader.ts`, mesmo caminho do JOGAR): para versões antigas, baixa o
   instalador (SHA-1), tira dele só o `install_profile.json` e o jar universal (`tar.exe -xOf`, sem
   rodar o instalador), confere o universal com o `.sha1` do maven, baixa e confere cada biblioteca
   para `.minecraft/libraries`, grava `versions/<id>/<id>.json` e devolve o id. O perfil continua
   pelo `gravarPerfil` de hoje (backup do `launcher_profiles.json` e só com o launcher fechado).
4. **Tirar os bloqueios** marcados "shortcut: remover na fase F1" (7 pontos), o `forgeAntigo` de
   `src/shared/versoes.ts` e o shortcut de `forge.ts:12`; a lista de versões do Forge passa a começar
   no 1.7.10.
5. **Aviso**, em pt-BR e en-US: "Esta versão usa Java 8, que o HubSquare baixa sozinho.", na escolha
   de versão (assistente e nova instalação) e no Jogar das instalações de Forge antigo.
6. **Testes**: node:test da regra (nome com e sem sufixo, leitura do perfil, bibliotecas sem `.sha1`
   pelo `checksums`, Java por versão) e um e2e com instalador e bibliotecas falsos no servidor
   simulado (cliente e servidor 1.7.10).
7. **Terminal** (`scripts/repro-modpack/`, com `HUBSQUARE_DADOS` em `.teste/`): servidor da Naruto
   Storm Online até o "Done" no log, e o cliente com a pasta da versão e o perfil gerados.
8. **Documentos**: PROJETO.md (versões suportadas), DESIGN.md, `testar-quando-voltar.md` e CHANGELOG.

## 3. Pontos para aprovar

- **Abaixo do 1.7.10** (1.6.4, 1.5.2…): instaladores ainda mais antigos e sem garantia de caminho
  confiável. Proposta: continuam fora da lista, recusados com uma mensagem própria.
- **EULA no teste pelo terminal:** para ver o "Done", o servidor de teste em `.teste/` precisa do
  `eula=true`. Proposta: o script grava o `eula.txt` só nessa pasta de teste, como pedido de quem
  roda o script; o app continua nunca aceitando sozinho.
