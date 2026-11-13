import { useEffect, useId, useState } from 'react'
import { classesBotao } from './estilos'
import { IconeSeta } from './icones'

// Componentes base das telas novas (DESIGN.md, seções 6.12 a 6.21).

// Card de painel (6.12): faixa de título de 48px com ações opcionais e corpo com 16px de margem.
export function CardPainel({
  titulo,
  acoes,
  className = '',
  children
}: {
  titulo: string
  acoes?: React.ReactNode
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className={`border border-linha bg-panel ${className}`}>
      <header className="flex h-12 items-center justify-between gap-3 border-b border-linha px-4">
        <h2 className="text-sm font-bold">{titulo}</h2>
        {acoes && <div className="flex items-center gap-2">{acoes}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

// Título de página (6.12): display 28px em --accent, com 24px embaixo. Para telas sem banner.
export function TituloPagina({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h1 className="texto-pixel mb-6 text-[28px] text-accent">{children}</h1>
}

// Cor do quadrado de cada jogador: sempre a mesma para o mesmo nome, vinda dos tokens.
const CORES = ['verde', 'azul', 'roxo', 'laranja', 'vermelho', 'ciano']
// eslint-disable-next-line react-refresh/only-export-components
export function corDoNome(nome: string): string {
  let soma = 0
  for (const letra of nome) soma = (soma * 31 + letra.charCodeAt(0)) >>> 0
  return `var(--sugestao-${CORES[soma % CORES.length]})`
}

const TAMANHOS = {
  28: 'h-7 w-7 text-sm',
  40: 'h-10 w-10 text-xl',
  72: 'h-[72px] w-[72px] text-4xl'
}

// Rostos já pedidos nesta janela (o processo principal guarda o arquivo por 24 h).
const rostos = new Map<string, Promise<string | null>>()

function useRosto(uuid: string | undefined): string | null {
  const [rosto, setRosto] = useState<{ uuid: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!uuid) return
    let ativo = true
    let pedido = rostos.get(uuid)
    if (!pedido) {
      pedido = window.api.cabecaJogador(uuid).then((r) => (r.ok ? r.valor : null))
      rostos.set(uuid, pedido)
    }
    pedido.then((url) => ativo && setRosto({ uuid, url }))
    return () => {
      ativo = false
    }
  }, [uuid])
  return rosto && rosto.uuid === uuid ? rosto.url : null
}

// Cabeça do jogador (6.13): rosto da skin (baixado da Mojang em tempo de uso) ou, sem ele,
// o fallback próprio: quadrado com a cor do nome e a inicial em display.
export function CabecaJogador({
  nome,
  tamanho = 28,
  online,
  uuid
}: {
  nome: string
  tamanho?: keyof typeof TAMANHOS
  online?: boolean
  uuid?: string
}): React.JSX.Element {
  const imagem = useRosto(uuid)
  return (
    <span className={`relative inline-flex shrink-0 ${TAMANHOS[tamanho]}`}>
      {imagem ? (
        <img src={imagem} alt="" className="h-full w-full [image-rendering:pixelated]" />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center font-pixel text-on-dark"
          style={{ backgroundColor: corDoNome(nome) }}
        >
          {nome.charAt(0).toUpperCase()}
        </span>
      )}
      {online !== undefined && (
        <span
          aria-hidden="true"
          className={`absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-panel ${
            online ? 'bg-online' : 'bg-offline'
          }`}
        />
      )}
    </span>
  )
}

// Botões-bloco (6.14): atalhos grandes de 72px, em grade de 4 colunas (2 abaixo de 900px).
export function BotoesBloco({
  itens
}: {
  itens: {
    rotulo: string
    icone: React.ReactNode
    variante: 'primario' | 'perigo'
    aoClicar: () => void
  }[]
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
      {itens.map((item) => (
        <button
          key={item.rotulo}
          type="button"
          onClick={item.aoClicar}
          className={`${classesBotao(item.variante)} h-[72px] gap-3 text-[15px] [&>svg]:h-6 [&>svg]:w-6`}
        >
          {item.icone}
          {item.rotulo}
        </button>
      ))}
    </div>
  )
}

// Acordeão (6.21): linha de 52px com ícone, título e botão redondo com chevron que gira 180°.
// A altura anima (--dur-slow) pela grade 0fr → 1fr, sem medir nada.
export function Acordeao({
  itens
}: {
  itens: { icone: React.ReactNode; titulo: string; conteudo: React.ReactNode }[]
}): React.JSX.Element {
  const [aberto, setAberto] = useState<string | null>(null)
  const base = useId()

  return (
    <div className="divide-y divide-linha border border-linha bg-panel">
      {itens.map((item) => {
        const estaAberto = aberto === item.titulo
        const idConteudo = `${base}-${item.titulo}`
        return (
          <div key={item.titulo}>
            <button
              type="button"
              aria-expanded={estaAberto}
              aria-controls={idConteudo}
              onClick={() => setAberto(estaAberto ? null : item.titulo)}
              className="flex h-[52px] w-full items-center gap-3 px-3 text-left transition-colors duration-(--dur-fast) hover:bg-panel-2"
            >
              <span aria-hidden="true" className="text-accent [&>svg]:h-5 [&>svg]:w-5">
                {item.icone}
              </span>
              <span className="flex-1 text-base font-bold">{item.titulo}</span>
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-text"
              >
                <IconeSeta
                  className={`h-4 w-4 transition-transform duration-(--dur-slow) ease-(--ease-out) ${
                    estaAberto ? 'rotate-180' : ''
                  }`}
                />
              </span>
            </button>
            <div
              id={idConteudo}
              className={`grid transition-[grid-template-rows] duration-(--dur-slow) ease-(--ease-out) ${
                estaAberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div className="p-3">{item.conteudo}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
