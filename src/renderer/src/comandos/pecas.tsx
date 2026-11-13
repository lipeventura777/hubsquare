import { useState } from 'react'
import {
  acaoDestrutiva,
  montarComandos,
  type AcaoCentral,
  type ContextoComandos
} from '../../../shared/comandos'
import type { ErroTela, RespostaComando } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { CabecaJogador } from '../componentes/paineis'
import { Botao, Dialogo } from '../componentes/ui'
import type { Variante } from '../componentes/estilos'

// Peças da Central de comandos (Fase 26).

export interface Central {
  ctx: ContextoComandos
  ligado: boolean
}

// Respostas do servidor, uma por comando, em português quando a versão tem a tradução.
export function Respostas({
  respostas
}: {
  respostas: RespostaComando[]
}): React.JSX.Element | null {
  if (!respostas.length) return null
  return (
    <ul aria-live="polite" className="flex flex-col gap-1 text-[13px]">
      {respostas.map((r, i) => (
        <li
          key={i}
          className={`border-l-4 px-3 py-1.5 ${
            r.ok === true
              ? 'border-online bg-online/12'
              : r.ok === false
                ? 'border-danger bg-danger/12'
                : 'border-linha bg-panel-2'
          }`}
        >
          <span className="mr-2" aria-hidden="true">
            {r.ok === true ? '✓' : r.ok === false ? '✕' : '•'}
          </span>
          {r.texto}
        </li>
      ))}
    </ul>
  )
}

// O comando que vai rodar, em texto pequeno (para aprender), ou o que falta preencher.
export function Previa({
  comandos,
  erro
}: {
  comandos: string[]
  erro: string | null
}): React.JSX.Element {
  if (erro) return <p className="text-xs text-warning">⚠ {erro}</p>
  return (
    <p className="font-mono text-xs break-all text-muted" aria-label="Comando que será executado">
      {comandos.map((c) => `/${c}`).join('  ·  ')}
    </p>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function previa(
  acao: AcaoCentral,
  ctx: ContextoComandos
): { comandos: string[]; erro: string | null } {
  try {
    return { comandos: montarComandos(acao, ctx), erro: null }
  } catch (e) {
    return { comandos: [], erro: e instanceof Error ? e.message : String(e) }
  }
}

// Botão de uma ação: mostra o comando, pede confirmação se apaga coisas e mostra a resposta.
export function Executar({
  acao,
  central,
  rotulo,
  variante = 'primario',
  confirmar
}: {
  acao: AcaoCentral
  central: Central
  rotulo: string
  variante?: Variante
  confirmar?: string // texto da confirmação (o padrão vale para as ações destrutivas)
}): React.JSX.Element {
  const [rodando, setRodando] = useState(false)
  const [respostas, setRespostas] = useState<RespostaComando[]>([])
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const { comandos, erro: invalido } = previa(acao, central.ctx)
  const destrutiva = acaoDestrutiva(acao)

  async function rodar(confirmado: boolean): Promise<void> {
    setConfirmando(false)
    setRodando(true)
    setErro(null)
    setRespostas([])
    const r = await window.api.executarAcao(acao, confirmado)
    setRodando(false)
    if (r.ok) setRespostas(r.valor)
    else setErro(r.erro)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Botao
          tamanho="pequeno"
          variante={destrutiva ? 'perigo' : variante}
          disabled={!central.ligado || !!invalido || rodando}
          onClick={() => (destrutiva || confirmar ? setConfirmando(true) : rodar(false))}
        >
          {rodando ? 'Executando...' : rotulo}
        </Botao>
        <div className="min-w-0 flex-1">
          <Previa comandos={comandos} erro={invalido} />
        </div>
      </div>
      <Respostas respostas={respostas} />
      {erro && <MensagemErro erro={erro} />}
      <Dialogo
        aberto={confirmando}
        titulo={`${rotulo}?`}
        aoCancelar={() => setConfirmando(false)}
        acao={{ rotulo, variante: destrutiva ? 'perigo' : 'primario', aoClicar: () => rodar(true) }}
      >
        <p>{confirmar ?? 'Isso não dá para desfazer.'}</p>
        <p className="mt-2 font-mono text-xs break-all text-muted">
          {comandos.map((c) => `/${c}`).join('\n')}
        </p>
      </Dialogo>
    </div>
  )
}

// Um ou mais jogadores online, com a cabeça (seção 6.13).
export function EscolherJogadores({
  online,
  escolhidos,
  aoMudar,
  umSo = false,
  rotulo = 'Jogadores'
}: {
  online: string[]
  escolhidos: string[]
  aoMudar: (nomes: string[]) => void
  umSo?: boolean
  rotulo?: string
}): React.JSX.Element {
  if (!online.length) {
    return <p className="text-[13px] text-muted">Ninguém online agora.</p>
  }
  const todos = !umSo && online.every((n) => escolhidos.includes(n))
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-xs font-bold tracking-[.02em] text-muted uppercase">
        {rotulo}
      </legend>
      <div className="flex flex-wrap gap-2">
        {!umSo && (
          <button
            type="button"
            aria-pressed={todos}
            onClick={() => aoMudar(todos ? [] : online)}
            className={`h-9 border-2 px-3 text-[13px] ${todos ? 'border-accent bg-panel-2' : 'border-linha'}`}
          >
            Todos ({online.length})
          </button>
        )}
        {online.map((n) => {
          const marcado = escolhidos.includes(n)
          return (
            <button
              key={n}
              type="button"
              aria-pressed={marcado}
              onClick={() =>
                aoMudar(
                  umSo ? [n] : marcado ? escolhidos.filter((x) => x !== n) : [...escolhidos, n]
                )
              }
              className={`flex h-9 items-center gap-2 border-2 pr-3 pl-1 text-[13px] transition-colors duration-(--dur-fast) ${
                marcado ? 'border-accent bg-panel-2' : 'border-linha hover:border-muted'
              }`}
            >
              <CabecaJogador nome={n} tamanho={28} online />
              {n}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
