import { useEffect, useState } from 'react'
import { t } from '../../../shared/i18n'

interface Endereco {
  endereco: string | null
  aviso: string
}

const DESLIGADO: Endereco = { endereco: null, aviso: t('useEnderecoAtivo.ligueOServidorParaGerar') }

// Endereço que os amigos usam, conforme o método "em uso" na tela Conexão.
// Sem endereço, devolve um aviso curto do que falta.
export function useEnderecoAtivo(ligado: boolean): Endereco {
  const [resultado, setResultado] = useState<Endereco>(DESLIGADO)

  useEffect(() => {
    if (!ligado) return
    let ativo = true
    const definir = (endereco: string | null, aviso = ''): void => {
      if (ativo) setResultado({ endereco, aviso })
    }
    window.api.lerConexao().then(async (r) => {
      if (!r.ok) return definir(null, t('useEnderecoAtivo.naoConseguiLerAConexao'))
      const { modo, porta, playit, radminIp, lanIp } = r.valor
      if (modo === 'playit') {
        return playit.endereco
          ? definir(playit.endereco)
          : definir(null, t('useEnderecoAtivo.configureOPlayitGgNa'))
      }
      if (modo === 'radmin') {
        return radminIp
          ? definir(`${radminIp}:${porta}`)
          : definir(null, t('useEnderecoAtivo.radminVpnFechadoOuDesconectado'))
      }
      if (modo === 'lan') {
        return lanIp
          ? definir(`${lanIp}:${porta}`)
          : definir(null, t('useEnderecoAtivo.redeLocalNaoEncontrada'))
      }
      const ip = await window.api.lerIpPublico()
      return ip.ok && ip.valor
        ? definir(`${ip.valor}:${porta}`)
        : definir(null, t('useEnderecoAtivo.naoConseguiDescobrirOIp'))
    })
    return () => {
      ativo = false
    }
  }, [ligado])

  return ligado ? resultado : DESLIGADO
}
