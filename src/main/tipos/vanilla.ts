import { join } from 'path'
import { ErroApp } from '../erros'
import { detalhesVersao, versoesRelease } from '../mojang'
import { baixar } from '../rede'
import type { TipoServidor } from '.'
import { t } from '../../shared/i18n'

export const vanilla: TipoServidor = {
  listarVersoes: versoesRelease,

  async argumentos() {
    return ['-jar', 'server.jar', 'nogui']
  },

  async instalar(versao, pasta, _java, aoProgredir) {
    const destino = join(pasta, 'server.jar')
    const servidor = (await detalhesVersao(versao)).downloads.server
    if (!servidor) {
      throw new ErroApp(t('tipos.vanilla.aVersaoNaoTemServidor', { versao }))
    }
    await baixar(
      servidor.url,
      destino,
      { algoritmo: 'sha1', valor: servidor.sha1 },
      `Baixando o servidor Vanilla ${versao}`,
      aoProgredir,
      undefined,
      t('p.rede.itemServidor', { nome: 'Vanilla', versao })
    )
    return null
  }
}
