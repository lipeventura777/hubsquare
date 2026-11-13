import { Children, Fragment, isValidElement, useEffect, useId, useRef, useState } from 'react'
import { Flutuante } from './Flutuante'
import { campo, classesBotao, type Variante } from './estilos'

// Componentes base do DESIGN.md (seções 5 e 6). Cantos retos, cores só pelos tokens.

type PropsBotao = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  tamanho?: 'normal' | 'pequeno' | 'grande'
}

export function Botao({
  variante = 'secundario',
  tamanho = 'normal',
  className = '',
  type = 'button',
  ...resto
}: PropsBotao): React.JSX.Element {
  return (
    <button type={type} className={`${classesBotao(variante, tamanho)} ${className}`} {...resto} />
  )
}

// Caixa de seleção quadrada de 16px; marcada fica com fundo --accent e ✓ (seção 6.7).
export function CaixaSelecao({
  marcada,
  aoMudar,
  children,
  disabled
}: {
  marcada: boolean
  aoMudar: (marcada: boolean) => void
  children: React.ReactNode
  disabled?: boolean
}): React.JSX.Element {
  return (
    <label
      // relative: o input invisível (sr-only) fica dentro do label e rola junto com a página.
      className={`relative flex min-h-8 items-center gap-2 text-[13px] ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={marcada}
        disabled={disabled}
        onChange={(e) => aoMudar(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className="flex h-4 w-4 shrink-0 items-center justify-center border border-checkbox text-accent-text transition-colors duration-(--dur-fast) peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent [&>svg]:invisible peer-checked:[&>svg]:visible"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
          {/* ✓ em pixels */}
          <path d="M13 3h2v2h-1v1h-1v1h-1v1h-1v1h-1v1H9v1H8v1H7v1H5v-1H4v-1H3V9H2V7h2v1h1v1h1v1h1V9h1V8h1V7h1V6h1V5h1V4h1z" />
        </svg>
      </span>
      <span>{children}</span>
    </label>
  )
}

// Interruptor (seção 6.16): trilho 44×22, alça quadrada de 18px com relevo.
// Ligado: trilho --accent com ✓. Desligado: trilho --danger com ✕.
export function Interruptor({
  ligado,
  aoMudar,
  rotulo,
  disabled
}: {
  ligado: boolean
  aoMudar: (ligado: boolean) => void
  rotulo: string
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={disabled}
      onClick={() => aoMudar(!ligado)}
      className={`relative h-[22px] w-11 shrink-0 transition-colors duration-(--dur-base) ease-(--ease-out) disabled:cursor-not-allowed disabled:opacity-50 ${
        ligado ? 'bg-accent text-accent-text' : 'bg-danger text-on-dark'
      }`}
    >
      {/* ✓ à esquerda quando ligado, ✕ à direita quando desligado; trocam com fade e escala leve. */}
      <span
        aria-hidden="true"
        className={`absolute top-1/2 left-1.5 -translate-y-1/2 text-xs font-bold transition-[transform,opacity] duration-(--dur-fast) ease-(--ease-out) ${
          ligado ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        ✓
      </span>
      <span
        aria-hidden="true"
        className={`absolute top-1/2 right-1.5 -translate-y-1/2 text-xs font-bold transition-[transform,opacity] duration-(--dur-fast) ease-(--ease-out) ${
          ligado ? 'scale-90 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        ✕
      </span>
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 h-[18px] w-[18px] border-b-2 border-secondary-shadow bg-secondary shadow-[inset_0_1px_0_var(--relevo-brilho)] transition-transform duration-(--dur-base) ease-(--ease-out) ${
          ligado ? 'translate-x-[22px]' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// Linha de controle (seção 6.16): fundo --bg-panel-2, 48px, ícone + rótulo à esquerda e
// o interruptor à direita.
export function LinhaControle({
  icone,
  rotulo,
  ligado,
  aoMudar,
  disabled,
  children
}: {
  icone?: React.ReactNode
  rotulo: string
  ligado: boolean
  aoMudar: (ligado: boolean) => void
  disabled?: boolean
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-h-12 items-center gap-3 bg-panel-2 px-4 py-2">
      {icone && <span className="shrink-0 text-accent">{icone}</span>}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold">{rotulo}</div>
        {children && <div className="text-xs text-muted">{children}</div>}
      </div>
      <Interruptor ligado={ligado} aoMudar={aoMudar} rotulo={rotulo} disabled={disabled} />
    </div>
  )
}

// Escolha única (tema, por exemplo): quadrado de 16px com um quadrado menor dentro quando marcada.
export function OpcaoRadio({
  nome,
  marcada,
  aoEscolher,
  children
}: {
  nome: string
  marcada: boolean
  aoEscolher: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="relative flex min-h-8 cursor-pointer items-center gap-2 text-[13px]">
      <input
        type="radio"
        name={nome}
        className="peer sr-only"
        checked={marcada}
        onChange={aoEscolher}
      />
      <span
        aria-hidden="true"
        className="flex h-4 w-4 shrink-0 items-center justify-center border border-checkbox peer-checked:border-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent [&>span]:invisible peer-checked:[&>span]:visible"
      >
        <span className="h-2 w-2 bg-accent" />
      </span>
      <span>{children}</span>
    </label>
  )
}

// Coluna das telas de ajustes (seção 6.7): alinhada à esquerda, até 720px, margem de 40px,
// seções separadas por 40px. "largo" deixa usar a largura toda (grades de cards).
export function PaginaAjustes({
  children,
  largo = false
}: {
  children: React.ReactNode
  largo?: boolean
}): React.JSX.Element {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className={`flex flex-col gap-10 p-10 ${largo ? '' : 'max-w-[720px]'}`}>{children}</div>
    </div>
  )
}

// Estado vazio (seção 6.23): ícone pixel de 48px em --text-muted, frase curta e,
// se fizer sentido, um botão de ação.
export function EstadoVazio({
  icone,
  titulo,
  texto,
  children
}: {
  icone: React.ReactNode
  titulo: string
  texto?: string
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span aria-hidden="true" className="text-muted [&>svg]:h-12 [&>svg]:w-12">
        {icone}
      </span>
      <p className="text-base font-bold">{titulo}</p>
      {texto && <p className="max-w-md text-[13px] text-muted">{texto}</p>}
      {children}
    </div>
  )
}

// Faixa de aviso no mesmo formato do painel de erro (seção 6.9), para atenção ou sucesso.
export function Aviso({
  tipo,
  children
}: {
  tipo: 'atencao' | 'sucesso'
  children: React.ReactNode
}): React.JSX.Element {
  const cor = tipo === 'atencao' ? 'border-warning bg-warning/12' : 'border-online bg-online/12'
  return (
    <div
      role="status"
      className={`flex items-center gap-4 border-l-4 px-4 py-3 text-[13px] ${cor}`}
    >
      {children}
    </div>
  )
}

// Seção das telas de ajustes (seção 6.7): cabeçalho em rótulo pequeno e o conteúdo embaixo.
export function Secao({
  titulo,
  children
}: {
  titulo: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col">
      <h2 className="mb-4 text-xs font-bold tracking-[.02em] text-muted uppercase">{titulo}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

// Card estilo "notícias" (seção 6.6): imagem 16:9 em cima (print ou padrão geométrico),
// etiqueta --accent no canto e informações embaixo.
export function CardImagem({
  imagem,
  etiqueta,
  titulo,
  info,
  children,
  ordem = 0
}: {
  imagem?: string
  ordem?: number
  etiqueta: string
  titulo: string
  info?: string
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <article
      className="anim-item flex w-[300px] flex-col border border-linha bg-panel transition-colors duration-(--dur-fast) hover:border-muted"
      style={{ '--ordem': ordem } as React.CSSProperties}
    >
      <div className="relative aspect-video overflow-hidden">
        {imagem ? (
          <img src={imagem} alt="" className="h-full w-full object-cover" />
        ) : (
          <div aria-hidden="true" className="banner-padrao h-full w-full" />
        )}
        <span className="absolute bottom-2 left-2 bg-accent px-2 py-0.5 text-xs font-bold text-accent-text">
          {etiqueta}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-[13px] font-bold" title={titulo}>
            {titulo}
          </h3>
          {info && <span className="shrink-0 text-xs text-muted">{info}</span>}
        </div>
        {children}
      </div>
    </article>
  )
}

export function Campo(props: React.ComponentProps<'input'>): React.JSX.Element {
  return <input {...props} className={`${campo} ${props.className ?? ''}`} />
}

interface OpcaoLista {
  valor: string
  rotulo: React.ReactNode
  texto: string // para "digitar para buscar"
  desativada: boolean
}

const textoDe = (n: React.ReactNode): string =>
  typeof n === 'string' || typeof n === 'number'
    ? String(n)
    : Array.isArray(n)
      ? n.map(textoDe).join('')
      : isValidElement<{ children?: React.ReactNode }>(n)
        ? textoDe(n.props.children)
        : ''

// As <option> filhas (inclusive dentro de fragmentos, listas e condições).
function lerOpcoes(filhos: React.ReactNode): OpcaoLista[] {
  return Children.toArray(filhos).flatMap((f): OpcaoLista[] => {
    if (!isValidElement<{ value?: unknown; children?: React.ReactNode; disabled?: boolean }>(f))
      return []
    if (f.type === Fragment) return lerOpcoes(f.props.children)
    if (f.type !== 'option') return []
    const texto = textoDe(f.props.children)
    return [
      {
        valor: String(f.props.value ?? texto),
        rotulo: f.props.children,
        texto,
        desativada: f.props.disabled === true
      }
    ]
  })
}

const semAcento = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Lista de seleção (seção 6.7). Mesmo uso do <select> (filhos <option>, value, onChange com
// e.target.value), mas a lista abre na camada flutuante: nunca é cortada, vira para cima quando
// não cabe e não mexe na rolagem da página. Teclado: setas, Enter/Espaço, Home/End, Esc e
// digitar para buscar. Leitores de tela: combobox + listbox.
export function Selecao({
  children,
  className = '',
  value,
  defaultValue,
  onChange,
  disabled,
  title,
  id,
  'aria-label': rotulo
}: React.SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  const opcoes = lerOpcoes(children)
  const [interno, setInterno] = useState(String(defaultValue ?? opcoes[0]?.valor ?? ''))
  const atual = value !== undefined ? String(value) : interno
  const indiceAtual = Math.max(
    0,
    opcoes.findIndex((o) => o.valor === atual)
  )
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(indiceAtual)
  const botao = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLUListElement>(null)
  const base = useId()
  const busca = useRef({ texto: '', ate: 0 })

  function abrir(): void {
    if (disabled) return
    setAtivo(indiceAtual)
    setAberto(true)
  }

  function escolher(i: number): void {
    const o = opcoes[i]
    if (!o || o.desativada) return
    setAberto(false)
    setInterno(o.valor)
    botao.current?.focus({ preventScroll: true })
    if (o.valor !== atual) {
      onChange?.({
        target: { value: o.valor },
        currentTarget: { value: o.valor }
      } as unknown as React.ChangeEvent<HTMLSelectElement>)
    }
  }

  // Próxima opção habilitada (passo +1/-1), sem dar a volta.
  function mover(de: number, passo: number): number {
    for (let i = de + passo; i >= 0 && i < opcoes.length; i += passo)
      if (!opcoes[i].desativada) return i
    return de
  }

  // Leva a opção ativa para a área visível da lista (sem rolar a página).
  useEffect(() => {
    if (!aberto) return
    const item = document.getElementById(`${base}-${ativo}`)
    const caixa = item?.closest('.flutuante') as HTMLElement | null
    if (!item || !caixa) return
    const topo = item.offsetTop
    if (topo < caixa.scrollTop) caixa.scrollTop = topo
    else if (topo + item.offsetHeight > caixa.scrollTop + caixa.clientHeight)
      caixa.scrollTop = topo + item.offsetHeight - caixa.clientHeight
  }, [aberto, ativo, base])

  function teclas(e: React.KeyboardEvent<HTMLButtonElement>): void {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault()
        if (!aberto) return abrir()
        setAtivo((i) => mover(i, e.key === 'ArrowDown' ? 1 : -1))
        return
      case 'Home':
      case 'End':
        if (!aberto) return
        e.preventDefault()
        setAtivo(e.key === 'Home' ? mover(-1, 1) : mover(opcoes.length, -1))
        return
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (aberto) escolher(ativo)
        else abrir()
        return
      case 'Tab':
        setAberto(false)
        return
    }
    // Digitar para buscar (como no <select>): junta as letras digitadas em sequência.
    if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return
    const agora = Date.now()
    busca.current.texto = (agora < busca.current.ate ? busca.current.texto : '') + semAcento(e.key)
    busca.current.ate = agora + 700
    const i = opcoes.findIndex(
      (o) => !o.desativada && semAcento(o.texto).startsWith(busca.current.texto)
    )
    if (i < 0) return
    if (aberto) setAtivo(i)
    else escolher(i)
  }

  const selecionada = opcoes[indiceAtual]
  return (
    <div className={`relative ${className}`}>
      <button
        ref={botao}
        type="button"
        id={id}
        role="combobox"
        aria-label={rotulo}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={`${base}-lista`}
        aria-activedescendant={aberto ? `${base}-${ativo}` : undefined}
        title={title}
        disabled={disabled}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={teclas}
        className={`${campo} flex cursor-pointer items-center pr-8 text-left disabled:cursor-not-allowed`}
      >
        <span
          className="truncate"
          title={typeof selecionada?.rotulo === 'string' ? selecionada.rotulo : undefined}
        >
          {selecionada?.rotulo}
        </span>
      </button>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-muted"
      >
        ▼
      </span>
      <Flutuante ancora={botao} aberto={aberto} aoFechar={() => setAberto(false)} larguraDaAncora>
        <ul
          ref={lista}
          id={`${base}-lista`}
          role="listbox"
          aria-label={rotulo}
          className="border-2 border-linha bg-panel py-1 text-[13px] text-texto shadow-xl"
        >
          {opcoes.map((o, i) => (
            <li
              key={`${o.valor}-${i}`}
              id={`${base}-${i}`}
              role="option"
              aria-selected={o.valor === atual}
              aria-disabled={o.desativada || undefined}
              // mousedown: escolhe sem tirar o foco do campo
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => escolher(i)}
              onMouseMove={() => i !== ativo && !o.desativada && setAtivo(i)}
              className={`flex min-h-8 items-center gap-2 px-3 ${
                o.desativada ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              } ${i === ativo ? 'bg-tile-active' : ''} ${o.valor === atual ? 'font-bold' : ''}`}
            >
              <span aria-hidden="true" className="w-3 shrink-0 text-accent">
                {o.valor === atual ? '✓' : ''}
              </span>
              <span className="min-w-0 flex-1">{o.rotulo}</span>
            </li>
          ))}
        </ul>
      </Flutuante>
    </div>
  )
}

// Slider com o valor ao lado (ex.: "4 GB").
export function Slider({
  rotulo,
  valor,
  min,
  max,
  passo = 1,
  aoMudar,
  formatar = String
}: {
  rotulo: string
  valor: number
  min: number
  max: number
  passo?: number
  aoMudar: (valor: number) => void
  formatar?: (valor: number) => string
}): React.JSX.Element {
  const id = useId()
  const preenchido = max > min ? ((valor - min) / (max - min)) * 100 : 0
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[13px]">
        {rotulo}
      </label>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          className="slider flex-1"
          min={min}
          max={max}
          step={passo}
          value={valor}
          onChange={(e) => aoMudar(e.target.valueAsNumber)}
          style={{ '--preenchido': `${preenchido}%` } as React.CSSProperties}
        />
        <span className="w-14 text-right text-[13px] font-bold">{formatar(valor)}</span>
      </div>
    </div>
  )
}

export interface ItemMenu {
  rotulo: string
  aoClicar: () => void
  desabilitado?: boolean
}

// Menu suspenso (chevron do cartão do servidor, ⋮ da barra de ação, ⋯ das listas).
// Mostra uma lista de itens ou, com "painel", um conteúdo livre (ex.: detalhes do servidor).
// Abre na camada flutuante (nunca é cortado e vira para cima quando não cabe); fecha ao clicar
// fora, ao escolher um item ou com Esc. Teclado: setas, Home/End, Enter.
export function Menu({
  rotulo,
  itens,
  className = '',
  classeBotao = '',
  children,
  paraCima = false,
  abrirParaDireita = false,
  painel,
  desabilitado = false
}: {
  rotulo: string
  itens?: ItemMenu[]
  painel?: React.ReactNode
  desabilitado?: boolean
  className?: string
  classeBotao?: string
  children: React.ReactNode
  paraCima?: boolean // lado preferido (vira se não couber)
  abrirParaDireita?: boolean
}): React.JSX.Element {
  const [aberto, setAberto] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLUListElement>(null)

  function fechar(devolverFoco = true): void {
    setAberto(false)
    if (devolverFoco) botao.current?.focus({ preventScroll: true })
  }

  // Ao abrir pelo teclado ou mouse, o foco vai para o primeiro item (sem rolar a página).
  useEffect(() => {
    if (!aberto || !itens) return
    const quadro = requestAnimationFrame(() =>
      lista.current
        ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
        ?.focus({ preventScroll: true })
    )
    return () => cancelAnimationFrame(quadro)
  }, [aberto, itens])

  function teclas(e: React.KeyboardEvent<HTMLUListElement>): void {
    const botoes = [
      ...(lista.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
    ]
    const i = botoes.indexOf(document.activeElement as HTMLButtonElement)
    const ir = (n: number): void => {
      e.preventDefault()
      botoes[(n + botoes.length) % botoes.length]?.focus({ preventScroll: true })
    }
    if (e.key === 'ArrowDown') ir(i + 1)
    else if (e.key === 'ArrowUp') ir(i - 1)
    else if (e.key === 'Home') ir(0)
    else if (e.key === 'End') ir(botoes.length - 1)
    else if (e.key === 'Tab') fechar(false)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={botao}
        type="button"
        aria-label={rotulo}
        aria-haspopup={painel ? 'dialog' : 'menu'}
        aria-expanded={aberto}
        disabled={desabilitado}
        onClick={() => setAberto((a) => !a)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && itens && !aberto) {
            e.preventDefault()
            setAberto(true)
          }
        }}
        className={classeBotao}
      >
        {children}
      </button>
      <Flutuante
        ancora={botao}
        aberto={aberto && !!(painel || itens)}
        aoFechar={() => fechar()}
        lado={paraCima ? 'cima' : 'baixo'}
        alinhar={abrirParaDireita ? 'inicio' : 'fim'}
        role={painel ? 'dialog' : undefined}
        rotulo={painel ? rotulo : undefined}
      >
        {painel ? (
          <div className="border-2 border-linha bg-panel p-4 text-[13px] text-texto shadow-xl">
            {painel}
          </div>
        ) : (
          <ul
            ref={lista}
            role="menu"
            aria-label={rotulo}
            onKeyDown={teclas}
            className="min-w-48 border-2 border-linha bg-panel py-1 text-[13px] text-texto shadow-xl"
          >
            {itens?.map((item) => (
              <li key={item.rotulo} role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.desabilitado}
                  onClick={() => {
                    fechar()
                    item.aoClicar()
                  }}
                  className="flex h-8 w-full items-center px-3 text-left outline-none hover:bg-tile-active focus-visible:bg-tile-active disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {item.rotulo}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Flutuante>
    </div>
  )
}

// Diálogo de confirmação (seção 6.8). Usa o <dialog> do navegador: prende o foco e fecha com Esc.
export function Dialogo({
  aberto,
  titulo,
  children,
  aoCancelar,
  acao
}: {
  aberto: boolean
  titulo: string
  children: React.ReactNode
  aoCancelar: () => void
  acao: {
    rotulo: string
    variante?: Variante
    aoClicar: () => void
    ocupado?: boolean
    desabilitado?: boolean // ex.: até digitar o nome para apagar
  }
}): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (aberto && !dialogo.open) dialogo.showModal()
    if (!aberto && dialogo.open) dialogo.close()
  }, [aberto])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        if (!acao.ocupado) aoCancelar()
      }}
      className="m-auto w-[440px] max-w-[calc(100vw-32px)] border-2 border-linha bg-panel p-6 text-texto backdrop:bg-[var(--overlay)]"
    >
      <h2 className="texto-pixel text-xl">{titulo}</h2>
      <div className="mt-3 text-sm">{children}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Botao onClick={aoCancelar} disabled={acao.ocupado}>
          Cancelar
        </Botao>
        <Botao
          variante={acao.variante ?? 'primario'}
          onClick={acao.aoClicar}
          disabled={acao.ocupado || acao.desabilitado}
        >
          {acao.rotulo}
        </Botao>
      </div>
    </dialog>
  )
}
