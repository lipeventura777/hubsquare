import {
  DIFICULDADES,
  MODOS,
  NOMES_DIFICULDADES,
  NOMES_MODOS,
  type Configuracoes,
  type Dificuldade,
  type LimitesRam,
  type ModoDeJogo
} from '../../../shared/tipos'
import { CaixaSelecao, Campo, Secao, Selecao, Slider } from '../componentes/ui'
import { EditorMotd } from './EditorMotd'

// Campos de jogo usados na tela Configurações e no assistente de primeira vez (seção 6.7).
export function CamposDoJogo({
  config,
  ram,
  mudar,
  nome,
  icone = null
}: {
  config: Configuracoes
  ram: LimitesRam
  mudar: <K extends keyof Configuracoes>(chave: K, valor: Configuracoes[K]) => void
  nome: string // para a prévia do MOTD
  icone?: string | null
}): React.JSX.Element {
  return (
    <>
      <Secao titulo="Jogo">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-[13px]">
            Modo de jogo
            <Selecao
              value={config.modoDeJogo}
              onChange={(e) => mudar('modoDeJogo', e.target.value as ModoDeJogo)}
            >
              {MODOS.map((m) => (
                <option key={m} value={m}>
                  {NOMES_MODOS[m]}
                </option>
              ))}
            </Selecao>
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            Dificuldade
            <Selecao
              value={config.dificuldade}
              onChange={(e) => mudar('dificuldade', e.target.value as Dificuldade)}
            >
              {DIFICULDADES.map((d) => (
                <option key={d} value={d}>
                  {NOMES_DIFICULDADES[d]}
                </option>
              ))}
            </Selecao>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-[13px]">
          Máximo de jogadores
          <Campo
            type="number"
            min={1}
            max={1000}
            value={config.maxJogadores}
            onChange={(e) => mudar('maxJogadores', e.target.valueAsNumber)}
            className="w-32"
          />
        </label>
      </Secao>

      <Secao titulo="Mensagem na lista de servidores">
        <EditorMotd
          valor={config.motd}
          aoMudar={(m) => mudar('motd', m)}
          nome={nome}
          icone={icone}
          maxJogadores={config.maxJogadores || 20}
        />
      </Secao>

      <Secao titulo="Regras">
        <CaixaSelecao marcada={config.pvp} aoMudar={(v) => mudar('pvp', v)}>
          PvP (jogadores podem atacar uns aos outros)
        </CaixaSelecao>
      </Secao>

      <Secao titulo="Desempenho">
        <Slider
          rotulo={`RAM do servidor (sugerido para este PC: ${ram.sugerida} GB)`}
          valor={config.ramGb}
          min={ram.min}
          max={ram.max}
          aoMudar={(v) => mudar('ramGb', v)}
          formatar={(v) => `${v} GB`}
        />
      </Secao>
    </>
  )
}
