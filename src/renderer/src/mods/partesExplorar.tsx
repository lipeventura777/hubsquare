import { useState } from 'react'
import { useIndicador } from '../componentes/movimento'
import { Botao, CaixaSelecao, Campo, Selecao } from '../componentes/ui'
import { IconeProjeto } from './TelaMods'

// Peças do Explorar (Fase 23), usadas também pela aba Instalados (Fase 23.2):
// abas por tipo, barra de busca, etiquetas de filtro, painel de filtros, cards e esqueleto.

// Preferência do usuário guardada no navegador (ex.: grade ou lista).
// eslint-disable-next-line react-refresh/only-export-components
export function usePreferencia(chave: string, padrao: string): [string, (v: string) => void] {
  const [valor, setValor] = useState(() => {
    try {
      return localStorage.getItem(chave) ?? padrao
    } catch {
      return padrao
    }
  })
  return [
    valor,
    (v) => {
      setValor(v)
      try {
        localStorage.setItem(chave, v)
      } catch {
        // sem armazenamento: a escolha vale só até fechar o app
      }
    }
  ]
}

// Abas no mesmo desenho das abas do cabeçalho (seção 6.2), em 14px, com contador opcional.
export function AbasDeTipo<T extends string>({
  abas,
  ativa,
  aoEscolher,
  rotulo
}: {
  abas: { id: T; nome: string; contador?: number }[]
  ativa: T
  aoEscolher: (t: T) => void
  rotulo: string
}): React.JSX.Element {
  const { conteiner, indicador } = useIndicador(ativa, 'x')
  return (
    <div
      ref={conteiner as React.RefObject<HTMLDivElement>}
      role="tablist"
      aria-label={rotulo}
      className="relative flex h-10 flex-wrap items-stretch gap-6 border-b border-linha"
    >
      {abas.map((a) => (
        <button
          key={a.id}
          type="button"
          role="tab"
          data-indicador={a.id}
          aria-selected={a.id === ativa}
          onClick={() => aoEscolher(a.id)}
          className={`text-sm transition-colors duration-(--dur-fast) ${
            a.id === ativa ? 'font-bold' : 'text-muted hover:text-texto'
          }`}
        >
          {a.nome}
          {a.contador !== undefined && (
            <span className="ml-1.5 bg-panel-2 px-1.5 text-xs font-normal">{a.contador}</span>
          )}
        </button>
      ))}
      <span
        ref={indicador as React.RefObject<HTMLSpanElement>}
        aria-hidden="true"
        className="absolute bottom-1 left-0 h-[3px] w-6 bg-accent transition-transform duration-(--dur-base) ease-(--ease-out)"
      />
    </div>
  )
}

// "« Filtros", busca, ordenação e "Grade | Lista".
export function BarraDeBusca<O extends string>({
  painel,
  aoAlternarPainel,
  termo,
  aoMudarTermo,
  aoProcurar,
  rotuloBusca,
  ordens,
  ordem,
  aoOrdenar,
  vista,
  aoMudarVista
}: {
  painel: boolean
  aoAlternarPainel: () => void
  termo: string
  aoMudarTermo: (t: string) => void
  aoProcurar?: () => void // sem ele, a busca filtra enquanto digita (sem botão Procurar)
  rotuloBusca: string
  ordens: { valor: O; rotulo: string }[]
  ordem: O
  aoOrdenar: (o: O) => void
  vista: string
  aoMudarVista: (v: string) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Botao aria-expanded={painel} onClick={aoAlternarPainel}>
        {painel ? '« Filtros' : 'Filtros »'}
      </Botao>
      <form
        className="flex min-w-[240px] flex-1 gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          aoProcurar?.()
        }}
      >
        <Campo
          aria-label={rotuloBusca}
          placeholder={rotuloBusca}
          value={termo}
          maxLength={100}
          onChange={(e) => aoMudarTermo(e.target.value)}
          className="flex-1"
        />
        {aoProcurar && (
          <Botao variante="primario" type="submit">
            Procurar
          </Botao>
        )}
      </form>
      <Selecao
        aria-label="Ordenar por"
        value={ordem}
        onChange={(e) => aoOrdenar(e.target.value as O)}
        className="w-56"
      >
        {ordens.map((o) => (
          <option key={o.valor} value={o.valor}>
            Ordenar: {o.rotulo}
          </option>
        ))}
      </Selecao>
      <div role="group" aria-label="Mostrar resultados em" className="flex">
        {(['grade', 'lista'] as const).map((v) => (
          <Botao
            key={v}
            tamanho="pequeno"
            variante={vista === v ? 'primario' : 'secundario'}
            aria-pressed={vista === v}
            onClick={() => aoMudarVista(v)}
          >
            {v === 'grade' ? 'Grade' : 'Lista'}
          </Botao>
        ))}
      </div>
    </div>
  )
}

export function EtiquetasDeFiltro({
  itens,
  aoLimpar
}: {
  itens: { rotulo: string; aoTirar: () => void }[]
  aoLimpar: () => void
}): React.JSX.Element | null {
  if (!itens.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
      {itens.map((e) => (
        <button
          key={e.rotulo}
          type="button"
          onClick={e.aoTirar}
          aria-label={`Tirar o filtro ${e.rotulo}`}
          className="flex h-7 items-center gap-2 border border-linha bg-panel-2 px-2 text-xs transition-colors duration-(--dur-fast) hover:border-muted"
        >
          {e.rotulo} <span aria-hidden="true">×</span>
        </button>
      ))}
      <button type="button" className="text-xs text-accent underline" onClick={aoLimpar}>
        Limpar filtros
      </button>
    </div>
  )
}

export function PainelDeFiltros({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <aside
      aria-label="Filtros"
      className="anim-item flex w-60 shrink-0 flex-col gap-5 border border-linha bg-panel p-4"
    >
      {children}
    </aside>
  )
}

export function GrupoFiltro({
  titulo,
  children
}: {
  titulo: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-2 text-xs font-bold tracking-[.02em] text-muted uppercase">
        {titulo}
      </legend>
      {children}
    </fieldset>
  )
}

const GRADE = 'grid grid-cols-1 gap-3 min-[900px]:grid-cols-2 min-[1300px]:grid-cols-3'

export function ListaDeCards({
  vista,
  children
}: {
  vista: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <ul
      className={
        vista === 'grade'
          ? GRADE
          : 'flex flex-col divide-y divide-linha border border-linha bg-panel'
      }
    >
      {children}
    </ul>
  )
}

export function Etiqueta({
  tom = 'neutro',
  children
}: {
  tom?: 'accent' | 'aviso' | 'neutro'
  children: React.ReactNode
}): React.JSX.Element {
  const cor =
    tom === 'accent'
      ? 'bg-accent text-accent-text'
      : tom === 'aviso'
        ? 'bg-warning text-(--text-on-light)'
        : 'bg-panel-2 text-muted'
  return <span className={`px-1.5 py-0.5 text-xs ${cor}`}>{children}</span>
}

// Card de projeto (seção 6.22.1). O card abre os detalhes; seleção e ações são opcionais
// (aba Instalados) e ficam fora do botão principal.
export function CardProjeto({
  icone,
  titulo,
  linha,
  descricao,
  etiquetas,
  vista,
  aoAbrir,
  selecao,
  acoes
}: {
  icone: string | null
  titulo: string
  linha: string
  descricao?: string
  etiquetas?: React.ReactNode
  vista: string
  aoAbrir: () => void
  selecao?: { marcada: boolean; aoMudar: (v: boolean) => void }
  acoes?: React.ReactNode
}): React.JSX.Element {
  const grade = vista === 'grade'
  return (
    <li className="anim-item">
      <div
        className={`flex h-full gap-3 transition-colors duration-(--dur-fast) ${
          grade
            ? 'flex-col border border-linha bg-panel p-3 hover:border-muted'
            : 'items-center px-3 py-2 hover:bg-panel-2'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {selecao && (
            <span className={grade ? 'pt-0.5' : 'self-center'}>
              <CaixaSelecao marcada={selecao.marcada} aoMudar={selecao.aoMudar}>
                <span className="sr-only">Selecionar {titulo}</span>
              </CaixaSelecao>
            </span>
          )}
          <button
            type="button"
            onClick={aoAbrir}
            className={`flex min-w-0 flex-1 gap-3 text-left ${grade ? '' : 'items-center'}`}
          >
            <IconeProjeto url={icone} titulo={titulo} tam={grade ? 56 : 40} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="truncate text-sm font-bold" title={titulo}>
                {titulo}
              </p>
              <p className="truncate text-xs text-muted" title={linha}>
                {linha}
              </p>
              {descricao && (
                <p className={`text-[13px] ${grade ? 'line-clamp-2' : 'truncate'}`}>{descricao}</p>
              )}
              {grade && etiquetas && (
                <div className="mt-1 flex flex-wrap items-center gap-1">{etiquetas}</div>
              )}
            </div>
          </button>
        </div>
        {(acoes || (!grade && etiquetas)) && (
          <div className={`flex shrink-0 items-center gap-2 ${grade ? 'justify-end' : ''}`}>
            {!grade && etiquetas}
            {acoes}
          </div>
        )}
      </div>
    </li>
  )
}

export function EsqueletoDeCards({
  vista,
  quantos = 6
}: {
  vista: string
  quantos?: number
}): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={vista === 'grade' ? GRADE : 'flex flex-col gap-2'}
    >
      {Array.from({ length: quantos }, (_, i) => (
        <div
          key={i}
          className={`anim-esqueleto bg-panel-2 ${vista === 'grade' ? 'h-[112px]' : 'h-14'}`}
        />
      ))}
    </div>
  )
}
