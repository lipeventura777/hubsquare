import { app, dialog, shell, type BrowserWindow } from 'electron'
import { createHash, randomUUID } from 'crypto'
import { createReadStream, existsSync, watch, type FSWatcher } from 'fs'
import { copyFile, mkdir, readdir, rename, rm, stat } from 'fs/promises'
import { isAbsolute, join } from 'path'
import type { ArquivoManual, DownloadManual, InfoServidor } from '../shared/tipos'
import { lerAjustesJogo } from './ajustesJogo'
import { gravarComSeguranca, lerTexto } from './config'
import { conferir, paginaOficial, reconhecivel, triar, type Esperado } from './downloadsRegras'
import { ErroApp } from './erros'
import { infoDaInstalacao } from './instalacoes'
import { instalarBaixado, jaTemArquivo } from './mods'
import { avisarTela } from './servidor'
import { acharItem, lerInfo } from './servidores'

// Fase D: assistente de downloads manuais (o fluxo do ATLauncher).
// Arquivos do CurseForge que o autor não deixa outros apps baixarem: o usuário baixa pela página
// oficial, e o app reconhece o arquivo na pasta Downloads PELO HASH e o instala sozinho.
// - Nada é baixado pelo app (nem de espelhos); só a página oficial é aberta no navegador.
// - Só sai da pasta Downloads o arquivo cujo hash bate com um esperado.
// - Uma cópia fica em `downloads-manuais` (pasta de dados) para outros servidores e instalações
//   DESTE PC. Ela nunca vai para Pacote pros amigos, convites ou exportações.

const pastaDados = (): string => join(app.getPath('userData'), 'downloads-manuais')
const arquivoPendencias = (): string => join(app.getPath('userData'), 'downloads-pendentes.json')
const arquivoIndice = (): string => join(pastaDados(), 'indice.json')

interface Salvo {
  id: string
  alvo: string
  nomeAlvo: string
  titulo: string
  arquivo: string
  tamanho: number
  sha1: string | null
  md5: string | null
  url: string
  icone: string | null
  projetoId: string
  versaoId: string
  versao: string
  fonte?: 'curseforge' | 'modrinth'
  pronto: boolean
}

// O que está guardado no cache, pelo SHA-1 (o arquivo fica em downloads-manuais/<sha1>).
export interface Guardado {
  titulo: string
  arquivo: string
  tamanho: number
  md5: string
  url: string
}

// ---------- Leitura e gravação ----------

async function lerJson<T>(arquivo: string, padrao: T): Promise<T> {
  try {
    const t = await lerTexto(arquivo)
    return t ? (JSON.parse(t) as T) : padrao
  } catch {
    return padrao
  }
}

const lerPendencias = async (): Promise<Salvo[]> => {
  const d = await lerJson<{ itens?: Salvo[] }>(arquivoPendencias(), {})
  return Array.isArray(d.itens) ? d.itens : []
}
const gravarPendencias = (itens: Salvo[]): Promise<void> =>
  gravarComSeguranca(arquivoPendencias(), JSON.stringify({ itens }, null, 2))

export const lerGuardados = (): Promise<Record<string, Guardado>> =>
  lerJson<Record<string, Guardado>>(arquivoIndice(), {})

// Uma mudança de cada vez (vigia, botões e instalações mexem no mesmo arquivo).
let cadeia: Promise<unknown> = Promise.resolve()
function enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
  const r = cadeia.then(tarefa)
  cadeia = r.catch(() => {})
  return r
}

// Estados que não se gravam: "conferindo" e "arquivo diferente" valem só enquanto o app está aberto.
const conferindo = new Set<string>()
const diferentes = new Map<string, string>() // id → motivo (achado na pasta; refeito a cada procura)
const escolhidosErrados = new Map<string, string>() // id → motivo (arquivo escolhido ou arrastado)

function paraTela(s: Salvo): DownloadManual {
  return {
    id: s.id,
    alvo: s.alvo,
    nomeAlvo: s.nomeAlvo,
    titulo: s.titulo,
    arquivo: s.arquivo,
    tamanho: s.tamanho,
    url: s.url,
    icone: s.icone,
    estado: s.pronto
      ? 'pronto'
      : conferindo.has(s.id)
        ? 'conferindo'
        : diferentes.has(s.id) || escolhidosErrados.has(s.id)
          ? 'diferente'
          : 'aguardando',
    motivo: s.pronto ? undefined : (escolhidosErrados.get(s.id) ?? diferentes.get(s.id))
  }
}

export async function listarPendencias(): Promise<DownloadManual[]> {
  return (await lerPendencias()).map(paraTela)
}

async function avisar(): Promise<void> {
  const itens = await lerPendencias()
  avisarTela('downloads:mudou', itens.map(paraTela))
  atualizarVigia(itens)
}

// ---------- Páginas oficiais ----------

export async function abrirPagina(id: unknown): Promise<void> {
  const p = (await lerPendencias()).find((x) => x.id === id)
  if (!p || !paginaOficial(p.url)) throw new ErroApp('Esse download não está mais na lista.')
  await shell.openExternal(p.url)
}

// ---------- Hash e cache ----------

function hashes(caminho: string): Promise<{ sha1: string; md5: string }> {
  return new Promise((resolver, falhar) => {
    const s = createHash('sha1')
    const m = createHash('md5')
    createReadStream(caminho)
      .on('error', falhar)
      .on('data', (d) => {
        s.update(d)
        m.update(d)
      })
      .on('end', () => resolver({ sha1: s.digest('hex'), md5: m.digest('hex') }))
  })
}

const bate = (p: Salvo, h: { sha1: string; md5: string }): boolean =>
  p.sha1 ? p.sha1 === h.sha1 : p.md5 === h.md5

async function mover(origem: string, destino: string): Promise<void> {
  try {
    await rename(origem, destino)
  } catch {
    // Outro disco (ex.: Downloads em D:): copia e só então apaga o original.
    await copyFile(origem, destino)
    await rm(origem, { force: true })
  }
}

async function infoDo(alvo: string): Promise<InfoServidor | null> {
  try {
    if (alvo.startsWith('jogo:')) return await infoDaInstalacao(alvo.slice(5))
    const item = await acharItem(alvo)
    return item ? await lerInfo(item) : null
  } catch {
    return null
  }
}

// Põe a cópia do cache na pasta de destino, pela fila de instalação da tela Mods.
async function instalarDoCache(p: Salvo, sha1: string): Promise<boolean> {
  const info = await infoDo(p.alvo)
  if (!info) return false
  await instalarBaixado(info, join(pastaDados(), sha1), {
    projetoId: p.projetoId,
    versaoId: p.versaoId,
    arquivo: p.arquivo,
    sha1,
    titulo: p.titulo,
    versao: p.versao,
    icone: p.icone,
    fonte: p.fonte === 'modrinth' ? undefined : 'curseforge' // sem fonte = Modrinth
  })
  return true
}

// Arquivo conferido: vai para o cache (movido, se veio da pasta vigiada) e para cada pendência.
async function aceitar(
  origem: string,
  moverOrigem: boolean,
  h: { sha1: string; md5: string }
): Promise<void> {
  const itens = await lerPendencias()
  const alvos = itens.filter((p) => !p.pronto && bate(p, h))
  if (!alvos.length) return
  await mkdir(pastaDados(), { recursive: true })
  const noCache = join(pastaDados(), h.sha1)
  if (existsSync(noCache) && (await hashes(noCache)).sha1 === h.sha1) {
    if (moverOrigem) await rm(origem, { force: true }) // cópia repetida do mesmo arquivo
  } else if (moverOrigem) await mover(origem, noCache)
  else await copyFile(origem, noCache)
  const guardados = await lerGuardados()
  const p0 = alvos[0]
  guardados[h.sha1] = {
    titulo: p0.titulo,
    arquivo: p0.arquivo,
    tamanho: p0.tamanho,
    md5: h.md5,
    url: p0.url
  }
  await gravarComSeguranca(arquivoIndice(), JSON.stringify(guardados, null, 2))
  for (const p of alvos) {
    diferentes.delete(p.id)
    escolhidosErrados.delete(p.id)
    p.pronto = await instalarDoCache(p, h.sha1).catch(() => false)
  }
  await gravarPendencias(itens)
}

// ---------- Registrar o que falta ----------

// Chamado ao instalar um mod/modpack, ao criar o servidor e ao instalar uma instalação.
// Abre a janela sozinho quando algo novo ficou faltando.
export function registrarPendencias(info: InfoServidor, manuais: ArquivoManual[]): Promise<void> {
  return enfileirar(async () => {
    const itens = await lerPendencias()
    const guardados = await lerGuardados()
    let faltam = false
    for (const m of manuais.filter(reconhecivel)) {
      const sha1 = m.sha1 ?? null
      const md5 = m.md5 ?? null
      if (itens.some((p) => p.alvo === info.id && p.arquivo === m.arquivo && !p.pronto)) continue
      if (sha1 && (await jaTemArquivo(info, m.arquivo!, sha1).catch(() => false))) continue
      const p: Salvo = {
        id: randomUUID(),
        alvo: info.id,
        nomeAlvo: info.nome,
        titulo: m.titulo.slice(0, 120),
        arquivo: m.arquivo!,
        tamanho: m.tamanho!,
        sha1,
        md5,
        url: m.url,
        icone: m.icone ?? null,
        projetoId: m.projetoId ?? '',
        versaoId: m.versaoId ?? '',
        versao: m.versao ?? m.arquivo!,
        fonte: m.fonte,
        pronto: false
      }
      // Já baixado antes neste PC: usa a cópia do cache, sem pedir de novo.
      const doCache = sha1
        ? guardados[sha1] && sha1
        : Object.entries(guardados).find(([, g]) => g.md5 === md5)?.[0]
      if (doCache && existsSync(join(pastaDados(), doCache))) {
        p.pronto = await instalarDoCache(p, doCache).catch(() => false)
      }
      if (!p.pronto) faltam = true
      itens.push(p)
    }
    await gravarPendencias(itens)
    await avisar()
    if (faltam) avisarTela('downloads:abrir', info.id)
    if (faltam) agendar()
  })
}

// Tira da lista o que já ficou pronto (ao fechar a janela).
export function limparProntos(): Promise<void> {
  return enfileirar(async () => {
    await gravarPendencias((await lerPendencias()).filter((p) => !p.pronto))
    await avisar()
  })
}

// ---------- Procurar nas pastas ----------

async function pastasVigiadas(): Promise<string[]> {
  const extras = (await lerAjustesJogo().catch(() => null))?.pastasDownloads ?? []
  return [...new Set([app.getPath('downloads'), ...extras])].filter((p) => existsSync(p))
}

// O que já está no cache (baixado antes, ou movido e a instalação falhou): instala sem pedir.
async function usarCache(): Promise<void> {
  const guardados = await lerGuardados()
  const itens = await lerPendencias()
  let mudou = false
  for (const p of itens.filter((x) => !x.pronto)) {
    const sha1 = p.sha1 ?? Object.entries(guardados).find(([, g]) => g.md5 === p.md5)?.[0]
    if (!sha1 || !guardados[sha1] || !existsSync(join(pastaDados(), sha1))) continue
    p.pronto = await instalarDoCache(p, sha1).catch(() => false)
    mudou ||= p.pronto
  }
  if (mudou) await gravarPendencias(itens)
}

// Olha cada arquivo da pasta (sem subpastas). Só é aberto o que tem o tamanho de um esperado;
// só é movido o que tem o hash de um esperado. O resto nem é tocado.
async function procurarAgora(): Promise<void> {
  await usarCache()
  const esperados: Esperado[] = (await lerPendencias())
    .filter((p) => !p.pronto)
    .map((p) => ({ id: p.id, arquivo: p.arquivo, tamanho: p.tamanho, sha1: p.sha1, md5: p.md5 }))
  if (!esperados.length) return
  diferentes.clear()
  for (const pasta of await pastasVigiadas()) {
    for (const nome of await readdir(pasta).catch(() => [] as string[])) {
      const caminho = join(pasta, nome)
      const t = await stat(caminho).catch(() => null)
      if (!t?.isFile()) continue
      const tri = triar(nome, t.size, esperados)
      if (tri.tipo === 'diferente') diferentes.set(tri.id, tri.motivo)
      if (tri.tipo !== 'conferir') continue
      for (const id of tri.ids) conferindo.add(id)
      await avisar()
      try {
        const h = await hashes(caminho)
        const r = conferir(nome, h, esperados)
        if (r.tipo === 'ok') {
          await aceitar(caminho, true, h)
          for (const id of r.ids) {
            const i = esperados.findIndex((e) => e.id === id)
            if (i >= 0) esperados.splice(i, 1)
          }
        } else if (r.tipo === 'diferente') diferentes.set(r.id, r.motivo)
      } catch {
        // Arquivo sumiu ou está preso pelo navegador: a próxima mudança na pasta tenta de novo.
      } finally {
        for (const id of tri.ids) conferindo.delete(id)
      }
    }
  }
  await avisar()
}

let espera: ReturnType<typeof setTimeout> | null = null
let deNovo = false
let rodando = false

// Junta várias mudanças da pasta numa procura só (o navegador renomeia o arquivo várias vezes).
function agendar(): void {
  if (espera) clearTimeout(espera)
  espera = setTimeout(() => {
    espera = null
    if (rodando) {
      deNovo = true
      return
    }
    rodando = true
    enfileirar(procurarAgora)
      .catch(() => {})
      .finally(() => {
        rodando = false
        if (deNovo) {
          deNovo = false
          agendar()
        }
      })
  }, 800)
}

export function procurar(): Promise<void> {
  return enfileirar(procurarAgora)
}

// ---------- Vigia ----------

let vigias: FSWatcher[] = []
let vigiando = ''

// Liga a vigia só enquanto houver algo faltando; desliga quando tudo fica pronto.
function atualizarVigia(itens: Salvo[]): void {
  const precisa = itens.some((p) => !p.pronto)
  pastasVigiadas()
    .then((pastas) => {
      const chave = precisa ? pastas.join('|') : ''
      if (chave === vigiando) return
      for (const v of vigias) v.close()
      vigias = []
      vigiando = chave
      if (!precisa) return
      for (const p of pastas) {
        try {
          const v = watch(p, { persistent: false }, () => agendar())
          v.on('error', () => {})
          vigias.push(v)
        } catch {
          // Pasta sem permissão: fica só o "Já baixei, escolher arquivo".
        }
      }
    })
    .catch(() => {})
}

// Ao abrir o app: tira pendências de servidores/instalações que não existem mais e procura.
export async function iniciarDownloadsManuais(): Promise<void> {
  await enfileirar(async () => {
    const itens = await lerPendencias()
    const vivos: Salvo[] = []
    for (const p of itens) if (p.pronto || (await infoDo(p.alvo))) vivos.push(p)
    await gravarPendencias(vivos.filter((p) => !p.pronto))
  })
  await avisar()
  agendar()
}

// Pastas mudaram em Ajustes do jogo.
export async function pastasMudaram(): Promise<void> {
  vigiando = '-'
  await avisar()
  agendar()
}

// ---------- Escolher ou arrastar o arquivo ----------

export async function conferirArquivo(id: unknown, caminho: unknown): Promise<void> {
  if (typeof caminho !== 'string' || !isAbsolute(caminho)) throw new ErroApp('Arquivo inválido.')
  const t = await stat(caminho).catch(() => null)
  if (!t?.isFile()) throw new ErroApp('Não achei esse arquivo. Escolha de novo.')
  await enfileirar(async () => {
    const itens = await lerPendencias()
    const p = itens.find((x) => x.id === id)
    if (!p) throw new ErroApp('Esse download não está mais na lista.')
    if (p.pronto) return
    conferindo.add(p.id)
    await avisar()
    try {
      const h = await hashes(caminho)
      const esperados = itens
        .filter((x) => !x.pronto)
        .map((x) => ({
          id: x.id,
          arquivo: x.arquivo,
          tamanho: x.tamanho,
          sha1: x.sha1,
          md5: x.md5
        }))
      const r = conferir(p.arquivo, h, esperados)
      // O arquivo escolhido é do usuário: o app copia, não move.
      if (r.tipo === 'ok') await aceitar(caminho, false, h)
      else
        escolhidosErrados.set(
          p.id,
          t.size !== p.tamanho
            ? `Esse não é o arquivo esperado: o tamanho não bate. Baixe "${p.arquivo}" pela página.`
            : 'Esse não é o arquivo esperado: o conteúdo (hash) é diferente. Baixe de novo pela página.'
        )
    } finally {
      conferindo.delete(p.id)
    }
  })
  await avisar()
}

export async function escolherArquivo(id: unknown, janela: BrowserWindow | null): Promise<void> {
  const p = (await lerPendencias()).find((x) => x.id === id)
  if (!p) throw new ErroApp('Esse download não está mais na lista.')
  const opcoes = {
    title: `Escolha o arquivo ${p.arquivo}`,
    defaultPath: app.getPath('downloads'),
    properties: ['openFile' as const],
    filters: [{ name: 'Mod', extensions: ['jar', 'zip'] }]
  }
  const escolha = janela
    ? await dialog.showOpenDialog(janela, opcoes)
    : await dialog.showOpenDialog(opcoes)
  if (escolha.canceled || !escolha.filePaths[0]) return
  await conferirArquivo(id, escolha.filePaths[0])
}
