import { useEffect, useState } from 'react'
import type { AvisoVersao, MotivoEspera } from '../../../shared/tipos'
import { Markdown } from '../mods/Markdown'
import { Botao } from './ui'
import { t } from '../../../shared/i18n'

// Versão nova do HubSquare (Fases M2 e L1): aviso discreto no canto, no padrão dos avisos
// (DESIGN.md 6.9 e 8), nunca notificação do Windows. Baixada em segundo plano, vira "Versão X
// pronta" com "Reiniciar e atualizar", "Ao fechar" e "Ver novidades"; com algo rodando, mostra
// por que ainda espera. Se não deu para baixar, "Baixar" abre a página do release.
const ESPERA: Record<MotivoEspera, () => string> = {
  servidor: () => t('avisoVersaoApp.esperandoServidor'),
  backup: () => t('avisoVersaoApp.esperandoBackup'),
  modpack: () => t('avisoVersaoApp.esperandoModpack'),
  jogar: () => t('avisoVersaoApp.esperandoJogar')
}

export function AvisoVersaoApp(): React.JSX.Element | null {
  const [aviso, setAviso] = useState<AvisoVersao | null>(null)
  const [novidades, setNovidades] = useState(false)
  useEffect(() => {
    window.api.avisoVersaoApp().then((r) => r.ok && setAviso(r.valor))
    return window.api.aoMudarVersaoApp(setAviso)
  }, [])
  if (!aviso) return null

  const fechar = (acao: () => Promise<unknown>): void => {
    setAviso(null)
    void acao()
  }
  const notas = aviso.notas.trim() && (!aviso.pronta || novidades) && (
    <div className="max-h-48 overflow-y-auto pr-1">
      <Markdown texto={aviso.notas} />
    </div>
  )
  return (
    <div
      role="status"
      className="anim-aviso fixed right-4 bottom-4 z-(--z-avisos) flex w-[380px] max-w-[calc(100vw-32px)] flex-col gap-2 border-2 border-linha bg-panel p-4 shadow-lg"
    >
      <div className="text-sm font-bold">
        {aviso.pronta
          ? t('avisoVersaoApp.versaoPronta', { versao: aviso.versao })
          : t('avisoVersaoApp.hubsquareDisponivel', { versao: aviso.versao })}
      </div>
      {aviso.pronta && (
        <p className="text-[13px]">{t('avisoVersaoApp.prontaTexto', { versao: aviso.versao })}</p>
      )}
      {aviso.esperando && (
        <p className="text-[13px] font-bold text-warning">{ESPERA[aviso.esperando]()}</p>
      )}
      {notas}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Botao tamanho="pequeno" onClick={() => fechar(window.api.pularVersaoApp)}>
          {t('avisoVersaoApp.pularEstaVersao')}
        </Botao>
        {aviso.pronta ? (
          <>
            {aviso.notas.trim() && (
              <Botao tamanho="pequeno" onClick={() => setNovidades((v) => !v)}>
                {novidades
                  ? t('avisoVersaoApp.esconderNovidades')
                  : t('avisoVersaoApp.verNovidades')}
              </Botao>
            )}
            <Botao tamanho="pequeno" onClick={() => fechar(window.api.lembrarVersaoDepois)}>
              {t('avisoVersaoApp.aoFechar')}
            </Botao>
            <Botao
              tamanho="pequeno"
              variante="primario"
              disabled={!!aviso.esperando}
              onClick={() => void window.api.instalarVersaoApp()}
            >
              {t('avisoVersaoApp.reiniciarEAtualizar')}
            </Botao>
          </>
        ) : (
          <>
            <Botao tamanho="pequeno" onClick={() => fechar(window.api.lembrarVersaoDepois)}>
              {t('avisoVersaoApp.lembrarDepois')}
            </Botao>
            <Botao
              tamanho="pequeno"
              variante="primario"
              onClick={() => void window.api.baixarVersaoApp()}
            >
              {t('avisoVersaoApp.baixar')}
            </Botao>
          </>
        )}
      </div>
    </div>
  )
}
