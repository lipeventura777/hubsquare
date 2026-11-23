import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  GITHUB_SPONSORS_ATIVO,
  GITHUB_SPONSORS_URL,
  PIX_CHAVE_ALEATORIA,
  PIX_COPIA_E_COLA,
  PIX_TITULAR,
  chaveDoPix,
  crc16Pix,
  pixValido,
  urlDeSponsors
} from '../src/shared/apoioRegras'
import { ptBR } from '../src/shared/i18n/pt-BR'
import { enUS } from '../src/shared/i18n/en-US'

const RAIZ = join(import.meta.dirname, '..')

test('pix: o CRC16 (polinômio 0x1021) do copia e cola é 9010', () => {
  assert.equal(PIX_COPIA_E_COLA.endsWith('63049010'), true)
  assert.equal(crc16Pix(PIX_COPIA_E_COLA.slice(0, -4)), '9010')
  assert.equal(pixValido(PIX_COPIA_E_COLA), true)
  // Um caractere mudado (ou o código cortado) deixa de bater.
  assert.equal(pixValido(PIX_COPIA_E_COLA.replace('Felipe', 'Felipo')), false)
  assert.equal(pixValido(PIX_COPIA_E_COLA.slice(0, -1)), false)
  // Valor de referência do padrão (CRC16/CCITT-FALSE de "123456789" é 29B1).
  assert.equal(crc16Pix('123456789'), '29B1')
})

test('pix: a chave aleatória está dentro do código e os dados batem', () => {
  assert.equal(chaveDoPix(PIX_COPIA_E_COLA), PIX_CHAVE_ALEATORIA)
  assert.match(PIX_CHAVE_ALEATORIA, /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/)
  assert.ok(PIX_COPIA_E_COLA.includes(`5924${PIX_TITULAR}`)) // nome do recebedor, 24 letras
  assert.equal(PIX_COPIA_E_COLA, PIX_COPIA_E_COLA.trim()) // sem espaço sobrando
})

test('sponsors: desligado com o marcador; só aceita a página do GitHub Sponsors (https)', () => {
  assert.equal(GITHUB_SPONSORS_ATIVO, false)
  assert.equal(GITHUB_SPONSORS_URL, '[LINK_PAGINA_APOIO]')
  assert.equal(urlDeSponsors(GITHUB_SPONSORS_URL), null)
  assert.equal(
    urlDeSponsors('https://github.com/sponsors/lipeventura777'),
    'https://github.com/sponsors/lipeventura777'
  )
  for (const ruim of [
    'http://github.com/sponsors/x',
    'https://github.com/x',
    'https://github.com/sponsors/',
    'https://github.com.evil.org/sponsors/x',
    'https://github.com/sponsors/x/../../y',
    'https://user@github.com/sponsors/x',
    'javascript:alert(1)',
    ''
  ])
    assert.equal(urlDeSponsors(ruim), null, ruim)
})

test('frase obrigatória: igual nos dois idiomas, no app', () => {
  assert.equal(
    ptBR['apoio.frase'],
    'A doação é totalmente opcional e não desbloqueia nada de novo no app. O HubSquare é e continuará gratuito.'
  )
  assert.equal(
    enUS['apoio.frase'],
    'Donating is entirely optional and unlocks nothing new in the app. HubSquare is and will stay free.'
  )
})

// Nenhum recurso do app lê estado de doação: só a tela de Sobre (por um canal próprio) enxerga isso.
function fontes(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? fontes(join(pasta, e.name))
      : /\.(ts|tsx)$/.test(e.name)
        ? [join(pasta, e.name)]
        : []
  )
}
const rel = (p: string): string => relative(RAIZ, p).split('\\').join('/')
const quemTem = (re: RegExp): string[] =>
  fontes(join(RAIZ, 'src'))
    .filter((p) => re.test(readFileSync(p, 'utf8')))
    .map(rel)
    .sort()

test('nenhum recurso do app lê estado de doação', () => {
  // As constantes (Pix, Sponsors): só o arquivo delas e o src/main/apoio.ts importam.
  assert.deepEqual(quemTem(/from '[./]+(shared\/)?apoioRegras'|apoioRegras'/), [
    'src/main/apoio.ts'
  ])
  // O módulo do processo principal: só quem registra o canal.
  assert.deepEqual(quemTem(/from '\.\/apoio'/), ['src/main/index.ts'])
  // O canal na tela: só o cartão de Sobre (e o preload que o declara).
  assert.deepEqual(quemTem(/dadosApoio|abrirSponsors/), [
    'src/main/apoio.ts',
    'src/main/index.ts',
    'src/preload/index.ts',
    'src/renderer/src/aparencia/ApoiarProjeto.tsx'
  ])
  // E o estado de doação não vai em log, relatório nem telemetria.
  assert.deepEqual(quemTem(/PIX_COPIA_E_COLA|GITHUB_SPONSORS_ATIVO/), [
    'src/main/apoio.ts',
    'src/shared/apoioRegras.ts'
  ])
})
