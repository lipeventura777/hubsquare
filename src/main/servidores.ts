import { app } from 'electron'
import { randomUUID } from 'crypto'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import type { InfoServidor, TipoId } from '../shared/tipos'
import { gravarComSeguranca, lerTexto } from './config'

// Lista de servidores salvos (índice) e qual está ativo. Fica em servidores.json, na pasta de
// dados do app. Cada servidor continua com o seu servsquare.json dentro da própria pasta.

export const ARQUIVO_INFO = 'servsquare.json'

export function pastaServidores(): string {
  return join(app.getPath('documents'), 'ServSquare', 'servidores')
}

export interface ItemIndice {
  id: string
  nome: string
  pasta: string
  tipo: TipoId
  versao: string
}

interface Indice {
  ativo: string | null
  servidores: ItemIndice[]
}

const arquivoIndice = (): string => join(app.getPath('userData'), 'servidores.json')

// Guardado em memória depois da primeira leitura; toda mudança passa por gravar().
let cache: Indice | null = null

// Primeira abertura depois da Fase 11: o servidor que já existia vira o primeiro da lista.
// Nada é movido nem apagado; só se anota onde ele está.
async function migrar(): Promise<Indice> {
  const servidores: ItemIndice[] = []
  let pastas: string[] = []
  try {
    pastas = await readdir(pastaServidores())
  } catch {
    // ainda não existe nenhum servidor
  }
  for (const nome of pastas) {
    const pasta = join(pastaServidores(), nome)
    try {
      const info = JSON.parse(await readFile(join(pasta, ARQUIVO_INFO), 'utf8'))
      servidores.push({
        id: randomUUID(),
        nome: info.nome,
        pasta,
        tipo: info.tipo,
        versao: info.versao
      })
    } catch {
      // pasta sem servsquare.json: criação não terminou ou não é nossa
    }
  }
  return { ativo: servidores[0]?.id ?? null, servidores }
}

export async function lerIndice(): Promise<Indice> {
  if (cache) return cache
  const texto = await lerTexto(arquivoIndice())
  if (texto) {
    cache = JSON.parse(texto) as Indice
  } else {
    cache = await migrar()
    await gravar(cache)
  }
  return cache
}

async function gravar(indice: Indice): Promise<void> {
  cache = indice
  await gravarComSeguranca(arquivoIndice(), JSON.stringify(indice, null, 2))
}

// Junta o item do índice com o servsquare.json da pasta. null se a pasta sumiu.
export async function lerInfo(item: ItemIndice): Promise<InfoServidor | null> {
  try {
    const info = JSON.parse(await readFile(join(item.pasta, ARQUIVO_INFO), 'utf8'))
    return { ...info, id: item.id, pasta: item.pasta }
  } catch {
    return null
  }
}

export async function servidorAtual(): Promise<InfoServidor | null> {
  const indice = await lerIndice()
  const ativo = indice.servidores.find((s) => s.id === indice.ativo)
  return ativo ? lerInfo(ativo) : null
}

export async function acharItem(id: unknown): Promise<ItemIndice | undefined> {
  return (await lerIndice()).servidores.find((s) => s.id === id)
}

export async function registrar(
  item: Omit<ItemIndice, 'id'>,
  tornarAtivo: boolean
): Promise<string> {
  const indice = await lerIndice()
  const id = randomUUID()
  await gravar({
    ativo: tornarAtivo || !indice.ativo ? id : indice.ativo,
    servidores: [...indice.servidores, { ...item, id }]
  })
  return id
}

export async function atualizarItem(
  id: string,
  mudancas: Partial<Omit<ItemIndice, 'id'>>
): Promise<void> {
  const indice = await lerIndice()
  await gravar({
    ...indice,
    servidores: indice.servidores.map((s) => (s.id === id ? { ...s, ...mudancas } : s))
  })
}

export async function definirAtivo(id: string): Promise<void> {
  await gravar({ ...(await lerIndice()), ativo: id })
}

export async function removerItem(id: string): Promise<void> {
  const indice = await lerIndice()
  const servidores = indice.servidores.filter((s) => s.id !== id)
  await gravar({
    servidores,
    ativo: indice.ativo === id ? (servidores[0]?.id ?? null) : indice.ativo
  })
}
