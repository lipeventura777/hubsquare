import { createServer } from 'node:net'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { area, criarPeloAssistente, expect, pagina, pastaServidor, test } from './apoio'

// Fase E3: a porta do servidor vinda do server.properties (Opções, Conexão e o aviso de porta em
// uso ao ligar). Fase F1: o Forge é suportado do 1.7.10 em diante (tests/e2e/forgeAntigo.e2e.ts);
// abaixo dele, o JOGAR continua recusando sem baixar nada.

const FORGE_ANTIGO = 'Forge Muito Antigo'

test('JOGAR numa instalação Forge 1.6.4 mostra a mensagem e não baixa nada', async ({ abrir }) => {
  const a = await abrir('app', (p) => {
    const dados = join(p, 'appData', 'HubSquare')
    writeFileSync(join(dados, 'modo-app.json'), JSON.stringify({ modo: 'amigo' }))
    writeFileSync(
      join(dados, 'instalacoes.json'),
      JSON.stringify({
        ignorados: [],
        instalacoes: [
          {
            id: 'f'.repeat(32),
            nome: FORGE_ANTIGO,
            pasta: join(p, 'documents', 'HubSquare', 'jogo', FORGE_ANTIGO),
            versao: '1.6.4',
            loader: 'forge',
            versaoLoader: '9.11.1.1345',
            ram: 4,
            origem: { tipo: 'zero' },
            criada: '2026-11-20',
            ultimoUso: null,
            arquivoImagem: null,
            fundo: null
          }
        ]
      })
    )
  })
  const j = a.janela
  await pagina(j, 'Jogar')
  await j.getByRole('button', { name: /^(JOGAR|ATUALIZAR E JOGAR)$/ }).click()
  // O painel de erro mostra a primeira frase como título e a segunda como o que fazer.
  await expect(
    j.getByText('O Forge antes da 1.7.10 não é suportado.', { exact: true })
  ).toBeVisible()
  await expect(
    j.getByText('Escolha a 1.7.10 ou uma versão mais nova.', { exact: true })
  ).toBeVisible()
  // A instalação continua lá (nada apagado). Nenhum pedido à internet: o simulado conferiria.
  const indice = JSON.parse(
    readFileSync(join(a.pasta, 'appData', 'HubSquare', 'instalacoes.json'), 'utf8')
  )
  expect(indice.instalacoes).toHaveLength(1)
})

test('porta 25570 nas Opções vale na Conexão; porta ocupada avisa ao ligar', async ({ abrir }) => {
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Porta')
  await area(j, 'ServSquare')
  await pagina(j, 'Opções')
  await j.getByLabel(/Porta do servidor/).fill('25570')
  await j.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(j.getByText('Configurações salvas.')).toBeVisible()
  const props = readFileSync(join(pastaServidor(a.pasta, 'Servidor Porta'), 'server.properties'))
  expect(props.toString('utf8')).toMatch(/^server-port=25570$/m)

  await pagina(j, 'Conexão')
  await expect(j.getByText('25570').first()).toBeVisible()

  // Outro programa na 25570: ligar avisa antes, com o caminho para as Opções.
  const ocupante = createServer()
  await new Promise<void>((r) => ocupante.listen(25570, r))
  try {
    await pagina(j, 'Painel')
    await j.getByRole('button', { name: 'Ligar', exact: true }).click()
    await expect(
      j.getByText('A porta 25570 já está em uso por outro programa.', { exact: true })
    ).toBeVisible()
    await j.getByRole('button', { name: 'Trocar a porta nas Opções' }).click()
    await expect(j.getByLabel(/Porta do servidor/)).toHaveValue('25570')
  } finally {
    await new Promise<void>((r) => ocupante.close(() => r()))
  }
})
