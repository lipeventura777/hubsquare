import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ehRespostaDoList, interpretarLinha } from '../src/main/linhaDeJogador.ts'

// Começo de linha de cada software, como aparece no console do app.
const PREFIXOS = {
  vanilla: '[15:02:11] [Server thread/INFO]: ',
  fabric: '[15:02:11] [Server thread/INFO]: ',
  paper: '[15:02:11 INFO]: ',
  forge: '[11Nov2026 00:08:30.337] [Server thread/INFO] [minecraft/MinecraftServer]: ',
  neoforge:
    '[11nov.2026 00:08:30.337] [Server thread/INFO] [net.minecraft.server.MinecraftServer/]: '
}
// Minecraft 26.x põe "System chat: " antes das mensagens do sistema; versões antigas, não.
const SISTEMA = ['System chat: ', '']

test('linhas reais do Minecraft 26.3 (copiadas dos logs do Paper e do NeoForge)', () => {
  const reais = [
    '[17:17:21] [Server thread/INFO]: System chat: jogador_teste joined the game',
    '[11nov.2026 00:13:55.759] [Server thread/INFO] [net.minecraft.server.MinecraftServer/]: System chat: jogador_teste joined the game'
  ]
  for (const l of reais) {
    assert.deepEqual(interpretarLinha(l, []), {
      lista: ['jogador_teste'],
      aviso: { nome: 'jogador_teste', tipo: 'entrou' }
    })
  }
  assert.deepEqual(
    interpretarLinha(
      '[11nov.2026 00:20:16.912] [Server thread/INFO] [net.minecraft.server.MinecraftServer/]: System chat: jogador_teste left the game',
      ['jogador_teste']
    ),
    { lista: [], aviso: { nome: 'jogador_teste', tipo: 'saiu' } }
  )
  assert.deepEqual(
    interpretarLinha(
      '[17:08:45] [Server thread/INFO]: System chat: There are 0 of a max of 10 players online: ',
      ['Velho']
    ),
    { lista: [] }
  )
})

test('entrada, saída e list em todos os softwares, com e sem "System chat"', () => {
  for (const [software, p] of Object.entries(PREFIXOS)) {
    for (const s of SISTEMA) {
      const msg = `${software} ${s || 'sem prefixo'}`
      assert.deepEqual(
        interpretarLinha(`${p}${s}Ana_01 joined the game`, []),
        { lista: ['Ana_01'], aviso: { nome: 'Ana_01', tipo: 'entrou' } },
        msg
      )
      assert.deepEqual(
        interpretarLinha(`${p}${s}Ana_01 left the game`, ['Bob', 'Ana_01']),
        { lista: ['Bob'], aviso: { nome: 'Ana_01', tipo: 'saiu' } },
        msg
      )
      assert.deepEqual(
        interpretarLinha(`${p}${s}There are 2 of a max of 20 players online: Ana, Bob`, []),
        { lista: ['Ana', 'Bob'] },
        msg
      )
    }
  }
})

test('códigos de cor (ANSI e §) e \\r no fim não atrapalham', () => {
  const p = PREFIXOS.paper
  assert.equal(
    interpretarLinha(`${p}\x1b[33;1mSystem chat: Ana joined the game\x1b[m`, [])?.aviso?.nome,
    'Ana'
  )
  assert.equal(
    interpretarLinha(`${p}\x1b[0;33m\x1b[1mAna left the game\x1b[0m\r`, ['Ana'])?.aviso?.tipo,
    'saiu'
  )
  assert.equal(interpretarLinha(`${p}§eSystem chat: Ana joined the game§r`, [])?.aviso?.nome, 'Ana')
  assert.deepEqual(
    interpretarLinha(
      `${p}\x1b[2KThere are 1 of a max of 20 players online: \x1b[32mAna\x1b[0m`,
      []
    ),
    { lista: ['Ana'] }
  )
})

test('mensagem de chat não finge entrada', () => {
  const p = PREFIXOS.vanilla
  assert.equal(interpretarLinha(`${p}<Bob> Ana joined the game`, []), null)
  assert.equal(interpretarLinha(`${p}<Bob> System chat: Ana joined the game`, []), null)
  assert.equal(interpretarLinha(`${p}[Not Secure] <Bob> Ana joined the game`, []), null)
  assert.equal(interpretarLinha(`${PREFIXOS.paper}[Server] Ana joined the game`, []), null)
})

test('quem já está na lista não aparece duas vezes', () => {
  assert.deepEqual(
    interpretarLinha(`${PREFIXOS.vanilla}System chat: Ana joined the game`, ['Ana'])?.lista,
    ['Ana']
  )
})

test('linhas comuns não mudam nada', () => {
  assert.equal(
    interpretarLinha(`${PREFIXOS.vanilla}Done (3.2s)! For help, type "help"`, ['Ana']),
    null
  )
  assert.equal(
    interpretarLinha(
      '[11nov.2026 00:13:55.737] [Server thread/INFO] [net.minecraft.server.players.PlayerList/]: jogador_teste[/192.168.0.10:58251] logged in with entity id 79 at (-301.2, 87.0, 485.0)',
      []
    ),
    null
  )
})

test('reconhece a resposta do list (para esconder a conferência automática do console)', () => {
  assert.equal(
    ehRespostaDoList(
      `${PREFIXOS.neoforge}System chat: There are 0 of a max of 10 players online: `
    ),
    true
  )
  assert.equal(
    ehRespostaDoList(`${PREFIXOS.paper}\x1b[0mThere are 1 of a max of 20 players online: Ana`),
    true
  )
  assert.equal(ehRespostaDoList(`${PREFIXOS.paper}Ana joined the game`), false)
})
