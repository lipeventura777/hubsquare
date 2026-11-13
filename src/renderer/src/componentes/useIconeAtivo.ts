import { useEffect, useState } from 'react'
import { EVENTO_ICONE } from '../estrutura/navegar'

// Ícone do servidor ativo (data URL ou null); atualiza quando o usuário troca ou remove.
export function useIconeAtivo(chave?: unknown): string | null {
  const [icone, setIcone] = useState<string | null>(null)
  useEffect(() => {
    const ler = (): void => {
      window.api.lerIcone().then((r) => setIcone(r.ok ? r.valor : null))
    }
    ler()
    window.addEventListener(EVENTO_ICONE, ler)
    return () => window.removeEventListener(EVENTO_ICONE, ler)
  }, [chave])
  return icone
}
