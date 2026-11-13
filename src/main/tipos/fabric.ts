import { rm } from 'fs/promises'
import { join } from 'path'
import { ErroApp } from '../erros'
import { versoesRelease } from '../mojang'
import { baixar, buscarJson } from '../rede'
import type { TipoServidor } from '.'

// API oficial do Fabric (meta.fabricmc.net). O "server jar" é um lançador pequeno que,
// na primeira vez que liga, baixa o servidor oficial e as bibliotecas do Fabric.
const META = 'https://meta.fabricmc.net/v2'
const JAR = 'fabric-server-launch.jar'

interface ItemMeta {
  version: string
  stable: boolean
}

export async function maisNovaEstavel(caminho: 'loader' | 'installer' | 'game'): Promise<string> {
  const item = (await buscarJson<ItemMeta[]>(`${META}/versions/${caminho}`)).find((i) => i.stable)
  if (!item) throw new ErroApp('O Fabric não tem uma versão estável agora. Tente mais tarde.')
  return item.version
}

export const fabric: TipoServidor = {
  async listarVersoes() {
    const [releases, jogo] = await Promise.all([
      versoesRelease(),
      buscarJson<ItemMeta[]>(`${META}/versions/game`)
    ])
    const doFabric = new Set(jogo.filter((v) => v.stable).map((v) => v.version))
    return releases.filter((v) => doFabric.has(v))
  },

  async instalar(versao, pasta, _java, aoProgredir, versaoLoader) {
    const [loader, instalador] = await Promise.all([
      versaoLoader ?? maisNovaEstavel('loader'),
      maisNovaEstavel('installer')
    ])
    // O lançador usa o server.jar da pasta como servidor oficial. Um jar de outro loader ou
    // de outra versão estragaria a partida, então ele sai e o Fabric baixa o certo.
    await rm(join(pasta, 'server.jar'), { force: true })
    await rm(join(pasta, 'fabric-server-launcher.properties'), { force: true })
    // A meta gera esse jar na hora e não publica checksum; o download é por HTTPS do site oficial.
    await baixar(
      `${META}/versions/loader/${encodeURIComponent(versao)}/${loader}/${instalador}/server/jar`,
      join(pasta, JAR),
      undefined,
      `Baixando o Fabric ${loader} para o ${versao}`,
      aoProgredir
    )
    return loader
  },

  async argumentos() {
    return ['-jar', JAR, 'nogui']
  }
}
