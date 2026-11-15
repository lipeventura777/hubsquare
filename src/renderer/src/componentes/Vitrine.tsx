import { classesBotao } from './estilos'
import { IconeOlho, IconeOlhoRiscado } from './icones'
import { t } from '../../../shared/i18n'

// Modo vitrine (Fase V11, DESIGN.md seção 6.25): Jogar e Painel com o fundo à mostra. Aqui ficam
// o botão de olho ("Esconder painel" / "Mostrar painel") e o bloco de vidro do canto de baixo à
// esquerda. O bloco é uma placa de vidro (.placa-vidro, pelo menos 70%): 4,5:1 sobre qualquer
// fundo, a mesma regra do nome no banner (tests/contrasteRegras.test.ts).

export function BotaoVitrine({
  ligada,
  aoAlternar
}: {
  ligada: boolean
  aoAlternar: () => void
}): React.JSX.Element {
  const rotulo = ligada ? t('vitrine.mostrarPainel') : t('vitrine.esconderPainel')
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      onClick={aoAlternar}
      className={`${classesBotao('secundario', 'pequeno')} w-8 px-0!`}
    >
      {ligada ? (
        <IconeOlho className="h-4 w-4 shrink-0" />
      ) : (
        <IconeOlhoRiscado className="h-4 w-4 shrink-0" />
      )}
    </button>
  )
}

export function BlocoVitrine({
  icone,
  nome,
  detalhe,
  principal,
  estado,
  fundo,
  aoMostrar
}: {
  icone: React.ReactNode
  nome: string
  detalhe?: string
  principal: React.ReactNode // JOGAR ou LIGAR, exatamente o mesmo botão da barra
  estado?: React.ReactNode // ao lado do botão: estado do servidor, progresso, erro
  fundo: React.ReactNode // o mesmo botão "Fundo" do banner
  aoMostrar: () => void
}): React.JSX.Element {
  return (
    <div
      role="region"
      aria-label={t('vitrine.vitrineDe', { nome })}
      className="vitrine-bloco placa-vidro absolute bottom-6 left-6 z-20 flex max-w-[min(640px,calc(100%-48px))] flex-col gap-4 p-5 text-texto"
    >
      <div className="flex min-w-0 items-center gap-4">
        {icone}
        <div className="min-w-0">
          <h2
            className="texto-pixel truncate text-3xl [text-shadow:3px_3px_0_var(--sombra-texto)]"
            title={nome}
          >
            {nome}
          </h2>
          {detalhe && <p className="truncate text-[13px] text-muted">{detalhe}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {principal}
        {estado}
      </div>
      <div className="flex items-center gap-2">
        {fundo}
        <BotaoVitrine ligada aoAlternar={aoMostrar} />
      </div>
    </div>
  )
}
