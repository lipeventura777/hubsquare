import { useEffect, useState } from 'react'
import type { ErroTela, EstadoServidor, InfoServidor } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Esqueleto } from '../componentes/movimento'
import { PaginaAjustes, Secao } from '../componentes/ui'
import { BotaoRelatorio } from '../componentes/RelatorioErro'
import { AjusteAtualizacoes } from './AjusteAtualizacoes'
import { EditorIcone } from './EditorIcone'
import { OpcoesDoJogo } from './OpcoesDoJogo'
import { ListaDoServidor } from './Whitelist'

export function TelaConfiguracoes({ aba }: { aba: string }): React.JSX.Element {
  const [info, setInfo] = useState<InfoServidor | null | undefined>(undefined)
  const [estado, setEstado] = useState<EstadoServidor>('desligado')
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    window.api.servidorAtual().then((r) => (r.ok ? setInfo(r.valor) : setErro(r.erro)))
    window.api.lerConsole().then((c) => setEstado(c.estado))
    return window.api.aoMudarEstado((aviso) => setEstado(aviso.estado))
  }, [])

  return (
    <PaginaAjustes>
      {erro && <MensagemErro erro={erro} />}
      {info === undefined && !erro && <Esqueleto linhas={4} />}
      {info === null && <p>Nenhum servidor encontrado. Crie um servidor na tela Painel.</p>}
      {info && aba === 'Gerais' && (
        <>
          <Secao titulo="Ícone do servidor">
            <EditorIcone nome={info.nome} />
          </Secao>
          <OpcoesDoJogo estado={estado} nome={info.nome} />
          <Secao titulo="Atualizações">
            <AjusteAtualizacoes />
          </Secao>
        </>
      )}
      {info && aba === 'Whitelist' && <ListaDoServidor lista="whitelist" />}
      {aba === 'Gerais' && info !== undefined && (
        <Secao titulo="Ajuda">
          <p className="text-[13px] text-muted">
            Algo deu errado? O relatório junta os logs e as configurações, sem segredos, para quem
            for ajudar.
          </p>
          <div>
            <BotaoRelatorio />
          </div>
        </Secao>
      )}
    </PaginaAjustes>
  )
}
