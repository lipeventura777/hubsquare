import { Logo } from '../componentes/Logo'
import { useState } from 'react'
import type { ErroTela } from '../../../shared/tipos'
import type { ModoApp } from '../../../shared/modoRegras'
import { MensagemErro } from '../componentes/MensagemErro'
import { t } from '../../../shared/i18n'

// Primeira abertura (Fase M6, DESIGN.md seção 6.10.1): duas escolhas grandes. "Vou hospedar
// servidores" é o app completo (ServSquare + PlaySquare); "Só vou jogar com amigos" mostra só o
// PlaySquare, sem nenhum serviço de servidor rodando. Dá para trocar depois em Ajustes do jogo.
export function BoasVindas({
  sugerirAmigo,
  temConvite,
  aoEscolher
}: {
  sugerirAmigo: boolean
  temConvite: boolean
  aoEscolher: (modo: ModoApp) => Promise<ErroTela | null>
}): React.JSX.Element {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)

  async function escolher(modo: ModoApp): Promise<void> {
    setOcupado(true)
    const e = await aoEscolher(modo)
    setOcupado(false)
    setErro(e)
  }

  const opcoes: { modo: ModoApp; titulo: string; texto: string }[] = [
    {
      modo: 'amigo',
      titulo: t('boasVindas.soVouJogarComAmigos'),
      texto: t('boasVindas.entreNoServidorDeUm')
    },
    {
      modo: 'completo',
      titulo: t('boasVindas.vouHospedarServidores'),
      texto: t('boasVindas.crieConfigureELigueServidores')
    }
  ]
  // Aberto por um convite: o modo amigo vem primeiro e em destaque.
  const ordem = sugerirAmigo ? opcoes : [opcoes[1], opcoes[0]]

  return (
    <div className="flex h-screen items-center justify-center p-6 text-texto">
      <div className="vidro-painel flex w-full max-w-[760px] flex-col gap-6 p-10">
        <div className="flex flex-col gap-2">
          <Logo tamanho={72} />
          <h1 className="texto-pixel text-[28px]">{t('boasVindas.bemVindoAoHubsquare')}</h1>
          <p className="text-[13px] text-muted">{t('boasVindas.comoVoceVaiUsarO')}</p>
        </div>
        {sugerirAmigo && temConvite && (
          <p className="bg-panel-2 px-4 py-3 text-[13px]">
            {t('boasVindas.voceAbriuUmConviteEscolha')}
          </p>
        )}
        <div className="grid gap-3 min-[720px]:grid-cols-2">
          {ordem.map((o, n) => {
            const destaque = sugerirAmigo && o.modo === 'amigo'
            return (
              <button
                key={o.modo}
                type="button"
                disabled={ocupado}
                onClick={() => void escolher(o.modo)}
                className={`anim-item flex flex-col gap-2 rounded-[var(--raio-item)] border-2 bg-panel p-6 text-left transition-colors duration-(--dur-fast) disabled:opacity-60 ${
                  destaque ? 'border-accent' : 'border-linha hover:border-muted'
                }`}
                style={{ '--ordem': n } as React.CSSProperties}
              >
                <span className="texto-pixel text-xl">{o.titulo}</span>
                <span className="text-[13px] text-muted">{o.texto}</span>
                {destaque && (
                  <span className="self-start bg-accent px-2 py-0.5 text-xs font-bold text-accent-text">
                    {t('boasVindas.sugerido')}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {erro && <MensagemErro erro={erro} />}
      </div>
    </div>
  )
}
