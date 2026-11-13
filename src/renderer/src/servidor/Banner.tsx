import { useEffect, useState } from 'react'
import { MotdFormatado } from '../componentes/MotdFormatado'
import type { InfoServidor } from '../../../shared/tipos'
import { useAparencia } from '../aparencia/useAparencia'
import { Avisos } from '../componentes/Avisos'
import { IconeCopiar } from '../componentes/icones'
import { Botao } from '../componentes/ui'
import { BotaoDiagnostico, consertoDoDono } from '../componentes/Diagnostico'

// Banner da aba Painel (seção 6.3): imagem do usuário (ou o padrão geométrico), nome do servidor
// em pixel, MOTD, o card "Chame seus amigos" e os avisos de entrada e saída.
export function Banner({
  info,
  endereco,
  aviso
}: {
  info: InfoServidor
  endereco: string | null
  aviso: string
}): React.JSX.Element {
  const { fundoUrl } = useAparencia()
  const [motd, setMotd] = useState('')

  useEffect(() => {
    window.api.lerConfiguracoes().then((r) => r.ok && setMotd(r.valor.configuracoes.motd))
  }, [])

  return (
    <section
      aria-label="Servidor"
      className="relative flex h-[50vh] min-h-[300px] shrink-0 items-center overflow-hidden text-on-dark"
    >
      {fundoUrl ? (
        <img src={fundoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div aria-hidden="true" className="banner-padrao absolute inset-0" />
      )}
      <div aria-hidden="true" className="banner-gradiente absolute inset-0" />

      <div className="relative flex min-w-0 flex-1 flex-col items-center px-6 text-center">
        {/* Placa de vidro: o nome fica legível sobre o bioma ou qualquer imagem (Fase V1). */}
        <div className="placa-vidro flex max-w-full flex-col items-center px-8 py-4 text-texto">
          <h2 className="texto-pixel max-w-full text-5xl break-words [text-shadow:3px_3px_0_var(--sombra-texto)]">
            {info.nome}
          </h2>
          {motd && <MotdFormatado motd={motd} className="mt-2 max-w-full text-base" />}
        </div>
      </div>

      <CardAmigos endereco={endereco} aviso={aviso} />

      <Avisos className="absolute right-[380px] bottom-4" />
    </section>
  )
}

function CardAmigos({
  endereco,
  aviso
}: {
  endereco: string | null
  aviso: string
}): React.JSX.Element {
  const [copiado, setCopiado] = useState(false)

  async function copiar(): Promise<void> {
    if (!endereco) return
    await window.api.copiar(endereco)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="relative mr-6 flex w-[340px] shrink-0 flex-col gap-2 rounded-(--raio-item) border border-linha bg-panel/92 p-5 text-texto">
      <h3 className="texto-pixel text-[22px]">Chame seus amigos!</h3>
      <p className="text-[13px] text-muted">
        {endereco ? 'Passe este endereço para eles entrarem.' : aviso}
      </p>
      {endereco && <code className="font-mono text-[15px] font-bold break-all">{endereco}</code>}
      <Botao variante="destaque" className="mt-1 self-start" onClick={copiar} disabled={!endereco}>
        <IconeCopiar className="h-4 w-4" />
        {copiado ? 'Copiado!' : 'Copiar endereço'}
      </Botao>
      <BotaoDiagnostico
        rotulo="Testar tudo"
        titulo="Testar a conexão do servidor"
        tamanho="pequeno"
        rodar={window.api.diagnosticarDono}
        aoConsertar={consertoDoDono}
      />
    </div>
  )
}
