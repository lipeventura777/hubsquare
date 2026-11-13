import { useEffect, useState } from 'react'
import type { Configuracoes, ErroTela, EstadoServidor, LimitesRam } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Esqueleto } from '../componentes/movimento'
import { Aviso, Botao } from '../componentes/ui'
import { useIconeAtivo } from '../componentes/useIconeAtivo'
import { CamposDoJogo } from './CamposDoJogo'

export function OpcoesDoJogo({
  estado,
  nome
}: {
  estado: EstadoServidor
  nome: string
}): React.JSX.Element {
  const icone = useIconeAtivo()
  const [config, setConfig] = useState<Configuracoes | null>(null)
  const [ram, setRam] = useState<LimitesRam | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [reiniciarPendente, setReiniciarPendente] = useState(false)
  const [reiniciando, setReiniciando] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    window.api.lerConfiguracoes().then((r) => {
      if (!r.ok) return setErro(r.erro)
      setConfig(r.valor.configuracoes)
      setRam(r.valor.ram)
    })
  }, [])

  if (!config || !ram) return erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={5} />

  function mudar<K extends keyof Configuracoes>(chave: K, valor: Configuracoes[K]): void {
    setConfig((c) => c && { ...c, [chave]: valor })
    setSalvo(false)
  }

  async function salvar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault()
    if (!config) return
    setErro(null)
    setSalvando(true)
    const r = await window.api.salvarConfiguracoes(config)
    setSalvando(false)
    if (!r.ok) return setErro(r.erro)
    setSalvo(true)
    setReiniciarPendente(r.valor.precisaReiniciar)
  }

  async function reiniciar(): Promise<void> {
    setErro(null)
    setReiniciando(true)
    const r = await window.api.reiniciar()
    setReiniciando(false)
    if (r.ok) setReiniciarPendente(false)
    else setErro(r.erro)
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-10">
      <CamposDoJogo config={config} ram={ram} mudar={mudar} nome={nome} icone={icone} />

      <div className="flex flex-col gap-3">
        <Botao type="submit" variante="primario" disabled={salvando} className="self-start">
          {salvando ? 'Salvando...' : 'Salvar'}
        </Botao>
        {salvo && !reiniciarPendente && <Aviso tipo="sucesso">Configurações salvas.</Aviso>}
        {reiniciarPendente && (estado !== 'desligado' || reiniciando) && (
          <Aviso tipo="atencao">
            <span className="flex-1">As mudanças valem quando você reiniciar o servidor.</span>
            <Botao variante="atencao" onClick={reiniciar} disabled={reiniciando}>
              {reiniciando ? 'Reiniciando...' : 'Reiniciar agora'}
            </Botao>
          </Aviso>
        )}
        {erro && <MensagemErro erro={erro} />}
      </div>
    </form>
  )
}
