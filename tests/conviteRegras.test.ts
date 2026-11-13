import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Manifesto } from '../src/shared/tipos.ts'
import {
  aRemover,
  arquivoDeConvite,
  codigoDoConvite,
  compararManifestos,
  hashDoConteudo,
  lerConvite,
  linkDoConvite,
  modsProibidos,
  normalizarToken,
  novoToken,
  precisaAtualizar,
  proximaVersao,
  sobrescreverOverride,
  validarManifesto
} from '../src/main/conviteRegras.ts'

const h1 = 'a'.repeat(40)
const h2 = 'b'.repeat(40)
const h512 = 'c'.repeat(128)
const arq = (path: string, sha1 = h1, obrigatorio = true): Manifesto['arquivos'][number] => ({
  path,
  sha1,
  sha512: h512,
  tamanho: 10,
  downloads: ['https://cdn.modrinth.com/data/x/versions/y/' + path.split('/')[1]],
  obrigatorio
})
const base = (arquivos: Manifesto['arquivos'], versao = 1): Manifesto => ({
  formato: 1,
  conviteId: 'convite-123456',
  versao,
  servidor: 'Meu',
  minecraft: '1.21.4',
  loader: 'fabric',
  versaoLoader: '0.16.0',
  arquivos,
  proibidos: [],
  semLink: [],
  enderecos: ['26.1.2.3:25565'],
  geradoEm: '2026-11-11'
})

test('a versão do manifesto só sobe quando o conteúdo muda', () => {
  const m = base([arq('mods/a.jar')])
  const v1 = proximaVersao(null, hashDoConteudo(m))
  assert.equal(v1.versao, 1)
  // Mesmo conteúdo, com endereço e data diferentes: não sobe.
  const igual = { ...m, enderecos: ['outro:1'], geradoEm: 'amanhã' }
  assert.deepEqual(proximaVersao(v1, hashDoConteudo(igual)), v1)
  // A ordem dos arquivos não importa.
  const doisA = base([arq('mods/a.jar'), arq('mods/b.jar', h2)])
  const doisB = base([arq('mods/b.jar', h2), arq('mods/a.jar')])
  assert.equal(hashDoConteudo(doisA), hashDoConteudo(doisB))
  // Mod novo: sobe uma.
  const v2 = proximaVersao(v1, hashDoConteudo(doisA))
  assert.equal(v2.versao, 2)
  // Mod atualizado (mesmo nome, hash novo): sobe de novo.
  assert.equal(
    proximaVersao(v2, hashDoConteudo(base([arq('mods/a.jar', h2), arq('mods/b.jar', h2)]))).versao,
    3
  )
})

test('desatualizada só quando a versão disponível é maior', () => {
  assert.equal(precisaAtualizar(0, 1), true)
  assert.equal(precisaAtualizar(3, 3), false)
  assert.equal(precisaAtualizar(4, 3), false) // servidor voltou atrás no backup: não força nada
})

test('compara o que entra e o que sai, respeitando os recomendados recusados', () => {
  const antes = base([
    arq('mods/a.jar'),
    arq('mods/velho.jar'),
    arq('mods/opcional.jar', h1, false)
  ])
  const depois = base(
    [arq('mods/a.jar', h2), arq('mods/novo.jar'), arq('mods/opcional.jar', h1, false)],
    2
  )
  assert.deepEqual(compararManifestos(antes, depois, []), {
    entra: ['a.jar', 'novo.jar'],
    sai: ['a.jar', 'velho.jar']
  })
  assert.deepEqual(compararManifestos(null, depois, ['mods/opcional.jar']), {
    entra: ['a.jar', 'novo.jar'],
    sai: []
  })
})

test('atualização preserva o que é do jogador: só sai o que o app pôs', () => {
  const antes = {
    'mods/do-servidor.jar': h1,
    'mods/continua.jar': h1,
    'resourcepacks/pack.zip': h1
  }
  const novo = { 'mods/continua.jar': h1 }
  const sai = aRemover(antes, novo)
  assert.deepEqual(sai.sort(), ['mods/do-servidor.jar', 'resourcepacks/pack.zip'])
  // Mundos, prints, configurações e mods "meus" nunca estão no registro, então nunca saem;
  // e mesmo que um registro antigo tivesse algo fora das pastas geridas, ele fica.
  const estranho = aRemover(
    { 'saves/Mundo/level.dat': h1, 'config/x.toml': h1, '../fora.jar': h1 },
    {}
  )
  assert.deepEqual(estranho, [])
  // Configuração que o jogador já tem não é sobrescrita; mods do pack sim.
  assert.equal(sobrescreverOverride('config/sodium.json', true), false)
  assert.equal(sobrescreverOverride('config/sodium.json', false), true)
  assert.equal(sobrescreverOverride('options.txt', true), false)
  assert.equal(sobrescreverOverride('mods/a.jar', true), true)
})

test('mods proibidos batem pelo nome do arquivo, sem diferença de maiúsculas', () => {
  assert.deepEqual(modsProibidos(['XRay-1.0.jar', 'sodium.jar'], ['xray']), ['XRay-1.0.jar'])
  assert.deepEqual(modsProibidos(['sodium.jar'], []), [])
})

test('código, link e arquivo de convite voltam iguais', () => {
  const t = novoToken()
  assert.equal(normalizarToken(t), t)
  const codigo = codigoDoConvite('26.12.34.56:8788', t)
  assert.match(codigo, /^26\.12\.34\.56:8788#[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/)
  assert.deepEqual(lerConvite(codigo), {
    enderecos: ['26.12.34.56:8788'],
    token: t,
    manifesto: null
  })
  // Código digitado em minúsculas, com espaços: funciona.
  assert.equal(lerConvite(` ${codigo.toLowerCase()} `).token, t)
  const link = linkDoConvite(['192.168.0.5:8788', 'x.joinmc.link:4000'], t)
  assert.deepEqual(lerConvite(link).enderecos, ['192.168.0.5:8788', 'x.joinmc.link:4000'])
  const m = base([arq('mods/a.jar')])
  const arquivo = lerConvite(arquivoDeConvite(['192.168.0.5:8788'], t, m))
  assert.equal(arquivo.manifesto?.versao, 1)
  assert.throws(() => lerConvite('qualquer coisa'))
  assert.throws(() => lerConvite('1.2.3.4:8788#CURTO'))
})

test('manifesto de fora é conferido: caminho, hash e link oficial', () => {
  assert.equal(validarManifesto(base([arq('mods/a.jar')])).arquivos.length, 1)
  assert.throws(() => validarManifesto(base([arq('../fora.jar')])))
  assert.throws(() => validarManifesto(base([arq('saves/x.jar')])))
  assert.throws(() => validarManifesto(base([{ ...arq('mods/a.jar'), sha1: 'x' }])))
  assert.throws(() =>
    validarManifesto(
      base([{ ...arq('mods/a.jar'), downloads: ['https://site-qualquer.com/a.jar'] }])
    )
  )
  assert.throws(() => validarManifesto({ ...base([]), loader: 'quilt' }))
})
