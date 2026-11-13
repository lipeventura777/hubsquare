import { dialog, type BrowserWindow } from 'electron'
import { readFile, readdir, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'
import { gunzip } from 'zlib'
import type { ArquivoLog, InfoServidor, RelatorioTravamento } from '../shared/tipos'
import { caminhoNoServidor } from './caminhoServidor'
import { causaProvavel } from './causaTravamento'
import { ErroApp } from './erros'

// Registro de eventos: logs/latest.log + logs/*.log.gz e crash-reports/*.txt.
// Só abre arquivos que aparecem nessas listas, sempre pela checagem de caminho da tela Arquivos.

const PASTAS = { logs: 'logs', travamentos: 'crash-reports' } as const
type Tipo = keyof typeof PASTAS

const ACEITA: Record<Tipo, (nome: string) => boolean> = {
  logs: (n) => n === 'latest.log' || n.endsWith('.log.gz'),
  travamentos: (n) => n.endsWith('.txt')
}

// shortcut: arquivos enormes mostram só o final (4 MB); o arquivo completo continua em "Baixar".
const LIMITE = 4 * 1024 * 1024

async function listar(info: InfoServidor, tipo: Tipo): Promise<ArquivoLog[]> {
  const pasta = await caminhoNoServidor(info.pasta, PASTAS[tipo])
  const nomes = await readdir(pasta).catch(() => [] as string[])
  const lista = await Promise.all(
    nomes.filter(ACEITA[tipo]).map(async (nome) => {
      const s = await stat(join(pasta, nome))
      return { nome, tamanho: s.size, data: s.mtime.toISOString() }
    })
  )
  return lista.sort((a, b) => b.data.localeCompare(a.data))
}

export const listarLogs = (info: InfoServidor): Promise<ArquivoLog[]> => listar(info, 'logs')
export const listarTravamentos = (info: InfoServidor): Promise<ArquivoLog[]> =>
  listar(info, 'travamentos')

async function lerTextoCompleto(info: InfoServidor, tipo: Tipo, valor: unknown): Promise<string> {
  const nome = typeof valor === 'string' ? valor : ''
  if (!(await listar(info, tipo)).some((a) => a.nome === nome)) {
    throw new ErroApp('Esse arquivo não existe mais. Atualize a lista.')
  }
  const dados = await readFile(await caminhoNoServidor(info.pasta, `${PASTAS[tipo]}/${nome}`))
  return (nome.endsWith('.gz') ? await promisify(gunzip)(dados) : dados).toString('utf8')
}

export async function lerLog(info: InfoServidor, nome: unknown): Promise<string> {
  const texto = await lerTextoCompleto(info, 'logs', nome)
  if (texto.length <= LIMITE) return texto
  const resto = texto.slice(-LIMITE)
  return `[ServSquare] Arquivo grande: mostrando só o final. Use "Baixar" para ver tudo.\n${resto.slice(resto.indexOf('\n') + 1)}`
}

export async function lerTravamento(
  info: InfoServidor,
  nome: unknown
): Promise<RelatorioTravamento> {
  const texto = await lerTextoCompleto(info, 'travamentos', nome)
  return { texto, causa: causaProvavel(texto) }
}

// Salva o texto (já descompactado) onde o usuário escolher. false se cancelar.
export async function baixarLog(
  info: InfoServidor,
  tipo: unknown,
  nome: unknown,
  janela: BrowserWindow | null
): Promise<boolean> {
  if (tipo !== 'logs' && tipo !== 'travamentos') throw new ErroApp('Tipo de registro desconhecido.')
  const texto = await lerTextoCompleto(info, tipo, nome)
  const opcoes = {
    title: 'Salvar cópia',
    defaultPath: String(nome)
      .replace(/\.gz$/, '')
      .replace(/\.log$/, '.txt')
  }
  const escolha = janela
    ? await dialog.showSaveDialog(janela, opcoes)
    : await dialog.showSaveDialog(opcoes)
  if (escolha.canceled || !escolha.filePath) return false
  await writeFile(escolha.filePath, texto)
  return true
}
