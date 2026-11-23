# CI: testes de convite (dono e amigo) só rodam no PC

**Decisão do dono (nov/2026):** os 7 testes que abrem o dono e o amigo como duas instâncias ficam fora do CI do GitHub (`soNoPc()` em `tests/e2e/apoio.ts`, pela variável `GITHUB_ACTIONS`). No PC, `npm run test:e2e` roda todos eles.

Testes:

- `diagnostico.e2e.ts`: "diagnóstico do amigo: servidor do dono desligado" e "...instalação desatualizada, depois nick não aprovado, depois tudo certo"
- `fluxos.e2e.ts`: "convite: o dono convida e o amigo, em outra instância, entra"
- `passar.e2e.ts`: "passar o servidor: sem segredos, outro PC hospeda..." e "passar o servidor leva o fundo..."
- `pedidos.e2e.ts`: "pedido: o amigo pede ao aceitar o convite..." e "pedido: nick que não existe..."

## O que se sabe (runner windows-latest)

- Sintoma: ao aceitar o convite, o app do amigo não recebe a resposta do manifesto. O `erros.log` do amigo diz `falar com o servidor do convite em 10.1.0.x:<porta> (parou ao conectar, ~5 s): The operation was aborted due to timeout`.
- **Não é** Firewall nem o adaptador: o runner tem `Ethernet 3` (10.1.0.x, o IP anunciado), `Ethernet 4` (Azure, mesmo IP) e `vEthernet (nat)` (ignorado pelo app). O Electron escuta e conecta no IP de rede com e sem regra do Firewall.
- **Não é** o dono parado: o processo do teste pede o manifesto ao dono e recebe HTTP 200 em milissegundos.
- **Não é** o processo do amigo sem rede: pelo `app.evaluate`, o processo principal do amigo abre socket e faz `fetch` do mesmo manifesto (HTTP 200 em ~14 ms). Mesmo assim, o pedido do próprio fluxo de aceitar o convite, logo depois, esgota o tempo.
- **Não resolveu:** subir o prazo do manifesto de 5 s para 15 s; abrir dono e amigo sem o fundo animado; manter as janelas cobertas renderizando (isso resolveu outro problema: o clique que travava).
- Ainda aberto: por que o pedido feito dentro do fluxo do app esgota o tempo quando o mesmo pedido feito pelo `evaluate` responde. Próximo passo, se alguém retomar: acesso ao runner (tmate) e log do lado do dono (o pedido chega?).

## Como voltar a rodar no CI

Tirar a linha `soNoPc()` dos testes acima (ou fazer `soNoPc` não pular) e enviar a branch para o CI.
