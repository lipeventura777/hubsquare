import { useState } from 'react'
import { OPCOES_EXCLUSAO, type ErroTela, type OpcaoExclusao } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { CardPainel } from '../componentes/paineis'
import { useEstadoServidor } from '../servidor/comandos'
import { Aviso, Botao, CaixaSelecao, Dialogo } from '../componentes/ui'

const NOMES: Record<OpcaoExclusao, string> = {
  xp: 'Experiência',
  inventario: 'Inventário e armadura',
  ender: 'Baú do Ender',
  dados: 'Arquivo do jogador (posição, vida, itens e o resto)',
  estatisticas: 'Estatísticas',
  avancos: 'Conquistas (avanços)'
}

// Zona de perigo (DESIGN.md, 6.20): apaga dados do jogador com o servidor desligado,
// sempre depois de um backup do mundo feito pelo próprio app.
export function ZonaDePerigo({
  nome,
  aoApagar
}: {
  nome: string
  aoApagar: () => void
}): React.JSX.Element {
  const { estado } = useEstadoServidor()
  const [marcadas, setMarcadas] = useState<OpcaoExclusao[]>([])
  const [confirmando, setConfirmando] = useState(false)
  const [apagando, setApagando] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [pronto, setPronto] = useState(false)
  const desligado = estado === 'desligado'
  const todas = marcadas.length === OPCOES_EXCLUSAO.length

  const marcar = (o: OpcaoExclusao, sim: boolean): void =>
    setMarcadas((m) => (sim ? [...m, o] : m.filter((x) => x !== o)))

  async function apagar(): Promise<void> {
    setApagando(true)
    setErro(null)
    setPronto(false)
    const r = await window.api.excluirDadosJogador(nome, marcadas)
    setApagando(false)
    setConfirmando(false)
    if (!r.ok) return setErro(r.erro)
    setMarcadas([])
    setPronto(true)
    aoApagar()
  }

  return (
    <CardPainel titulo="Zona de perigo" className="border-t-2 border-t-danger">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Pilula>
            <CaixaSelecao
              marcada={todas}
              aoMudar={(sim) => setMarcadas(sim ? [...OPCOES_EXCLUSAO] : [])}
            >
              Selecionar todos
            </CaixaSelecao>
          </Pilula>
          {OPCOES_EXCLUSAO.map((o) => (
            <Pilula key={o}>
              <CaixaSelecao marcada={marcadas.includes(o)} aoMudar={(sim) => marcar(o, sim)}>
                {NOMES[o]}
              </CaixaSelecao>
            </Pilula>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!desligado && (
            <span className="text-xs text-muted">Desligue o servidor para apagar dados.</span>
          )}
          <Botao
            variante="perigo"
            disabled={!marcadas.length || !desligado}
            onClick={() => setConfirmando(true)}
          >
            Apagar dados
          </Botao>
        </div>
        {pronto && (
          <Aviso tipo="sucesso">Dados apagados. O backup está em Cópias de segurança.</Aviso>
        )}
        {erro && <MensagemErro erro={erro} />}
      </div>

      <Dialogo
        aberto={confirmando}
        titulo={`Apagar dados de ${nome}?`}
        aoCancelar={() => setConfirmando(false)}
        acao={{ rotulo: 'Apagar', variante: 'perigo', aoClicar: apagar, ocupado: apagando }}
      >
        <p>Vai ser apagado:</p>
        <ul className="my-2 list-disc pl-5">
          {OPCOES_EXCLUSAO.filter((o) => marcadas.includes(o)).map((o) => (
            <li key={o}>{NOMES[o]}</li>
          ))}
        </ul>
        <p>Antes, o app faz um backup do mundo inteiro, que fica em Cópias de segurança.</p>
      </Dialogo>
    </CardPainel>
  )
}

function Pilula({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="border border-linha bg-panel-2 px-3">{children}</div>
}
