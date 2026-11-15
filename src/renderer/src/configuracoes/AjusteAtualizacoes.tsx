import { useEffect, useState } from 'react'
import type { AjustesApp } from '../../../shared/tipos'
import { LinhaControle } from '../componentes/ui'
import { t } from '../../../shared/i18n'

// "Verificar atualizações automaticamente" (ligado por padrão). Vale para o app todo.
export function AjusteAtualizacoes(): React.JSX.Element | null {
  const [ajustes, setAjustes] = useState<AjustesApp | null>(null)

  useEffect(() => {
    window.api.lerAjustes().then((r) => r.ok && setAjustes(r.valor))
  }, [])

  if (!ajustes) return null
  return (
    <>
      <LinhaControle
        rotulo={t('ajusteAtualizacoes.verificarAtualizacoesAutomaticamente')}
        ligado={ajustes.verificarAtualizacoes}
        aoMudar={async (v) => {
          const r = await window.api.salvarAjustes({ verificarAtualizacoes: v })
          if (r.ok) setAjustes(r.valor)
        }}
      />
      <p className="text-xs text-muted">{t('ajusteAtualizacoes.aoAbrirOAppE')}</p>
      <AjusteVersaoApp />
    </>
  )
}

// "Avisar quando sair versão nova do HubSquare" (Fase M2, ligado por padrão). Também fica em
// PlaySquare › Ajustes do jogo, para quem só usa o launcher.
export function AjusteVersaoApp(): React.JSX.Element | null {
  const [ligado, setLigado] = useState<boolean | null>(null)
  useEffect(() => {
    window.api.avisoVersaoLigado().then((r) => r.ok && setLigado(r.valor))
  }, [])
  if (ligado === null) return null
  return (
    <>
      <LinhaControle
        rotulo={t('ajusteAtualizacoes.avisarQuandoSairVersaoNova')}
        ligado={ligado}
        aoMudar={async (v) => {
          const r = await window.api.ligarAvisoVersao(v)
          if (r.ok) setLigado(r.valor)
        }}
      />
      <p className="text-xs text-muted">{t('ajusteAtualizacoes.aoAbrirOAppE2')}</p>
    </>
  )
}
