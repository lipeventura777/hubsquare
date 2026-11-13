# Pendência: aviso de atualização do app (Fase P6, item 4)

**Situação:** feito na Fase M2. Como o repositório `lipeventura777/hubsquare` passa a ser público,
o app lê direto dele (`releases/latest`, sem chave), em vez do repositório separado só de releases
que estava planejado aqui.

- Lógica: `src/main/atualizacaoAppRegras.ts` (testes em `tests/atualizacaoAppRegras.test.ts`).
- Busca e cache: `src/main/atualizacaoApp.ts` → `atualizacao-app.json` na pasta de dados.
- Aviso: `src/renderer/src/componentes/AvisoVersaoApp.tsx`; opção em Opções › Gerais e em
  PlaySquare › Ajustes do jogo.
- Como lançar: `docs/como-lancar-versao.md`.

Falta só ver o aviso na tela quando sair o primeiro release público (`testar-quando-voltar.md`).
