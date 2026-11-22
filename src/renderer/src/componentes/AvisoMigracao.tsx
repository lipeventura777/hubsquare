import { useEffect, useState } from 'react'
import { Botao } from './ui'
import { t } from '../../../shared/i18n'

// Fase E2: quando a mudança das pastas ServSquare para HubSquare não terminou nesta abertura, um
// aviso de atenção no canto (padrão dos avisos, DESIGN.md 6.9 e 8). Nunca notificação do Windows.
// O app tenta de novo sozinho na próxima abertura.
export function AvisoMigracao(): React.JSX.Element | null {
  const [texto, setTexto] = useState<string | null>(null)
  useEffect(() => {
    window.api.avisoMigracao().then(setTexto)
  }, [])
  if (!texto) return null
  return (
    <div
      role="alert"
      data-aviso="migracao"
      className="anim-aviso fixed bottom-4 left-4 z-(--z-avisos) flex w-[420px] max-w-[calc(100vw-32px)] flex-col gap-2 border-2 border-l-4 border-linha border-l-warning bg-panel p-4 shadow-lg"
    >
      <div className="text-sm">{texto}</div>
      <div className="flex justify-end">
        <Botao tamanho="pequeno" onClick={() => setTexto(null)}>
          {t('avisoMigracao.fechar')}
        </Botao>
      </div>
    </div>
  )
}
