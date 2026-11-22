import { ErroApp } from '../erros'
import { versoesRelease } from '../mojang'
import { buscarBytes, buscarJson } from '../rede'
import { compararVersoes } from '../../shared/versoes'
import {
  FORGE_MAIS_ANTIGO,
  ehForgeAntigo,
  forgeSemSuporte,
  nomeNoMaven,
  urlDoMaven,
  versoesDoMetadata
} from '../../shared/forgeAntigoRegras'
import type { TipoServidor } from '.'
import { argumentosDoInstalador, rodarInstalador } from './instalador'
import { escolherForge } from './versoesLoader'
import { t } from '../../shared/i18n'

const PROMOS = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
const MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge'

// Abaixo do 1.7.10 não há um caminho confiável (docs/forge-antigo.md): continua recusado.
export function exigirForgeSuportado(loader: string, versao: string): void {
  if (forgeSemSuporte(loader, versao)) throw new ErroApp(t('tipos.forge.forgeAntesDa1710'))
}

export async function versoesForge(): Promise<Map<string, string>> {
  return escolherForge((await buscarJson<{ promos: Record<string, string> }>(PROMOS)).promos)
}

// Fase F1: o nome do build antigo no maven (às vezes com o sufixo "-<versão>"), pelo
// maven-metadata.xml do próprio Forge.
export async function nomeDoForgeAntigo(versao: string, numero: string): Promise<string> {
  const xml = await buscarBytes(`${MAVEN}/maven-metadata.xml`, t('p.rede.itemListaDoForge'))
  const nome = nomeNoMaven(versoesDoMetadata(xml.toString('utf8')), versao, numero)
  if (!nome) throw new ErroApp(t('tipos.forge.oForgeAindaNaoTem', { versao }))
  return nome
}

export const forge: TipoServidor = {
  async listarVersoes() {
    const [releases, doForge] = await Promise.all([versoesRelease(), versoesForge()])
    return releases.filter((v) => doForge.has(v) && compararVersoes(v, FORGE_MAIS_ANTIGO) >= 0)
  },

  async instalar(versao, pasta, java, aoProgredir, versaoLoader) {
    exigirForgeSuportado('forge', versao)
    const numero = versaoLoader ?? (await versoesForge()).get(versao)
    if (!numero) throw new ErroApp(t('tipos.forge.oForgeAindaNaoTem', { versao }))
    // Fase F1: de 1.7.10 a 1.12.1, o instalador antigo (nome pelo metadata e sem pasta de destino).
    const antigo = ehForgeAntigo(versao)
    const completa = antigo ? await nomeDoForgeAntigo(versao, numero) : `${versao}-${numero}`
    await rodarInstalador(
      `Forge ${numero}`,
      antigo
        ? urlDoMaven(completa, 'installer')
        : `${MAVEN}/${completa}/forge-${completa}-installer.jar`,
      pasta,
      java,
      aoProgredir,
      antigo
    )
    return numero
  },

  argumentos: (pasta) => argumentosDoInstalador(pasta, 'Forge')
}
