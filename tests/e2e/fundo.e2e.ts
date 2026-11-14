import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkdirSync as mk } from 'node:fs'
import { area, criarPeloAssistente, expect, pagina, test } from './apoio'
import { MC } from './simulado'

// Fase V4: fundos personalizáveis.

// PNG de 1×1 de verdade (bytes do formato, não só a extensão).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)
const HASH_PNG = /^[0-9a-f]{64}\.png$/
const lerJson = (f: string): Record<string, unknown> => JSON.parse(readFileSync(f, 'utf8'))

test('fundo: escolher uma imagem para a instalação troca o banner na hora e continua depois', async ({
  abrir
}) => {
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Fundo', MC)
  await area(j, 'PlaySquare')
  await pagina(j, 'Jogar')
  const banner = j.getByRole('region', { name: /^Instalação Servidor Fundo/ })
  await expect(banner).toBeVisible()
  await expect(banner.locator('img[data-fundo]')).toHaveCount(0)

  const imagem = join(a.pasta, 'minha-imagem.png')
  writeFileSync(imagem, PNG)
  await a.escolherArquivo(imagem)
  await j.getByRole('button', { name: 'Trocar o fundo' }).click()
  const painel = j.getByRole('dialog', { name: 'Trocar o fundo' })
  await painel.getByRole('radio', { name: 'Imagem' }).click()
  await painel.getByRole('button', { name: 'Escolher uma imagem…' }).click()

  // Na hora, pelo protocolo do app (nunca file://).
  const img = banner.locator('img[data-fundo]')
  await expect(img).toHaveCount(1, { timeout: 10_000 })
  await expect(img).toHaveAttribute('src', /^hubsquare-fundo:\/\/img\/[0-9a-f]{64}\.png$/)
  await expect.poll(() => img.evaluate((e) => (e as HTMLImageElement).naturalWidth)).toBe(1)

  // A cópia pelo hash na pasta de fundos; a original pode sumir.
  const fundos = join(a.pasta, 'appData', 'ServSquare', 'fundos')
  const guardadas = readdirSync(fundos).filter((n) => HASH_PNG.test(n))
  expect(guardadas).toHaveLength(1)
  const indice = lerJson(join(a.pasta, 'appData', 'ServSquare', 'instalacoes.json'))
  const inst = (
    indice.instalacoes as { nome: string; fundo: { tipo: string; imagem: string } }[]
  ).find((i) => i.nome === 'Servidor Fundo')!
  expect(inst.fundo).toMatchObject({ tipo: 'imagem', imagem: guardadas[0] })

  // Mexer nos ajustes aparece na hora (prévia) e fica salvo.
  await painel.getByText('Mostrar a imagem inteira').click()
  await expect(img).toHaveCSS('object-fit', 'contain')

  // A mesma imagem de novo não duplica.
  await painel.getByRole('button', { name: 'Escolher outra imagem…' }).click()
  await expect.poll(() => readdirSync(fundos).filter((n) => HASH_PNG.test(n)).length).toBe(1)

  // Depois de recarregar a tela, a imagem continua.
  await j.reload()
  await area(j, 'PlaySquare')
  await pagina(j, 'Jogar')
  await expect(
    j.getByRole('region', { name: /^Instalação Servidor Fundo/ }).locator('img[data-fundo]')
  ).toHaveCount(1)
})

test('fundo: arquivo que não é imagem é recusado com mensagem', async ({ abrir }) => {
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Recusa', MC)
  await area(j, 'PlaySquare')
  await pagina(j, 'Jogar')
  const falso = join(a.pasta, 'nao-sou-imagem.png')
  writeFileSync(falso, 'MZ isto é um programa, não uma imagem')
  await a.escolherArquivo(falso)
  await j.getByRole('button', { name: 'Trocar o fundo' }).click()
  const painel = j.getByRole('dialog', { name: 'Trocar o fundo' })
  await painel.getByRole('radio', { name: 'Imagem' }).click()
  await painel.getByRole('button', { name: 'Escolher uma imagem…' }).click()
  await expect(
    painel.getByText('Esse arquivo não é uma imagem PNG, JPG ou WEBP').first()
  ).toBeVisible()
  expect(existsSync(join(a.pasta, 'appData', 'ServSquare', 'fundos'))).toBe(false)
})

test('fundo: migração dos fundos antigos (imagem que existe vale, a que sumiu avisa)', async ({
  abrir
}) => {
  const a = await abrir('app', (p) => {
    const dados = join(p, 'appData', 'ServSquare')
    const jogo = join(p, 'documents', 'ServSquare', 'jogo')
    mkdirSync(join(dados, 'fundos'), { recursive: true })
    mk(join(jogo, 'Com Imagem'), { recursive: true })
    mk(join(jogo, 'Sem Arquivo'), { recursive: true })
    writeFileSync(join(jogo, 'Com Imagem', 'hubsquare-fundo.png'), PNG)
    writeFileSync(join(dados, 'fundos', 'fundo-123.png'), PNG)
    writeFileSync(join(dados, 'modo-app.json'), JSON.stringify({ modo: 'amigo' }))
    writeFileSync(
      join(dados, 'aparencia.json'),
      JSON.stringify({
        bioma: 'mar',
        fundo: 'fundo-123.png',
        fundoEmTodoApp: true,
        escurecimento: 0.5
      })
    )
    const base = {
      versao: MC,
      loader: 'vanilla',
      versaoLoader: null,
      ram: 4,
      origem: { tipo: 'zero' }
    }
    writeFileSync(
      join(dados, 'instalacoes.json'),
      JSON.stringify({
        ignorados: [],
        instalacoes: [
          {
            ...base,
            id: 'a'.repeat(32),
            nome: 'Com Imagem',
            pasta: join(jogo, 'Com Imagem'),
            arquivoFundo: 'hubsquare-fundo.png',
            criada: '2026-01-01',
            ultimoUso: null,
            arquivoImagem: null
          },
          {
            ...base,
            id: 'b'.repeat(32),
            nome: 'Sem Arquivo',
            pasta: join(jogo, 'Sem Arquivo'),
            arquivoFundo: 'hubsquare-fundo.jpg',
            criada: '2026-01-01',
            ultimoUso: null,
            arquivoImagem: null
          },
          {
            ...base,
            id: 'c'.repeat(32),
            nome: 'Com Bioma',
            pasta: join(jogo, 'Com Bioma'),
            bannerBioma: 'nether',
            criada: '2026-01-01',
            ultimoUso: null,
            arquivoImagem: null
          }
        ]
      })
    )
  })
  const j = a.janela
  await expect(j.getByText(/A imagem de fundo de Sem Arquivo não existe mais/)).toBeVisible()
  const dados = join(a.pasta, 'appData', 'ServSquare')
  const indice = lerJson(join(dados, 'instalacoes.json'))
  const [com, sem, bioma] = indice.instalacoes as { fundo: Record<string, unknown> | null }[]
  expect(com.fundo).toMatchObject({ tipo: 'imagem' })
  expect(HASH_PNG.test(com.fundo!.imagem as string)).toBe(true)
  expect(existsSync(join(dados, 'fundos', com.fundo!.imagem as string))).toBe(true)
  expect(sem.fundo).toBeNull()
  expect(bioma.fundo).toEqual({ tipo: 'bioma', bioma: 'nether' })
  // O fundo do app que valia em todas as telas virou uma imagem guardada; nada antigo foi apagado.
  const aparencia = lerJson(join(dados, 'aparencia.json'))
  expect(aparencia.fundoApp).toMatchObject({ tipo: 'imagem', ajuste: { luz: -50 } })
  expect(existsSync(join(dados, 'fundos', 'fundo-123.png'))).toBe(true)
  expect(
    existsSync(
      join(a.pasta, 'documents', 'ServSquare', 'jogo', 'Com Imagem', 'hubsquare-fundo.png')
    )
  ).toBe(true)
})
