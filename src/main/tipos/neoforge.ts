import { ErroApp } from '../erros'
import { versoesRelease } from '../mojang'
import { buscarJson } from '../rede'
import type { TipoServidor } from '.'
import { argumentosDoInstalador, rodarInstalador } from './instalador'
import { escolherNeoForge } from './versoesLoader'

const API = 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'
const MAVEN = 'https://maven.neoforged.net/releases/net/neoforged/neoforge'

export async function versoesNeoForge(): Promise<Map<string, string>> {
  return escolherNeoForge((await buscarJson<{ versions: string[] }>(API)).versions)
}

export const neoforge: TipoServidor = {
  async listarVersoes() {
    const [releases, doNeo] = await Promise.all([versoesRelease(), versoesNeoForge()])
    return releases.filter((v) => doNeo.has(v))
  },

  async instalar(versao, pasta, java, aoProgredir, versaoLoader) {
    const numero = versaoLoader ?? (await versoesNeoForge()).get(versao)
    if (!numero) throw new ErroApp(`O NeoForge ainda não tem o ${versao}. Escolha outra versão.`)
    await rodarInstalador(
      `NeoForge ${numero}`,
      `${MAVEN}/${numero}/neoforge-${numero}-installer.jar`,
      pasta,
      java,
      aoProgredir
    )
    return numero
  },

  argumentos: (pasta) => argumentosDoInstalador(pasta, 'NeoForge')
}
