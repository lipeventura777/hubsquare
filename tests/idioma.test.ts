import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ptBR } from '../src/shared/i18n/pt-BR'
import { enUS } from '../src/shared/i18n/en-US'
import { dataHora, definirIdioma, numero, t, tamanho, tNome } from '../src/shared/i18n'
import { decidirIdioma, idiomaDoInstalador, idiomaDoSistema } from '../src/shared/idiomaRegras'

const variaveis = (v: unknown): string =>
  JSON.stringify(
    (typeof v === 'string' ? [v] : Object.values(v as object))
      .flatMap((s: string) => s.match(/\{\w+\}/g) ?? [])
      .sort()
  )

test('os dois idiomas têm exatamente as mesmas chaves', () => {
  assert.deepEqual(Object.keys(enUS).sort(), Object.keys(ptBR).sort())
})

test('cada texto tem as mesmas variáveis e o mesmo formato (plural ou não) nos dois idiomas', () => {
  const erros: string[] = []
  for (const [k, pt] of Object.entries(ptBR)) {
    const en = (enUS as Record<string, unknown>)[k]
    if (typeof pt !== typeof en) erros.push(`${k}: plural só em um idioma`)
    else if (variaveis(pt) !== variaveis(en))
      erros.push(`${k}: ${variaveis(pt)} ≠ ${variaveis(en)}`)
    if (typeof en === 'string' && !en.trim()) erros.push(`${k}: vazio em en-US`)
  }
  assert.deepEqual(erros, [])
})

test('t troca variáveis e escolhe o plural pelo count', () => {
  definirIdioma('pt-BR')
  assert.equal(
    t('assistente.oServidorFoiCriadoAgora', { nome: 'A', v: 'Paper', versao: '1.21' }),
    'O servidor A (Paper 1.21) foi criado. Agora é só ligar.'
  )
  assert.equal(tNome('Ajustes do jogo'), 'Ajustes do jogo')
  definirIdioma('en-US')
  assert.equal(tNome('Ajustes do jogo'), 'Game settings')
  assert.equal(tNome('não existe'), 'não existe')
  assert.equal(t('nome.Painel'), 'Dashboard')
  definirIdioma('pt-BR')
})

test('números, tamanhos e datas no formato de cada idioma', () => {
  const d = new Date(2026, 10, 12, 14, 30)
  definirIdioma('pt-BR')
  assert.equal(tamanho(993_382), '970,1 KB')
  assert.equal(numero(1234.5), '1.234,5')
  assert.match(dataHora(d), /^12\/11\/2026/)
  definirIdioma('en-US')
  assert.equal(tamanho(993_382), '970.1 KB')
  assert.equal(numero(1234.5), '1,234.5')
  assert.match(dataHora(d), /^11\/12\/26/)
  definirIdioma('pt-BR')
})

test('idioma da primeira abertura', () => {
  assert.equal(idiomaDoSistema(['pt-BR', 'en-US']), 'pt-BR')
  assert.equal(idiomaDoSistema(['pt-PT']), 'pt-BR')
  assert.equal(idiomaDoSistema(['es-ES']), 'en-US')
  assert.equal(idiomaDoSistema([]), 'en-US')
  assert.equal(idiomaDoInstalador('1033\r\n'), 'en-US')
  assert.equal(idiomaDoInstalador('pt-BR'), 'pt-BR')
  assert.equal(idiomaDoInstalador('xx'), null)
  const base = { instalador: null, sistema: 'en-US' as const, usadoAntes: false }
  assert.deepEqual(decidirIdioma({ ...base, salvo: 'en-US', usadoAntes: true }), {
    idioma: 'en-US',
    perguntar: false
  })
  // Instalação antiga, de antes da tradução: português sem perguntar.
  assert.deepEqual(decidirIdioma({ ...base, salvo: null, usadoAntes: true }), {
    idioma: 'pt-BR',
    perguntar: false
  })
  assert.deepEqual(decidirIdioma({ ...base, salvo: null }), { idioma: 'en-US', perguntar: true })
  assert.deepEqual(decidirIdioma({ ...base, salvo: 'xx', instalador: 'pt-BR' }), {
    idioma: 'pt-BR',
    perguntar: true
  })
})
