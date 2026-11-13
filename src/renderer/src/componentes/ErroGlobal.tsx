import { Component, useEffect, useState } from 'react'
import type { ErroTela } from '../../../shared/tipos'
import { MensagemErro } from './MensagemErro'
import { Botao } from './ui'

// Nenhum erro derruba o app (correção da instalação de modpacks): o que escapar do processo
// principal ou da tela aparece aqui, no padrão de erro (seção 6.9), em vez de travar ou fechar.

const textoDe = (e: unknown): string =>
  e instanceof Error ? (e.stack ?? e.message) : typeof e === 'string' ? e : JSON.stringify(e)

const erroDaTela = (e: unknown): ErroTela => ({
  mensagem:
    'Algo deu errado nesta tela. Você pode continuar usando o app; se repetir, veja os detalhes.',
  detalhes: textoDe(e)
})

export function ErroGlobal(): React.JSX.Element | null {
  const [erro, setErro] = useState<ErroTela | null>(null)
  useEffect(() => {
    const aoErro = (e: ErrorEvent): void => setErro(erroDaTela(e.error ?? e.message))
    const aoRejeitar = (e: PromiseRejectionEvent): void => setErro(erroDaTela(e.reason))
    window.addEventListener('error', aoErro)
    window.addEventListener('unhandledrejection', aoRejeitar)
    const parar = window.api.aoErroDoApp(setErro)
    return () => {
      window.removeEventListener('error', aoErro)
      window.removeEventListener('unhandledrejection', aoRejeitar)
      parar()
    }
  }, [])
  if (!erro) return null
  return (
    <div className="anim-aviso fixed right-4 bottom-4 z-(--z-avisos) w-[420px] max-w-[calc(100vw-32px)] bg-panel shadow-lg">
      <MensagemErro erro={erro} />
      <div className="flex justify-end px-4 pb-3">
        <Botao tamanho="pequeno" onClick={() => setErro(null)}>
          Fechar
        </Botao>
      </div>
    </div>
  )
}

// Erro ao desenhar uma tela: mostra a mensagem e "Recarregar a tela", em vez de deixar tudo branco.
export class LimiteDeErro extends Component<{ children: React.ReactNode }, { erro: unknown }> {
  state = { erro: null as unknown }
  static getDerivedStateFromError(erro: unknown): { erro: unknown } {
    return { erro }
  }
  render(): React.ReactNode {
    if (!this.state.erro) return this.props.children
    return (
      <div className="m-auto flex max-w-[560px] flex-col gap-3 p-10">
        <MensagemErro erro={erroDaTela(this.state.erro)} />
        <div>
          <Botao variante="primario" onClick={() => location.reload()}>
            Recarregar a tela
          </Botao>
        </div>
      </div>
    )
  }
}
