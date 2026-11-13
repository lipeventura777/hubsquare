import type { TipoId } from '../../shared/tipos'
import type { AoProgredir } from '../rede'
import { fabric } from './fabric'
import { forge } from './forge'
import { neoforge } from './neoforge'
import { paper } from './paper'
import { vanilla } from './vanilla'

// Cada tipo de servidor (loader) segue esta interface.
// Para um tipo novo: criar o arquivo, registrar aqui e em TipoId/NOMES_TIPOS (shared/tipos.ts).
export interface TipoServidor {
  // Versões do Minecraft que o loader aceita, da mais nova para a mais antiga.
  listarVersoes(): Promise<string[]>
  // Deixa a pasta pronta para ligar. `java` é o java.exe certo para a versão.
  // `versaoLoader` força uma versão do loader (ex.: a que o modpack exige); sem ela, usa a padrão.
  // Devolve a versão do loader instalada (null no Paper e no Vanilla).
  instalar(
    versao: string,
    pasta: string,
    java: string,
    aoProgredir: AoProgredir,
    versaoLoader?: string
  ): Promise<string | null>
  // O que vem depois da RAM e das flags do app no comando do Java.
  argumentos(pasta: string): Promise<string[]>
}

export const tiposDeServidor: Record<TipoId, TipoServidor> = {
  paper,
  vanilla,
  fabric,
  forge,
  neoforge
}

export function ehTipo(valor: unknown): valor is TipoId {
  return typeof valor === 'string' && Object.hasOwn(tiposDeServidor, valor)
}
