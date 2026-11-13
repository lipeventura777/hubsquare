import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { EstadoServidor, ErroTela, LinhaConsole } from '../../../shared/tipos'
import { sugerir, type NoComando } from '../../../shared/comandos'
import { Flutuante } from '../componentes/Flutuante'
import { corDaLinha, useJogadores } from './comandos'
import { animacoesReduzidas } from '../componentes/movimento'

const LIMITE = 5000

// Junta linhas novas sem repetir as que já estão na tela (cada linha tem um número).
function juntar(atuais: LinhaConsole[], novas: LinhaConsole[]): LinhaConsole[] {
  const ultima = atuais.at(-1)?.n ?? -1
  return [...atuais, ...novas.filter((l) => l.n > ultima)].slice(-LIMITE)
}

// Console ao vivo com o campo de comando ("> ..."). O histórico fica no processo principal,
// então trocar de aba não perde nada.
export function Console({
  estado,
  aoErro
}: {
  estado: EstadoServidor
  aoErro: (erro: ErroTela | null) => void
}): React.JSX.Element {
  const [linhas, setLinhas] = useState<LinhaConsole[]>([])
  const [comando, setComando] = useState('')
  // Só as linhas que chegam depois do histórico entram com fade (seção 8).
  const [ultimaDoHistorico, setUltimaDoHistorico] = useState(Infinity)
  const caixa = useRef<HTMLDivElement>(null)
  const noFim = useRef(true)
  const ultimoTopo = useRef(0)
  // Horários das linhas recebidas no último segundo, para saber se estão chegando rápido demais.
  const chegadas = useRef<number[]>([])
  // Fase 26: autocompletar (árvore de comandos da versão), histórico e favoritos.
  const jogadores = useJogadores()
  const [arvore, setArvore] = useState<{
    no: NoComando
    itens: string[]
    efeitos: string[]
  } | null>(null)
  const [historico, setHistorico] = useState<string[]>([])
  const [favoritos, setFavoritos] = useState<string[]>([])
  const [pos, setPos] = useState<number | null>(null) // posição no histórico (↑/↓)
  const [sugestoes, setSugestoes] = useState<{ inicio: number; opcoes: string[] }>({
    inicio: 0,
    opcoes: []
  })
  const [escolhida, setEscolhida] = useState(0)
  const [lista, setLista] = useState(false)
  const formulario = useRef<HTMLFormElement>(null)
  const campoComando = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.lerHistoricoConsole().then((r) => {
      if (!r.ok) return
      setHistorico(r.valor.historico)
      setFavoritos(r.valor.favoritos)
    })
    // Só se os comandos desta versão já foram preparados (tela Comandos).
    window.api.estadoDadosComandos().then(async (e) => {
      if (!e.ok || !e.valor.pronto) return
      const d = await window.api.dadosCentral()
      if (d.ok)
        setArvore({
          no: d.valor.arvore,
          itens: d.valor.itens.map((i) => i.id),
          efeitos: d.valor.efeitos.map((x) => x.id)
        })
    })
  }, [])

  function digitar(texto: string): void {
    setComando(texto)
    setPos(null)
    setEscolhida(0)
    setSugestoes(
      arvore && texto.trim()
        ? sugerir(arvore.no, texto, { jogadores, itens: arvore.itens, efeitos: arvore.efeitos })
        : { inicio: 0, opcoes: [] }
    )
  }

  function completar(opcao: string): void {
    digitar(`${comando.slice(0, sugestoes.inicio)}${opcao} `)
  }

  function teclas(e: React.KeyboardEvent<HTMLInputElement>): void {
    const abertas = sugestoes.opcoes.length > 0
    if (abertas && (e.key === 'Tab' || (e.key === 'Enter' && escolhida > 0))) {
      e.preventDefault()
      completar(sugestoes.opcoes[escolhida] ?? sugestoes.opcoes[0])
      return
    }
    if (e.key === 'Escape') setSugestoes({ inicio: 0, opcoes: [] })
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const sobe = e.key === 'ArrowUp'
    if (abertas) {
      setEscolhida((i) => (i + (sobe ? -1 : 1) + sugestoes.opcoes.length) % sugestoes.opcoes.length)
      return
    }
    // Histórico: ↑ volta para os comandos mais antigos, ↓ vem para os mais novos.
    if (!historico.length) return
    const atual = pos ?? historico.length
    const nova = Math.max(0, Math.min(historico.length, atual + (sobe ? -1 : 1)))
    setPos(nova === historico.length ? null : nova)
    setComando(nova === historico.length ? '' : historico[nova])
  }

  async function favoritar(c: string, sim: boolean): Promise<void> {
    const r = await window.api.mudarFavorito(c, sim)
    if (r.ok) setFavoritos(r.valor.favoritos)
  }

  useEffect(() => {
    const parar = window.api.aoReceberConsole((novas) => {
      const agora = performance.now()
      chegadas.current = [
        ...chegadas.current.filter((t) => agora - t < 1000),
        ...novas.map(() => agora)
      ]
      setLinhas((l) => juntar(l, novas))
    })
    window.api.lerConsole().then((c) => {
      setUltimaDoHistorico(c.historico.at(-1)?.n ?? -1)
      setLinhas((l) => juntar(c.historico, l))
    })
    return parar
  }, [])

  // Rolagem automática, só se o usuário não subiu para ler linhas antigas. É suave, menos
  // quando chegam mais de 20 linhas por segundo (aí pula direto para não ficar atrasada).
  useLayoutEffect(() => {
    const el = caixa.current
    if (!el || !noFim.current) return
    const rapido = chegadas.current.length > 20 || animacoesReduzidas()
    el.scrollTo({ top: el.scrollHeight, behavior: rapido ? 'auto' : 'smooth' })
  }, [linhas])

  function aoRolar(): void {
    const el = caixa.current
    if (!el) return
    // Só para de acompanhar se o usuário subiu; a rolagem suave do próprio app só desce.
    if (el.scrollTop < ultimoTopo.current - 2) noFim.current = false
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 30) noFim.current = true
    ultimoTopo.current = el.scrollTop
  }

  async function enviar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault()
    if (!comando.trim()) return
    aoErro(null)
    const r = await window.api.enviarComando(comando)
    if (!r.ok) return aoErro(r.erro)
    const h = await window.api.adicionarAoHistorico(comando)
    if (h.ok) setHistorico(h.valor.historico)
    setComando('')
    setPos(null)
    setSugestoes({ inicio: 0, opcoes: [] })
  }

  const aceita = estado === 'ligando' || estado === 'ligado'

  return (
    <div className="flex min-h-0 flex-1 flex-col border border-linha bg-console font-mono text-[13px]">
      <div
        ref={caixa}
        onScroll={aoRolar}
        role="log"
        aria-label="Console do servidor"
        className="min-h-0 flex-1 overflow-auto p-3 break-all whitespace-pre-wrap"
      >
        {linhas.map((l) => (
          <div
            key={l.n}
            className={`${corDaLinha(l.texto)} ${l.n > ultimaDoHistorico ? 'anim-linha' : ''}`}
          >
            {l.texto}
          </div>
        ))}
      </div>
      <form
        ref={formulario}
        onSubmit={enviar}
        className="flex h-10 items-center gap-2 border-t border-linha px-3 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-accent"
      >
        {/* Sugestões e favoritos abrem na camada flutuante (acima do campo; descem se não couber). */}
        <Flutuante
          ancora={campoComando}
          aberto={sugestoes.opcoes.length > 0}
          aoFechar={() => setSugestoes({ inicio: 0, opcoes: [] })}
          lado="cima"
        >
          <ul
            id="sugestoes-console"
            role="listbox"
            aria-label="Sugestões"
            className="max-h-64 min-w-56 border border-linha bg-console py-1 font-mono text-[13px] shadow-xl"
          >
            {sugestoes.opcoes.map((o, i) => (
              <li key={o} role="option" aria-selected={i === escolhida}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    completar(o)
                  }}
                  className={`w-full px-3 py-0.5 text-left ${i === escolhida ? 'bg-panel-2 text-on-dark' : 'text-console-muted'}`}
                >
                  {o}
                </button>
              </li>
            ))}
            <li className="px-3 pt-1 text-[11px] text-console-muted">
              Tab completa · ↑↓ escolhe · Esc fecha
            </li>
          </ul>
        </Flutuante>
        <Flutuante
          ancora={formulario}
          aberto={lista}
          aoFechar={() => setLista(false)}
          lado="cima"
          alinhar="fim"
          role="dialog"
          rotulo="Comandos favoritos e histórico"
        >
          <div className="flex w-96 max-w-[calc(100vw-16px)] flex-col border border-linha bg-console p-2 font-mono text-[12px] shadow-xl">
            <p className="px-1 pb-1 font-sans text-xs font-bold text-console-muted uppercase">
              Favoritos
            </p>
            {!favoritos.length && (
              <p className="px-1 pb-2 text-console-muted">Nenhum ainda: use ☆ no histórico.</p>
            )}
            {favoritos.map((f) => (
              <div key={f} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => favoritar(f, false)}
                  aria-label="Tirar dos favoritos"
                  className="text-warning"
                >
                  ★
                </button>
                <button
                  type="button"
                  onClick={() => {
                    digitar(f)
                    setLista(false)
                  }}
                  className="min-w-0 flex-1 truncate px-1 py-0.5 text-left text-on-dark hover:bg-panel-2"
                >
                  {f}
                </button>
              </div>
            ))}
            <p className="px-1 pt-2 pb-1 font-sans text-xs font-bold text-console-muted uppercase">
              Histórico
            </p>
            {[...historico]
              .reverse()
              .slice(0, 20)
              .map((h) => (
                <div key={h} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => favoritar(h, !favoritos.includes(h))}
                    aria-label={
                      favoritos.includes(h) ? 'Tirar dos favoritos' : 'Salvar nos favoritos'
                    }
                    className={favoritos.includes(h) ? 'text-warning' : 'text-console-muted'}
                  >
                    {favoritos.includes(h) ? '★' : '☆'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      digitar(h)
                      setLista(false)
                    }}
                    className="min-w-0 flex-1 truncate px-1 py-0.5 text-left text-console-muted hover:bg-panel-2 hover:text-on-dark"
                  >
                    {h}
                  </button>
                </div>
              ))}
          </div>
        </Flutuante>
        <span aria-hidden="true" className="text-console-muted">
          &gt;
        </span>
        <input
          ref={campoComando}
          aria-controls={sugestoes.opcoes.length ? 'sugestoes-console' : undefined}
          aria-expanded={sugestoes.opcoes.length > 0}
          role="combobox"
          value={comando}
          onChange={(e) => digitar(e.target.value)}
          onKeyDown={teclas}
          onBlur={() => setTimeout(() => setSugestoes({ inicio: 0, opcoes: [] }), 150)}
          autoComplete="off"
          aria-autocomplete="list"
          disabled={!aceita}
          placeholder={
            aceita
              ? 'Digite um comando e aperte Enter (Tab completa, ↑↓ histórico)'
              : 'Ligue o servidor para usar comandos'
          }
          aria-label="Comando do servidor"
          className="h-full flex-1 bg-transparent text-on-dark outline-none placeholder:text-console-muted disabled:opacity-60"
        />
        <button
          type="button"
          aria-expanded={lista}
          onClick={() => setLista(!lista)}
          title="Comandos favoritos e histórico"
          className="shrink-0 px-1 text-console-muted hover:text-on-dark"
        >
          ★ Favoritos
        </button>
      </form>
    </div>
  )
}
