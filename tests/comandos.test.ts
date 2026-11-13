import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  capacidades,
  compilarModelos,
  comandoDeAtalho,
  comandoDestrutivo,
  expandirAtalho,
  montarComandos,
  sugerir,
  textoDaLinha,
  traduzirResposta,
  type NoComando
} from '../src/shared/comandos'

const arg = (
  parser: string,
  children?: Record<string, NoComando>,
  properties?: Record<string, unknown>
): NoComando => ({
  type: 'argument',
  parser,
  executable: true,
  ...(children && { children }),
  ...(properties && { properties })
})
const lit = (children?: Record<string, NoComando>): NoComando => ({
  type: 'literal',
  executable: true,
  ...(children && { children })
})

// Árvore no formato do commands.json do servidor (26.x).
const NOVA: NoComando = {
  type: 'root',
  children: {
    time: lit({ set: lit({ time: arg('minecraft:time', undefined, { min: 0 }) }) }),
    weather: lit({ clear: lit({ duration: arg('minecraft:time') }), rain: lit(), thunder: lit() }),
    worldborder: lit({
      set: lit({ distance: arg('brigadier:double', { time: arg('minecraft:time') }) })
    }),
    gamerule: lit({
      keep_inventory: lit({ value: arg('brigadier:bool') }),
      'minecraft:keep_inventory': lit({ value: arg('brigadier:bool') }),
      random_tick_speed: lit({ value: arg('brigadier:integer', undefined, { min: 0 }) }),
      max_snow_accumulation_height: lit({
        value: arg('brigadier:integer', undefined, { min: 0, max: 8 })
      })
    }),
    give: lit({
      targets: arg('minecraft:entity', {
        item: arg('minecraft:item_stack', { count: arg('brigadier:integer') })
      })
    }),
    effect: lit({
      give: lit({
        targets: arg('minecraft:entity', {
          effect: arg(
            'minecraft:resource',
            { infinite: lit() },
            { registry: 'minecraft:mob_effect' }
          )
        })
      }),
      clear: lit()
    }),
    execute: lit({ run: { type: 'literal' } }),
    teleport: lit({ targets: arg('minecraft:entity') }),
    tp: { type: 'literal', redirect: ['teleport'] },
    tellraw: lit(),
    title: lit(),
    clear: lit(),
    ban: lit(),
    kick: lit(),
    say: lit()
  }
}

// Versão antiga (1.20.x): clima em segundos, nomes camelCase, sem "infinite".
const ANTIGA: NoComando = {
  type: 'root',
  children: {
    weather: lit({ clear: lit({ duration: arg('brigadier:integer') }) }),
    gamerule: lit({ keepInventory: lit({ value: arg('brigadier:bool') }) }),
    effect: lit({
      give: lit({ targets: arg('minecraft:entity', { effect: arg('minecraft:mob_effect') }) })
    })
  }
}

test('capacidades vêm da árvore da versão', () => {
  const c = capacidades(NOVA)
  assert.deepEqual(
    c.gamerules.map((r) => r.nome),
    ['keep_inventory', 'max_snow_accumulation_height', 'random_tick_speed']
  )
  assert.deepEqual(c.gamerules[1], {
    nome: 'max_snow_accumulation_height',
    tipo: 'int',
    min: 0,
    max: 8
  })
  assert.equal(c.climaComUnidade, true)
  assert.equal(c.bordaComUnidade, true)
  assert.equal(c.efeitoInfinito, true)
  const a = capacidades(ANTIGA)
  assert.deepEqual(a.gamerules, [{ nome: 'keepInventory', tipo: 'bool' }])
  assert.equal(a.climaComUnidade, false)
  assert.equal(a.efeitoInfinito, false)
})

test('comandos montados e validados', () => {
  const ctx = {
    arvore: NOVA,
    itens: new Set(['minecraft:diamond', 'create:wrench']),
    efeitos: new Set(['minecraft:speed'])
  }
  assert.deepEqual(montarComandos({ tipo: 'tempo', ticks: 6000 }, ctx), ['time set 6000'])
  assert.deepEqual(montarComandos({ tipo: 'clima', clima: 'clear', segundos: 600 }, ctx), [
    'weather clear 600s'
  ])
  assert.deepEqual(
    montarComandos({ tipo: 'clima', clima: 'clear', segundos: 600 }, { arvore: ANTIGA }),
    ['weather clear 600']
  )
  assert.deepEqual(montarComandos({ tipo: 'borda', tamanho: 1000, segundos: 30 }, ctx), [
    'worldborder set 1000 30s'
  ])
  assert.deepEqual(montarComandos({ tipo: 'gamerule', nome: 'keep_inventory', valor: true }, ctx), [
    'gamerule keep_inventory true'
  ])
  assert.throws(
    () => montarComandos({ tipo: 'gamerule', nome: 'keepInventory', valor: true }, ctx),
    /não existe/
  )
  assert.throws(
    () => montarComandos({ tipo: 'gamerule', nome: 'max_snow_accumulation_height', valor: 9 }, ctx),
    /0 a 8/
  )
  assert.deepEqual(
    montarComandos(
      { tipo: 'dar', jogadores: ['Steve', 'Alex'], item: 'diamond', quantidade: 64 },
      ctx
    ),
    ['give Steve minecraft:diamond 64', 'give Alex minecraft:diamond 64']
  )
  assert.deepEqual(
    montarComandos(
      { tipo: 'dar', jogadores: ['Steve'], item: 'create:wrench', quantidade: 1 },
      ctx
    ),
    ['give Steve create:wrench 1']
  )
  assert.throws(
    () =>
      montarComandos(
        { tipo: 'dar', jogadores: ['Steve'], item: 'minecraft:nada', quantidade: 1 },
        ctx
      ),
    /não existe/
  )
  assert.throws(
    () =>
      montarComandos({ tipo: 'dar', jogadores: ['Steve'], item: 'diamond', quantidade: 6401 }, ctx),
    /1 a 6400/
  )
  assert.deepEqual(
    montarComandos(
      {
        tipo: 'efeito',
        jogadores: ['Steve'],
        efeito: 'speed',
        nivel: 2,
        segundos: null,
        ocultar: true
      },
      ctx
    ),
    ['effect give Steve minecraft:speed infinite 1 true']
  )
  assert.deepEqual(
    montarComandos({ tipo: 'tpCoord', jogadores: ['Steve'], x: 10.5, y: 64, z: -3 }, ctx),
    ['tp Steve 10.50 64 -3']
  )
})

test('nada de texto solto: nomes, quebras de linha e injeção', () => {
  const ctx = { arvore: NOVA }
  assert.throws(
    () => montarComandos({ tipo: 'limpar', jogadores: ['Steve; stop'] }, ctx),
    /inválido/
  )
  assert.throws(() => montarComandos({ tipo: 'limpar', jogadores: [] }, ctx), /pelo menos um/)
  assert.throws(() => montarComandos({ tipo: 'say', texto: 'oi\nstop' }, ctx), /uma linha/)
  assert.throws(
    () => montarComandos({ tipo: 'kick', jogadores: ['Steve'], motivo: 'a\rb' }, ctx),
    /uma linha/
  )
  assert.throws(
    () =>
      montarComandos(
        { tipo: 'dar', jogadores: ['Steve'], item: 'diamond 64\nop x', quantidade: 1 },
        ctx
      ),
    /inválido/
  )
  // Aspas e chaves no chat ficam dentro do texto (JSON escapado), sem quebrar o comando.
  assert.deepEqual(
    montarComandos(
      { tipo: 'chat', jogadores: [], texto: 'diz "oi" {x}', cor: 'gold', negrito: false },
      ctx
    ),
    ['tellraw @a {"text":"diz \\"oi\\" {x}","color":"gold"}']
  )
  assert.deepEqual(
    montarComandos(
      {
        tipo: 'titulo',
        jogadores: ['Steve'],
        titulo: 'Bem-vindo',
        subtitulo: 'ao servidor',
        cor: 'aqua'
      },
      ctx
    ),
    [
      'title Steve subtitle {"text":"ao servidor","color":"aqua"}',
      'title Steve title {"text":"Bem-vindo","color":"aqua","bold":true}'
    ]
  )
  assert.throws(
    () =>
      montarComandos(
        { tipo: 'clima', clima: 'clear', segundos: 1 },
        { arvore: { type: 'root', children: {} } }
      ),
    /não existe nesta versão/
  )
})

test('atalhos: {jogador}, comandos e destrutivos', () => {
  assert.equal(
    comandoDeAtalho('/give {jogador} minecraft:bread 16'),
    'give {jogador} minecraft:bread 16'
  )
  assert.throws(() => comandoDeAtalho('say oi\nstop'), /uma linha/)
  assert.deepEqual(expandirAtalho(['tp {jogador} 0 80 0', 'say pronto'], 'Steve'), [
    'tp Steve 0 80 0',
    'say pronto'
  ])
  assert.throws(() => expandirAtalho(['tp {jogador} 0 80 0'], null), /jogador escolhido/)
  assert.throws(() => expandirAtalho(['tp {jogador} 0 80 0'], 'a b'), /inválido/)
  assert.equal(comandoDestrutivo('kill @e[type=zombie]'), true)
  assert.equal(comandoDestrutivo('execute as Steve run clear Steve'), true)
  assert.equal(comandoDestrutivo('ban Steve'), true)
  assert.equal(comandoDestrutivo('give Steve minecraft:clear_glass 1'), false)
  assert.equal(comandoDestrutivo('weather clear'), false)
})

const EN = {
  'commands.time.set': 'Set the time to %s',
  'commands.give.success.single': 'Gave %s %s to %s',
  'commands.gamerule.query': 'Game rule %s is currently set to %s',
  'argument.entity.notfound.player': 'No player was found',
  'command.unknown.command': 'Unknown or incomplete command. See below for error',
  'commands.effect.give.success.multiple': 'Applied effect %s to %s targets',
  'commands.setworldspawn.success': 'Set the world spawn point to %s, %s, %s [%s]'
}
const PT = {
  'commands.time.set': 'Horário definido para %s',
  'commands.give.success.single': '%s × %s foi dado a %s',
  'argument.entity.notfound.player': 'Nenhum jogador foi encontrado',
  'commands.setworldspawn.success': 'Ponto de renascimento definido em %s, %s, %s [%s]'
}

test('respostas do console em português, com sucesso ou erro', () => {
  const m = compilarModelos(EN)
  assert.equal(
    textoDaLinha('[16:32:37] [Server thread/INFO]: Set the time to 1000'),
    'Set the time to 1000'
  )
  assert.equal(textoDaLinha('[16:32:37 INFO]: Set the time to 1000'), 'Set the time to 1000')
  assert.equal(
    textoDaLinha(
      '[16:32:37] [Server thread/INFO] [minecraft/MinecraftServer]: Set the time to 1000'
    ),
    'Set the time to 1000'
  )
  assert.deepEqual(
    traduzirResposta('[16:32:37] [Server thread/INFO]: Set the time to 1000', m, PT),
    {
      chave: 'commands.time.set',
      ok: true,
      texto: 'Horário definido para 1000'
    }
  )
  assert.deepEqual(
    traduzirResposta('[x] [Server thread/INFO]: Gave 64 [Diamond] to Steve', m, PT)?.texto,
    '64 × [Diamond] foi dado a Steve'
  )
  assert.equal(traduzirResposta('[x] [Server thread/INFO]: No player was found', m, PT)?.ok, false)
  assert.equal(
    traduzirResposta(
      '[x] [Server thread/INFO]: Unknown or incomplete command. See below for error',
      m,
      PT
    )?.ok,
    false
  )
  assert.equal(
    traduzirResposta('[x] [Server thread/INFO]: Applied effect Speed to 2 targets', m, PT)?.texto,
    'Applied effect Speed to 2 targets'
  )
  assert.equal(traduzirResposta('[x] [Server thread/INFO]: <Steve> oi', m, PT), null)
})

test('autocompletar: comandos, jogadores, itens e efeitos', () => {
  const f = {
    jogadores: ['Steve', 'Alex'],
    itens: ['minecraft:diamond', 'minecraft:dirt'],
    efeitos: ['minecraft:speed']
  }
  assert.deepEqual(sugerir(NOVA, 'wea', f).opcoes, ['weather'])
  assert.deepEqual(sugerir(NOVA, 'weather ', f).opcoes, ['clear', 'rain', 'thunder'])
  assert.deepEqual(sugerir(NOVA, 'give S', f).opcoes, ['Steve'])
  assert.deepEqual(sugerir(NOVA, 'give Steve di', f).opcoes, [
    'minecraft:diamond',
    'minecraft:dirt'
  ])
  assert.deepEqual(sugerir(NOVA, 'effect give Alex sp', f).opcoes, ['minecraft:speed'])
  assert.deepEqual(sugerir(NOVA, 'tp ', f).opcoes.slice(0, 2), ['Steve', 'Alex'])
  assert.deepEqual(sugerir(NOVA, 'execute run time s', f).opcoes, ['set'])
  assert.equal(sugerir(NOVA, 'give Steve di', f).inicio, 'give Steve '.length)
})
