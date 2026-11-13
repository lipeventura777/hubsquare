import { join } from 'path'
import { ErroApp } from '../erros'
import { detalhesVersao, versoesRelease } from '../mojang'
import { baixar } from '../rede'
import type { TipoServidor } from '.'

export const vanilla: TipoServidor = {
  listarVersoes: versoesRelease,

  async argumentos() {
    return ['-jar', 'server.jar', 'nogui']
  },

  async instalar(versao, pasta, _java, aoProgredir) {
    const destino = join(pasta, 'server.jar')
    const servidor = (await detalhesVersao(versao)).downloads.server
    if (!servidor) {
      throw new ErroApp(`A versão ${versao} não tem servidor oficial. Escolha outra versão.`)
    }
    await baixar(
      servidor.url,
      destino,
      { algoritmo: 'sha1', valor: servidor.sha1 },
      `Baixando o servidor Vanilla ${versao}`,
      aoProgredir
    )
    return null
  }
}
