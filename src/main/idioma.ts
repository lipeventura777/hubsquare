import { app, BrowserWindow } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { definirIdioma, ehIdioma, idiomaAtual, type Idioma } from '../shared/i18n'
import {
  ARQUIVOS_DE_USO,
  decidirIdioma,
  idiomaDoInstalador,
  idiomaDoSistema
} from '../shared/idiomaRegras'
import { gravarComSeguranca } from './config'
import { ErroApp } from './erros'
import { t } from '../shared/i18n'

// Idioma do app (Fase I1), em idioma.json na pasta de dados. O instalador deixa a escolha dele em
// idioma-instalador.txt, na mesma pasta; ela só vale como sugestão na primeira abertura.

const pasta = (): string => app.getPath('userData')
const arquivo = (): string => join(pasta(), 'idioma.json')

let perguntar = false
const aoMudar: (() => void)[] = []

function ler(caminho: string): string | null {
  try {
    return readFileSync(caminho, 'utf8')
  } catch {
    return null
  }
}

// Síncrono e antes de tudo: o resto do processo principal já monta os textos no idioma certo.
export function iniciarIdioma(): void {
  let salvo: unknown = null
  try {
    salvo = (JSON.parse(ler(arquivo()) ?? '{}') as { idioma?: unknown }).idioma
  } catch {
    // arquivo estragado: decide de novo
  }
  const d = decidirIdioma({
    salvo,
    instalador: idiomaDoInstalador(ler(join(pasta(), 'idioma-instalador.txt'))),
    sistema: idiomaDoSistema(app.getPreferredSystemLanguages()),
    usadoAntes: ARQUIVOS_DE_USO.some((n) => existsSync(join(pasta(), n)))
  })
  definirIdioma(d.idioma)
  perguntar = d.perguntar
  // Instalação antiga: grava o português para não decidir de novo.
  if (!ehIdioma(salvo) && !d.perguntar) void gravar(d.idioma).catch(() => {})
}

const gravar = (idioma: Idioma): Promise<void> =>
  gravarComSeguranca(arquivo(), JSON.stringify({ idioma }, null, 2))

export const estadoIdioma = (): { idioma: Idioma; perguntar: boolean } => ({
  idioma: idiomaAtual(),
  perguntar
})

export function aoMudarIdioma(fn: () => void): void {
  aoMudar.push(fn)
}

// Troca na hora: o processo principal (bandeja, mensagens) muda já; a tela recarrega sozinha.
export async function escolherIdioma(valor: unknown): Promise<Idioma> {
  if (!ehIdioma(valor)) throw new ErroApp(t('p.idioma.escolhaUmIdiomaDaLista'))
  await gravar(valor)
  definirIdioma(valor)
  perguntar = false
  for (const fn of aoMudar) fn()
  for (const j of BrowserWindow.getAllWindows()) j.webContents.send('idioma:mudou', valor)
  return valor
}
