import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  assuntoDoRelato,
  limparDescricao,
  montarMailto,
  montarUrlIssue,
  relatorioPorPadrao,
  EMAIL_SUPORTE,
  LIMITE_ISSUE,
  LIMITE_MAILTO,
  type Relato
} from '../src/main/relatarRegras'

const base: Relato = {
  tipo: 'bug',
  descricao: 'O servidor não liga depois de trocar a versão.\nAparece "Ligando…" para sempre.',
  versao: '1.5.0',
  windows: '10.0.19045 (Windows 10 Pro)',
  idioma: 'pt-BR',
  arquivo: 'HubSquare-relatorio-2026-11-20_10-30.zip'
}

const consulta = (url: string): URLSearchParams => new URLSearchParams(url.split('?')[1])

test('mailto: endereço, assunto com versão e tipo, corpo com descrição, versão, Windows e idioma', () => {
  const url = montarMailto(base)
  assert.ok(url.startsWith(`mailto:${EMAIL_SUPORTE}?subject=`))
  const q = consulta(url)
  assert.equal(
    q.get('subject'),
    '[HubSquare 1.5.0] Bug: O servidor não liga depois de trocar a versão.'
  )
  const corpo = q.get('body')!
  assert.match(corpo, /O servidor não liga/)
  assert.match(corpo, /1\.5\.0/)
  assert.match(corpo, /Windows 10 Pro/)
  assert.match(corpo, /pt-BR/)
  assert.match(corpo, /HubSquare-relatorio-2026-11-20_10-30\.zip/)
})

test('mailto: acentos e símbolos vão codificados (sem espaço, + nem & solto)', () => {
  const url = montarMailto({ ...base, descricao: 'Ação & reação: 50% + "aspas" ç ã é' })
  assert.ok(!/[ "]/.test(url))
  assert.match(url, /A%C3%A7%C3%A3o%20%26%20rea%C3%A7%C3%A3o/)
  assert.ok(consulta(url).get('body')!.startsWith('Ação & reação: 50% + "aspas" ç ã é'))
})

test('mailto: descrição enorme é cortada para caber no limite, com o aviso de corte', () => {
  const longa = 'ção '.repeat(3000)
  const url = montarMailto({ ...base, descricao: longa })
  assert.ok(url.length <= LIMITE_MAILTO, `tamanho ${url.length}`)
  const corpo = consulta(url).get('body')!
  assert.match(corpo, /texto cortado/)
  assert.match(corpo, /1\.5\.0/) // o rodapé sempre vai
  assert.doesNotThrow(() => decodeURIComponent(url)) // nada cortado no meio de um caractere
})

test('assunto: só o começo da primeira linha', () => {
  const a = assuntoDoRelato({ ...base, tipo: 'sugestao', descricao: `\n${'x'.repeat(200)}` })
  assert.ok(a.startsWith('[HubSquare 1.5.0] Sugestão: xxx'))
  assert.ok(a.endsWith('…'))
  assert.ok(a.length < 100)
})

test('issue: modelo, título, etiqueta e campos pelo tipo', () => {
  const bug = consulta(montarUrlIssue(base))
  assert.ok(
    montarUrlIssue(base).startsWith('https://github.com/lipeventura777/hubsquare/issues/new?')
  )
  assert.equal(bug.get('template'), 'bug.yml')
  assert.equal(bug.get('labels'), 'bug')
  assert.equal(bug.get('versao'), '1.5.0')
  assert.match(bug.get('oque')!, /O servidor não liga/)
  assert.match(bug.get('relatorio')!, /HubSquare-relatorio-2026-11-20_10-30\.zip/)
  assert.equal(bug.get('title'), assuntoDoRelato(base))

  const ideia = consulta(montarUrlIssue({ ...base, tipo: 'sugestao', arquivo: null }))
  assert.equal(ideia.get('template'), 'sugestao.yml')
  assert.equal(ideia.get('labels'), 'enhancement')
  assert.match(ideia.get('problema')!, /O servidor não liga/)
  assert.equal(ideia.get('relatorio'), null)

  assert.equal(consulta(montarUrlIssue({ ...base, tipo: 'problema' })).get('labels'), 'bug')
  assert.equal(consulta(montarUrlIssue({ ...base, tipo: 'outro' })).get('labels'), 'question')
})

test('issue: espaço vira %20 e a URL respeita o limite', () => {
  const url = montarUrlIssue({ ...base, descricao: 'ã '.repeat(5000) })
  assert.ok(!url.includes('+'))
  assert.ok(url.length <= LIMITE_ISSUE, `tamanho ${url.length}`)
})

test('descrição: segredos do PC e a pasta do usuário saem antes de montar o link', () => {
  const limpa = limparDescricao(
    'meu token é abcdef123456 e o log fica em C:\\Users\\Fulano\\AppData\\Roaming\\HubSquare',
    { casas: ['C:\\Users\\Fulano'], segredos: ['abcdef123456'] }
  )
  assert.ok(!limpa.includes('abcdef123456'))
  assert.ok(!limpa.includes('Fulano'))
  assert.match(limpa, /%USERPROFILE%/)
})

test('relatório marcado por padrão só em bug e problema', () => {
  assert.equal(relatorioPorPadrao('bug'), true)
  assert.equal(relatorioPorPadrao('problema'), true)
  assert.equal(relatorioPorPadrao('sugestao'), false)
  assert.equal(relatorioPorPadrao('outro'), false)
})
