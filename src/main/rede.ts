import { app } from 'electron'
import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import { appendFile, mkdir, rename, rm } from 'fs/promises'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import type { ReadableStream as WebReadableStream } from 'stream/web'
import { ErroApp, detalhar } from './erros'
import type { Progresso } from '../shared/tipos'
import { t } from '../shared/i18n'
import { classificarFalha, linhaDoLog, type FalhaDownload } from '../shared/redeRegras'

export type AoProgredir = (p: Progresso) => void

// Repositório público do app (aviso de atualização e contato no User-Agent).
export const REPOSITORIO = 'lipeventura777/hubsquare'

// O único User-Agent do app, em todas as chamadas (Modrinth, Hangar, PaperMC, Adoptium, GitHub).
// O Modrinth pede que identifique o app e um contato: o contato é a página do projeto, sem e-mail.
export const userAgent = (): string => `HubSquare/${app.getVersion()} (github.com/${REPOSITORIO})`

export interface Checksum {
  algoritmo: 'sha1' | 'sha256' | 'sha512'
  valor: string
}

// Testes (Fase M3): com HUBSQUARE_DOWNLOADS (ex.: http://127.0.0.1:5123), todo pedido à internet
// vai para o servidor simulado, como <servidor>/<site>/<caminho>. As conferências de site
// permitido continuam sendo feitas com a URL original.
export function urlDeVerdade(url: string): string {
  const simulado = process.env.HUBSQUARE_DOWNLOADS
  if (!simulado) return url
  const u = new URL(url)
  return `${simulado}/${u.host}${u.pathname}${u.search}`
}

const FALHAS: Record<FalhaDownload, Parameters<typeof t>[0]> = {
  naoExiste: 'p.rede.falhaNaoExiste',
  recusado: 'p.rede.falhaRecusado',
  siteComProblema: 'p.rede.falhaSiteComProblema',
  semConexao: 'p.rede.falhaSemConexao'
}

// O que falhou, para a mensagem: o item que quem chamou informou, ou "um arquivo de <site>".
function nomeDoItem(url: string, item?: string): string {
  if (item) return item
  let host = '?'
  try {
    host = new URL(url).host
  } catch {
    // fica "?"
  }
  return t('p.rede.itemArquivoDe', { host })
}

// Fase E3: a mensagem diz o item e o que fazer (só manda esperar quando o site está com
// problema), e o erros.log ganha só o site, o status e o item (linhaDoLog).
function falhaDeDownload(
  url: string,
  status: number | null,
  item: string | undefined,
  detalhe: string
): ErroApp {
  const nome = nomeDoItem(url, item)
  void mkdir(join(app.getPath('userData'), 'logs'), { recursive: true })
    .then(() =>
      appendFile(
        join(app.getPath('userData'), 'logs', 'erros.log'),
        `[${new Date().toISOString()}] ${linhaDoLog(url, status, nome)}\n`
      )
    )
    .catch(() => {}) // é o próprio registro: sem ele não há onde anotar
  return new ErroApp(t(FALHAS[classificarFalha(status)], { item: nome }), detalhe)
}

async function pedir(
  url: string,
  timeoutMs?: number,
  aceitar404 = false,
  extra?: RequestInit,
  item?: string
): Promise<Response> {
  let resposta: Response
  try {
    resposta = await fetch(urlDeVerdade(url), {
      ...extra,
      headers: {
        'User-Agent': userAgent(),
        ...(extra?.headers as Record<string, string> | undefined)
      },
      // O sinal de quem chamou (ex.: Cancelar) vale junto com o tempo limite.
      signal:
        timeoutMs && extra?.signal
          ? AbortSignal.any([AbortSignal.timeout(timeoutMs), extra.signal])
          : timeoutMs
            ? AbortSignal.timeout(timeoutMs)
            : (extra?.signal ?? undefined)
    })
  } catch (e) {
    throw falhaDeDownload(url, null, item, `${url}\n${detalhar(e)}`)
  }
  if (!resposta.ok && !(aceitar404 && resposta.status === 404)) {
    throw falhaDeDownload(
      url,
      resposta.status,
      item,
      t('p.rede.http', { url, status: resposta.status, statusText: resposta.statusText })
    )
  }
  return resposta
}

// `extra` permite POST e cabeçalhos próprios (ex.: o User-Agent que o Modrinth exige).
// `item` (todas as funções): o que está sendo baixado, para a mensagem de erro.
export async function buscarJson<T>(url: string, extra?: RequestInit, item?: string): Promise<T> {
  return (await pedir(url, 30_000, false, extra, item)).json() as Promise<T>
}

// Igual ao buscarJson, mas devolve null quando o site diz "não encontrado" (404 ou 204).
export async function buscarJsonOpcional<T>(url: string, item?: string): Promise<T | null> {
  const resposta = await pedir(url, 30_000, true, undefined, item)
  if (resposta.status === 404 || resposta.status === 204) return null
  return resposta.json() as Promise<T>
}

export async function buscarBytes(url: string, item?: string): Promise<Buffer> {
  return Buffer.from(await (await pedir(url, 30_000, false, undefined, item)).arrayBuffer())
}

// Baixa para um arquivo temporário e só troca pelo definitivo se o checksum bater.
export async function baixar(
  url: string,
  destino: string,
  checksum: Checksum | undefined,
  etapa: string,
  aoProgredir: AoProgredir,
  sinal?: AbortSignal, // Cancelar: interrompe o download no meio
  item?: string
): Promise<void> {
  const resposta = await pedir(url, undefined, false, sinal ? { signal: sinal } : undefined, item)
  const total = Number(resposta.headers.get('content-length')) || 0
  const temporario = `${destino}.baixando`
  const hash = checksum && createHash(checksum.algoritmo)
  let recebido = 0
  let ultimoAviso = 0
  aoProgredir({ etapa, recebido, total })

  try {
    await pipeline(
      // O fetch e o Node usam tipos de stream com o mesmo formato, mas com nomes diferentes.
      Readable.fromWeb(resposta.body as WebReadableStream),
      async function* (origem: AsyncIterable<Buffer>) {
        for await (const pedaco of origem) {
          hash?.update(pedaco)
          recebido += pedaco.length
          if (Date.now() - ultimoAviso > 100) {
            ultimoAviso = Date.now()
            aoProgredir({ etapa, recebido, total })
          }
          yield pedaco
        }
      },
      createWriteStream(temporario)
    )
  } catch (e) {
    await rm(temporario, { force: true })
    throw new ErroApp(
      t('p.rede.oDownloadFoiInterrompidoConfira', { item: nomeDoItem(url, item) }),
      `${url}\n${detalhar(e)}`
    )
  }

  if (hash && checksum) {
    const obtido = hash.digest('hex')
    if (obtido !== checksum.valor.toLowerCase()) {
      await rm(temporario, { force: true })
      throw new ErroApp(
        t('p.rede.oArquivoBaixadoVeioCorrompido', { item: nomeDoItem(url, item) }),
        `${url}\n${checksum.algoritmo} esperado: ${checksum.valor}\n${checksum.algoritmo} obtido: ${obtido}`
      )
    }
  }

  await rename(temporario, destino)
  aoProgredir({ etapa, recebido, total: total || recebido })
}
