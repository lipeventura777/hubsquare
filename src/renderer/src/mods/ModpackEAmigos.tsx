import { IconeAtencao } from '../icones'
import { useEffect, useState } from 'react'
import type {
  AtualizacaoModpack,
  ErroTela,
  EscolhaConflito,
  InfoServidor,
  PacoteAmigos,
  PlanoAtualizacaoModpack,
  Progresso
} from '../../../shared/tipos'
import { useEnderecoAtivo } from '../conexao/useEnderecoAtivo'
import { MensagemErro } from '../componentes/MensagemErro'
import { BarraProgresso } from '../componentes/movimento'
import { CardPainel } from '../componentes/paineis'
import { Botao, Dialogo, OpcaoRadio } from '../componentes/ui'
import { t } from '../../../shared/i18n'

// Tela Mods (Fase 17): "Pacote pros amigos" e a atualização do modpack de onde o servidor veio.

function BarraDoProgresso({
  progresso
}: {
  progresso: Progresso | null
}): React.JSX.Element | null {
  if (!progresso) return null
  return (
    <div className="flex flex-col gap-1 text-[13px]">
      <span>{progresso.etapa}</span>
      <BarraProgresso
        rotulo={progresso.etapa}
        valor={progresso.recebido}
        maximo={progresso.total}
      />
    </div>
  )
}

// Texto curto, pronto para colar no Discord.
function textoDiscord(info: InfoServidor, pacote: PacoteAmigos, endereco: string | null): string {
  const linhas = [
    t('modpackEAmigos.comoEntrarNoServidor', { nome: info.nome }),
    t('modpackEAmigos.n1BaixeOArquivoQue', { arquivo: pacote.arquivo }),
    t('modpackEAmigos.n2NoAppDoModrinth'),
    t('modpackEAmigos.n3AbraAInstanciaCriada', {
      v: endereco ?? t('modpackEAmigos.euMandoOEnderecoQuando')
    })
  ]
  if (pacote.manuais.length) {
    linhas.push(
      t('modpackEAmigos.essesModsPrecisamSerBaixados', { join: pacote.manuais.join(', ') })
    )
  }
  return linhas.join('\n')
}

export function BotaoPacoteAmigos({
  info,
  ligado
}: {
  info: InfoServidor
  ligado: boolean
}): React.JSX.Element {
  const [gerando, setGerando] = useState(false)
  const [pacote, setPacote] = useState<PacoteAmigos | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [copiado, setCopiado] = useState(false)
  const { endereco } = useEnderecoAtivo(ligado)

  async function gerar(): Promise<void> {
    setGerando(true)
    setErro(null)
    const r = await window.api.gerarPacoteAmigos()
    setGerando(false)
    if (!r.ok) return setErro(r.erro)
    if (r.valor) {
      setCopiado(false)
      setPacote(r.valor)
    }
  }

  const texto = pacote ? textoDiscord(info, pacote, endereco) : ''

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Botao variante="destaque" onClick={gerar} disabled={gerando}>
          {gerando ? t('modpackEAmigos.gerando') : t('modpackEAmigos.pacoteProsAmigos')}
        </Botao>
        <span className="text-xs text-muted">{t('modpackEAmigos.umArquivoMrpackComO')}</span>
      </div>
      {erro && <MensagemErro erro={erro} />}

      <Dialogo
        aberto={!!pacote}
        titulo={t('modpackEAmigos.pacotePronto')}
        aoCancelar={() => setPacote(null)}
        acao={{
          rotulo: copiado ? t('modpackEAmigos.copiado') : t('modpackEAmigos.copiarTexto'),
          variante: 'destaque',
          aoClicar: () => {
            navigator.clipboard.writeText(texto)
            setCopiado(true)
          }
        }}
      >
        {pacote && (
          <div className="flex flex-col gap-3 text-[13px]">
            <p>
              <b>{pacote.arquivo}</b> {t('modpackEAmigos.foiSalvoCom', { mods: pacote.mods })}{' '}
              {pacote.mods === 1 ? t('modpackEAmigos.mod') : t('modpackEAmigos.mods')}
              {t('modpackEAmigos.osModsDoModrinthNao')}
            </p>
            {pacote.extras > 0 && (
              <p>
                {t('modpackEAmigos.tambemVao', { extras: pacote.extras })}{' '}
                {pacote.extras === 1 ? 'item escolhido' : t('modpackEAmigos.itensEscolhidos')}{' '}
                {t('modpackEAmigos.noExplorarShadersResourcePacks')}
              </p>
            )}
            {pacote.semModrinth.length > 0 && (
              <p className="text-muted">
                {t('modpackEAmigos.incluidosNoArquivoNaoEstao')} {pacote.semModrinth.join(', ')}
              </p>
            )}
            {pacote.manuais.length > 0 && (
              <p className="text-warning">
                <IconeAtencao className="mr-1 inline h-[1em] w-[1em] align-[-0.125em]" />
                {t('modpackEAmigos.baixeManualmenteNaoEstaoNo')} {pacote.manuais.join(', ')}
              </p>
            )}
            <p>{t('modpackEAmigos.mandeOArquivoJuntoCom')}</p>
            <pre className="font-mono max-h-48 overflow-auto bg-console p-3 text-xs whitespace-pre-wrap text-white">
              {texto}
            </pre>
          </div>
        )}
      </Dialogo>
    </div>
  )
}

export function AtualizacaoDoModpack({
  ligado,
  aoAtualizar
}: {
  ligado: boolean
  aoAtualizar: () => Promise<void>
}): React.JSX.Element | null {
  const [nova, setNova] = useState<AtualizacaoModpack | null | undefined>(undefined)
  const [plano, setPlano] = useState<PlanoAtualizacaoModpack | null>(null)
  const [escolhas, setEscolhas] = useState<Record<string, EscolhaConflito>>({})
  const [ocupado, setOcupado] = useState<'planejando' | 'atualizando' | null>(null)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [feito, setFeito] = useState(false)

  useEffect(() => window.api.aoProgredir(setProgresso), [])

  useEffect(() => {
    let ativo = true
    window.api.atualizacaoModpack().then((r) => {
      if (!ativo) return
      if (r.ok) setNova(r.valor)
      else {
        setNova(null)
        setErro(r.erro)
      }
    })
    return () => {
      ativo = false
    }
  }, [feito])

  async function planejar(): Promise<void> {
    setOcupado('planejando')
    setErro(null)
    const r = await window.api.planejarAtualizacaoModpack()
    setOcupado(null)
    setProgresso(null)
    if (!r.ok) return setErro(r.erro)
    // Na dúvida, o arquivo do usuário fica.
    setEscolhas(Object.fromEntries(r.valor.conflitos.map((c) => [c.caminho, 'meu' as const])))
    setPlano(r.valor)
  }

  async function atualizar(): Promise<void> {
    if (!plano) return
    setOcupado('atualizando')
    setErro(null)
    const r = await window.api.atualizarModpack(plano.token, escolhas)
    setOcupado(null)
    setProgresso(null)
    setPlano(null)
    if (!r.ok) return setErro(r.erro)
    setFeito((f) => !f)
    await aoAtualizar()
  }

  if (nova === undefined) return null
  if (!nova) return erro ? <MensagemErro erro={erro} /> : null

  return (
    <>
      <CardPainel
        titulo={t('modpackEAmigos.modpack', { nome: nova.nome })}
        acoes={
          <Botao
            variante="primario"
            tamanho="pequeno"
            disabled={!!ocupado || ligado}
            title={ligado ? t('modpackEAmigos.desligueOServidorParaAtualizar') : undefined}
            onClick={planejar}
          >
            {ocupado === 'planejando'
              ? t('modpackEAmigos.verificando')
              : t('modpackEAmigos.atualizarOModpack')}
          </Botao>
        }
      >
        <p className="text-[13px]">
          {nova.versaoAtual} → <b>{nova.versaoNova}</b>
        </p>
        <p className="mt-1 text-xs text-muted">
          {ligado
            ? t('modpackEAmigos.desligueOServidorParaAtualizar2')
            : t('modpackEAmigos.oAppFazBackupAntes')}
        </p>
        {ocupado === 'planejando' && <BarraDoProgresso progresso={progresso} />}
        {erro && (
          <div className="mt-3">
            <MensagemErro erro={erro} />
          </div>
        )}
      </CardPainel>

      <Dialogo
        aberto={!!plano}
        titulo={t('modpackEAmigos.atualizarPara', { v: plano?.versaoNova ?? '' })}
        aoCancelar={() => !ocupado && setPlano(null)}
        acao={{
          rotulo:
            ocupado === 'atualizando'
              ? t('modpackEAmigos.atualizando')
              : t('modpackEAmigos.atualizar'),
          variante: 'primario',
          ocupado: ocupado === 'atualizando',
          aoClicar: atualizar
        }}
      >
        {plano && (
          <div className="flex flex-col gap-3 text-[13px]">
            <p>
              {plano.escrever}{' '}
              {plano.escrever === 1
                ? t('modpackEAmigos.arquivoNovoOuAtualizado')
                : t('modpackEAmigos.arquivosNovosOuAtualizados')}
              {plano.apagar > 0 && t('modpackEAmigos.queOPackNaoUsa', { apagar: plano.apagar })}.
              {plano.trocaLoader &&
                t('modpackEAmigos.oLoaderMudaParaA', { trocaLoader: plano.trocaLoader })}{' '}
              {t('modpackEAmigos.antesOAppFazBackup')}
            </p>
            {plano.conflitos.length > 0 && (
              <>
                <p className="font-bold">
                  {plano.conflitos.length === 1
                    ? t('modpackEAmigos.umArquivoSeuBateCom')
                    : t('modpackEAmigos.arquivosSeusBatemComO', { length: plano.conflitos.length })}
                </p>
                <ul className="flex max-h-64 flex-col gap-2 overflow-auto">
                  {plano.conflitos.map((c) => (
                    <li key={c.caminho} className="border border-linha p-2">
                      <p className="font-mono truncate text-xs" title={c.caminho}>
                        {c.caminho}
                      </p>
                      <p className="text-xs text-muted">{c.motivo}</p>
                      <div className="flex gap-4">
                        {(['meu', 'pack'] as const).map((e) => (
                          <OpcaoRadio
                            key={e}
                            nome={c.caminho}
                            marcada={escolhas[c.caminho] === e}
                            aoEscolher={() => setEscolhas((a) => ({ ...a, [c.caminho]: e }))}
                          >
                            {e === 'meu'
                              ? t('modpackEAmigos.manterOMeu')
                              : t('modpackEAmigos.usarODoPack')}
                          </OpcaoRadio>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {ocupado === 'atualizando' && <BarraDoProgresso progresso={progresso} />}
          </div>
        )}
      </Dialogo>
    </>
  )
}
