import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  executarMovimentos,
  nomeNovo,
  pastaEmUso,
  precisaMover,
  processoUsando,
  registrarMovidas,
  trocarCaminho,
  trocarCaminhosEmJson,
  validarRegistro,
  type EstadoRaiz,
  type Raiz
} from '../src/shared/migracaoRegras'

const DADOS: Raiz = {
  antiga: 'C:\\Users\\João Paula\\AppData\\Roaming\\ServSquare',
  nova: 'C:\\Users\\João Paula\\AppData\\Roaming\\HubSquare'
}
const DOCS: Raiz = {
  antiga: 'C:\\Users\\João Paula\\Documents\\ServSquare',
  nova: 'C:\\Users\\João Paula\\Documents\\HubSquare'
}
const estado = (r: Raiz, antigaExiste: boolean, novaExiste: boolean): EstadoRaiz => ({
  ...r,
  antigaExiste,
  novaExiste
})

test('pasta nova já existe: não move e usa a nova', () => {
  const r = estado(DADOS, true, true)
  assert.equal(precisaMover(r), false)
  assert.equal(pastaEmUso(r), DADOS.nova)
})

test('só uma das pastas antigas existe: move só ela', () => {
  const raizes = [estado(DADOS, true, false), estado(DOCS, false, false)]
  assert.deepEqual(
    raizes.filter(precisaMover).map((r) => r.antiga),
    [DADOS.antiga]
  )
  // A que não existia usa o nome novo (instalação nova daquele lado).
  assert.equal(pastaEmUso(raizes[1]), DOCS.nova)
  assert.equal(pastaEmUso(estado(DADOS, false, false)), DADOS.nova)
})

test('caminhos com espaços e acentos trocam só a raiz', () => {
  const trocas = [DADOS, DOCS]
  assert.equal(
    trocarCaminho('C:\\Users\\João Paula\\Documents\\ServSquare\\jogo\\Mundo é Nosso', trocas),
    'C:\\Users\\João Paula\\Documents\\HubSquare\\jogo\\Mundo é Nosso'
  )
  // barras normais, maiúsculas diferentes e a raiz sozinha
  assert.equal(
    trocarCaminho('c:/users/joão paula/documents/servsquare/servidores/Ação', trocas),
    'C:\\Users\\João Paula\\Documents\\HubSquare/servidores/Ação'
  )
  assert.equal(trocarCaminho(DADOS.antiga + '\\', trocas), DADOS.nova)
  // outra pasta que só começa igual não muda
  const parecida = 'C:\\Users\\João Paula\\Documents\\ServSquareVelho\\x'
  assert.equal(trocarCaminho(parecida, trocas), parecida)
  assert.equal(trocarCaminho('Paper 1.21', trocas), 'Paper 1.21')

  const json = {
    instalacoes: [{ pasta: `${DOCS.antiga}\\jogo\\A B`, nome: 'ServSquare', ram: 4 }],
    fundos: [`${DADOS.antiga}\\fundos\\x.png`, null, true]
  }
  assert.deepEqual(trocarCaminhosEmJson(json, trocas), {
    instalacoes: [{ pasta: `${DOCS.nova}\\jogo\\A B`, nome: 'ServSquare', ram: 4 }],
    fundos: [`${DADOS.nova}\\fundos\\x.png`, null, true]
  })
})

test('falha no meio desfaz o que já foi movido e a segunda tentativa termina', () => {
  const disco = new Set([DADOS.antiga, DOCS.antiga])
  let falhar = true
  const mover = (de: string, para: string): void => {
    if (falhar && de === DOCS.antiga) throw new Error('EBUSY: arquivo em uso')
    if (!disco.has(de) || disco.has(para)) throw new Error('ENOENT')
    disco.delete(de)
    disco.add(para)
  }
  const existe = (r: Raiz): EstadoRaiz => estado(r, disco.has(r.antiga), disco.has(r.nova))

  const primeira = executarMovimentos([DADOS, DOCS], mover)
  assert.match(primeira.erro ?? '', /EBUSY/)
  assert.deepEqual(primeira.movidas, [])
  // Nada apagado: as duas antigas de volta, e a sessão usa elas.
  assert.deepEqual([...disco].sort(), [DADOS.antiga, DOCS.antiga].sort())
  assert.equal(pastaEmUso(existe(DADOS)), DADOS.antiga)
  assert.equal(pastaEmUso(existe(DOCS)), DOCS.antiga)

  // Próxima abertura: o arquivo já não está em uso.
  falhar = false
  const pendentes = [existe(DADOS), existe(DOCS)]
    .filter(precisaMover)
    .map(({ antiga, nova }) => ({ antiga, nova }))
  const segunda = executarMovimentos(pendentes, mover)
  assert.equal(segunda.erro, null)
  assert.deepEqual(segunda.movidas, [DADOS, DOCS])
  assert.equal(pastaEmUso(existe(DADOS)), DADOS.nova)
  assert.equal(pastaEmUso(existe(DOCS)), DOCS.nova)
  assert.equal([existe(DADOS), existe(DOCS)].filter(precisaMover).length, 0)
})

test('volta que também falha deixa a raiz no lugar novo, sem perder nada', () => {
  const disco = new Set([DADOS.antiga, DOCS.antiga])
  const mover = (de: string, para: string): void => {
    if (de === DOCS.antiga || de === DADOS.nova) throw new Error('EPERM')
    disco.delete(de)
    disco.add(para)
  }
  const r = executarMovimentos([DADOS, DOCS], mover)
  assert.deepEqual(r.presas, [DADOS])
  assert.deepEqual(r.movidas, [DADOS])
  assert.ok(disco.has(DADOS.nova) && disco.has(DOCS.antiga))
  assert.equal(pastaEmUso(estado(DADOS, false, true)), DADOS.nova)
  assert.equal(pastaEmUso(estado(DOCS, true, false)), DOCS.antiga)
})

test('servidor ligado ou jogo aberto nas pastas antigas segura a migração', () => {
  const linhas = [
    '"C:\\Program Files\\Java\\bin\\javaw.exe" -jar outra.jar',
    `"${DADOS.antiga}\\java\\21\\bin\\java.exe" -Xmx4G -jar server.jar nogui`
  ]
  assert.equal(processoUsando(linhas, [DADOS.antiga]), linhas[1])
  const jogo = `javaw.exe --gameDir ${DOCS.antiga.replace(/\\/g, '/')}/jogo/Cobbleverse --width 800`
  assert.equal(processoUsando([jogo], [DOCS.antiga]), jogo)
  assert.equal(processoUsando([`java.exe ${DOCS.antiga}Velho\\x`], [DOCS.antiga]), null)
  assert.equal(processoUsando([], [DADOS.antiga]), null)
})

test('nome novo dos arquivos do app', () => {
  assert.equal(nomeNovo('servsquare.json'), 'hubsquare.json')
  assert.equal(nomeNovo('servsquare-mods.json'), 'hubsquare-mods.json')
  assert.equal(nomeNovo('.servsquare-mods-pendentes'), '.hubsquare-mods-pendentes')
  assert.equal(nomeNovo('ServSquare-acoes.log'), 'hubsquare-acoes.log')
  assert.equal(nomeNovo('server.properties'), null)
  assert.equal(nomeNovo('hubsquare-instalacao.json'), null)
})

test('registro: junta movidas, marca pendências e ignora lixo', () => {
  assert.equal(registrarMovidas(null, [], 'x'), null)
  const r1 = registrarMovidas(null, [DADOS], '2026-11-20')
  assert.deepEqual(r1, {
    data: '2026-11-20',
    movido: [DADOS],
    concluida: false,
    perfisPendentes: true
  })
  const r2 = registrarMovidas({ ...r1!, concluida: true, perfisPendentes: false }, [DOCS], 'y')
  assert.deepEqual(r2?.movido, [DADOS, DOCS])
  assert.equal(r2?.concluida, false)
  assert.equal(validarRegistro('lixo'), null)
  assert.deepEqual(validarRegistro({ movido: [DADOS, { antiga: 1 }], concluida: true }), {
    data: '',
    movido: [DADOS],
    concluida: true,
    perfisPendentes: false
  })
})
