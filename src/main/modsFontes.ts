import { downloadPermitido } from '../shared/fontes'
import type { ArquivoManual, InfoServidor } from '../shared/tipos'
import * as cf from './curseforge'
import {
  ETIQUETA_LOADER_CF,
  LOADER_CF,
  escolherArquivoCF,
  escolherVersaoHangar,
  familia,
  soDoClienteCF
} from './fontesRegras'
import * as hangar from './hangar'
import type { ItemInterno } from './mods'
import { nomeSeguro } from './modsRegras'

// Mods e plugins do CurseForge e do Hangar (Fase 24) no mesmo formato de plano do Modrinth.
// Arquivo que o autor não deixa outros apps baixarem vira "Baixe pelo site" (nunca é baixado).

const MAX_PROJETOS = 40 // trava contra dependências em loop

export interface Montado {
  itens: ItemInterno[]
  avisos: string[]
  problemas: string[]
  manuais: ArquivoManual[]
}

const nomeDoServidor = (info: InfoServidor): string => `${info.tipo} ${info.versao}`

// ---------- CurseForge ----------

// Plugins (Paper): a API filtra mal a versão (marcam só "1.21"), então o app confere.
export async function arquivoCF(
  info: InfoServidor,
  modId: number
): Promise<cf.ArquivoCF | undefined> {
  return escolherArquivoCF(await arquivosCFQueServem(info, modId), null, null)
}

// Todos os arquivos do CurseForge que servem no servidor, o mais novo primeiro.
export async function arquivosCFQueServem(
  info: InfoServidor,
  modId: number
): Promise<cf.ArquivoCF[]> {
  const paper = info.tipo === 'paper'
  const loader = paper ? null : (LOADER_CF[info.tipo] ?? null)
  const versoes = paper ? [info.versao, familia(info.versao)] : [info.versao]
  const etiqueta = paper ? null : (ETIQUETA_LOADER_CF[info.tipo] ?? null)
  return (await cf.arquivos(modId, paper ? null : info.versao, loader))
    .filter((a) => a.isAvailable !== false && !a.isServerPack)
    .filter((a) => a.gameVersions.some((v) => versoes.includes(v)))
    .filter((a) => !etiqueta || a.gameVersions.includes(etiqueta))
    .sort((a, b) => Date.parse(b.fileDate) - Date.parse(a.fileDate))
}

export function itemCF(m: cf.ModCF, a: cf.ArquivoCF, dependencia: boolean): ItemInterno | null {
  const sha1 = cf.sha1Do(a)
  if (!a.downloadUrl || !downloadPermitido(a.downloadUrl, 'curseforge')) return null
  if (!nomeSeguro(a.fileName) || !sha1) return null
  return {
    titulo: m.name,
    versao: a.displayName,
    arquivo: a.fileName,
    tamanho: a.fileLength,
    dependencia,
    url: a.downloadUrl,
    checksum: { algoritmo: 'sha1', valor: sha1 },
    registro: {
      projetoId: String(m.id),
      versaoId: String(a.id),
      arquivo: a.fileName,
      sha1,
      titulo: m.name,
      versao: a.displayName,
      icone: m.logo?.thumbnailUrl ?? null,
      fonte: 'curseforge'
    }
  }
}

// Fase D: leva nome, tamanho e hashes para o assistente reconhecer o arquivo baixado à mão.
export const manualCF = (
  m: cf.ModCF | undefined,
  titulo: string,
  a: cf.ArquivoCF
): ArquivoManual => ({
  titulo,
  url: (m && cf.paginaDoArquivo(m, a.id)) ?? 'https://www.curseforge.com/minecraft',
  arquivo: a.fileName,
  tamanho: a.fileLength,
  sha1: cf.sha1Do(a),
  md5: a.hashes.find((h) => h.algo === 2)?.value.toLowerCase(),
  icone: m?.logo?.thumbnailUrl ?? null,
  projetoId: String(a.modId),
  versaoId: String(a.id),
  versao: a.displayName
})

export async function montarCurseForge(
  info: InfoServidor,
  inicio: number,
  jaInstalados: Set<string>
): Promise<Montado> {
  const escolhas = new Map<number, { a: cf.ArquivoCF; dependencia: boolean }>()
  const semVersao: number[] = []
  const fila = [{ id: inicio, dependencia: false }]
  while (fila.length && escolhas.size < MAX_PROJETOS) {
    const { id, dependencia } = fila.shift()!
    if (escolhas.has(id) || semVersao.includes(id)) continue
    const a = await arquivoCF(info, id)
    if (!a) {
      semVersao.push(id)
      continue
    }
    escolhas.set(id, { a, dependencia })
    for (const d of a.dependencies) {
      if (d.relationType === 3 && !jaInstalados.has(`curseforge:${d.modId}`))
        fila.push({ id: d.modId, dependencia: true })
    }
  }
  const mods = await cf.mods([...escolhas.keys(), ...semVersao])
  const titulo = (id: number): string => mods.get(id)?.name ?? `Projeto ${id}`
  const r: Montado = {
    itens: [],
    avisos: [],
    problemas: semVersao.map(
      (id) => `"${titulo(id)}" não tem versão para ${nomeDoServidor(info)}.`
    ),
    manuais: []
  }
  for (const [id, { a, dependencia }] of escolhas) {
    const m = mods.get(id)
    if (soDoClienteCF(a.gameVersions)) {
      r.avisos.push(
        `"${titulo(id)}" é só do jogador: funciona no jogo de cada um, não no servidor. Ele não vai ser instalado.`
      )
      continue
    }
    if (!m || !cf.podeBaixar(m, a)) {
      r.manuais.push(manualCF(m, titulo(id), a))
      continue
    }
    const item = itemCF(m, a, dependencia)
    if (item) r.itens.push(item)
    else r.problemas.push(`"${titulo(id)}" tem um arquivo que o app não aceita.`)
  }
  return r
}

// Versão mais nova no CurseForge; null se já é a instalada.
export async function novaCF(
  info: InfoServidor,
  projetoId: string,
  versaoId: string
): Promise<{ item: ItemInterno } | { manual: ArquivoManual; versao: string } | null> {
  const a = await arquivoCF(info, Number(projetoId))
  // Ids de arquivo do CurseForge só crescem: id maior = arquivo mais novo.
  if (!a || a.id <= Number(versaoId)) return null
  const m = await cf.mod(Number(projetoId))
  const item = cf.podeBaixar(m, a) ? itemCF(m, a, false) : null
  return item ? { item } : { manual: manualCF(m, m.name, a), versao: a.displayName }
}

// ---------- Hangar ----------

const https = (url: string | null | undefined): string | null =>
  url?.startsWith('https://') ? url : null

export function itemHangar(
  p: hangar.ProjetoHangar,
  v: hangar.VersaoHangar,
  dependencia: boolean
): ItemInterno | ArquivoManual | null {
  const dl = v.downloads.PAPER
  if (!dl?.downloadUrl || !dl.fileInfo) {
    // Só link externo: o autor publica fora do Hangar.
    return { titulo: p.name, url: https(dl?.externalUrl) ?? hangar.linkDoProjeto(p) }
  }
  if (!downloadPermitido(dl.downloadUrl, 'hangar') || !nomeSeguro(dl.fileInfo.name)) return null
  return {
    titulo: p.name,
    versao: v.name,
    arquivo: dl.fileInfo.name,
    tamanho: dl.fileInfo.sizeBytes,
    dependencia,
    url: dl.downloadUrl,
    checksum: { algoritmo: 'sha256', valor: dl.fileInfo.sha256Hash },
    registro: {
      projetoId: String(p.id),
      versaoId: String(v.id),
      arquivo: dl.fileInfo.name,
      sha1: '', // o Hangar só dá SHA-256; o app calcula depois de baixar
      titulo: p.name,
      versao: v.name,
      icone: p.avatarUrl,
      fonte: 'hangar'
    }
  }
}

export const ehManual = (x: ItemInterno | ArquivoManual): x is ArquivoManual => !('registro' in x)

export async function montarHangar(
  info: InfoServidor,
  inicio: number,
  jaInstalados: Set<string>
): Promise<Montado> {
  const r: Montado = { itens: [], avisos: [], problemas: [], manuais: [] }
  const vistos = new Set<number>()
  const fila = [{ id: inicio, dependencia: false }]
  while (fila.length && vistos.size < MAX_PROJETOS) {
    const { id, dependencia } = fila.shift()!
    if (vistos.has(id)) continue
    vistos.add(id)
    const [p, versoes] = await Promise.all([hangar.projeto(id), hangar.versoes(id)])
    const v = escolherVersaoHangar(versoes, info.versao)
    if (!v) {
      r.problemas.push(`"${p.name}" não tem versão para o Paper ${info.versao}.`)
      continue
    }
    const x = itemHangar(p, v, dependencia)
    if (!x) r.problemas.push(`"${p.name}" tem um arquivo que o app não aceita.`)
    else if (ehManual(x)) r.manuais.push(x)
    else r.itens.push(x)
    for (const d of v.pluginDependencies.PAPER ?? []) {
      if (!d.required) continue
      if (d.projectId !== null) {
        if (!jaInstalados.has(`hangar:${d.projectId}`))
          fila.push({ id: d.projectId, dependencia: true })
      } else {
        const url = https(d.externalUrl)
        if (url) r.manuais.push({ titulo: `${d.name} (necessário)`, url })
        else r.avisos.push(`"${p.name}" precisa do plugin "${d.name}", que não está no Hangar.`)
      }
    }
  }
  return r
}

export async function novaHangar(
  info: InfoServidor,
  projetoId: string,
  versaoId: string
): Promise<{ item: ItemInterno } | { manual: ArquivoManual; versao: string } | null> {
  const [p, versoes] = await Promise.all([hangar.projeto(projetoId), hangar.versoes(projetoId)])
  const v = escolherVersaoHangar(versoes, info.versao)
  // Ids de versão do Hangar só crescem.
  if (!v || v.id <= Number(versaoId)) return null
  const x = itemHangar(p, v, false)
  if (!x) return null
  return ehManual(x) ? { manual: x, versao: v.name } : { item: x }
}
