import { useEffect, useRef } from 'react'
import type { Area } from '../aparencia/useAparencia'

const AREAS: { area: Area; curto: string; nome: string }[] = [
  { area: 'serv', curto: 'Serv', nome: 'ServSquare' },
  { area: 'play', curto: 'Play', nome: 'PlaySquare' }
]

// Troca de área no topo da barra lateral (DESIGN.md, seção 6.1.1; Fase V3): um trilho de vidro
// com cantos --raio-item e 4px de espaço interno; as abas têm o raio de dentro (raio do trilho
// menos o espaço), para os cantos ficarem paralelos em todos os biomas. A selecionada mostra o
// nome inteiro, a outra só "Serv"/"Play" (sempre inteiro, sem recorte). O fundo da selecionada
// (destaque translúcido, contorno de 1px e brilho) desliza: largura e posição em 200 ms. Com
// "Reduzir animações", main.css só deixa a cor mudar e a troca é na hora.
// Medidas da barra aberta: 180px − 2×8px de margem = trilho de 164px; dentro, 156px.
const OUTRA = 52
const ESPACO = 4
const ESCOLHIDA = 164 - 2 * ESPACO - ESPACO - OUTRA // 100

// A troca de área monta a barra lateral de novo: a aba nova pega o foco quando montar.
let focarAoMontar = false

const RAIO_ABA = 'rounded-[calc(var(--raio-item)-4px)]'
const FOCO =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const SELECIONADA =
  'bg-accent/20 shadow-[inset_0_0_0_1px_var(--accent),0_0_14px_-4px_var(--accent)]'

export function TrocaDeArea({
  area,
  aoTrocar,
  recolhida
}: {
  area: Area
  aoTrocar: (area: Area) => void
  recolhida: boolean
}): React.JSX.Element {
  const lista = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focarAoMontar) return
    focarAoMontar = false
    lista.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
  }, [area])

  // Setas esquerda/direita (e cima/baixo, com a barra recolhida) trocam de aba.
  function teclas(e: React.KeyboardEvent): void {
    const frente = e.key === 'ArrowRight' || e.key === 'ArrowDown'
    const tras = e.key === 'ArrowLeft' || e.key === 'ArrowUp'
    if (!frente && !tras) return
    e.preventDefault()
    focarAoMontar = true
    aoTrocar(area === 'serv' ? 'play' : 'serv')
  }

  const aba = (
    a: (typeof AREAS)[number],
    extra: string,
    estilo?: React.CSSProperties
  ): React.JSX.Element => {
    const ativa = a.area === area
    return (
      <button
        key={a.area}
        type="button"
        role="tab"
        data-area={a.area}
        aria-selected={ativa}
        aria-label={a.nome}
        title={a.nome}
        tabIndex={ativa ? 0 : -1}
        onClick={() => !ativa && aoTrocar(a.area)}
        style={estilo}
        className={`texto-pixel relative flex min-h-11 items-center justify-center whitespace-nowrap ${RAIO_ABA} ${FOCO} transition-[color,background-color,width] duration-200 ease-(--ease-out) ${
          ativa
            ? 'cursor-default text-texto'
            : 'text-muted hover:bg-tile-active hover:text-texto active:translate-y-px'
        } ${extra}`}
      >
        {ativa && !recolhida ? a.nome : a.curto}
      </button>
    )
  }

  // Barra recolhida (56px): uma aba embaixo da outra, só o nome curto (o inteiro na dica).
  if (recolhida) {
    return (
      <div className="shrink-0 border-b-2 border-linha p-2">
        <div
          ref={lista}
          role="tablist"
          aria-label="Área do app"
          aria-orientation="vertical"
          onKeyDown={teclas}
          className="flex flex-col gap-1 rounded-(--raio-item) bg-(--bg-panel-2) p-1"
        >
          {AREAS.map((a) => aba(a, `text-xs ${a.area === area ? SELECIONADA : ''}`))}
        </div>
      </div>
    )
  }

  const servEscolhida = area === 'serv'
  return (
    <div className="shrink-0 border-b-2 border-linha p-2">
      <div
        ref={lista}
        role="tablist"
        aria-label="Área do app"
        onKeyDown={teclas}
        className="relative flex gap-1 rounded-(--raio-item) bg-(--bg-panel-2) p-1"
      >
        {/* Fundo da aba selecionada: desliza para o lado dela (posição e largura). */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-1 bottom-1 ${RAIO_ABA} ${SELECIONADA} transition-[left,width] duration-200 ease-(--ease-out)`}
          style={{
            left: servEscolhida ? ESPACO : ESPACO + OUTRA + ESPACO,
            width: ESCOLHIDA
          }}
        />
        {AREAS.map((a) => aba(a, 'text-[15px]', { width: a.area === area ? ESCOLHIDA : OUTRA }))}
      </div>
    </div>
  )
}
