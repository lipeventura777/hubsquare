import { useEffect, useState } from 'react'

interface Endereco {
  endereco: string | null
  aviso: string
}

const DESLIGADO: Endereco = { endereco: null, aviso: 'Ligue o servidor para gerar o endereço.' }

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
      if (!r.ok) return definir(null, 'Não consegui ler a conexão. Abra a tela Conexão.')
      const { modo, porta, playit, radminIp, lanIp } = r.valor
      if (modo === 'playit') {
        return playit.endereco
          ? definir(playit.endereco)
          : definir(null, 'Configure o playit.gg na tela Conexão.')
      }
      if (modo === 'radmin') {
        return radminIp
          ? definir(`${radminIp}:${porta}`)
          : definir(null, 'Radmin VPN fechado ou desconectado.')
      }
      if (modo === 'lan') {
        return lanIp ? definir(`${lanIp}:${porta}`) : definir(null, 'Rede local não encontrada.')
      }
      const ip = await window.api.lerIpPublico()
      return ip.ok && ip.valor
        ? definir(`${ip.valor}:${porta}`)
        : definir(null, 'Não consegui descobrir o IP público.')
    })
    return () => {
      ativo = false
    }
  }, [ligado])

  return ligado ? resultado : DESLIGADO
}
