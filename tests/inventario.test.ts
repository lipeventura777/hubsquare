import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import {
  durabilidadePadrao,
  nomeEncantamento,
  nomeEntidade,
  nomeEstatistica,
  nomeItem,
  texturasDoItem,
  itensDoJogador,
  lerItem,
  resumirEstatisticas
} from '../src/main/dadosJogador.ts'
import { lerNbt, limparNaRaiz } from '../src/main/zipSeguro.ts'

// Monta um .dat pequeno com XP, Inventory (1 item), EnderItems e equipment.
function datDeTeste(): Buffer {
  const str = (s: string): Buffer => {
    const b = Buffer.from(s, 'utf8')
    const t = Buffer.alloc(2)
    t.writeUInt16BE(b.length)
    return Buffer.concat([t, b])
  }
  const tag = (tipo: number, nome: string, valor: Buffer): Buffer =>
    Buffer.concat([Buffer.from([tipo]), str(nome), valor])
  const int = (n: number): Buffer => {
    const b = Buffer.alloc(4)
    b.writeInt32BE(n)
    return b
  }
  const float = (n: number): Buffer => {
    const b = Buffer.alloc(4)
    b.writeFloatBE(n)
    return b
  }
  const fim = Buffer.from([0])
  const item = Buffer.concat([
    tag(1, 'Slot', Buffer.from([3])),
    tag(8, 'id', str('minecraft:diamond_sword')),
    tag(3, 'count', int(1)),
    fim
  ])
  const lista = (itens: Buffer[]): Buffer =>
    Buffer.concat([Buffer.from([10]), int(itens.length), ...itens])
  const capacete = Buffer.concat([tag(8, 'id', str('minecraft:iron_helmet')), fim])
  return gzipSync(
    tag(
      10,
      '',
      Buffer.concat([
        tag(3, 'XpLevel', int(30)),
        tag(5, 'XpP', float(0.5)),
        tag(9, 'Inventory', lista([item])),
        tag(9, 'EnderItems', lista([item])),
        tag(10, 'equipment', Buffer.concat([tag(10, 'head', capacete), fim])),
        tag(8, 'Dimension', str('minecraft:overworld')),
        fim
      ])
    )
  )
}

test('zera só os campos pedidos e mantém o resto', () => {
  const original = datDeTeste()
  const antes = lerNbt(original)
  assert.equal(antes.XpLevel, 30)
  assert.equal(itensDoJogador(antes).barra[3]?.id, 'minecraft:diamond_sword')
  assert.equal(itensDoJogador(antes).armadura[0]?.id, 'minecraft:iron_helmet')

  const depois = lerNbt(limparNaRaiz(original, ['XpLevel', 'XpP', 'Inventory', 'equipment']))
  assert.equal(depois.XpLevel, 0)
  assert.equal(depois.XpP, 0)
  assert.deepEqual(depois.Inventory, [])
  assert.deepEqual(depois.equipment, {})
  assert.equal((depois.EnderItems as unknown[]).length, 1) // não foi pedido
  assert.equal(depois.Dimension, 'minecraft:overworld')
  // pedir um campo que não existe não muda nada
  assert.deepEqual(lerNbt(limparNaRaiz(original, ['NaoExiste'])), antes)
})

test('lê itens no formato antigo (tag) e no novo (componentes)', () => {
  const antigo = lerItem({
    id: 'minecraft:diamond_pickaxe',
    Count: 1,
    tag: {
      Damage: 100,
      Enchantments: [{ id: 'minecraft:efficiency', lvl: 5 }],
      display: { Name: '{"text":"Picareta"}' }
    }
  })
  assert.deepEqual(antigo, {
    id: 'minecraft:diamond_pickaxe',
    quantidade: 1,
    dano: 100,
    danoMax: 1561,
    encantamentos: [['minecraft:efficiency', 5]],
    nomeProprio: 'Picareta'
  })
  const v1_21_4 = lerItem({
    id: 'minecraft:enchanted_book',
    count: 1,
    components: { 'minecraft:stored_enchantments': { levels: { 'minecraft:mending': 1 } } }
  })
  assert.deepEqual(v1_21_4?.encantamentos, [['minecraft:mending', 1]])
  const novo = lerItem({
    id: 'minecraft:netherite_sword',
    count: 1,
    components: {
      'minecraft:damage': 7,
      'minecraft:enchantments': { 'minecraft:sharpness': 5 },
      'minecraft:custom_name': { text: 'Espadona' }
    }
  })
  assert.equal(novo?.danoMax, 2031)
  assert.equal(novo?.dano, 7)
  assert.deepEqual(novo?.encantamentos, [['minecraft:sharpness', 5]])
  assert.equal(novo?.nomeProprio, 'Espadona')
  assert.equal(lerItem({ id: 'minecraft:air' }), null)
  assert.equal(durabilidadePadrao('minecraft:diamond_chestplate'), 528)
  assert.equal(durabilidadePadrao('minecraft:stone'), null)
})

test('armadura antiga fica no Inventory (slots 100–103 e -106)', () => {
  const r = itensDoJogador({
    Inventory: [
      { Slot: 103, id: 'minecraft:iron_helmet', Count: 1 },
      { Slot: 100, id: 'minecraft:iron_boots', Count: 1 },
      { Slot: -106, id: 'minecraft:shield', Count: 1 },
      { Slot: 35, id: 'minecraft:dirt', Count: 64 }
    ]
  })
  assert.equal(r.armadura[0]?.id, 'minecraft:iron_helmet')
  assert.equal(r.armadura[3]?.id, 'minecraft:iron_boots')
  assert.equal(r.segundaMao?.id, 'minecraft:shield')
  assert.equal(r.inventario[26]?.quantidade, 64)
})

test('estatísticas: tempo, abates, mortes e distâncias em blocos', () => {
  const r = resumirEstatisticas({
    stats: {
      'minecraft:custom': {
        'minecraft:play_time': 72000,
        'minecraft:player_kills': 3,
        'minecraft:walk_one_cm': 12345,
        'minecraft:jump': 10
      },
      'minecraft:mined': { 'minecraft:stone': 5, 'minecraft:dirt': 50 }
    }
  })
  assert.equal(r?.tempo, 72000)
  assert.equal(r?.abates, 3)
  assert.equal(r?.mortes, 0)
  assert.deepEqual(r?.distancia, [['minecraft:walk_one_cm', 123.45]])
  assert.deepEqual(r?.quebrados, [
    ['minecraft:dirt', 50],
    ['minecraft:stone', 5]
  ])
  assert.equal(resumirEstatisticas({ 'stat.walkOneCm': 1 }), null)
  assert.equal(
    resumirEstatisticas({ stats: { 'minecraft:custom': { 'minecraft:play_one_minute': 20 } } })
      ?.tempo,
    20
  )
})

test('traduz itens, encantamentos e estatísticas, com o id como reserva', () => {
  const idioma = {
    'item.minecraft.diamond_sword': 'Espada de diamante',
    'block.minecraft.stone': 'Pedra',
    'enchantment.minecraft.sharpness': 'Afiação',
    'enchantment.level.5': 'V',
    'stat.minecraft.walk_one_cm': 'Distância caminhada',
    'entity.minecraft.zombie': 'Zumbi'
  }
  assert.equal(nomeItem('minecraft:diamond_sword', idioma), 'Espada de diamante')
  assert.equal(nomeItem('minecraft:stone', idioma), 'Pedra')
  assert.equal(nomeItem('minecraft:dirt', idioma), 'minecraft:dirt')
  assert.equal(nomeEncantamento(['minecraft:sharpness', 5], idioma), 'Afiação V')
  assert.equal(nomeEncantamento(['minecraft:mending', 12], {}), 'minecraft:mending 12')
  assert.equal(nomeEstatistica('minecraft:walk_one_cm', idioma), 'Distância caminhada')
  assert.equal(nomeEntidade('minecraft:zombie', idioma), 'Zumbi')
  assert.equal(texturasDoItem('minecraft:stone')[1], 'block/stone')
})

test('acha a textura pelo modelo do item, subindo pelos "parent"', () => {
  const assets: Record<string, unknown> = {
    'items/oak_slab': { model: { type: 'minecraft:model', model: 'minecraft:block/oak_slab' } },
    'models/block/oak_slab': {
      parent: 'minecraft:block/slab',
      textures: { bottom: 'minecraft:block/oak_planks', side: '#bottom' }
    },
    'models/block/slab': { textures: { particle: '#side' } },
    // formato antigo (antes da 1.21.4): sem items/, direto em models/item
    'models/item/stick': { parent: 'item/generated', textures: { layer0: 'item/stick' } }
  }
  const ler = (c: string): unknown => assets[c] ?? null
  assert.equal(texturasDoItem('minecraft:oak_slab', ler)[0], 'block/oak_planks')
  assert.equal(texturasDoItem('minecraft:stick', ler)[0], 'item/stick')
  assert.equal(texturasDoItem('minecraft:nada', ler)[0], 'item/nada') // cai nos palpites
})
