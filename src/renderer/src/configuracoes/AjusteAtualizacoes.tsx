import { useEffect, useState } from 'react'
import type { AjustesApp } from '../../../shared/tipos'
import { LinhaControle } from '../componentes/ui'

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
        rotulo="Verificar atualizações automaticamente"
        ligado={ajustes.verificarAtualizacoes}
        aoMudar={async (v) => {
          const r = await window.api.salvarAjustes({ verificarAtualizacoes: v })
          if (r.ok) setAjustes(r.valor)
        }}
      />
      <p className="text-xs text-muted">
        Ao abrir o app e a cada 6 horas, ele só confere se há versão nova do software, do Minecraft,
        dos mods ou do modpack, e mostra um aviso no Painel. Nada é atualizado sem você clicar.
      </p>
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
        rotulo="Avisar quando sair versão nova do HubSquare"
        ligado={ligado}
        aoMudar={async (v) => {
          const r = await window.api.ligarAvisoVersao(v)
          if (r.ok) setLigado(r.valor)
        }}
      />
      <p className="text-xs text-muted">
        Ao abrir o app e a cada 6 horas, ele confere no GitHub se saiu versão nova. O aviso só abre
        a página para baixar; nada é instalado sozinho.
      </p>
    </>
  )
}
