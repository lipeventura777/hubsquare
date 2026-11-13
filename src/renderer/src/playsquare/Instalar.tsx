/* eslint-disable react-refresh/only-export-components -- peças pequenas usadas por três telas */
import { useEffect, useState } from 'react'
import type { ErroTela, Instalacao } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Aviso, Botao } from '../componentes/ui'

// Correção P1: enquanto a abertura direta do jogo não funciona, o botão principal é INSTALAR
// (monta a pasta da instalação) e o JOGAR aparece desativado como "Em breve". Nada aqui abre o
// launcher, a Microsoft Store ou links externos.

export const DICA_JOGAR = 'Em breve: abrir o jogo direto pelo HubSquare'

// Opção interna do processo principal (ABRIR_LAUNCHER_LIGADO). Desligada até eu religar.
export function useAbrirLauncherLigado(): boolean {
  const [ligado, setLigado] = useState(false)
  useEffect(() => {
    window.api.abrirLauncherLigado().then(setLigado)
  }, [])
  return ligado
}

// O que o botão principal diz: INSTALAR (nunca montada), ATUALIZAR (mudou desde então).
export function precisaInstalar(i: Instalacao): boolean {
  return !i.instalada || i.atualizar
}

export function rotuloInstalar(i: Instalacao, ocupado: boolean): string {
  if (ocupado) return i.instalada ? 'ATUALIZANDO' : 'INSTALANDO'
  return i.instalada ? 'ATUALIZAR' : 'INSTALAR'
}

// JOGAR visível e desativado, com a dica.
export function JogarEmBreve({
  tamanho = 'normal'
}: {
  tamanho?: 'normal' | 'pequeno'
}): React.JSX.Element {
  return (
    <span title={DICA_JOGAR}>
      <Botao tamanho={tamanho} disabled aria-label={`Jogar. ${DICA_JOGAR}`}>
        JOGAR
      </Botao>
    </span>
  )
}

// Depois de instalar: abrir a pasta e exportar para o Modrinth App / Prism Launcher.
export function AcoesDaInstalada({
  i,
  compacto = false
}: {
  i: Instalacao
  compacto?: boolean
}): React.JSX.Element {
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [salvo, setSalvo] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Botao
          tamanho={compacto ? 'pequeno' : 'normal'}
          onClick={() =>
            void window.api.abrirPastaInstalacao(i.id).then((r) => setErro(r.ok ? null : r.erro))
          }
        >
          Abrir pasta da instalação
        </Botao>
        <Botao
          tamanho={compacto ? 'pequeno' : 'normal'}
          // Compacto (com o JOGAR ligado): opção secundária, sem destaque.
          variante={compacto ? undefined : 'destaque'}
          disabled={exportando}
          onClick={async () => {
            setExportando(true)
            const r = await window.api.exportarMrpack(i.id)
            setExportando(false)
            if (!r.ok) return setErro(r.erro)
            setErro(null)
            if (r.valor) setSalvo(r.valor)
          }}
        >
          {exportando ? 'Exportando...' : 'Exportar para Modrinth App / Prism Launcher'}
        </Botao>
      </div>
      {!compacto && (
        <p className="text-xs text-muted">
          Abrir o jogo direto pelo HubSquare chega numa próxima versão. Por enquanto, importe o
          arquivo exportado no Modrinth App ou no Prism Launcher e jogue por eles.
        </p>
      )}
      {salvo && (
        <Aviso tipo="sucesso">
          Salvo em Downloads como {salvo}. No Modrinth App ou no Prism Launcher, importe esse
          arquivo.
        </Aviso>
      )}
      {erro && <MensagemErro erro={erro} />}
    </div>
  )
}
