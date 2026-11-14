import { camadaDeLuz, urlDoFundo, type EscolhaFundo } from '../../../shared/fundoRegras'
import { ArteDoBioma, FundoAnimado } from './Fundo'

// Um fundo escolhido (Fase V4), ocupando o elemento pai (absolute inset-0): o bioma vivo, ou a
// imagem com os ajustes (enquadramento, ponto de foco, desfoque, luz e partículas por cima).
// "parado": quadro fixo do bioma e sem partículas (prévias e miniaturas).
export function CamadaFundo({
  escolha,
  parado = false,
  className = '',
  aoFalhar
}: {
  escolha: EscolhaFundo
  parado?: boolean
  className?: string
  aoFalhar?: () => void // a imagem não abriu (apagada ou estragada por fora)
}): React.JSX.Element {
  if (escolha.tipo === 'bioma') {
    return parado ? (
      <ArteDoBioma
        bioma={escolha.bioma}
        className={`absolute inset-0 h-full w-full ${className}`}
      />
    ) : (
      <FundoAnimado
        bioma={escolha.bioma}
        className={`absolute inset-0 h-full w-full ${className}`}
      />
    )
  }
  const { ajuste } = escolha
  const luz = camadaDeLuz(ajuste.luz)
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden bg-(--fundo-base) ${className}`}
    >
      <img
        data-fundo
        src={urlDoFundo(escolha.imagem)}
        alt=""
        onError={aoFalhar}
        className="absolute inset-0 h-full w-full"
        style={{
          objectFit: ajuste.enquadrar === 'inteira' ? 'contain' : 'cover',
          objectPosition: `${ajuste.focoX * 100}% ${ajuste.focoY * 100}%`,
          // O desfoque escurece a borda: a imagem cresce um pouco para a borda não aparecer.
          filter: ajuste.desfoque ? `blur(${ajuste.desfoque}px)` : undefined,
          transform: ajuste.desfoque ? 'scale(1.06)' : undefined
        }}
      />
      {luz && (
        <div
          className={`absolute inset-0 ${luz.cor === 'preto' ? 'bg-(--text-on-light)' : 'bg-(--text-on-dark)'}`}
          style={{ opacity: luz.opacidade }}
        />
      )}
      {ajuste.particulas && !parado && (
        <FundoAnimado bioma={ajuste.particulas} so className="absolute inset-0 h-full w-full" />
      )}
    </div>
  )
}
