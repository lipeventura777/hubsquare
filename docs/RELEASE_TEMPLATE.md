# Modelo de nota de versão

Copie o bloco abaixo no texto da release do GitHub e troque o que está entre `< >`. As novidades e correções saem da seção da versão no [CHANGELOG.md](../CHANGELOG.md) (o botão "Generate release notes" do GitHub agrupa os pull requests pelas etiquetas de [.github/release.yml](../.github/release.yml)). Como lançar uma versão: [como-lancar-versao.md](como-lancar-versao.md).

Antes de publicar:

1. Confira o SHA-256 do instalador (o `SHA256SUMS.txt` sai do `npm run dist`, em `release/`).
2. Envie o `.exe` em [virustotal.com](https://www.virustotal.com) e copie o link da análise (`https://www.virustotal.com/gui/file/<sha256>`).
3. Não escreva que o instalador é assinado enquanto o [CODE_SIGNING_POLICY.md](../CODE_SIGNING_POLICY.md) disser "planejado, ainda não enviado".

~~~~markdown
## Novidades / What's new

- <O que tem de novo, em uma linha, do ponto de vista de quem usa.>

## Correções / Fixes

- <O que foi corrigido.>

## Como instalar / How to install

1. Baixe o `HubSquare-Setup-<versão>.exe` em **Assets**. / Download `HubSquare-Setup-<version>.exe` under **Assets**.
2. Abra o instalador, escolha o idioma e a pasta e clique em **Instalar**. / Run the installer, choose the language and the folder, and click **Install**.
3. Quem já tem o HubSquare recebe esta versão pelo próprio app. / If you already have HubSquare, the app updates itself.

## Conferir o arquivo / Check the file

| Arquivo / File | SHA-256 |
| --- | --- |
| `HubSquare-Setup-<versão>.exe` | `<sha256>` |

```powershell
Get-FileHash .\HubSquare-Setup-<versão>.exe -Algorithm SHA256
```

VirusTotal: <link da análise / scan link>

O instalador ainda não tem assinatura digital. / The installer is not digitally signed yet.
~~~~
