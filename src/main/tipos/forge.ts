import { ErroApp } from '../erros'
import { versoesRelease } from '../mojang'
import { buscarJson } from '../rede'
import { compararVersoes } from '../../shared/versoes'
import type { TipoServidor } from '.'
import { argumentosDoInstalador, rodarInstalador } from './instalador'
import { escolherForge } from './versoesLoader'

const PROMOS = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
const MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge'
// shortcut: instaladores de antes do 1.12.2 têm outro formato; liberar se alguém pedir.
const MAIS_ANTIGA = '1.12.2'

export async function versoesForge(): Promise<Map<string, string>> {
  return escolherForge((await buscarJson<{ promos: Record<string, string> }>(PROMOS)).promos)
}

export const forge: TipoServidor = {
  async listarVersoes() {
    const [releases, doForge] = await Promise.all([versoesRelease(), versoesForge()])
    return releases.filter((v) => doForge.has(v) && compararVersoes(v, MAIS_ANTIGA) >= 0)
  },

  async instalar(versao, pasta, java, aoProgredir, versaoLoader) {
    const numero = versaoLoader ?? (await versoesForge()).get(versao)
    if (!numero) throw new ErroApp(`O Forge ainda não tem o ${versao}. Escolha outra versão.`)
    const completa = `${versao}-${numero}`
    await rodarInstalador(
      `Forge ${numero}`,
      `${MAVEN}/${completa}/forge-${completa}-installer.jar`,
      pasta,
      java,
      aoProgredir
    )
    return numero
  },

  argumentos: (pasta) => argumentosDoInstalador(pasta, 'Forge')
}
