import { useEffect, useState } from 'react'
import {
  NOMES_TIPOS,
  type AtualizacoesDisponiveis,
  type ErroTela,
  type EstadoServidor,
  type InfoServidor,
  type Progresso
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { BarraProgresso } from '../componentes/movimento'
import { CardPainel } from '../componentes/paineis'
import { Botao, Dialogo } from '../componentes/ui'
import { abrirTela } from '../estrutura/navegar'

// "Atualizações disponíveis" no Painel (Fase 21). Só avisa; cada atualização precisa de um clique.
export function CardAtualizacoes({
  info,
  estado
}: {
  info: InfoServidor
  estado: EstadoServidor
}): React.JSX.Element | null {
  const [a, setA] = useState<AtualizacoesDisponiveis | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    window.api.lerAtualizacoes().then((r) => r.ok && setA(r.valor))
    const pararProgresso = window.api.aoProgredir(setProgresso)
    const parar = window.api.aoMudarAtualizacoes(setA)
    return () => {
      parar()
      pararProgresso()
    }
  }, [])

  if (!a || a.servidorId !== info.id) return null
  if (!a.build && !a.minecraft && !a.mods && !a.modpack) return null

  const nome = NOMES_TIPOS[info.tipo]
  const desligado = estado === 'desligado'

  async function atualizar(): Promise<void> {
    setOcupado(true)
    setErro(null)
    const r = await window.api.atualizarBuild()
    setOcupado(false)
    setProgresso(null)
    setConfirmando(false)
    if (!r.ok) setErro(r.erro)
  }

  async function verificarDeNovo(): Promise<void> {
    setVerificando(true)
    const r = await window.api.verificarAtualizacoes()
    setVerificando(false)
    if (r.ok) setA(r.valor)
    else setErro(r.erro)
  }

  return (
    <CardPainel
      titulo="Atualizações disponíveis"
      // Chega uns segundos depois de abrir o app: entra com o fade + 6px das listas (seção 8).
      className="anim-item"
      acoes={
        <Botao tamanho="pequeno" onClick={verificarDeNovo} disabled={verificando}>
          {verificando ? 'Verificando...' : 'Verificar de novo'}
        </Botao>
      }
    >
      <ul className="flex flex-col divide-y divide-linha text-[13px]">
        {a.build && (
          <li className="flex flex-wrap items-center gap-3 py-2">
            <span className="flex-1">
              Nova versão do {nome} para o Minecraft {info.versao}:{' '}
              {a.build.atual ? `${a.build.atual} → ` : ''}
              <b>{a.build.nova}</b>.
              {!desligado && (
                <span className="text-muted"> Desligue o servidor para atualizar.</span>
              )}
            </span>
            <Botao
              variante="primario"
              tamanho="pequeno"
              disabled={!desligado}
              onClick={() => setConfirmando(true)}
            >
              Atualizar
            </Botao>
          </li>
        )}
        {a.minecraft && (
          <li className="flex flex-wrap items-center gap-3 py-2">
            <span className="flex-1">
              O {nome} já tem o <b>Minecraft {a.minecraft}</b>. Mods e plugins podem ainda não ter
              sido atualizados para ele: troque pela tela Software quando eles estiverem prontos.
            </span>
            <Botao tamanho="pequeno" onClick={() => abrirTela('Software')}>
              Abrir Software
            </Botao>
          </li>
        )}
        {a.modpack && (
          <li className="flex flex-wrap items-center gap-3 py-2">
            <span className="flex-1">
              Modpack {a.modpack.nome}: {a.modpack.versaoAtual} → <b>{a.modpack.versaoNova}</b>.
            </span>
            <Botao tamanho="pequeno" onClick={() => abrirTela('Mods', 'Atualizações')}>
              Ver
            </Botao>
          </li>
        )}
        {a.mods > 0 && (
          <li className="flex flex-wrap items-center gap-3 py-2">
            <span className="flex-1">
              {a.mods === 1 ? '1 mod ou plugin tem' : `${a.mods} mods ou plugins têm`} versão nova.
            </span>
            <Botao tamanho="pequeno" onClick={() => abrirTela('Mods', 'Atualizações')}>
              Ver
            </Botao>
          </li>
        )}
      </ul>
      {erro && (
        <div className="mt-3">
          <MensagemErro erro={erro} />
        </div>
      )}

      <Dialogo
        aberto={confirmando}
        titulo={`Atualizar o ${nome}?`}
        aoCancelar={() => !ocupado && setConfirmando(false)}
        acao={{ rotulo: ocupado ? 'Atualizando...' : 'Atualizar', ocupado, aoClicar: atualizar }}
      >
        <div className="flex flex-col gap-3">
          <p>
            Continua no Minecraft {info.versao}, só com a versão nova do {nome}
            {a.build ? ` (${a.build.nova})` : ''}. Um backup do mundo é feito antes.
          </p>
          {ocupado && progresso && (
            <div className="flex flex-col gap-1 text-[13px]">
              <span>{progresso.etapa}</span>
              <BarraProgresso
                rotulo={progresso.etapa}
                valor={progresso.recebido}
                maximo={progresso.total}
              />
            </div>
          )}
        </div>
      </Dialogo>
    </CardPainel>
  )
}
