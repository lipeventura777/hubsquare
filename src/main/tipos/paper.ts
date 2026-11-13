import { join } from 'path'
import { ErroApp } from '../erros'
import { versoesRelease } from '../mojang'
import { baixar, buscarJson } from '../rede'
import type { TipoServidor } from '.'

// API Fill v3 do PaperMC (a v2 foi desativada).
const API = 'https://fill.papermc.io/v3/projects/paper'

interface Build {
  id: number
  downloads: Record<string, { url: string; checksums: { sha256: string } } | undefined>
}

// Build mais nova do Paper para a versão (para os avisos de atualização).
export async function ultimaBuildPaper(
  versao: string
): Promise<{ id: string; sha256: string } | null> {
  const build = await buscarJson<Build>(
    `${API}/versions/${encodeURIComponent(versao)}/builds/latest`
  )
  const jar = build.downloads['server:default']
  return jar ? { id: String(build.id), sha256: jar.checksums.sha256 } : null
}

export const paper: TipoServidor = {
  async listarVersoes() {
    const [releases, projeto] = await Promise.all([
      versoesRelease(),
      buscarJson<{ versions: Record<string, string[]> }>(API)
    ])
    // O Paper também lista pre-releases; fica só o que a Mojang marca como release.
    const doPaper = new Set(Object.values(projeto.versions).flat())
    return releases.filter((v) => doPaper.has(v))
  },

  async argumentos() {
    return ['-jar', 'server.jar', 'nogui']
  },

  async instalar(versao, pasta, _java, aoProgredir) {
    const destino = join(pasta, 'server.jar')
    const build = await buscarJson<Build>(
      `${API}/versions/${encodeURIComponent(versao)}/builds/latest`
    )
    const jar = build.downloads['server:default']
    if (!jar) throw new ErroApp(`O Paper ${versao} ainda não tem download. Escolha outra versão.`)
    await baixar(
      jar.url,
      destino,
      { algoritmo: 'sha256', valor: jar.checksums.sha256 },
      `Baixando o Paper ${versao} (build ${build.id})`,
      aoProgredir
    )
    return String(build.id)
  }
}
