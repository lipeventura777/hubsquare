import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { basename, dirname, join } from 'path'
import type { InfoServidor, ItemRemovido } from '../shared/tipos'
import { pastaBackups } from './backup'
import { gravarComSeguranca } from './config'
import { ErroApp, detalhar } from './erros'
import { vencido } from './instaladosRegras'
import { dentroDe } from './mundo'
import { pastaLivre } from './pastaLivre'
import { aoLigar, esperarTarefas, eventos, lerEstado, registrarNoConsole } from './servidor'

// "Removidos recentemente" (Fase 23.2): o que sai pela aba Instalados vem para cá por 7 dias,
// dentro da pasta de backups do servidor. Cada item é uma pasta com item.json e o arquivo.
// Itens sem arquivo (Pacote pros amigos, resource pack do servidor) guardam só os dados.

export interface Entrada extends ItemRemovido {
  origem: string | null // caminho relativo à pasta do servidor
  dados?: unknown // para restaurar o que não é arquivo
}

const ID = /^[\w-]{1,80}$/

export function pastaRemovidos(info: InfoServidor): string {
  return join(pastaBackups(info), 'removidos')
}

// rename não atravessa discos (a pasta do servidor pode estar em outro): copia e apaga.
export async function mover(origem: string, destino: string): Promise<void> {
  await mkdir(dirname(destino), { recursive: true })
  try {
    await rename(origem, destino)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e
    await cp(origem, destino, { recursive: true, errorOnExist: true, force: false })
    await rm(origem, { recursive: true, force: true })
  }
}

// Move o arquivo (ou pasta) para os removidos. `origem` é relativo à pasta do servidor.
export async function guardarArquivo(
  info: InfoServidor,
  origem: string,
  meta: Pick<ItemRemovido, 'titulo' | 'categoria'>
): Promise<string> {
  const caminho = join(info.pasta, origem)
  if (!dentroDe(info.pasta, caminho) || caminho === info.pasta) {
    throw new ErroApp('Caminho fora da pasta do servidor. Nada foi removido.')
  }
  const id = `${Date.now()}-${randomUUID().slice(0, 8)}`
  const pasta = join(pastaRemovidos(info), id)
  await mover(caminho, join(pasta, 'conteudo', basename(caminho)))
  await gravar(pasta, { id, ...meta, quando: new Date().toISOString(), origem })
  return id
}

// Guarda só dados (ex.: o item do Pacote pros amigos que saiu).
export async function guardarDados(
  info: InfoServidor,
  meta: Pick<ItemRemovido, 'titulo' | 'categoria'>,
  dados: unknown
): Promise<string> {
  const id = `${Date.now()}-${randomUUID().slice(0, 8)}`
  const pasta = join(pastaRemovidos(info), id)
  await mkdir(pasta, { recursive: true })
  await gravar(pasta, { id, ...meta, quando: new Date().toISOString(), origem: null, dados })
  return id
}

function gravar(pasta: string, e: Entrada): Promise<void> {
  return writeFile(join(pasta, 'item.json'), JSON.stringify(e, null, 2))
}

// Lista os removidos e apaga os que passaram de 7 dias (só dentro da pasta "removidos").
export async function listarEntradas(info: InfoServidor): Promise<Entrada[]> {
  const raiz = pastaRemovidos(info)
  let ids: string[]
  try {
    ids = (await readdir(raiz)).filter((n) => ID.test(n))
  } catch {
    return []
  }
  const lista: Entrada[] = []
  for (const id of ids) {
    const pasta = join(raiz, id)
    const e = await readFile(join(pasta, 'item.json'), 'utf8')
      .then((t) => JSON.parse(t) as Entrada)
      .catch(() => null)
    if (!e || vencido(e.quando, Date.now())) {
      if (dentroDe(raiz, pasta) && pasta !== raiz) await rm(pasta, { recursive: true, force: true })
      continue
    }
    lista.push({ ...e, id })
  }
  return lista.sort((a, b) => b.quando.localeCompare(a.quando))
}

export async function lerEntrada(info: InfoServidor, id: unknown): Promise<Entrada> {
  if (typeof id === 'string' && ID.test(id)) {
    const e = (await listarEntradas(info)).find((x) => x.id === id)
    if (e) return e
  }
  throw new ErroApp('Esse item não está mais em Removidos recentemente (passou de 7 dias?).')
}

// Devolve o arquivo para onde estava. Não sobrescreve nada que esteja lá agora.
export async function devolverArquivo(info: InfoServidor, e: Entrada): Promise<void> {
  if (!e.origem) return
  const destino = join(info.pasta, e.origem)
  if (!dentroDe(info.pasta, destino)) throw new ErroApp('Caminho fora da pasta do servidor.')
  if (existsSync(destino)) {
    throw new ErroApp(
      `Já existe "${basename(destino)}" no lugar. Remova ou renomeie esse arquivo e tente de novo.`
    )
  }
  const origem = join(pastaRemovidos(info), e.id, 'conteudo', basename(e.origem))
  try {
    await mover(origem, destino)
  } catch (erro) {
    throw new ErroApp(
      'Não consegui devolver o arquivo. Feche programas usando a pasta e tente de novo.',
      detalhar(erro)
    )
  }
}

export async function apagarEntrada(info: InfoServidor, id: string): Promise<void> {
  const raiz = pastaRemovidos(info)
  const pasta = join(raiz, id)
  if (ID.test(id) && dentroDe(raiz, pasta) && pasta !== raiz) {
    await rm(pasta, { recursive: true, force: true })
  }
}

// ---------- Remoção agendada (servidor ligado) ----------

// Datapacks e outros arquivos que o mods.ts não cuida: com o servidor ligado, a remoção espera
// ele desligar (o mundo usa os arquivos). A lista fica na pasta do servidor.
const AGENDA = 'servsquare-remover.json'

interface Agendado extends Pick<ItemRemovido, 'titulo' | 'categoria'> {
  origem: string
}

export async function lerAgenda(info: InfoServidor): Promise<Agendado[]> {
  try {
    const d = JSON.parse(await readFile(join(info.pasta, AGENDA), 'utf8'))
    return Array.isArray(d) ? d.filter((a) => typeof a?.origem === 'string') : []
  } catch {
    return []
  }
}

let fila: Promise<unknown> = Promise.resolve()

function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const r = fila.then(tarefa)
  fila = r.catch(() => {})
  return r
}

function gravarAgenda(info: InfoServidor, lista: Agendado[]): Promise<void> {
  return gravarComSeguranca(join(info.pasta, AGENDA), JSON.stringify(lista, null, 2))
}

// Devolve true se ficou para quando o servidor desligar.
export function removerArquivo(
  info: InfoServidor,
  origem: string,
  meta: Pick<ItemRemovido, 'titulo' | 'categoria'>
): Promise<boolean> {
  return emFila(async () => {
    if (pastaLivre(info)) {
      await guardarArquivo(info, origem, meta)
      return false
    }
    const lista = (await lerAgenda(info)).filter((a) => a.origem !== origem)
    await gravarAgenda(info, [...lista, { origem, ...meta }])
    return true
  })
}

export function cancelarAgendado(info: InfoServidor, origem: string): Promise<boolean> {
  return emFila(async () => {
    const lista = await lerAgenda(info)
    const sobra = lista.filter((a) => a.origem !== origem)
    if (sobra.length === lista.length) return false
    await gravarAgenda(info, sobra)
    return true
  })
}

function aplicarAgenda(info: InfoServidor): Promise<void> {
  return emFila(async () => {
    const lista = await lerAgenda(info)
    if (!lista.length) return
    for (const a of lista) {
      if (!existsSync(join(info.pasta, a.origem))) continue // já saiu por outro caminho
      await guardarArquivo(info, a.origem, a).catch((e) =>
        registrarNoConsole(`[ServSquare] Não consegui remover ${a.origem}: ${detalhar(e)}`)
      )
    }
    await rm(join(info.pasta, AGENDA), { force: true })
  })
}

// Ao desligar (depois do backup que começa junto) e, por garantia, antes de ligar.
eventos.on('desligou', ({ info }) => {
  setImmediate(() => {
    void esperarTarefas()
      .then(() => (lerEstado() === 'desligado' ? aplicarAgenda(info) : undefined))
      .catch(() => {})
  })
})
aoLigar((info) => aplicarAgenda(info))
