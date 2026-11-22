import { classesBotao } from './estilos'
import { IconeOlho, IconeOlhoRiscado } from '../icones'
import { t } from '../../../shared/i18n'

// Modo vitrine (Fase V11, DESIGN.md seção 6.22.10): Jogar e Painel com o fundo do app à mostra (o
// mesmo componente animado, que a vitrine nunca troca, pausa nem remonta: ela só esconde o que está
// por cima). Aqui ficam o botão de olho e o bloco de vidro do canto de baixo à esquerda. O bloco é uma placa de vidro (.placa-vidro, pelo menos 70%): 4,5:1 sobre qualquer
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

// O bloco da vitrine: o ícone, o nome, o botão principal (LIGAR ou JOGAR, o mesmo da barra) e,
// ao lado dele, o olho que traz o painel de volta (sempre visível).
export function BlocoVitrine({
  icone,
  nome,
  principal,
  aoMostrar
}: {
  icone: React.ReactNode
  nome: string
  principal: React.ReactNode
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
        <h2
          className="texto-pixel min-w-0 truncate text-3xl [text-shadow:3px_3px_0_var(--sombra-texto)]"
          title={nome}
        >
          {nome}
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {principal}
        <BotaoVitrine ligada aoAlternar={aoMostrar} />
      </div>
    </div>
  )
}
