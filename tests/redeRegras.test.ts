import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classificarFalha, linhaDoLog, portaDe, portaValida } from '../src/shared/redeRegras'

test('cada classe de falha de download', () => {
  assert.equal(classificarFalha(404), 'naoExiste')
  assert.equal(classificarFalha(410), 'naoExiste')
  assert.equal(classificarFalha(401), 'recusado')
  assert.equal(classificarFalha(403), 'recusado')
  assert.equal(classificarFalha(400), 'recusado')
  assert.equal(classificarFalha(429), 'siteComProblema')
  assert.equal(classificarFalha(500), 'siteComProblema')
  assert.equal(classificarFalha(503), 'siteComProblema')
  assert.equal(classificarFalha(null), 'semConexao')
})

test('linha do log: só host, status e item (sem caminho, busca nem token)', () => {
  const linha = linhaDoLog(
    'http://26.1.2.3:8788/convite/abcdef0123456789/manifesto.json?chave=segredo',
    403,
    'convite'
  )
  assert.equal(linha, 'Download: 26.1.2.3:8788 · HTTP 403 · convite')
  assert.equal(
    linhaDoLog(
      'https://maven.minecraftforge.net/x/C:/Users/Ana/y',
      null,
      'cliente do Forge 1.7.10'
    ),
    'Download: maven.minecraftforge.net · HTTP sem resposta · cliente do Forge 1.7.10'
  )
  assert.equal(linhaDoLog('não é url', 404, 'Java 21'), 'Download: ? · HTTP 404 · Java 21')
})

test('porta do server.properties: ausente, inválida e 25570', () => {
  assert.equal(portaDe(undefined), 25565)
  assert.equal(portaDe(''), 25565)
  assert.equal(portaDe('abc'), 25565)
  assert.equal(portaDe('70000'), 25565)
  assert.equal(portaDe('0'), 25565)
  assert.equal(portaDe('25565.5'), 25565)
  assert.equal(portaDe('25570'), 25570)
  assert.equal(portaDe(' 25570 '), 25570)
  assert.equal(portaValida(25570), true)
  assert.equal(portaValida(65536), false)
  assert.equal(portaValida('25570'), false)
})
