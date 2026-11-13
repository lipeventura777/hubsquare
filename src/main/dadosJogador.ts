import { MODOS, type DadosJogador, type Local } from '../shared/tipos'

// Partes sem Electron da tela de jogador: resumo do <uuid>.dat e recorte da cabeça da skin.

// Antes da 1.16 a dimensão era um número.
const DIMENSOES_ANTIGAS: Record<number, string> = {
  0: 'minecraft:overworld',
  [-1]: 'minecraft:the_nether',
  1: 'minecraft:the_end'
}

function dimensao(v: unknown): string | null {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return DIMENSOES_ANTIGAS[v] ?? null
  return null
}

function numero(v: unknown, padrao: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : padrao
}

// Pos é lista de double; os locais de renascimento e morte são int array.
function local(pos: unknown, dim: unknown): Local | null {
  const lista = Array.isArray(pos) || pos instanceof Int32Array ? Array.from(pos) : null
  const d = dimensao(dim)
  if (!lista || lista.length !== 3 || !d) return null
  if (!lista.every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  const [x, y, z] = lista as number[]
  return { x, y, z, dimensao: d }
}

function objeto(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export function resumirJogador(nbt: Record<string, unknown>): DadosJogador {
  // 1.21.5+: respawn { pos, dimension }. Antes: SpawnX/Y/Z + SpawnDimension (1.16+; antes disso, sempre o mundo normal).
  const respawn = objeto(nbt.respawn)
  const renascimento = respawn
    ? local(respawn.pos, respawn.dimension)
    : typeof nbt.SpawnX === 'number'
      ? local([nbt.SpawnX, nbt.SpawnY, nbt.SpawnZ], nbt.SpawnDimension ?? 'minecraft:overworld')
      : null
  // LastDeathLocation existe desde a 1.19.
  const morte = objeto(nbt.LastDeathLocation)
  return {
    vida: Math.max(0, Math.min(20, numero(nbt.Health, 20))),
    fome: Math.max(0, Math.min(20, numero(nbt.foodLevel, 20))),
    nivel: numero(nbt.XpLevel, 0),
    progresso: Math.max(0, Math.min(1, numero(nbt.XpP, 0))),
    modo: MODOS[numero(nbt.playerGameType, -1)] ?? null,
    posicao: local(nbt.Pos, nbt.Dimension),
    renascimento,
    ultimaMorte: morte ? local(morte.pos, morte.dimension) : null
  }
}

// Rosto (8×8 em 8,8) com a camada do chapéu (40,8) por cima. Entra e sai em 4 bytes por pixel;
// a ordem das cores não importa, só o alfa no 4º byte.
export function rostoComChapeu(pixels: Buffer, largura: number): Buffer {
  const saida = Buffer.alloc(8 * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const rosto = ((8 + y) * largura + 8 + x) * 4
      const chapeu = ((8 + y) * largura + 40 + x) * 4
      const alfa = pixels[chapeu + 3] / 255
      const o = (y * 8 + x) * 4
      for (let c = 0; c < 3; c++) {
        saida[o + c] = Math.round(pixels[chapeu + c] * alfa + pixels[rosto + c] * (1 - alfa))
      }
      saida[o + 3] = 255
    }
  }
  return saida
}

// ---------- Inventário (Fase 13) ----------

export interface ItemBruto {
  id: string
  quantidade: number
  dano: number
  danoMax: number | null
  encantamentos: [string, number][]
  nomeProprio: string | null
}

// O jogo não grava a durabilidade máxima padrão; esta tabela cobre ferramentas, armas e armaduras.
const MATERIAL_FERRAMENTA: Record<string, number> = {
  wooden: 59,
  stone: 131,
  copper: 190,
  iron: 250,
  golden: 32,
  diamond: 1561,
  netherite: 2031
}
const PECA: Record<string, number> = { helmet: 11, chestplate: 16, leggings: 15, boots: 13 }
const MATERIAL_ARMADURA: Record<string, number> = {
  leather: 5,
  chainmail: 15,
  iron: 15,
  golden: 7,
  diamond: 33,
  netherite: 37,
  copper: 11,
  turtle: 25
}
const AVULSOS: Record<string, number> = {
  bow: 384,
  crossbow: 465,
  trident: 250,
  shield: 336,
  elytra: 432,
  fishing_rod: 64,
  shears: 238,
  flint_and_steel: 64,
  carrot_on_a_stick: 25,
  warped_fungus_on_a_stick: 100,
  brush: 64,
  mace: 500,
  wolf_armor: 64
}

export function durabilidadePadrao(id: string): number | null {
  const nome = id.replace(/^minecraft:/, '')
  const ferramenta = nome.match(/^(\w+?)_(sword|pickaxe|axe|shovel|hoe|spear)$/)
  if (ferramenta) return MATERIAL_FERRAMENTA[ferramenta[1]] ?? null
  const armadura = nome.match(/^(\w+?)_(helmet|chestplate|leggings|boots)$/)
  if (armadura && MATERIAL_ARMADURA[armadura[1]]) {
    return MATERIAL_ARMADURA[armadura[1]] * PECA[armadura[2]]
  }
  return AVULSOS[nome] ?? null
}

// Nome dado na bigorna: texto JSON (até a 1.21.4) ou componente de texto já em NBT (1.21.5+).
function texto(v: unknown): string | null {
  if (typeof v === 'string') {
    try {
      return texto(JSON.parse(v))
    } catch {
      return v
    }
  }
  if (Array.isArray(v)) return v.map(texto).join('') || null
  const o = objeto(v)
  if (!o) return null
  const extra = Array.isArray(o.extra) ? o.extra.map(texto).join('') : ''
  return `${typeof o.text === 'string' ? o.text : ''}${extra}` || null
}

function encantamentos(v: unknown): [string, number][] {
  // Antes da 1.20.5: lista de { id, lvl }. 1.20.5–1.21.4: { levels: { id: nível } }. Depois: { id: nível }.
  if (Array.isArray(v)) {
    return v
      .map(objeto)
      .filter((e): e is Record<string, unknown> => !!e)
      .map((e) => [String(e.id), numero(e.lvl, 1)])
  }
  const o = objeto(v)
  if (!o) return []
  const niveis = objeto(o.levels) ?? o
  return Object.entries(niveis)
    .filter(([, n]) => typeof n === 'number')
    .map(([id, n]) => [id.includes(':') ? id : `minecraft:${id}`, n as number])
}

export function lerItem(v: unknown): ItemBruto | null {
  const o = objeto(v)
  if (!o || typeof o.id !== 'string' || o.id === 'minecraft:air') return null
  const componentes = objeto(o.components) ?? {}
  const tag = objeto(o.tag) ?? {}
  return {
    id: o.id,
    quantidade: numero(o.count ?? o.Count, 1),
    dano: numero(componentes['minecraft:damage'] ?? tag.Damage, 0),
    danoMax:
      typeof componentes['minecraft:max_damage'] === 'number'
        ? (componentes['minecraft:max_damage'] as number)
        : durabilidadePadrao(o.id),
    encantamentos: encantamentos(
      componentes['minecraft:enchantments'] ??
        componentes['minecraft:stored_enchantments'] ??
        tag.Enchantments ??
        tag.StoredEnchantments
    ),
    nomeProprio: texto(componentes['minecraft:custom_name'] ?? objeto(tag.display)?.Name)
  }
}

export interface ItensBrutos {
  armadura: (ItemBruto | null)[] // cabeça, peito, pernas, pés
  segundaMao: ItemBruto | null
  inventario: (ItemBruto | null)[] // 27
  barra: (ItemBruto | null)[] // 9
  ender: (ItemBruto | null)[] // 27
}

// Slots: barra 0–8, inventário 9–35. Até a 1.21.4 a armadura (100–103) e a segunda mão (-106)
// ficavam no Inventory; a partir da 1.21.5 ficam no compound "equipment".
export function itensDoJogador(nbt: Record<string, unknown>): ItensBrutos {
  const vazio = (n: number): (ItemBruto | null)[] => Array.from({ length: n }, () => null)
  const r: ItensBrutos = {
    armadura: vazio(4),
    segundaMao: null,
    inventario: vazio(27),
    barra: vazio(9),
    ender: vazio(27)
  }
  for (const v of Array.isArray(nbt.Inventory) ? nbt.Inventory : []) {
    const slot = numero(objeto(v)?.Slot, -999)
    const item = lerItem(v)
    if (slot >= 0 && slot <= 8) r.barra[slot] = item
    else if (slot >= 9 && slot <= 35) r.inventario[slot - 9] = item
    else if (slot >= 100 && slot <= 103) r.armadura[103 - slot] = item
    else if (slot === -106) r.segundaMao = item
  }
  const equipamento = objeto(nbt.equipment)
  if (equipamento) {
    ;['head', 'chest', 'legs', 'feet'].forEach((k, i) => {
      if (equipamento[k]) r.armadura[i] = lerItem(equipamento[k])
    })
    if (equipamento.offhand) r.segundaMao = lerItem(equipamento.offhand)
  }
  for (const v of Array.isArray(nbt.EnderItems) ? nbt.EnderItems : []) {
    const slot = numero(objeto(v)?.Slot, -1)
    if (slot >= 0 && slot <= 26) r.ender[slot] = lerItem(v)
  }
  return r
}

// ---------- Estatísticas (stats/<uuid>.json, formato da 1.13+) ----------

export interface EstatisticasBrutas {
  tempo: number // ticks
  abates: number
  mortes: number
  distancia: [string, number][] // id do tipo de movimento, em blocos
  quebrados: [string, number][]
  usados: [string, number][]
  mortos: [string, number][]
}

export function resumirEstatisticas(json: unknown): EstatisticasBrutas | null {
  const stats = objeto(objeto(json)?.stats)
  if (!stats) return null // formato antigo (antes da 1.13) ou arquivo estranho
  const categoria = (k: string): [string, number][] =>
    Object.entries(objeto(stats[k]) ?? {})
      .filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0)
      .sort((a, b) => b[1] - a[1])
  const custom = objeto(stats['minecraft:custom']) ?? {}
  return {
    // "play_one_minute" virou "play_time" na 1.17; os dois contam ticks.
    tempo: numero(custom['minecraft:play_time'] ?? custom['minecraft:play_one_minute'], 0),
    abates: numero(custom['minecraft:player_kills'], 0),
    mortes: numero(custom['minecraft:deaths'], 0),
    distancia: categoria('minecraft:custom')
      .filter(([k]) => k.endsWith('_one_cm'))
      .map(([k, cm]) => [k, cm / 100]),
    quebrados: categoria('minecraft:mined'),
    usados: categoria('minecraft:used'),
    mortos: categoria('minecraft:killed')
  }
}

// ---------- Nomes traduzidos e texturas (pt_br.json e client.jar da versão) ----------

export type Idioma = Record<string, string>

const semPrefixo = (id: string): string => id.replace(/^minecraft:/, '')

export function nomeItem(id: string, idioma: Idioma): string {
  const n = semPrefixo(id)
  return idioma[`item.minecraft.${n}`] ?? idioma[`block.minecraft.${n}`] ?? id
}

export function nomeEncantamento([id, nivel]: [string, number], idioma: Idioma): string {
  const nome = idioma[`enchantment.minecraft.${semPrefixo(id)}`] ?? id
  return `${nome} ${idioma[`enchantment.level.${nivel}`] ?? nivel}`
}

export const nomeEstatistica = (id: string, idioma: Idioma): string =>
  idioma[`stat.minecraft.${semPrefixo(id)}`] ?? id

export const nomeEntidade = (id: string, idioma: Idioma): string =>
  idioma[`entity.minecraft.${semPrefixo(id)}`] ?? id

// Lê um .json de assets/minecraft (caminho sem a extensão); null se não existir.
export type LerAsset = (caminho: string) => unknown

// Primeiro "model" em texto dentro da definição do item (que pode ter seletores aninhados).
function primeiroModelo(v: unknown): string | null {
  if (Array.isArray(v)) {
    for (const x of v) {
      const m = primeiroModelo(x)
      if (m) return m
    }
    return null
  }
  const o = objeto(v)
  if (!o) return null
  if (typeof o.model === 'string') return o.model
  for (const x of Object.values(o)) {
    const m = primeiroModelo(x)
    if (m) return m
  }
  return null
}

// Textura que o jogo usa para o item: items/<id>.json (1.21.4+) ou models/item/<id>.json,
// subindo pelos "parent" e resolvendo as referências "#nome".
export function texturaDoModelo(id: string, ler: LerAsset): string | null {
  const n = semPrefixo(id)
  const texturas: Record<string, string> = {}
  let modelo: string | null = primeiroModelo(ler(`items/${n}`)) ?? `item/${n}`
  for (let i = 0; i < 10 && modelo; i++) {
    const m = objeto(ler(`models/${semPrefixo(modelo)}`))
    if (!m) break
    for (const [k, v] of Object.entries(objeto(m.textures) ?? {})) {
      if (typeof v === 'string' && !(k in texturas)) texturas[k] = v
    }
    modelo = typeof m.parent === 'string' ? m.parent : null
  }
  const resolver = (v: string | undefined, passos = 0): string | undefined =>
    v?.startsWith('#') && passos < 10 ? resolver(texturas[v.slice(1)], passos + 1) : v
  const chaves = ['layer0', 'all', 'side', 'texture', 'top', 'front', 'particle']
  for (const k of [...chaves, ...Object.keys(texturas)]) {
    const t = resolver(texturas[k])
    if (t && !t.startsWith('#')) return semPrefixo(t)
  }
  return null
}

// Sem os modelos (ou se não acharem nada), tenta nomes de textura comuns.
export function texturasDoItem(id: string, ler?: LerAsset): string[] {
  const n = semPrefixo(id)
  const doModelo = ler && texturaDoModelo(id, ler)
  return [
    ...(doModelo ? [doModelo] : []),
    `item/${n}`,
    `block/${n}`,
    `item/${n}_00`,
    `block/${n}_front`,
    `block/${n}_side`,
    `block/${n}_top`
  ]
}

// Entidades usam o ovo gerador como ícone.
export const texturasDaEntidade = (id: string): string[] => [`item/${semPrefixo(id)}_spawn_egg`]
