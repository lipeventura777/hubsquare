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
import { t } from '../../../shared/i18n'

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
      titulo={t('cardAtualizacoes.atualizacoesDisponiveis')}
      // Chega uns segundos depois de abrir o app: entra com o fade + 6px das listas (seção 8).
      className="anim-item"
      acoes={
        <Botao tamanho="pequeno" onClick={verificarDeNovo} disabled={verificando}>
          {verificando ? t('cardAtualizacoes.verificando') : t('cardAtualizacoes.verificarDeNovo')}
        </Botao>
      }
    >
      <ul className="flex flex-col divide-y divide-linha text-[13px]">
        {a.build && (
          <li className="flex flex-wrap items-center gap-3 py-2">
            <span className="flex-1">
              {t('cardAtualizacoes.novaVersaoDoParaO', { nome, versao: info.versao })}{' '}
              {a.build.atual ? `${a.build.atual} → ` : ''}
              <b>{a.build.nova}</b>.
              {!desligado && (
                <span className="text-muted">
                  {' '}
                  {t('cardAtualizacoes.desligueOServidorParaAtualizar')}
                </span>
              )}
            </span>
            <Botao
              variante="primario"
              tamanho="pequeno"
              disabled={!desligado}
              onClick={() => setConfirmando(true)}
            >
              {t('cardAtualizacoes.atualizar')}
            </Botao>
          </li>
        )}
        {a.minecraft && (
          <li className="flex flex-wrap items-center gap-3 py-2">
            <span className="flex-1">
              {t('cardAtualizacoes.oJaTemO', { nome })}{' '}
              <b>{t('cardAtualizacoes.minecraft', { minecraft: a.minecraft })}</b>
              {t('cardAtualizacoes.modsEPluginsPodemAinda')}
            </span>
            <Botao tamanho="pequeno" onClick={() => abrirTela('Software')}>
              {t('cardAtualizacoes.abrirSoftware')}
            </Botao>
          </li>
        )}
        {a.modpack && (
          <li className="flex flex-wrap items-center gap-3 py-2">
            <span className="flex-1">
              {t('cardAtualizacoes.modpack', {
                nome: a.modpack.nome,
                versaoAtual: a.modpack.versaoAtual
              })}{' '}
              <b>{a.modpack.versaoNova}</b>.
            </span>
            <Botao tamanho="pequeno" onClick={() => abrirTela('Mods', 'Atualizações')}>
              {t('cardAtualizacoes.ver')}
            </Botao>
          </li>
        )}
        {a.mods > 0 && (
          <li className="flex flex-wrap items-center gap-3 py-2">
            <span className="flex-1">
              {a.mods === 1
                ? t('cardAtualizacoes.n1ModOuPluginTem')
                : t('cardAtualizacoes.modsOuPluginsTem', { mods: a.mods })}{' '}
              {t('cardAtualizacoes.versaoNova')}
            </span>
            <Botao tamanho="pequeno" onClick={() => abrirTela('Mods', 'Atualizações')}>
              {t('cardAtualizacoes.ver')}
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
        titulo={t('cardAtualizacoes.atualizarO', { nome })}
        aoCancelar={() => !ocupado && setConfirmando(false)}
        acao={{
          rotulo: ocupado ? t('cardAtualizacoes.atualizando') : t('cardAtualizacoes.atualizar'),
          ocupado,
          aoClicar: atualizar
        }}
      >
        <div className="flex flex-col gap-3">
          <p>
            {t('cardAtualizacoes.continuaNoMinecraftSoCom', { versao: info.versao, nome })}
            {a.build ? ` (${a.build.nova})` : ''}
            {t('cardAtualizacoes.umBackupDoMundoE')}
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
