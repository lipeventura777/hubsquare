import { useEffect, useState } from 'react'
import type { ReleaseApp } from '../../../shared/tipos'
import { Markdown } from '../mods/Markdown'
import { Botao } from './ui'

// Versão nova do HubSquare (Fase M2): aviso discreto no canto, no padrão dos avisos (DESIGN.md
// 6.9 e 8). Só avisa: "Baixar" abre a página do release no navegador; nada é instalado sozinho.
// Sem internet não aparece nada.
export function AvisoVersaoApp(): React.JSX.Element | null {
  const [release, setRelease] = useState<ReleaseApp | null>(null)
  useEffect(() => {
    window.api.avisoVersaoApp().then((r) => r.ok && setRelease(r.valor))
    return window.api.aoMudarVersaoApp(setRelease)
  }, [])
  if (!release) return null

  const fechar = (acao: () => Promise<unknown>): void => {
    setRelease(null)
    void acao()
  }
  return (
    <div
      role="status"
      className="anim-aviso fixed right-4 bottom-4 z-(--z-avisos) flex w-[380px] max-w-[calc(100vw-32px)] flex-col gap-2 border-2 border-linha bg-panel p-4 shadow-lg"
    >
      <div className="text-sm font-bold">HubSquare {release.versao} disponível</div>
      {release.notas.trim() && (
        <div className="max-h-48 overflow-y-auto pr-1">
          <Markdown texto={release.notas} />
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Botao tamanho="pequeno" onClick={() => fechar(window.api.pularVersaoApp)}>
          Pular esta versão
        </Botao>
        <Botao tamanho="pequeno" onClick={() => fechar(window.api.lembrarVersaoDepois)}>
          Lembrar depois
        </Botao>
        <Botao
          tamanho="pequeno"
          variante="primario"
          onClick={() => void window.api.baixarVersaoApp()}
        >
          Baixar
        </Botao>
      </div>
    </div>
  )
}
