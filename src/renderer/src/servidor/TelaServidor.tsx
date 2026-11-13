import { useEffect, useState } from 'react'
import type { ErroTela, InfoServidor } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Esqueleto } from '../componentes/movimento'
import { Assistente } from '../assistente/Assistente'
import { PainelServidor } from './PainelServidor'

// Mostra o servidor que já existe ou, se não houver, o assistente para criar um.
export function TelaServidor({ aba }: { aba: string }): React.JSX.Element {
  const [servidor, setServidor] = useState<InfoServidor | null | undefined>(undefined)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    window.api.servidorAtual().then((r) => (r.ok ? setServidor(r.valor) : setErro(r.erro)))
  }, [])

  if (erro)
    return (
      <div className="p-6">
        <MensagemErro erro={erro} />
      </div>
    )
  if (servidor === undefined) {
    return (
      <div className="p-6">
        <Esqueleto linhas={4} />
      </div>
    )
  }
  if (servidor === null) return <Assistente aoConcluir={setServidor} />
  return <PainelServidor info={servidor} aba={aba} />
}
