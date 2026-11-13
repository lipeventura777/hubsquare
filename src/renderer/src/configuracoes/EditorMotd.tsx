import { useRef, useState } from 'react'
import {
  CARACTERES_POR_LINHA,
  CORES_MOTD,
  ESTILOS_MOTD,
  MAX_MOTD,
  semCodigos
} from '../../../shared/motd'
import { IconeDoServidor } from '../componentes/IconeDoServidor'
import { MotdFormatado } from '../componentes/MotdFormatado'
import { Campo } from '../componentes/ui'

const ROTULO_ESTILO: Record<string, React.ReactNode> = {
  l: <b>N</b>,
  o: <i>I</i>,
  n: <u>S</u>,
  m: <s>R</s>,
  r: 'Limpar'
}

// Editor do MOTD (Fase 21): duas linhas, botões que inserem os códigos § e prévia da lista.
export function EditorMotd({
  valor,
  aoMudar,
  nome,
  icone,
  maxJogadores
}: {
  valor: string
  aoMudar: (motd: string) => void
  nome: string
  icone: string | null
  maxJogadores: number
}): React.JSX.Element {
  const campos = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const [foco, setFoco] = useState(0)
  const linhas = [valor.split('\n')[0] ?? '', valor.split('\n')[1] ?? '']

  function mudarLinha(i: number, texto: string): void {
    const novas = [...linhas]
    novas[i] = texto.replace(/[\r\n]/g, '')
    aoMudar(novas[1] ? novas.join('\n') : novas[0])
  }

  // Insere "§x" onde está o cursor da linha escolhida e devolve o cursor para depois do código.
  function inserir(codigo: string): void {
    const campo = campos[foco].current
    const texto = linhas[foco]
    const inicio = campo?.selectionStart ?? texto.length
    const fim = campo?.selectionEnd ?? texto.length
    mudarLinha(foco, `${texto.slice(0, inicio)}§${codigo}${texto.slice(fim)}`)
    requestAnimationFrame(() => {
      campo?.focus()
      campo?.setSelectionRange(inicio + 2, inicio + 2)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px]">Mensagem do servidor (MOTD)</span>
      <div className="flex flex-wrap items-center gap-1" aria-label="Cores">
        {CORES_MOTD.map((c) => (
          <button
            key={c.codigo}
            type="button"
            title={`${c.nome} (§${c.codigo})`}
            aria-label={`Cor ${c.nome}`}
            onMouseDown={(e) => e.preventDefault()} // não tira o foco do campo
            onClick={() => inserir(c.codigo)}
            style={{ background: c.cor }}
            className="h-6 w-6 border border-linha transition-[border-color,transform] duration-(--dur-fast) hover:border-texto active:translate-y-px active:duration-(--dur-instant)"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1" aria-label="Estilos">
        {ESTILOS_MOTD.map((e) => (
          <button
            key={e.codigo}
            type="button"
            title={`${e.nome} (§${e.codigo})`}
            aria-label={e.nome}
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => inserir(e.codigo)}
            className="h-8 min-w-8 border border-linha bg-panel-2 px-2 text-[13px] transition-[background-color,transform] duration-(--dur-fast) hover:bg-tile-active active:translate-y-px active:duration-(--dur-instant)"
          >
            {ROTULO_ESTILO[e.codigo]}
          </button>
        ))}
      </div>

      {linhas.map((linha, i) => {
        const visiveis = semCodigos(linha).length
        return (
          <label key={i} className="flex flex-col gap-1 text-[13px]">
            <span className="flex justify-between text-xs text-muted">
              <span>Linha {i + 1}</span>
              <span className={visiveis > CARACTERES_POR_LINHA ? 'text-warning' : ''}>
                {visiveis}/{CARACTERES_POR_LINHA}
              </span>
            </span>
            <Campo
              ref={campos[i]}
              value={linha}
              maxLength={MAX_MOTD}
              onFocus={() => setFoco(i)}
              onChange={(e) => mudarLinha(i, e.target.value)}
              className="font-mono"
            />
          </label>
        )
      })}
      <span className="text-xs text-muted">
        Clique numa linha e depois numa cor ou estilo: o código entra onde está o cursor. Passando
        de {CARACTERES_POR_LINHA} letras, a linha pode ser cortada no jogo. Total: {valor.length}/
        {MAX_MOTD}.
      </span>

      <PreviaLista nome={nome} icone={icone} motd={valor} maxJogadores={maxJogadores} />
    </div>
  )
}

// Lembra a lista de servidores do jogo, com o visual do app (sem fonte nem texturas do jogo).
function PreviaLista({
  nome,
  icone,
  motd,
  maxJogadores
}: {
  nome: string
  icone: string | null
  motd: string
  maxJogadores: number
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">Prévia na lista de servidores</span>
      <div className="flex max-w-[620px] gap-3 border border-linha bg-console p-2">
        <IconeDoServidor icone={icone} nome={nome} tam={64} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate font-bold text-white" title={nome}>
              {nome}
            </span>
            <span className="text-xs text-console-muted">0/{maxJogadores}</span>
            <Sinal />
          </div>
          <MotdFormatado motd={motd} corPadrao="#aaaaaa" className="text-[13px] leading-5" />
        </div>
      </div>
    </div>
  )
}

// Barrinhas de conexão desenhadas pelo app.
function Sinal(): React.JSX.Element {
  return (
    <span aria-hidden="true" className="flex h-3 items-end gap-px">
      {[3, 5, 7, 9, 12].map((h) => (
        <span key={h} style={{ height: h }} className="w-[3px] bg-online" />
      ))}
    </span>
  )
}
