import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BLOQUEIO,
  VALIDADE_SESSAO,
  acharSessao,
  criarHashPin,
  corSegura,
  ehIpTailscale,
  textoSobre,
  hostPermitido,
  lerCookie,
  nomeDoAparelho,
  novaSessao,
  origemPermitida,
  pinValido,
  tentarLogin,
  type Tentativas
} from '../src/main/celularRegras'

const salvo = criarHashPin('123456')

test('o PIN fica só como hash', () => {
  assert.ok(!JSON.stringify(salvo).includes('123456'))
  assert.notEqual(criarHashPin('123456').salt, salvo.salt) // salt diferente a cada vez
  assert.equal(pinValido('12345'), false)
  assert.equal(pinValido('123456789'), false)
  assert.equal(pinValido('12a456'), false)
  assert.equal(pinValido('12345678'), true)
})

test('PIN certo entra', () => {
  const t: Tentativas = { falhas: 0, bloqueadoAte: null }
  assert.deepEqual(tentarLogin('123456', salvo, t, 0), { ok: true })
})

test('PIN errado diz quantas tentativas sobram', () => {
  const t: Tentativas = { falhas: 0, bloqueadoAte: null }
  assert.deepEqual(tentarLogin('654321', salvo, t, 0), {
    ok: false,
    motivo: 'errado',
    restantes: 4
  })
  assert.deepEqual(tentarLogin('abc', salvo, t, 0), { ok: false, motivo: 'errado', restantes: 3 })
  // acertar zera a contagem
  assert.deepEqual(tentarLogin('123456', salvo, t, 0), { ok: true })
  assert.equal(t.falhas, 0)
})

test('5 PINs errados bloqueiam por 15 minutos, até para o PIN certo', () => {
  const t: Tentativas = { falhas: 0, bloqueadoAte: null }
  for (let i = 0; i < 4; i++) assert.equal(tentarLogin('000000', salvo, t, 1000).ok, false)
  const quinta = tentarLogin('000000', salvo, t, 1000)
  assert.deepEqual(quinta, { ok: false, motivo: 'bloqueado', ate: 1000 + BLOQUEIO })
  assert.deepEqual(tentarLogin('123456', salvo, t, 1000 + BLOQUEIO - 1), {
    ok: false,
    motivo: 'bloqueado',
    ate: 1000 + BLOQUEIO
  })
  // depois dos 15 min, volta a aceitar
  assert.deepEqual(tentarLogin('123456', salvo, t, 1000 + BLOQUEIO), { ok: true })
})

test('sem PIN criado, ninguém entra', () => {
  assert.deepEqual(tentarLogin('123456', null, { falhas: 0, bloqueadoAte: null }, 0), {
    ok: false,
    motivo: 'sem-pin'
  })
})

test('sessão por token, que expira em 7 dias', () => {
  const { token, sessao } = novaSessao('Android · Chrome', 0)
  assert.ok(!JSON.stringify(sessao).includes(token)) // só o hash fica salvo
  assert.equal(acharSessao([sessao], token, VALIDADE_SESSAO - 1)?.id, sessao.id)
  assert.equal(acharSessao([sessao], token, VALIDADE_SESSAO), null)
  assert.equal(acharSessao([sessao], 'outro', 0), null)
  assert.equal(acharSessao([sessao], null, 0), null)
  assert.equal(lerCookie(`a=1; ss_sessao=${token}; b=2`, 'ss_sessao'), token)
})

test('endereços, Host e Origem', () => {
  assert.equal(ehIpTailscale('100.101.102.103'), true)
  assert.equal(ehIpTailscale('100.63.0.1'), false)
  assert.equal(ehIpTailscale('192.168.0.10'), false)
  const ips = ['192.168.0.10', '26.1.2.3']
  assert.equal(hostPermitido('192.168.0.10:8787', ips, 8787), true)
  assert.equal(hostPermitido('evil.example:8787', ips, 8787), false)
  assert.equal(hostPermitido('192.168.0.10:8788', ips, 8787), false)
  assert.equal(hostPermitido(undefined, ips, 8787), false)
  assert.equal(origemPermitida('http://192.168.0.10:8787', '192.168.0.10:8787'), true)
  assert.equal(origemPermitida('http://evil.example', '192.168.0.10:8787'), false)
  assert.equal(origemPermitida(undefined, '192.168.0.10:8787'), true)
  assert.equal(
    nomeDoAparelho('Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36'),
    'Android · Chrome'
  )
  assert.equal(
    nomeDoAparelho('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Mobile Safari/604.1'),
    'iPhone · Safari'
  )
})

test('cor de destaque segura para o CSS', () => {
  assert.equal(corSegura('#2f6fd6'), '#2f6fd6')
  assert.equal(corSegura('red;}body{display:none'), '#3c8527')
  assert.equal(textoSobre('#ffffff'), '#1b1b1b')
  assert.equal(textoSobre('#3c8527'), '#ffffff')
})
