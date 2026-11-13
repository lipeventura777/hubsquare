// Problemas dos mods e suspeitos de travamento (Fase 25), sem rede nem arquivos.
// Testado em tests/modsProblemas.test.ts.
import type { CorrecaoMod, FonteInstalado, ProblemaMod, TipoId } from '../shared/tipos'
import { compararVersoes } from '../shared/versoes'
import { lerCampos } from './configRegras'
import { metadadosDoJar } from './instaladosRegras'

type Estilo = 'fabric' | 'maven'

export interface Faixa {
  id: string
  faixa: string | string[] | null
  estilo: Estilo
}

export interface MetaJar {
  loaders: ('fabric' | 'quilt' | 'forge' | 'neoforge' | 'paper')[]
  ids: string[] // o id do mod e os que ele diz fornecer ("provides")
  nome: string | null
  versao: string | null
  depende: Faixa[]
  conflita: Faixa[]
  ambiente: 'cliente' | 'servidor' | null
  mc: Faixa | null // versões do Minecraft que o mod aceita
  pacotes: string[] // pacotes Java do mod (para achar o mod num travamento)
  fonte: FonteInstalado // adivinhada pelos links do autor (Fase 23.2)
}

// Dependências que são o próprio jogo ou o loader, não mods.
const DO_JOGO = new Set([
  'minecraft',
  'java',
  'fabricloader',
  'fabric-loader',
  'quilt_loader',
  'forge',
  'neoforge',
  'fml',
  'javafml',
  'mixinextras'
])

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

function faixasFabric(obj: unknown): Faixa[] {
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj as Record<string, unknown>).map(([id, f]) => ({
    id: id.toLowerCase(),
    faixa: Array.isArray(f) ? f.map(String) : typeof f === 'string' ? f : null,
    estilo: 'fabric' as const
  }))
}

// Blocos [[mods]] e [[dependencies.x]] de um mods.toml (Forge/NeoForge).
function blocosDoToml(t: string): { secao: string; v: Record<string, unknown> }[] {
  const blocos: { secao: string; v: Record<string, unknown> }[] = []
  for (const c of lerCampos(t, 'toml')) {
    const secao = c.secao ?? ''
    const atual = blocos[blocos.length - 1]
    // Bloco novo quando a seção muda ou o modId se repete (vários [[dependencies.x]]).
    if (!atual || atual.secao !== secao || (c.nome === 'modId' && 'modId' in atual.v)) {
      blocos.push({ secao, v: {} })
    }
    blocos[blocos.length - 1].v[c.nome] = c.valor
  }
  return blocos
}

export function lerMetaJar(a: {
  fabric?: string | null
  toml?: string | null // META-INF/mods.toml
  neoToml?: string | null // META-INF/neoforge.mods.toml
  plugin?: string | null // plugin.yml
  paperPlugin?: string | null // paper-plugin.yml
}): MetaJar {
  const base = metadadosDoJar({
    fabric: a.fabric,
    toml: a.neoToml ?? a.toml,
    plugin: a.paperPlugin ?? a.plugin
  })
  const m: MetaJar = {
    loaders: [],
    ids: [],
    nome: base.nome,
    versao: base.versao,
    depende: [],
    conflita: [],
    ambiente: null,
    mc: null,
    pacotes: [],
    fonte: base.fonte
  }
  if (a.fabric) {
    try {
      const d = JSON.parse(a.fabric)
      m.loaders.push('fabric')
      if (texto(d.id)) m.ids.push(d.id.toLowerCase())
      for (const p of Array.isArray(d.provides) ? d.provides : [])
        if (texto(p)) m.ids.push(p.toLowerCase())
      const deps = faixasFabric(d.depends)
      m.mc = deps.find((x) => x.id === 'minecraft') ?? null
      m.depende.push(...deps.filter((x) => !DO_JOGO.has(x.id)))
      m.conflita.push(...faixasFabric(d.breaks), ...faixasFabric(d.conflicts))
      if (d.environment === 'client') m.ambiente = 'cliente'
      if (d.environment === 'server') m.ambiente = 'servidor'
      const pontos = Object.values(d.entrypoints ?? {}).flat() as unknown[]
      for (const e of pontos) {
        const classe = typeof e === 'string' ? e : texto((e as { value?: unknown })?.value)
        const pacote = classe?.split('::')[0].split('.').slice(0, -1).join('.')
        if (pacote && pacote.split('.').length >= 2 && !m.pacotes.includes(pacote))
          m.pacotes.push(pacote)
      }
    } catch {
      // fabric.mod.json quebrado: fica sem esses dados
    }
  }
  for (const [t, loader] of [
    [a.neoToml, 'neoforge'],
    [a.toml, 'forge']
  ] as const) {
    if (!t) continue
    m.loaders.push(loader)
    for (const b of blocosDoToml(t)) {
      if (b.secao === 'mods' && texto(b.v.modId)) m.ids.push(String(b.v.modId).toLowerCase())
      const dep = b.secao.match(/^dependencies\./) && texto(b.v.modId)
      if (!dep) continue
      const id = String(b.v.modId).toLowerCase()
      const tipo = texto(b.v.type)?.toLowerCase()
      const faixa = texto(b.v.versionRange)
      const f: Faixa = { id, faixa, estilo: 'maven' }
      if (id === 'minecraft') m.mc = f
      else if (tipo === 'incompatible') m.conflita.push(f)
      else if (
        !DO_JOGO.has(id) &&
        (tipo === 'required' || (tipo === undefined && b.v.mandatory === true))
      )
        m.depende.push(f)
    }
  }
  const yml = a.paperPlugin ?? a.plugin
  if (yml) {
    m.loaders.push('paper')
    const campos = lerCampos(yml, 'yml')
    const nome = campos.find((c) => c.chave === 'name')?.valor
    if (typeof nome === 'string') m.ids.push(nome.toLowerCase())
    const depend = campos.find((c) => c.chave === 'depend')?.valor
    for (const d of Array.isArray(depend) ? depend : [])
      m.depende.push({ id: d.toLowerCase(), faixa: null, estilo: 'fabric' })
    // paper-plugin.yml: dependencies.server.<Nome>.required: true
    for (const c of campos) {
      const p = c.chave.match(/^dependencies\.server\.([^.]+)\.required$/)
      if (p && c.valor === true)
        m.depende.push({ id: p[1].toLowerCase(), faixa: null, estilo: 'fabric' })
    }
  }
  m.ids = [...new Set(m.ids)]
  return m
}

// ---------- Faixas de versão ----------

const limpa = (v: string): string => v.trim().replace(/^v/i, '').split(/[-+]/)[0]

// Faixa do Fabric: ">=1.20 <1.21", "~1.20.1", "^1.20", "1.20.x", "*"; lista = qualquer uma.
// Sintaxe que o app não entende conta como "aceita" (melhor não acusar à toa).
export function atende(versao: string, faixa: string | string[] | null, estilo: Estilo): boolean {
  if (faixa === null) return true
  if (Array.isArray(faixa)) return !faixa.length || faixa.some((f) => atende(versao, f, estilo))
  const v = limpa(versao)
  if (estilo === 'maven') return atendeMaven(v, faixa)
  return faixa
    .trim()
    .split(/\s+/)
    .every((p) => {
      if (!p || p === '*') return true
      const m = p.match(/^(>=|<=|>|<|=|\^|~)?(.+)$/)
      if (!m) return true
      const op = m[1] ?? '='
      const alvo = m[2]
      if (/^\d+(\.\d+)*(\.[xX*])?$/.test(alvo) && /[xX*]$/.test(alvo)) {
        const pre = alvo.replace(/\.[xX*]$/, '')
        return v === pre || v.startsWith(pre + '.')
      }
      const a = limpa(alvo)
      if (!/^\d+(\.\d+)*$/.test(a)) return true
      const c = compararVersoes(v, a)
      switch (op) {
        case '>=':
          return c >= 0
        case '<=':
          return c <= 0
        case '>':
          return c > 0
        case '<':
          return c < 0
        case '~': {
          // mesma "família" (1.20.1 → 1.20.x)
          const partes = a.split('.')
          const teto =
            partes.length >= 2
              ? `${partes[0]}.${Number(partes[1]) + 1}`
              : `${Number(partes[0]) + 1}`
          return c >= 0 && compararVersoes(v, teto) < 0
        }
        case '^':
          return c >= 0 && compararVersoes(v, `${Number(a.split('.')[0]) + 1}`) < 0
        default:
          return c === 0
      }
    })
}

// Faixa do Maven (Forge/NeoForge): "[1.20.1,1.21)", "[1.20,)", "1.20.1" (versão sugerida = qualquer).
function atendeMaven(v: string, faixa: string): boolean {
  const partes = faixa.match(/[[(][^\])]*[\])]/g)
  if (!partes) return true
  return partes.some((p) => {
    const ini = p[0]
    const fim = p[p.length - 1]
    const [a, b] = p
      .slice(1, -1)
      .split(',')
      .map((x) => x.trim())
    if (b === undefined)
      return ini === '[' && fim === ']' ? compararVersoes(v, limpa(a)) === 0 : true
    if (a && (ini === '[' ? compararVersoes(v, limpa(a)) < 0 : compararVersoes(v, limpa(a)) <= 0))
      return false
    if (b && (fim === ']' ? compararVersoes(v, limpa(b)) > 0 : compararVersoes(v, limpa(b)) >= 0))
      return false
    return true
  })
}

// ---------- Problemas ----------

export interface ModAnalise {
  chave: string
  titulo: string
  ativo: boolean
  data: string | null
  projetoId: string | null
  meta: MetaJar | null
  // Do Modrinth, quando o arquivo é de lá (sem internet, fica de fora).
  modrinth?: {
    jogos: string[]
    loaders: string[]
    dependencias: string[]
    incompativeis: string[]
    soDoJogador: boolean
  }
}

export type Correcao = CorrecaoMod
export type Problema = ProblemaMod

function aceitaLoader(loaders: MetaJar['loaders'], servidor: TipoId, versao: string): boolean {
  if (!loaders.length) return true
  if (servidor === 'fabric') return loaders.includes('fabric')
  if (servidor === 'forge') return loaders.includes('forge')
  // O NeoForge 1.20.1 ainda roda mods feitos para o Forge.
  if (servidor === 'neoforge')
    return loaders.includes('neoforge') || (versao === '1.20.1' && loaders.includes('forge'))
  if (servidor === 'paper') return loaders.includes('paper')
  return true
}

const NOME_LOADER: Record<string, string> = {
  fabric: 'Fabric',
  quilt: 'Quilt',
  forge: 'Forge',
  neoforge: 'NeoForge',
  paper: 'Paper'
}

export function verificarProblemas(
  mods: ModAnalise[],
  servidor: { tipo: TipoId; versao: string }
): Record<string, Problema[]> {
  const ativos = mods.filter((m) => m.ativo)
  const r: Record<string, Problema[]> = {}
  const add = (chave: string, p: Problema): void => {
    ;(r[chave] ??= []).push(p)
  }
  const quemFornece = new Map<string, ModAnalise[]>()
  for (const m of ativos)
    for (const id of m.meta?.ids ?? []) quemFornece.set(id, [...(quemFornece.get(id) ?? []), m])
  const projetos = new Set(ativos.flatMap((m) => (m.projetoId ? [m.projetoId] : [])))

  for (const m of ativos) {
    const meta = m.meta
    if (meta && !aceitaLoader(meta.loaders, servidor.tipo, servidor.versao)) {
      add(m.chave, {
        tipo: 'loader',
        texto: `Feito para ${meta.loaders.map((l) => NOME_LOADER[l]).join(' ou ')}, e este servidor usa ${NOME_LOADER[servidor.tipo] ?? servidor.tipo}.`,
        correcao: { tipo: 'desativar', rotulo: 'Desativar', chave: m.chave }
      })
      continue // o resto não importa se nem carrega
    }
    const mcOk = meta?.mc ? atende(servidor.versao, meta.mc.faixa, meta.mc.estilo) : true
    const modrinthOk = !m.modrinth?.jogos.length || m.modrinth.jogos.includes(servidor.versao)
    if (!mcOk || !modrinthOk) {
      add(m.chave, {
        tipo: 'versao',
        texto: `Esta versão do mod não é para o Minecraft ${servidor.versao}.`,
        correcao: { tipo: 'versao', rotulo: 'Trocar para uma versão compatível', chave: m.chave }
      })
    }
    if (meta?.ambiente === 'cliente' || m.modrinth?.soDoJogador) {
      add(m.chave, {
        tipo: 'jogador',
        texto: 'É só do jogador: no servidor ele não serve e pode impedir de ligar.',
        correcao: { tipo: 'remover', rotulo: 'Remover do servidor', chave: m.chave }
      })
    }
    // O jogo/loader confere estas (as do .jar); sem elas, vale o que o Modrinth diz.
    const faltam = (meta?.depende ?? []).filter((d) => !quemFornece.has(d.id))
    for (const d of faltam) {
      add(m.chave, {
        tipo: 'dependencia',
        texto: `Precisa do mod "${d.id}", que não está instalado (ou está desativado).`,
        correcao: { tipo: 'instalar', rotulo: `Instalar ${d.id}`, id: d.id, projeto: false }
      })
    }
    if (!meta?.depende.length) {
      for (const p of m.modrinth?.dependencias ?? []) {
        if (!projetos.has(p))
          add(m.chave, {
            tipo: 'dependencia',
            texto: 'Precisa de outro projeto do Modrinth que não está instalado.',
            correcao: { tipo: 'instalar', rotulo: 'Instalar a dependência', id: p, projeto: true }
          })
      }
    }
    for (const c of meta?.conflita ?? []) {
      for (const outro of quemFornece.get(c.id) ?? []) {
        if (outro === m) continue
        if (outro.meta?.versao && !atende(outro.meta.versao, c.faixa, c.estilo)) continue
        add(m.chave, {
          tipo: 'incompativel',
          texto: `O próprio mod diz que não funciona junto com "${outro.titulo}".`,
          correcao: { tipo: 'desativar', rotulo: `Desativar ${outro.titulo}`, chave: outro.chave }
        })
      }
    }
    for (const p of m.modrinth?.incompativeis ?? []) {
      const outro = ativos.find((x) => x.projetoId === p && x !== m)
      if (outro)
        add(m.chave, {
          tipo: 'incompativel',
          texto: `O autor diz que não funciona junto com "${outro.titulo}".`,
          correcao: { tipo: 'desativar', rotulo: `Desativar ${outro.titulo}`, chave: outro.chave }
        })
    }
  }

  // Duplicados: o mesmo mod (id principal ou projeto) em dois arquivos; o mais velho sai.
  const grupos = new Map<string, ModAnalise[]>()
  for (const m of ativos) {
    const id = m.projetoId ? `p:${m.projetoId}` : m.meta?.ids[0] ? `m:${m.meta.ids[0]}` : null
    if (id) grupos.set(id, [...(grupos.get(id) ?? []), m])
  }
  for (const lista of grupos.values()) {
    if (lista.length < 2) continue
    const ordem = [...lista].sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))
    for (const velho of ordem.slice(1)) {
      add(velho.chave, {
        tipo: 'duplicado',
        texto: `Está duplicado: "${ordem[0].titulo}" é o mesmo mod, mais novo.`,
        correcao: { tipo: 'remover', rotulo: 'Remover este (o mais velho)', chave: velho.chave }
      })
    }
  }
  return r
}

// ---------- Travamento ----------

export interface Suspeito {
  chave: string
  motivo: string
}

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Cruza o relatório de travamento com os mods. Os sinais mais fortes primeiro: a lista
// "Suspected Mods" do Forge, depois o mod na pilha de chamadas e nos mixins.
export function suspeitosDoTravamento(
  texto: string,
  mods: { chave: string; ids: string[]; pacotes: string[] }[]
): Suspeito[] {
  const notas: { chave: string; pontos: number; motivo: string }[] = []
  const suspeitosForge =
    texto.match(/Suspected Mods?:([\s\S]*?)(?:\n\s*\n|Stacktrace|$)/i)?.[1] ?? ''
  for (const m of mods) {
    const ids = m.ids.filter((id) => !DO_JOGO.has(id) && id.length >= 3)
    let pontos = 0
    let motivo = ''
    for (const id of ids) {
      const e = escapar(id)
      if (new RegExp(`\\(${e}\\)`, 'i').test(suspeitosForge)) {
        pontos += 5
        motivo ||= 'O próprio relatório aponta este mod como suspeito.'
      }
      const naPilha = texto.match(new RegExp(`(TRANSFORMER|MOD|/)${e}@`, 'gi'))?.length ?? 0
      if (naPilha) {
        pontos += Math.min(naPilha, 3) * 2
        motivo ||= 'Aparece na pilha de chamadas do travamento.'
      }
      const mixin =
        texto.match(new RegExp(`(${e}\\.mixins?\\.json|from mod ${e}\\b|mod '?${e}'?\\b)`, 'gi'))
          ?.length ?? 0
      if (mixin) {
        pontos += Math.min(mixin, 3) * 2
        motivo ||= 'Aparece no erro (mixin ou carregamento do mod).'
      }
    }
    for (const p of m.pacotes) {
      const n = texto.match(new RegExp(`at ${escapar(p)}\\.`, 'g'))?.length ?? 0
      if (n) {
        pontos += Math.min(n, 3)
        motivo ||= 'O código dele aparece na pilha de chamadas.'
      }
    }
    if (pontos) notas.push({ chave: m.chave, pontos, motivo })
  }
  return notas
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 5)
    .map(({ chave, motivo }) => ({ chave, motivo }))
}
