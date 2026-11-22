# Como prosseguir: vitrine do repositório

As capturas, os GIFs e o texto da release já estão prontos. Falta só o que se faz na página do GitHub e algumas decisões. Marque cada caixa quando terminar. Os textos para copiar estão em [docs/CONFIGURAR-GITHUB.md](../CONFIGURAR-GITHUB.md).

## 1. Conferir a página pública (2 minutos)

Abra https://github.com/lipeventura777/hubsquare e confira:

- [ ] O README aparece em português, com a logo e o nome HubSquare. Troque o tema do GitHub (avatar › Settings › Appearance) e veja se a logo e o nome aparecem nos dois, claro e escuro.
- [ ] O GIF anda, as 4 capturas aparecem e o botão **Baixar para Windows** leva à última versão.
- [ ] O link **English** no topo abre o `README.en.md`, e lá o **Português (Brasil)** volta.
- [ ] As perguntas frequentes abrem e fecham.

## 2. Seção About (descrição, site e topics)

- [ ] Na página do repositório, clique na engrenagem ao lado de **About** (coluna da direita).
- [ ] Cole a **Description** e o **Website** de [CONFIGURAR-GITHUB.md](../CONFIGURAR-GITHUB.md#1-seção-about-descrição-site-e-topics).
- [ ] Cole os **Topics** (separados por espaço) e salve com **Save changes**.

## 3. Prévia social

- [ ] Settings › General › **Social preview** › Edit › Upload an image › escolha `docs/assets/social-preview.png` (1280 × 640, já pronta). Ela aparece quando alguém compartilha o link do repositório.

## 4. Etiquetas e segurança

- [ ] Issues › Labels › **New label**: crie `modpack`, `security`, `i18n` e `ignore-for-release` (os modelos de issue e as notas de versão usam essas etiquetas).
- [ ] Settings › Code security › **Private vulnerability reporting** ligado (o SECURITY.md manda as pessoas para lá).
- [ ] Settings › Branches › regra para `main` exigindo o workflow **CI** antes de juntar pull requests.

## 5. Decisões que só você toma

- [ ] **E-mail de suporte.** O botão "Relatar problema" do app usa `suporte.hubsquare@gmail.com`. Se esse e-mail ainda não existe, crie a conta (ou me peça para mudar o botão numa fase de código).
- [ ] **Doações.** Quando escolher a plataforma, descomente a linha dela em [.github/FUNDING.yml](../../.github/FUNDING.yml), troque pelo seu usuário e ligue Settings › General › Features › **Sponsorships**.
- [ ] **CurseForge.** Quando a chave oficial chegar, crie o segredo `CURSEFORGE_API_KEY` em Settings › Secrets and variables › Actions. Até lá, ele continua "em breve".
- [ ] **Assinatura.** Depois do repositório público e do build automático, peça a assinatura à SignPath Foundation (veja [CODE_SIGNING_POLICY.md](../../CODE_SIGNING_POLICY.md)) e só então troque o status "planejado, ainda não enviado".

## 6. Nas próximas versões

- [ ] Depois de gerar o `.exe`, envie em [virustotal.com](https://www.virustotal.com) e copie o link da análise (`https://www.virustotal.com/gui/file/<sha256>`).
- [ ] Na nota da release, use o [RELEASE_TEMPLATE.md](../RELEASE_TEMPLATE.md) com o SHA-256 e esse link.

## 7. Limpeza opcional

- [ ] `docs/assets/Sem título.png` é um print avulso que não é usado em lugar nenhum. Pode apagar.

Outros testes que dependem de tela estão em [testar-quando-voltar.md](testar-quando-voltar.md).
