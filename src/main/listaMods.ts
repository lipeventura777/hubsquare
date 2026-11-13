import { app, dialog, type BrowserWindow } from 'electron'
import { readFile, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { FONTES } from '../shared/fontes'
import {
  CORES_ETIQUETA,
  EXTRAS_TIPOS,
  type CorEtiqueta,
  type InfoServidor,
  type ResultadoImportacao,
  type TravamentoMods
} from '../shared/tipos'
import { ErroApp } from './erros'
import { lerTravamento, listarTravamentos } from './logs'
import { metaDoJar } from './metaJar'
import { alternarMod, listarInstalados, planejarVarios } from './mods'
import { suspeitosDoTravamento } from './modsProblemas'
import { editarOrganizacao, idDoMod, lerOrganizacao } from './organizacao'
import { pastaLivre } from './pastaLivre'
import { ligar } from './servidor'

// Travamento × mods e lista de mods em JSON (Fase 25).

const TRES_DIAS = 3 * 24 * 60 * 60 * 1000

// O relatório de travamento mais recente (dos últimos 3 dias, ainda não dispensado) e os mods
// que aparecem nele.
export async function travamentoRecente(info: InfoServidor): Promise<TravamentoMods | null> {
  const pasta = EXTRAS_TIPOS[info.tipo]
  if (!pasta) return null
  const ultimo = (await listarTravamentos(info))[0]
  if (!ultimo || Date.now() - Date.parse(ultimo.data) > TRES_DIAS) return null
  if ((await lerOrganizacao(info)).travamentoVisto === ultimo.nome) return null
  const { texto, causa } = await lerTravamento(info, ultimo.nome)
  const mods = (await listarInstalados(info)).itens.filter(
    (m) => m.ativo && m.pendente !== 'instalar'
  )
  const dados = await Promise.all(
    mods.map(async (m) => ({ m, meta: await metaDoJar(join(info.pasta, pasta, m.arquivo)) }))
  )
  const suspeitos = suspeitosDoTravamento(
    texto,
    dados.map(({ m, meta }) => ({
      chave: `extras:${m.arquivo}`,
      ids: meta?.ids ?? [],
      pacotes: meta?.pacotes ?? []
    }))
  )
  return {
    nome: ultimo.nome,
    data: ultimo.data,
    causa,
    suspeitos: suspeitos.map((s) => ({
      ...s,
      titulo: mods.find((m) => `extras:${m.arquivo}` === s.chave)?.titulo ?? s.chave
    }))
  }
}

export async function dispensarTravamento(info: InfoServidor, nome: unknown): Promise<void> {
  if (typeof nome !== 'string') return
  await editarOrganizacao(info, (o) => {
    o.travamentoVisto = nome
  })
}

// "Desativar e tentar de novo": desativa os escolhidos e liga o servidor.
export async function desativarETentar(
  info: InfoServidor,
  chaves: unknown,
  nome: unknown
): Promise<void> {
  if (!pastaLivre(info)) throw new ErroApp('O servidor já está ligado.')
  const arquivos = (Array.isArray(chaves) ? chaves : [])
    .filter((c): c is string => typeof c === 'string' && c.startsWith('extras:'))
    .map((c) => c.slice('extras:'.length))
  if (!arquivos.length) throw new ErroApp('Escolha pelo menos um mod para desativar.')
  for (const a of arquivos) await alternarMod(info, a, false)
  await dispensarTravamento(info, nome)
  // No PlaySquare quem abre o jogo é o launcher oficial: o jogador clica em Jogar de novo.
  if (!info.jogador) await ligar()
}

// ---------- Exportar e importar ----------

interface ItemDaLista {
  titulo: string
  arquivo: string
  fonte: string
  projetoId: string | null
  versao: string | null
  ativo: boolean
  cor: CorEtiqueta | null
  nota: string
}

export async function exportarLista(
  info: InfoServidor,
  janela: BrowserWindow | null
): Promise<string | null> {
  const [lista, org] = await Promise.all([listarInstalados(info), lerOrganizacao(info)])
  const mods: ItemDaLista[] = lista.itens.map((m) => {
    const n = org.notas[idDoMod(m.fonte, m.projetoId, m.arquivo)]
    return {
      titulo: m.titulo,
      arquivo: m.arquivo,
      fonte: m.fonte,
      projetoId: m.projetoId,
      versao: m.versao,
      ativo: m.ativo,
      cor: n?.cor ?? null,
      nota: n?.nota ?? ''
    }
  })
  const opcoes = {
    title: 'Exportar a lista de mods',
    defaultPath: join(app.getPath('downloads'), `${info.nome} - mods.json`),
    filters: [{ name: 'Lista de mods (JSON)', extensions: ['json'] }]
  }
  const e = janela
    ? await dialog.showSaveDialog(janela, opcoes)
    : await dialog.showSaveDialog(opcoes)
  if (e.canceled || !e.filePath) return null
  const dado = {
    formato: 'servsquare-mods',
    versao: 1,
    servidor: { tipo: info.tipo, versao: info.versao },
    mods
  }
  await writeFile(e.filePath, JSON.stringify(dado, null, 2))
  return e.filePath
}

// Lê a lista, aplica etiquetas e notas na hora e planeja instalar o que falta (o usuário confirma).
export async function importarLista(
  info: InfoServidor,
  janela: BrowserWindow | null
): Promise<ResultadoImportacao | null> {
  const opcoes = {
    title: 'Importar uma lista de mods',
    properties: ['openFile' as const],
    filters: [{ name: 'Lista de mods (JSON)', extensions: ['json'] }]
  }
  const e = janela
    ? await dialog.showOpenDialog(janela, opcoes)
    : await dialog.showOpenDialog(opcoes)
  const arquivo = e.filePaths[0]
  if (e.canceled || !arquivo) return null
  if ((await stat(arquivo)).size > 1024 * 1024)
    throw new ErroApp('Esse arquivo é grande demais para uma lista de mods.')
  let dado: { formato?: unknown; mods?: unknown }
  try {
    dado = JSON.parse(await readFile(arquivo, 'utf8'))
  } catch {
    throw new ErroApp('Esse arquivo não é uma lista de mods do ServSquare (JSON inválido).')
  }
  if (dado.formato !== 'servsquare-mods' || !Array.isArray(dado.mods)) {
    throw new ErroApp('Esse arquivo não é uma lista de mods exportada pelo ServSquare.')
  }
  const itens = dado.mods.slice(0, 500).flatMap((x): ItemDaLista[] => {
    const m = x as Record<string, unknown>
    if (typeof m.titulo !== 'string' || typeof m.arquivo !== 'string') return []
    return [
      {
        titulo: m.titulo.slice(0, 120),
        arquivo: m.arquivo.slice(0, 200),
        fonte: typeof m.fonte === 'string' ? m.fonte : 'manual',
        projetoId: typeof m.projetoId === 'string' ? m.projetoId.slice(0, 64) : null,
        versao: null,
        ativo: m.ativo !== false,
        cor: CORES_ETIQUETA.includes(m.cor as CorEtiqueta) ? (m.cor as CorEtiqueta) : null,
        nota: typeof m.nota === 'string' ? m.nota.slice(0, 500) : ''
      }
    ]
  })
  const comFonte = itens.filter(
    (i) => i.projetoId && (FONTES as readonly string[]).includes(i.fonte)
  )
  let notas = 0
  await editarOrganizacao(info, (o) => {
    for (const i of itens) {
      if (!i.cor && !i.nota) continue
      o.notas[idDoMod(i.fonte, i.projetoId, i.arquivo)] = { cor: i.cor, nota: i.nota }
      notas++
    }
  })
  const plano = await planejarVarios(
    info,
    comFonte.map((i) => ({ fonte: i.fonte, projetoId: i.projetoId! }))
  )
  return {
    plano,
    notas,
    faltam: itens.filter((i) => !comFonte.includes(i)).map((i) => i.titulo)
  }
}
