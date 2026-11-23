import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// scripts/ativar-sponsors.mjs: só aceita URL https do GitHub Sponsors e troca tudo de uma vez.
interface Ativar {
  validar: (u: unknown, url: unknown) => { usuario: string; url: string }
  ligarConstantes: (s: string, url: string) => string
  abrirSecaoEn: (s: string, u: string) => string
  ligarFunding: (s: string, u: string) => string
}
const RAIZ = join(import.meta.dirname, '..')
const carregar = async (): Promise<Ativar> =>
  (await import(pathToFileURL(join(RAIZ, 'scripts', 'ativar-sponsors.mjs')).href)) as Ativar
const ler = (f: string): string => readFileSync(join(RAIZ, f), 'utf8')

test('ativar sponsors: recusa o que não for URL https de github.com/sponsors', async () => {
  const { validar } = await carregar()
  assert.deepEqual(validar('fulano', 'https://github.com/sponsors/fulano'), {
    usuario: 'fulano',
    url: 'https://github.com/sponsors/fulano'
  })
  for (const [u, url] of [
    ['fulano', 'http://github.com/sponsors/fulano'],
    ['fulano', 'https://github.com/fulano'],
    ['fulano', 'https://evil.org/sponsors/fulano'],
    ['fulano', 'https://github.com/sponsors/outro'], // usuário diferente
    ['fu lano', 'https://github.com/sponsors/fu lano'],
    ['fulano', '[LINK_PAGINA_APOIO]'],
    ['fulano', undefined]
  ])
    assert.throws(() => validar(u, url), undefined, `${u} ${url}`)
})

test('ativar sponsors: troca os marcadores e liga o Sponsors nos arquivos de verdade', async () => {
  const { ligarConstantes, abrirSecaoEn, ligarFunding } = await carregar()
  const url = 'https://github.com/sponsors/fulano'
  const regras = ligarConstantes(ler('src/shared/apoioRegras.ts'), url)
  assert.match(regras, /GITHUB_SPONSORS_ATIVO = true/)
  assert.ok(regras.includes(`GITHUB_SPONSORS_URL = '${url}'`))
  assert.ok(!regras.includes("[LINK_PAGINA_APOIO]'"))

  const en = abrirSecaoEn(ler('README.en.md'), 'fulano')
  assert.ok(!en.includes('SPONSORS-EN-') && !en.includes('[USUARIO_GITHUB]'))
  assert.ok(en.includes('## Support the project') && en.includes('/sponsors/fulano'))

  const funding = ligarFunding(ler('.github/FUNDING.yml'), 'fulano')
  assert.match(funding, /^github: \[fulano\]$/m)
  // Rodar duas vezes (já ativo) é recusado, não duplica nada.
  assert.throws(() => ligarConstantes(regras, url))
  assert.throws(() => ligarFunding(funding, 'fulano'))
})
