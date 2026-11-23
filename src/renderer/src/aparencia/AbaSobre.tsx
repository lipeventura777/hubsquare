import { Logo, Wordmark } from '../componentes/Logo'
import { useEffect, useState } from 'react'
import { t } from '../../../shared/i18n'
import { CardPainel } from '../componentes/paineis'
import { Botao } from '../componentes/ui'
import { BotaoRelatar } from '../componentes/RelatarProblema'
import { ApoiarProjeto } from './ApoiarProjeto'

// Fase I1: engrenagem › Sobre. Versão, licença, links públicos e o aviso da marca Minecraft.
// Os links aparecem como texto com "Copiar": o PlaySquare não abre links externos.
const REPOSITORIO = 'https://github.com/lipeventura777/hubsquare'
const LINKS: {
  chave: 'sobre.repositorio' | 'sobre.licenca' | 'sobre.privacidade' | 'sobre.terceiros'
  url: string
}[] = [
  { chave: 'sobre.repositorio', url: REPOSITORIO },
  { chave: 'sobre.licenca', url: `${REPOSITORIO}/blob/main/LICENSE` },
  { chave: 'sobre.privacidade', url: `${REPOSITORIO}/blob/main/PRIVACY.md` },
  { chave: 'sobre.terceiros', url: `${REPOSITORIO}/blob/main/THIRD_PARTY_NOTICES.md` }
]

export function AbaSobre(): React.JSX.Element {
  const [versao, setVersao] = useState('')
  const [copiado, setCopiado] = useState<string | null>(null)
  useEffect(() => {
    window.api.versaoDoApp().then(setVersao)
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <CardPainel titulo={t('sobre.titulo')}>
        <div className="flex flex-col gap-2 text-[13px]">
          <div className="flex items-center gap-3">
            <Logo tamanho={64} />
            <Wordmark className="text-[28px]" />
          </div>
          <p>{t('sobre.descricao')}</p>
          <p className="text-muted">{t('sobre.versao', { versao })}</p>
          <p className="text-muted">{t('sobre.fontes')}</p>
        </div>
      </CardPainel>
      <CardPainel titulo={t('relatar.relatarProblema')}>
        <div className="flex flex-col items-start gap-3 text-[13px]">
          <p>{t('relatar.sobreExplicacao')}</p>
          <BotaoRelatar />
        </div>
      </CardPainel>
      <ApoiarProjeto />
      <CardPainel titulo={t('sobre.links')}>
        <ul className="flex flex-col gap-3">
          {LINKS.map((l) => (
            <li key={l.url} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              <span className="font-bold">{t(l.chave)}</span>
              <span className="min-w-0 flex-1 break-all text-muted">{l.url}</span>
              <Botao
                tamanho="pequeno"
                onClick={() => {
                  void navigator.clipboard.writeText(l.url)
                  setCopiado(l.url)
                }}
              >
                {copiado === l.url ? t('sobre.copiado') : t('sobre.copiar')}
              </Botao>
            </li>
          ))}
        </ul>
      </CardPainel>
      <p className="text-xs font-bold text-muted">{t('sobre.avisoMojang')}</p>
    </div>
  )
}
