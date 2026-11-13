import { appendFile, readFile } from 'fs/promises'
import { join } from 'path'
import type { AcaoApp, InfoServidor } from '../shared/tipos'
import { registrarNoConsole } from './servidor'

// Registro do que o app fez sozinho (ex.: "Desligado por ficar 15 min vazio"), um arquivo por
// servidor. Aparece em Registro de eventos › Ações do app e também no console.
const ARQUIVO = 'servsquare-acoes.log'
const MOSTRAR = 500

export async function registrarAcao(info: InfoServidor, texto: string): Promise<void> {
  registrarNoConsole(`[ServSquare] ${texto}`)
  // shortcut: o arquivo só cresce (uma linha curta por ação); limpar se algum dia pesar.
  await appendFile(
    join(info.pasta, ARQUIVO),
    `${new Date().toISOString()}\t${texto.replace(/[\r\n\t]/g, ' ')}\n`
  ).catch(() => {})
}

// As mais recentes primeiro.
export async function lerAcoes(info: InfoServidor): Promise<AcaoApp[]> {
  const texto = await readFile(join(info.pasta, ARQUIVO), 'utf8').catch(() => '')
  return texto
    .split('\n')
    .filter(Boolean)
    .slice(-MOSTRAR)
    .reverse()
    .map((l) => {
      const [data, ...resto] = l.split('\t')
      return { data, texto: resto.join(' ') }
    })
}
