import { readFile } from 'fs/promises'
import { join } from 'path'
import { CORES_ETIQUETA, type CorEtiqueta, type InfoServidor } from '../shared/tipos'
import { gravarComSeguranca } from './config'
import { ErroApp } from './erros'

// Organização dos mods (Fase 25), na pasta do servidor: etiqueta e nota de cada mod, versões
// travadas, a versão anterior de cada mod (para "voltar") e os perfis de mods.
// Os mods são identificados por "fonte:projeto" (ou "arquivo:nome" quando não há fonte), para
// a etiqueta e o perfil continuarem valendo depois de uma atualização.

const ARQUIVO = 'servsquare-organizacao.json'

export interface Anterior {
  arquivo: string // nome do .jar guardado
  versao: string | null
  versaoId: string | null
  registro: unknown // registro do mods.ts (Fase 16), para reinstalar
  quando: string
}

export interface Organizacao {
  notas: Record<string, { cor: CorEtiqueta | null; nota: string }>
  travados: string[]
  anteriores: Record<string, Anterior>
  perfis: { nome: string; ativos: string[]; criado: string }[]
  travamentoVisto: string | null
}

export async function lerOrganizacao(info: InfoServidor): Promise<Organizacao> {
  try {
    const d = JSON.parse(await readFile(join(info.pasta, ARQUIVO), 'utf8'))
    return {
      notas: d.notas && typeof d.notas === 'object' ? d.notas : {},
      travados: Array.isArray(d.travados)
        ? d.travados.filter((x: unknown) => typeof x === 'string')
        : [],
      anteriores: d.anteriores && typeof d.anteriores === 'object' ? d.anteriores : {},
      perfis: Array.isArray(d.perfis) ? d.perfis : [],
      travamentoVisto: typeof d.travamentoVisto === 'string' ? d.travamentoVisto : null
    }
  } catch {
    return { notas: {}, travados: [], anteriores: {}, perfis: [], travamentoVisto: null }
  }
}

let fila: Promise<unknown> = Promise.resolve()

export function editarOrganizacao<T>(info: InfoServidor, mudar: (o: Organizacao) => T): Promise<T> {
  const r = fila.then(async () => {
    const o = await lerOrganizacao(info)
    const valor = mudar(o)
    await gravarComSeguranca(join(info.pasta, ARQUIVO), JSON.stringify(o, null, 2))
    return valor
  })
  fila = r.catch(() => {})
  return r
}

export function idDoMod(fonte: string, projetoId: string | null, arquivo: string): string {
  return projetoId && fonte !== 'manual' ? `${fonte}:${projetoId}` : `arquivo:${arquivo}`
}

const ID = /^(modrinth|curseforge|hangar|arquivo):[^\\/:*?"<>|]{1,200}$/

export function exigirIdMod(valor: unknown): string {
  if (typeof valor === 'string' && ID.test(valor)) return valor
  throw new ErroApp('Mod inválido. Atualize a lista.')
}

export async function mudarEtiqueta(
  info: InfoServidor,
  idMod: unknown,
  cor: unknown,
  nota: unknown
): Promise<void> {
  const id = exigirIdMod(idMod)
  const c = CORES_ETIQUETA.includes(cor as CorEtiqueta) ? (cor as CorEtiqueta) : null
  const n = typeof nota === 'string' ? nota.slice(0, 500) : ''
  await editarOrganizacao(info, (o) => {
    if (!c && !n.trim()) delete o.notas[id]
    else o.notas[id] = { cor: c, nota: n }
  })
}

export async function travarVersao(
  info: InfoServidor,
  idMod: unknown,
  travar: unknown
): Promise<void> {
  const id = exigirIdMod(idMod)
  await editarOrganizacao(info, (o) => {
    o.travados = o.travados.filter((x) => x !== id)
    if (travar === true) o.travados.push(id)
  })
}
