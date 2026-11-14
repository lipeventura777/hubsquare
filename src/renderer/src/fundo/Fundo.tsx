import { useEffect, useRef, useState } from 'react'
import type { Bioma } from '../../../shared/tipos'
import { useAparencia } from '../aparencia/useAparencia'
import { Aviso, Botao } from '../componentes/ui'
import { ALTURA, ARTE, LARGURA } from './biomas'
import { criarMotor, type Motor } from './motor'
import { CamadaFundo } from './CamadaFundo'

// Fundo de bioma (Fases V1 e V2, DESIGN.md seção 7): pixel art pequena, ampliada sem suavizar.
// Vivo (motor.ts), parado quando o jogo está aberto, a janela está escondida ou sem foco, ou um
// modpack está instalando. Com uma imagem do usuário, só as partículas do bioma por cima.

// Um quadro parado: miniaturas da Aparência.
export function ArteDoBioma({
  bioma,
  className = ''
}: {
  bioma: Bioma
  className?: string
}): React.JSX.Element {
  const tela = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = tela.current?.getContext('2d')
    if (!c) return
    c.clearRect(0, 0, LARGURA, ALTURA)
    ARTE[bioma].desenhar(c)
  }, [bioma])
  return (
    <canvas
      ref={tela}
      width={LARGURA}
      height={ALTURA}
      aria-hidden="true"
      className={`object-cover [image-rendering:pixelated] ${className}`}
    />
  )
}

// O bioma vivo. Trocar o bioma faz uma transição suave; "so" = só as partículas (transparente).
export function FundoAnimado({
  bioma,
  so = false,
  className = '',
  aoPesar
}: {
  bioma: Bioma
  so?: boolean
  className?: string
  aoPesar?: () => void
}): React.JSX.Element {
  const tela = useRef<HTMLCanvasElement>(null)
  const motor = useRef<Motor | null>(null)
  const pesou = useRef(aoPesar)
  useEffect(() => {
    pesou.current = aoPesar
  })
  useEffect(() => {
    motor.current = criarMotor(tela.current!, bioma, so, () => pesou.current?.())
    return () => motor.current?.destruir()
    // O motor nasce uma vez; bioma e "so" mudam pelos efeitos abaixo (com transição).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const primeiro = useRef(true)
  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false
      return
    }
    motor.current?.trocarBioma(bioma)
  }, [bioma])
  useEffect(() => motor.current?.soParticulas(so), [so])
  return (
    <canvas
      ref={tela}
      aria-hidden="true"
      className={`object-cover [image-rendering:pixelated] ${className}`}
    />
  )
}

const CHAVE_AVISO = 'hubsquare-aviso-fundo-leve'

// Atrás de todo o app (inclusive do assistente de primeira vez).
export function FundoDoApp(): React.JSX.Element | null {
  const { aparencia, fundoApp, falhou, imagemFalhou, avisosFundo, fecharAvisosFundo, mudar } =
    useAparencia()
  const [aviso, setAviso] = useState(false)
  if (!aparencia) return null

  // Economia automática: o desenho passou de 4 ms por quadro em média.
  function aoPesar(): void {
    if (aparencia?.animacaoFundo === 'leve') return
    mudar({ animacaoFundo: 'leve' })
    try {
      if (localStorage.getItem(CHAVE_AVISO)) return
      localStorage.setItem(CHAVE_AVISO, '1')
    } catch {
      // sem armazenamento: avisa nesta sessão
    }
    setAviso(true)
  }

  // Fase V4: o fundo do app (bioma ou imagem com ajustes). A imagem que não abre volta ao bioma
  // padrão, com um aviso discreto (nunca a tela preta).
  const fundo = fundoApp ?? { tipo: 'bioma' as const, bioma: aparencia.bioma }
  return (
    <>
      {fundo.tipo === 'bioma' ? (
        <FundoAnimado
          bioma={fundo.bioma}
          aoPesar={aoPesar}
          className="fixed inset-0 -z-10 h-full w-full"
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 -z-10">
          <CamadaFundo escolha={fundo} aoFalhar={imagemFalhou} />
        </div>
      )}
      {(falhou || avisosFundo.length > 0) && (
        <div className="anim-aviso fixed bottom-4 left-4 z-(--z-avisos) flex w-[380px] max-w-[calc(100vw-32px)] flex-col gap-2">
          {falhou && (
            <Aviso tipo="atencao">
              <span className="flex-1">
                A imagem de fundo não abriu (foi apagada ou está estragada). Mostrando o bioma;
                escolha outra em Aparência › Fundo.
              </span>
            </Aviso>
          )}
          {avisosFundo.map((a) => (
            <Aviso key={a} tipo="atencao">
              <span className="flex-1">{a}</span>
              <Botao tamanho="pequeno" onClick={fecharAvisosFundo}>
                OK
              </Botao>
            </Aviso>
          ))}
        </div>
      )}
      {aviso && (
        <div className="anim-aviso fixed bottom-4 left-4 z-(--z-avisos) w-[380px] max-w-[calc(100vw-32px)]">
          <Aviso tipo="atencao">
            <span className="flex-1">
              O fundo animado estava pesando neste PC e passou para o modo leve. Dá para mudar em
              Aparência › Tema.
            </span>
            <Botao tamanho="pequeno" onClick={() => setAviso(false)}>
              OK
            </Botao>
          </Aviso>
        </div>
      )}
    </>
  )
}
