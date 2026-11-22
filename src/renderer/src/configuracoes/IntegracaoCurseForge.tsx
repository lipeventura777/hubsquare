import { useEffect, useState } from 'react'
import { Aviso, Secao } from '../componentes/ui'
import { t } from '../../../shared/i18n'

// Opções › Integrações (Fase L1): o CurseForge usa a chave oficial do HubSquare, que entra só no
// build. Não há mais campo para colar chave: a tela só diz se ele está ativo ou "em breve".
export function IntegracaoCurseForge(): React.JSX.Element {
  const [tem, setTem] = useState<boolean | null>(null)
  useEffect(() => {
    window.api.temChaveCurseForge().then((r) => setTem(r.ok && r.valor))
  }, [])
  return (
    <Secao titulo={t('integracaoCurseForge.curseforge')}>
      {tem === true && (
        <Aviso tipo="sucesso">
          <span>{t('integracaoCurseForge.ativo')}</span>
        </Aviso>
      )}
      {tem === false && <p className="text-[13px]">{t('integracaoCurseForge.emBreve')}</p>}
    </Secao>
  )
}
