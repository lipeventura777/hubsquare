import { useEffect, useState } from 'react'
import type { EstadoServidor, ErroTela, InfoServidor, Resultado } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { PaginaAjustes } from '../componentes/ui'
import { useEnderecoAtivo } from '../conexao/useEnderecoAtivo'
import { Backups } from './Backups'
import { BarraDeAcao } from './BarraDeAcao'
import { CardAtualizacoes } from './CardAtualizacoes'
import { Banner } from './Banner'
import { Console } from './Console'
import { ListaJogadores } from './ListaJogadores'
import { BotoesAtalhos } from '../comandos/Atalhos'

// Tela principal (DESIGN.md, seções 2 e 6.3 a 6.5). Abas: Painel, Console (tela cheia) e Backups.
export function PainelServidor({
  info,
  aba
}: {
  info: InfoServidor
  aba: string
}): React.JSX.Element {
  const [estado, setEstado] = useState<EstadoServidor>('desligado')
  const [erro, setErro] = useState<ErroTela | null>(null)
  const { endereco, aviso } = useEnderecoAtivo(estado === 'ligado')

  useEffect(() => {
    window.api.lerConsole().then((c) => setEstado(c.estado))
    return window.api.aoMudarEstado((a) => {
      setEstado(a.estado)
      if (a.erro) setErro(a.erro)
    })
  }, [])

  async function executar(acao: () => Promise<Resultado<void>>): Promise<void> {
    setErro(null)
    const r = await acao()
    if (!r.ok) setErro(r.erro)
  }

  if (aba === 'Backups') {
    return (
      <PaginaAjustes largo>
        <Backups estado={estado} />
      </PaginaAjustes>
    )
  }

  if (aba === 'Console') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-6">
        {erro && <MensagemErro erro={erro} />}
        <Console estado={estado} aoErro={setErro} />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <Banner info={info} endereco={endereco} aviso={aviso} />
      <BarraDeAcao
        info={info}
        estado={estado}
        endereco={endereco}
        aoLigarDesligar={() =>
          executar(estado === 'desligado' ? window.api.ligar : window.api.desligar)
        }
        aoReiniciar={() => executar(window.api.reiniciar)}
        aoAbrirPasta={() => executar(window.api.abrirPastaServidor)}
      />

      <div className="flex flex-col gap-4 p-6">
        {erro && <MensagemErro erro={erro} />}
        <CardAtualizacoes info={info} estado={estado} />

        {/* Atalhos com estrela (Comandos › Atalhos), no lugar dos 4 botões fixos de antes. */}
        <BotoesAtalhos ligado={estado === 'ligado'} />

        <div className="grid h-[360px] grid-cols-[2fr_1fr] gap-4">
          <Console estado={estado} aoErro={setErro} />
          <ListaJogadores aoErro={setErro} />
        </div>
      </div>
    </div>
  )
}
