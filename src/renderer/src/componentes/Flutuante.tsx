import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { calcularPosicao, type LadoFlutuante, type Posicao } from '../../../shared/posicaoFlutuante'

// Camada flutuante única do app (listas de seleção, menus ⋯, autocompletar, dicas).
// - Fica fora da área com rolagem: portal no fim do documento, como "popover" do navegador
//   (camada mais alta, acima até dos diálogos; z-index do token --z-flutuante por garantia).
// - Cola no elemento que abriu, vira para cima quando não cabe embaixo e não sai pelos lados.
// - Altura limitada ao espaço disponível, com rolagem interna.
// - Acompanha rolagem e redimensionamento; fecha com Esc e clique fora.
// - Por ser "fixed" na camada do topo, abrir e fechar nunca muda o tamanho nem a rolagem da página.

type Alinhar = 'inicio' | 'fim' | 'centro'

// Mede a âncora e o conteúdo e diz onde a camada fica (null se ainda não dá para medir).
function medir(
  a: HTMLElement | null,
  el: HTMLElement | null,
  lado: LadoFlutuante,
  alinhar: Alinhar,
  larguraDaAncora: boolean
): Posicao | null {
  if (!a || !el) return null
  const r = a.getBoundingClientRect()
  const p = calcularPosicao(
    r,
    { altura: el.scrollHeight, largura: Math.max(el.offsetWidth, larguraDaAncora ? r.width : 0) },
    { largura: window.innerWidth, altura: window.innerHeight },
    lado,
    alinhar
  )
  return { ...p, ...(larguraDaAncora && { minWidth: r.width }) }
}

export function Flutuante({
  ancora,
  aberto,
  aoFechar,
  children,
  lado = 'baixo',
  alinhar = 'inicio',
  larguraDaAncora = false,
  fecharAoClicarFora = true,
  role,
  id,
  rotulo,
  className = ''
}: {
  ancora: React.RefObject<HTMLElement | null>
  aberto: boolean
  aoFechar: () => void
  children: React.ReactNode
  lado?: LadoFlutuante
  alinhar?: Alinhar
  larguraDaAncora?: boolean // pelo menos a largura do elemento que abriu (listas de seleção)
  fecharAoClicarFora?: boolean
  role?: string
  id?: string
  rotulo?: string
  className?: string
}): React.JSX.Element | null {
  // Continua na tela durante a animação de saída.
  const [montado, setMontado] = useState(aberto)
  const [saindo, setSaindo] = useState(false)
  const [pos, setPos] = useState<Posicao | null>(null)
  // Fim do documento; ou dentro do diálogo aberto onde está a âncora (fora dele, tudo fica inerte).
  const [destino, setDestino] = useState<Element | null>(null)
  const camada = useRef<HTMLDivElement>(null)
  const fechar = useRef(aoFechar)
  useEffect(() => {
    fechar.current = aoFechar
  })

  useEffect(() => {
    if (aberto) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- abre (ou cancela a saída)
      setDestino(ancora.current?.closest('dialog[open]') ?? document.body)
      setMontado(true)
      setSaindo(false)
      return
    }
    if (!montado) return
    setSaindo(true)
    const duracao =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dur-fast')) || 0
    const t = setTimeout(() => {
      setMontado(false)
      setSaindo(false)
      setPos(null)
    }, duracao)
    return () => clearTimeout(t)
  }, [aberto, montado, ancora])

  // Mostra na camada do topo e posiciona antes de pintar (sem piscar no lugar errado).
  useLayoutEffect(() => {
    const el = camada.current
    if (!montado || !el) return
    if (!el.matches(':popover-open')) el.showPopover?.()
    setPos(medir(ancora.current, el, lado, alinhar, larguraDaAncora))
  }, [montado, ancora, lado, alinhar, larguraDaAncora])

  useEffect(() => {
    if (!montado || saindo) return
    let quadro = 0
    const depois = (): void => {
      cancelAnimationFrame(quadro)
      quadro = requestAnimationFrame(() =>
        setPos(medir(ancora.current, camada.current, lado, alinhar, larguraDaAncora))
      )
    }
    // Rolagem de qualquer área (captura) e mudanças de tamanho da janela, da âncora ou do conteúdo.
    window.addEventListener('scroll', depois, true)
    window.addEventListener('resize', depois)
    const obs = new ResizeObserver(depois)
    if (camada.current) obs.observe(camada.current)
    if (ancora.current) obs.observe(ancora.current)
    const fora = (e: MouseEvent): void => {
      const alvo = e.target as Node
      if (camada.current?.contains(alvo) || ancora.current?.contains(alvo)) return
      if (fecharAoClicarFora) fechar.current()
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      // Não deixa o Esc fechar também o diálogo onde a lista está.
      e.preventDefault()
      e.stopPropagation()
      fechar.current()
    }
    document.addEventListener('mousedown', fora, true)
    document.addEventListener('keydown', esc, true)
    return () => {
      cancelAnimationFrame(quadro)
      window.removeEventListener('scroll', depois, true)
      window.removeEventListener('resize', depois)
      obs.disconnect()
      document.removeEventListener('mousedown', fora, true)
      document.removeEventListener('keydown', esc, true)
    }
  }, [montado, saindo, ancora, lado, alinhar, larguraDaAncora, fecharAoClicarFora])

  if (!montado || !destino) return null
  return createPortal(
    <div
      ref={camada}
      popover="manual"
      role={role}
      id={id}
      aria-label={rotulo}
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        maxHeight: pos?.maxHeight,
        minWidth: pos?.minWidth,
        visibility: pos ? 'visible' : 'hidden'
      }}
      className={`flutuante ${pos?.cima ? 'flutuante-cima' : 'flutuante-baixo'} ${saindo ? 'flutuante-saindo' : ''} ${className}`}
    >
      {children}
    </div>,
    destino
  )
}
