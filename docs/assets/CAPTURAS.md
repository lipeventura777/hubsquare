# Capturas e GIFs do README

As imagens que o README.md (português) e o README.en.md (inglês) usam ficam nesta pasta (`docs/assets/`). Todas já estão prontas. Para trocar uma, salve a nova com o mesmo nome e rode `node docs/ferramentas/verificar-links.mjs`: se alguma listada aqui sumir, ele mostra como **pendente**.

## Como tirar de novo

- Janela do app **maximizada** num monitor de 1920 × 1080, com "Reduzir animações" e "Vidro leve" desligados.
- Idioma do app: pt-BR para os arquivos `pt-*` e en-US para os `en-*` (engrenagem › Idioma / Language), com a mesma cena nas duas línguas.
- **Nunca ligue o servidor para as capturas:** ligado, o app mostra o seu IP em vários lugares.
- Use um servidor de exemplo com nome neutro ("Servidor da Turma" / "Friends Server"). Cubra o código, o link e os endereços na tela Convites. Nada de caminho com o seu usuário do Windows, IP ou nicks reais.
- GIF: até uns 8 MB (o GitHub mostra GIF de até 10 MB). Para reduzir um GIF com o ffmpeg: `fps=10,scale=1280:-1` com `palettegen` e `paletteuse`.

## Lista

| Arquivo | Tela | Fundo |
| --- | --- | --- |
| `docs/assets/pt-demo.gif` | Assistente de novo servidor até a tela Jogar, sem ligar o servidor | — |
| `docs/assets/en-demo.gif` | A mesma sequência, em inglês | — |
| `docs/assets/pt-painel.png` | ServSquare › Painel com o servidor desligado | Dia |
| `docs/assets/en-painel.png` | O mesmo, em inglês | Dia |
| `docs/assets/pt-jogar.png` | PlaySquare › Jogar, "Servidor desligado" | Dia |
| `docs/assets/en-jogar.png` | O mesmo, em inglês | Dia |
| `docs/assets/pt-mods.png` | ServSquare › Mods › Explorar | Noite |
| `docs/assets/en-mods.png` | O mesmo, em inglês | Noite |
| `docs/assets/pt-convites.png` | ServSquare › Conexão › Convites, com o código, o link e os endereços cobertos | Aurora Nevada |
| `docs/assets/en-convites.png` | O mesmo, em inglês | Aurora Nevada |

## Outros arquivos desta pasta

- `logo.svg`: cópia da logo completa (`build/logo/hubsquare-logo.svg`), usada no topo dos READMEs.
- `social-preview.svg` e `social-preview.png`: prévia social de 1280 × 640 (como subir no GitHub: [docs/CONFIGURAR-GITHUB.md](../CONFIGURAR-GITHUB.md)).
- `docs/marca/wordmark-claro.png` e `docs/marca/wordmark-escuro.png`: o nome HubSquare para tema claro e escuro do GitHub.
