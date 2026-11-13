import { app } from 'electron'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import {
  conviteNosArgumentos,
  decidirModo,
  MODOS_APP,
  podeUsarModoAmigo,
  type ModoApp
} from '../shared/modoRegras'
import type { EstadoModo } from '../shared/tipos'
import { gravarComSeguranca, lerTexto } from './config'
import { ErroApp } from './erros'
import { lerIndice } from './servidores'

// Modo do app (Fase M6): completo (ServSquare + PlaySquare) ou amigo (só o PlaySquare, sem os
// serviços do ServSquare). Guardado em modo-app.json, na pasta de dados; trocar de modo nunca
// apaga nada do ServSquare.

const arquivo = (): string => join(app.getPath('userData'), 'modo-app.json')

let modo: ModoApp | null = null
let sugerirAmigo = false
let convite: string | null = null

async function lerSalvo(): Promise<ModoApp | null> {
  try {
    const m = (JSON.parse(await lerTexto(arquivo())) as { modo?: unknown }).modo
    return MODOS_APP.includes(m as ModoApp) ? (m as ModoApp) : null
  } catch {
    return null
  }
}

const gravar = (m: ModoApp): Promise<void> =>
  gravarComSeguranca(arquivo(), JSON.stringify({ modo: m }, null, 2))

// O convite que abriu o app (link ou o conteúdo do arquivo .hubsquare), para já vir colado.
export async function conviteDosArgumentos(argv: string[]): Promise<string | null> {
  const c = conviteNosArgumentos(argv)
  if (!c) return null
  if ('link' in c) return c.link
  try {
    if ((await stat(c.arquivo)).size > 5_000_000) return null
    return await readFile(c.arquivo, 'utf8')
  } catch {
    return null
  }
}

export async function decidirAoAbrir(argv: string[]): Promise<ModoApp | null> {
  const salvo = await lerSalvo()
  convite = await conviteDosArgumentos(argv)
  const temServidores = (await lerIndice()).servidores.length > 0
  const d = decidirModo({ salvo, temServidores, abertoPorConvite: !!convite })
  modo = d.modo
  sugerirAmigo = d.sugerirAmigo
  // Quem já tinha servidores fica gravado no completo (não vê as boas-vindas depois).
  if (!salvo && d.modo) await gravar(d.modo)
  return modo
}

export const modoAtual = (): ModoApp | null => modo

export function estadoModo(): EstadoModo {
  return { modo, sugerirAmigo, convite }
}

// O convite já foi para a tela: não volta a aparecer.
export function convitePegou(): void {
  convite = null
}

export function guardarConvite(texto: string): void {
  convite = texto
}

export async function escolherModo(valor: unknown, estadoServidor: string): Promise<ModoApp> {
  if (!MODOS_APP.includes(valor as ModoApp)) throw new ErroApp('Escolha um modo da lista.')
  if (valor === 'amigo' && !podeUsarModoAmigo(estadoServidor)) {
    throw new ErroApp('Desligue o servidor antes de usar só o PlaySquare.')
  }
  modo = valor as ModoApp
  sugerirAmigo = false
  await gravar(modo)
  return modo
}
