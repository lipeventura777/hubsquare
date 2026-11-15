import { useEffect, useState } from 'react'
import type { ErroTela } from '../../../shared/tipos'
import type { ModoApp } from '../../../shared/modoRegras'
import { MensagemErro } from '../componentes/MensagemErro'
import { Botao, Secao } from '../componentes/ui'
import { avisarModo } from '../estrutura/navegar'
import { t } from '../../../shared/i18n'

// Ajustes do jogo › Modo do app (Fase M6). Trocar só muda a tela e os serviços do ServSquare:
// nenhum servidor, backup ou configuração é apagado. Voltar ao amigo só com o servidor desligado.
export function ModoDoApp(): React.JSX.Element | null {
  const [modo, setModo] = useState<ModoApp | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    window.api.estadoModo().then((r) => r.ok && setModo(r.valor.modo))
  }, [])
  if (!modo) return null

  async function trocar(novo: ModoApp): Promise<void> {
    setOcupado(true)
    const r = await window.api.escolherModoApp(novo)
    setOcupado(false)
    if (!r.ok) return setErro(r.erro)
    setErro(null)
    setModo(novo)
    avisarModo(r.valor)
  }

  return (
    <Secao titulo={t('modoDoApp.modoDoApp')}>
      <p className="text-[13px] text-muted">
        {modo === 'amigo' ? t('modoDoApp.voceEstaUsandoSoO') : t('modoDoApp.voceEstaUsandoOApp')}
      </p>
      <div>
        {modo === 'amigo' ? (
          <Botao variante="primario" disabled={ocupado} onClick={() => void trocar('completo')}>
            {t('modoDoApp.tambemQueroHospedarServidores')}
          </Botao>
        ) : (
          <Botao disabled={ocupado} onClick={() => void trocar('amigo')}>
            {t('modoDoApp.usarSoOPlaysquareModo')}
          </Botao>
        )}
      </div>
      <p className="text-xs text-muted">{t('modoDoApp.trocarNaoApagaNadaSeus')}</p>
      {erro && <MensagemErro erro={erro} />}
    </Secao>
  )
}
