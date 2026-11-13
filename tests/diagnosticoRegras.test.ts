import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FRASE_PULADA,
  limparParaCopiar,
  primeiroProblema,
  rodarChecagens,
  textoParaCopiar,
  type Checagem
} from '../src/shared/diagnosticoRegras.ts'

// Diagnóstico de conexão (Fase M5): ordem, pulo depois de uma essencial e o texto copiado.

const ok = (id: string, essencial = true): Checagem => ({
  id,
  nome: id,
  essencial,
  rodar: async () => ({ resultado: 'ok', frase: `${id} certo` })
})
const falha = (id: string, essencial = true): Checagem => ({
  id,
  nome: id,
  essencial,
  rodar: async () => ({ resultado: 'falhou', frase: `${id} quebrado`, conserto: 'ligarServidor' })
})

test('tudo certo: todas rodam, em ordem, sem problema', async () => {
  const linhas = await rodarChecagens([ok('a'), ok('b'), ok('c')])
  assert.deepEqual(
    linhas.map((l) => [l.id, l.resultado]),
    [
      ['a', 'ok'],
      ['b', 'ok'],
      ['c', 'ok']
    ]
  )
  assert.equal(primeiroProblema(linhas), null)
})

test('essencial falhou: as seguintes são puladas e o conserto aparece', async () => {
  let rodouDepois = false
  const depois: Checagem = {
    ...ok('c'),
    rodar: async () => {
      rodouDepois = true
      return { resultado: 'ok', frase: '' }
    }
  }
  const linhas = await rodarChecagens([ok('a'), falha('b'), depois])
  assert.deepEqual(
    linhas.map((l) => l.resultado),
    ['ok', 'falhou', 'pulada']
  )
  assert.equal(rodouDepois, false)
  assert.equal(linhas[2].frase, FRASE_PULADA)
  assert.equal(primeiroProblema(linhas)?.id, 'b')
  assert.equal(primeiroProblema(linhas)?.conserto, 'ligarServidor')
})

test('não essencial falhou ou deu aviso: as seguintes continuam', async () => {
  const aviso: Checagem = {
    ...ok('b'),
    rodar: async () => ({ resultado: 'aviso', frase: 'cuidado' })
  }
  const linhas = await rodarChecagens([falha('a', false), aviso, ok('c')])
  assert.deepEqual(
    linhas.map((l) => l.resultado),
    ['falhou', 'aviso', 'ok']
  )
})

test('erro inesperado numa checagem vira "falhou" com frase clara', async () => {
  const quebra: Checagem = {
    ...ok('a'),
    rodar: async () => {
      throw new Error('ECONNRESET 10.0.0.5')
    }
  }
  const linhas = await rodarChecagens([quebra, ok('b')])
  assert.equal(linhas[0].resultado, 'falhou')
  assert.match(linhas[0].frase, /Não deu para conferir/)
  assert.equal(linhas[1].resultado, 'pulada')
})

test('texto copiado: sem token do convite e sem IP público completo', () => {
  const t = limparParaCopiar(
    'Convite 26.12.34.56:8788#K7QF-M2XA-9TBC-H4PZ, token K7QFM2XA9TBCH4PZ, IP 187.45.120.33, casa 192.168.0.10, tailscale 100.101.2.3'
  )
  assert.doesNotMatch(t, /K7QF/)
  assert.doesNotMatch(t, /187\.45\.120\.33/)
  assert.match(t, /187\.45\.•••\.•••/)
  assert.match(t, /26\.12\.34\.56:8788/) // Radmin: o amigo já conhece
  assert.match(t, /192\.168\.0\.10/)
  assert.match(t, /100\.101\.2\.3/)
  assert.match(limparParaCopiar('palavrasnormaissemnumero'), /palavrasnormaissemnumero/)
})

test('texto copiado começa pelo problema e lista as checagens', async () => {
  const linhas = await rodarChecagens([ok('Internet'), falha('Servidor'), ok('Mods')])
  const t = textoParaCopiar('Não consigo entrar em Servidor X', linhas)
  assert.match(t.split('\n')[1], /^Problema: Servidor\. Servidor quebrado/)
  assert.match(t, /✓ Internet: Internet certo/)
  assert.match(t, /– Mods:/)
})
