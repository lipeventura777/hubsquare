import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { EstadoServidor } from '../../../shared/tipos'
import { t } from '../../../shared/i18n'

// Peças animadas do catálogo da seção 8 do DESIGN.md. As classes (anim-*) ficam no main.css
// e todas param sozinhas com "Reduzir animações".

// eslint-disable-next-line react-refresh/only-export-components
export function animacoesReduzidas(): boolean {
  return document.documentElement.hasAttribute('data-reduzir-animacoes')
}

// Cor de fundo de cada status (bolinha e barra de status do cartão da barra lateral).
// eslint-disable-next-line react-refresh/only-export-components
export const COR_STATUS: Record<EstadoServidor | 'erro', string> = {
  desligado: 'bg-offline',
  ligando: 'bg-starting',
  ligado: 'bg-online',
  desligando: 'bg-starting',
  erro: 'bg-erro'
}

// Bolinha de status: "Ligando"/"Desligando" pulsa em loop; ao ficar "Online", pulsa uma vez.
// Sempre acompanhada de texto (seção 9), quem usa coloca o texto ao lado.
export function BolinhaStatus({
  estado,
  tamanho = 'h-2 w-2'
}: {
  estado: EstadoServidor | 'erro'
  tamanho?: string
}): React.JSX.Element {
  const pulso =
    estado === 'ligando' || estado === 'desligando'
      ? 'pulso-loop'
      : estado === 'ligado'
        ? 'pulso-unico'
        : ''
  // A chave faz o pulso único rodar de novo a cada vez que o estado muda.
  return (
    <span
      key={estado}
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${tamanho} ${COR_STATUS[estado]} ${pulso}`}
    />
  )
}

// Número que conta até o valor em 400 ms na primeira vez; depois só troca (seção 8).
export function NumeroAnimado({
  valor,
  formatar = (v) => String(Math.round(v))
}: {
  valor: number
  formatar?: (v: number) => string
}): React.JSX.Element {
  const [mostrado, setMostrado] = useState(animacoesReduzidas() ? valor : 0)
  const contou = useRef(false)

  useEffect(() => {
    if (contou.current || animacoesReduzidas()) {
      contou.current = true
      const quadro = requestAnimationFrame(() => setMostrado(valor))
      return () => cancelAnimationFrame(quadro)
    }
    contou.current = true
    const inicio = performance.now()
    let quadro = 0
    const passo = (agora: number): void => {
      const t = Math.min(1, (agora - inicio) / 400)
      setMostrado(valor * (1 - (1 - t) ** 3))
      if (t < 1) quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [valor])

  return <>{formatar(mostrado)}</>
}

// Barra de progresso: trilho --bg-panel-2, preenchimento --accent que cresce (por transform).
// Sem total conhecido, só as listras deslizando.
export function BarraProgresso({
  valor,
  maximo,
  rotulo
}: {
  valor: number
  maximo: number
  rotulo: string
}): React.JSX.Element {
  const fracao = maximo > 0 ? Math.min(1, Math.max(0, valor / maximo)) : 1
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={maximo || undefined}
      aria-valuenow={maximo ? valor : undefined}
      className="relative h-2 w-full overflow-hidden bg-panel-2"
    >
      {/* O preenchimento entra da esquerda por translateX (Fase P8: só transform), não por
          scaleX: assim as listras de dentro não ficam espremidas no começo do download. */}
      <div
        className="absolute inset-0 overflow-hidden bg-accent transition-transform duration-(--dur-base) ease-(--ease-entrada)"
        style={{ transform: `translateX(-${((1 - fracao) * 100).toFixed(2)}%)` }}
      >
        <div aria-hidden="true" className="anim-listras" />
      </div>
    </div>
  )
}

// Esqueleto de carregamento (seção 6.23): blocos --bg-panel-2 com brilho passando.
// Esqueleto (Fase P8): no formato do que vai aparecer (linhas de 80 px com o ícone, cards de
// 300 px com a imagem 16:9 ou a grade de jogadores), para nada pular quando os dados chegam. Só
// aparece depois de 150 ms (.esqueleto-atraso): carregamento rápido não pisca.
type FormaEsqueleto = 'linhas' | 'lista' | 'cards' | 'jogadores'
const BLOCO = 'anim-esqueleto bg-panel-2'
export function Esqueleto({
  linhas = 3,
  forma = 'linhas'
}: {
  linhas?: number
  forma?: FormaEsqueleto
}): React.JSX.Element {
  const itens = Array.from({ length: linhas }, (_, i) => i)
  return (
    <div
      role="status"
      aria-label={t('movimento.carregando')}
      className={`esqueleto-atraso ${
        forma === 'cards'
          ? 'flex flex-wrap gap-4'
          : forma === 'jogadores'
            ? 'grid grid-cols-1 gap-3 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-4'
            : 'flex flex-col gap-3'
      }`}
    >
      {itens.map((i) =>
        forma === 'lista' ? (
          <div key={i} className="flex h-20 items-center gap-3 border border-linha bg-panel px-5">
            <div className={`${BLOCO} size-10 shrink-0`} />
            <div className="flex flex-1 flex-col gap-2">
              <div className={`${BLOCO} h-4 w-1/3`} />
              <div className={`${BLOCO} h-3 w-1/5`} />
            </div>
          </div>
        ) : forma === 'cards' ? (
          <div key={i} className="flex w-[300px] flex-col border border-linha bg-panel">
            <div className={`${BLOCO} aspect-video`} />
            <div className="flex flex-col gap-3 p-3">
              <div className={`${BLOCO} h-4 w-2/3`} />
              <div className={`${BLOCO} h-8`} />
            </div>
          </div>
        ) : forma === 'jogadores' ? (
          <div
            key={i}
            className="flex h-[72px] items-center gap-3 border border-linha bg-panel px-4"
          >
            <div className={`${BLOCO} size-10 shrink-0`} />
            <div className={`${BLOCO} h-4 w-1/2`} />
          </div>
        ) : (
          <div key={i} className={`${BLOCO} h-9`} style={{ width: `${[100, 80, 60][i % 3]}%` }} />
        )
      )}
    </div>
  )
}

// Indicador que desliza até o item ativo (sublinhado da aba, barra da lateral).
// Os itens marcam a posição com data-indicador="<id>". Move o indicador direto pelo estilo.
// eslint-disable-next-line react-refresh/only-export-components
export function useIndicador(
  ativo: string,
  eixo: 'x' | 'y'
): {
  conteiner: React.RefObject<HTMLElement | null>
  indicador: React.RefObject<HTMLElement | null>
} {
  const conteiner = useRef<HTMLElement | null>(null)
  const indicador = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const barra = indicador.current
    const alvo = conteiner.current?.querySelector<HTMLElement>(
      `[data-indicador="${CSS.escape(ativo)}"]`
    )
    if (!barra) return
    if (!alvo) {
      barra.style.opacity = '0'
      return
    }
    barra.style.opacity = '1'
    barra.style.transform =
      eixo === 'x' ? `translateX(${alvo.offsetLeft}px)` : `translateY(${alvo.offsetTop}px)`
    if (eixo === 'y') barra.style.height = `${alvo.offsetHeight}px`
  })

  return { conteiner, indicador }
}
