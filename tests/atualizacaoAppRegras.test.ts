import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ESTADO_INICIAL,
  INTERVALO,
  aplicarResposta,
  avisoParaMostrar,
  compararSemver,
  deveVerificar,
  lembrarDepois,
  lerEstado,
  pularVersao,
  releaseDoGitHub,
  type EstadoAviso
} from '../src/main/atualizacaoAppRegras.ts'

const REPO = 'dono/hubsquare'
const AGORA = 1_800_000_000_000
const json = (tag: string, extra: Record<string, unknown> = {}): unknown => ({
  tag_name: tag,
  html_url: `https://github.com/${REPO}/releases/tag/${tag}`,
  body: '## Novidades\n- coisa nova',
  draft: false,
  prerelease: false,
  ...extra
})
const comRelease = (tag: string): EstadoAviso =>
  aplicarResposta(ESTADO_INICIAL, { status: 200, etag: '"abc"', json: json(tag) }, REPO, AGORA)

test('semver: igual, maior, menor e pré-lançamento', () => {
  assert.equal(compararSemver('1.2.0', 'v1.2.0'), 0)
  assert.ok(compararSemver('1.10.0', '1.9.9') > 0)
  assert.ok(compararSemver('1.0.9', '1.1.0') < 0)
  assert.ok(compararSemver('1.2.0-beta.1', '1.2.0') < 0)
  assert.ok(compararSemver('1.2.0-beta.2', '1.2.0-beta.10') < 0)
  assert.ok(compararSemver('1.2.0-alpha', '1.2.0-beta') < 0)
  assert.equal(compararSemver('lixo', '1.0.0'), 0)
})

test('versão igual: sem aviso', () => {
  assert.equal(avisoParaMostrar('1.1.0', comRelease('v1.1.0'), AGORA), null)
})

test('versão maior: aviso com versão, página e novidades', () => {
  const r = avisoParaMostrar('1.1.0', comRelease('v1.2.0'), AGORA)
  assert.deepEqual(r, {
    versao: '1.2.0',
    url: `https://github.com/${REPO}/releases/tag/v1.2.0`,
    notas: '## Novidades\n- coisa nova'
  })
})

test('versão menor (app mais novo que o release): sem aviso', () => {
  assert.equal(avisoParaMostrar('1.3.0', comRelease('v1.2.0'), AGORA), null)
})

test('pré-lançamento: não avisa de beta; quem está na beta recebe a final', () => {
  const beta = aplicarResposta(
    ESTADO_INICIAL,
    { status: 200, etag: null, json: json('v2.0.0-beta.1', { prerelease: true }) },
    REPO,
    AGORA
  )
  assert.equal(avisoParaMostrar('1.1.0', beta, AGORA), null)
  assert.equal(avisoParaMostrar('1.2.0', comRelease('v1.2.0-rc.1'), AGORA), null)
  assert.equal(avisoParaMostrar('1.2.0-beta.1', comRelease('v1.2.0'), AGORA)?.versao, '1.2.0')
})

test('versão pulada some; a próxima volta a avisar', () => {
  const pulou = pularVersao(comRelease('v1.2.0'))
  assert.equal(avisoParaMostrar('1.1.0', pulou, AGORA), null)
  const nova = aplicarResposta(
    pulou,
    { status: 200, etag: null, json: json('v1.3.0') },
    REPO,
    AGORA
  )
  assert.equal(avisoParaMostrar('1.1.0', nova, AGORA)?.versao, '1.3.0')
})

test('lembrar depois: some por um dia', () => {
  const depois = lembrarDepois(comRelease('v1.2.0'), AGORA)
  assert.equal(avisoParaMostrar('1.1.0', depois, AGORA + 60_000), null)
  assert.equal(avisoParaMostrar('1.1.0', depois, AGORA + 25 * 3600_000)?.versao, '1.2.0')
})

test('falha de rede: nada muda e nada é mostrado de novo', () => {
  const antes = comRelease('v1.1.0')
  assert.equal(aplicarResposta(antes, null, REPO, AGORA + 1), antes)
  assert.equal(aplicarResposta(ESTADO_INICIAL, null, REPO, AGORA).verificadoEm, 0)
  assert.equal(
    avisoParaMostrar('1.1.0', aplicarResposta(ESTADO_INICIAL, null, REPO, AGORA), AGORA),
    null
  )
})

test('304, limite do GitHub e repositório sem release', () => {
  const e = comRelease('v1.2.0')
  const naoMudou = aplicarResposta(e, { status: 304, etag: null, json: null }, REPO, AGORA + 10)
  assert.equal(naoMudou.release?.versao, '1.2.0')
  assert.equal(naoMudou.etag, '"abc"')
  assert.equal(naoMudou.verificadoEm, AGORA + 10)
  const limite = aplicarResposta(e, { status: 403, etag: null, json: {} }, REPO, AGORA + 20)
  assert.equal(limite.release?.versao, '1.2.0')
  assert.equal(limite.verificadoEm, AGORA + 20)
  assert.equal(aplicarResposta(e, { status: 404, etag: null, json: {} }, REPO, AGORA).release, null)
})

test('intervalo de 6 h e opção desligada', () => {
  const e = { ...ESTADO_INICIAL, verificadoEm: AGORA }
  assert.equal(deveVerificar(ESTADO_INICIAL, AGORA), true)
  assert.equal(deveVerificar(e, AGORA + INTERVALO - 1), false)
  assert.equal(deveVerificar(e, AGORA + INTERVALO), true)
  assert.equal(deveVerificar(e, AGORA - 1000), true) // relógio voltou
  assert.equal(deveVerificar({ ...e, ligado: false }, AGORA + INTERVALO), false)
  assert.equal(avisoParaMostrar('1.1.0', { ...comRelease('v1.2.0'), ligado: false }, AGORA), null)
})

test('release de outro lugar ou estranho é ignorado', () => {
  assert.equal(releaseDoGitHub(json('v1.2.0', { html_url: 'https://evil.com/x' }), REPO), null)
  assert.equal(
    releaseDoGitHub(
      json('v1.2.0', { html_url: 'https://github.com/outro/repo/releases/tag/v1' }),
      REPO
    ),
    null
  )
  assert.equal(releaseDoGitHub(json('nova-versao'), REPO), null)
  assert.equal(releaseDoGitHub(json('v1.2.0', { draft: true }), REPO), null)
  assert.equal(releaseDoGitHub(null, REPO), null)
})

test('arquivo guardado estranho volta ao padrão', () => {
  assert.deepEqual(lerEstado(null), ESTADO_INICIAL)
  assert.deepEqual(lerEstado({ ligado: 'sim', release: { versao: 1 } }), ESTADO_INICIAL)
  assert.equal(lerEstado({ ligado: false }).ligado, false)
})
