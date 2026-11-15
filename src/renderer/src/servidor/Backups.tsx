import { useCallback, useEffect, useState } from 'react'
import {
  NOMES_BACKUP,
  TIPOS_BACKUP,
  type Backup,
  type ErroTela,
  type EstadoServidor,
  type InfoServidor,
  type TipoBackup
} from '../../../shared/tipos'
import { validarAutomacao } from '../../../shared/automacao'
import { useAparencia } from '../aparencia/useAparencia'
import { MensagemErro } from '../componentes/MensagemErro'
import { tamanho as formatarTamanho } from '../componentes/formato'
import { IconeCadeado } from '../componentes/icones'
import {
  Aviso,
  Botao,
  CaixaSelecao,
  CardImagem,
  Campo,
  Dialogo,
  Secao,
  Selecao
} from '../componentes/ui'
import { t, idiomaAtual } from '../../../shared/i18n'

const data = (b: Backup): string => new Date(b.data).toLocaleString(idiomaAtual())
const tamanho = (b: Backup): string => formatarTamanho(b.tamanho)
const nomeTipo = (b: Backup): string =>
  b.tipo ? NOMES_BACKUP[b.tipo] : t('backups.semTipoAnotado')

type Ordem = 'data' | 'tamanho'

// Aba Backups: um card por backup (seção 6.6), com Restaurar, Proteger e Apagar (Fase 23.2).
export function Backups({ estado }: { estado: EstadoServidor }): React.JSX.Element {
  const { screenshots } = useAparencia()
  const [info, setInfo] = useState<InfoServidor | null>(null)
  const [backups, setBackups] = useState<Backup[]>([])
  const [confirmando, setConfirmando] = useState<Backup | null>(null)
  const [restaurando, setRestaurando] = useState(false)
  const [restaurado, setRestaurado] = useState<Backup | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [tipo, setTipo] = useState<TipoBackup | 'sem' | null>(null)
  const [ordem, setOrdem] = useState<Ordem>('data')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [apagando, setApagando] = useState<Backup[] | null>(null)
  const [nomeDigitado, setNomeDigitado] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback((): void => {
    window.api.listarBackups().then((r) => (r.ok ? setBackups(r.valor) : setErro(r.erro)))
  }, [])

  useEffect(() => {
    window.api.servidorAtual().then((r) => r.ok && setInfo(r.valor))
    carregar()
    return window.api.aoMudarBackups(carregar)
  }, [carregar])

  async function restaurar(): Promise<void> {
    if (!confirmando) return
    setErro(null)
    setRestaurado(null)
    setRestaurando(true)
    const r = await window.api.restaurarBackup(confirmando.arquivo)
    setRestaurando(false)
    if (r.ok) setRestaurado(confirmando)
    else setErro(r.erro)
    setConfirmando(null)
    carregar()
  }

  async function proteger(b: Backup): Promise<void> {
    setErro(null)
    const r = await window.api.protegerBackup(b.arquivo, !b.protegido)
    if (!r.ok) setErro(r.erro)
    // Protegido não pode ficar selecionado para apagar.
    setSelecionados((s) => {
      const novo = new Set(s)
      novo.delete(b.arquivo)
      return novo
    })
    carregar()
  }

  async function apagar(): Promise<void> {
    if (!apagando) return
    setErro(null)
    setOcupado(true)
    const r = await window.api.apagarBackups(
      apagando.map((b) => b.arquivo),
      todos ? nomeDigitado : undefined
    )
    setOcupado(false)
    setApagando(null)
    setNomeDigitado('')
    setSelecionados(new Set())
    if (!r.ok) setErro(r.erro)
    carregar()
  }

  const desligado = estado === 'desligado'
  const manter = info ? validarAutomacao(info.automacao).backup.manter : 10
  const usado = backups.reduce((t, b) => t + b.tamanho, 0)
  const tipos = TIPOS_BACKUP.filter((t) => backups.some((b) => b.tipo === t))
  const visiveis = backups
    .filter((b) => !tipo || (tipo === 'sem' ? !b.tipo : b.tipo === tipo))
    .sort((a, b) =>
      ordem === 'tamanho' ? b.tamanho - a.tamanho : b.arquivo.localeCompare(a.arquivo)
    )
  const escolhidos = backups.filter((b) => selecionados.has(b.arquivo) && !b.protegido)
  const liberar = (lista: Backup[]): string =>
    formatarTamanho(lista.reduce((t, b) => t + b.tamanho, 0))
  // Apagar TODOS os backups do servidor exige digitar o nome dele.
  const todos = !!apagando && apagando.length === backups.length

  return (
    <Secao titulo={t('backups.backups', { length: backups.length })}>
      <p className="text-[13px] text-muted">
        {t('backups.umBackupEFeitoSozinho', { manter })}
        {!desligado && t('backups.desligueOServidorParaRestaurar')}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[13px]">
          {t('backups.espacoUsado')} <b>{formatarTamanho(usado)}</b>
        </p>
        <span className="flex-1" />
        <Selecao
          aria-label={t('backups.tipoDeBackup')}
          value={tipo ?? ''}
          onChange={(e) => setTipo((e.target.value || null) as TipoBackup | 'sem' | null)}
          className="w-64"
        >
          <option value="">{t('backups.todosOsTipos')}</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {NOMES_BACKUP[t]}
            </option>
          ))}
          {backups.some((b) => !b.tipo) && (
            <option value="sem">{t('backups.semTipoAnotado')}</option>
          )}
        </Selecao>
        <Selecao
          aria-label={t('backups.ordenarPor')}
          value={ordem}
          onChange={(e) => setOrdem(e.target.value as Ordem)}
          className="w-48"
        >
          <option value="data">{t('backups.ordenarData')}</option>
          <option value="tamanho">{t('backups.ordenarTamanho')}</option>
        </Selecao>
        {escolhidos.length > 0 && (
          <Botao variante="perigo" onClick={() => setApagando(escolhidos)}>
            {t('backups.apagarSelecionadosLibera', {
              length: escolhidos.length,
              liberar: liberar(escolhidos)
            })}
          </Botao>
        )}
      </div>

      {restaurado && (
        <Aviso tipo="sucesso">
          {t('backups.backupDeRestauradoEleAbre', { data: data(restaurado) })}
        </Aviso>
      )}
      {erro && <MensagemErro erro={erro} />}

      {backups.length === 0 ? (
        <p className="text-[13px] text-muted">{t('backups.nenhumBackupAindaOPrimeiro')}</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {visiveis.map((b, i) => (
            <CardImagem
              key={b.arquivo}
              ordem={i}
              imagem={
                screenshots.length ? screenshots[i % screenshots.length].miniatura : undefined
              }
              etiqueta={b.arquivo === backups[0].arquivo ? t('backups.maisRecente') : nomeTipo(b)}
              titulo={data(b)}
              info={tamanho(b)}
            >
              <div className="flex items-center gap-2 text-xs text-muted">
                {b.protegido && <IconeCadeado className="h-4 w-4 text-accent" />}
                <span>
                  {b.protegido ? t('backups.protegido') : ''}
                  {nomeTipo(b)}
                </span>
              </div>
              {/* Dois grupos que quebram juntos: seleção + Proteger; Apagar + Restaurar à direita. */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <CaixaSelecao
                    marcada={selecionados.has(b.arquivo)}
                    disabled={b.protegido}
                    aoMudar={(v) =>
                      setSelecionados((s) => {
                        const novo = new Set(s)
                        if (v) novo.add(b.arquivo)
                        else novo.delete(b.arquivo)
                        return novo
                      })
                    }
                  >
                    <span className="sr-only">
                      {t('backups.selecionarBackupDe', { data: data(b) })}
                    </span>
                  </CaixaSelecao>
                  <Botao
                    tamanho="pequeno"
                    aria-pressed={b.protegido}
                    onClick={() => proteger(b)}
                    title={
                      b.protegido
                        ? t('backups.tirarAProtecao')
                        : t('backups.protegerNuncaApagarSozinho')
                    }
                  >
                    <IconeCadeado className="h-4 w-4" />
                    {b.protegido ? t('backups.desproteger') : t('backups.proteger')}
                  </Botao>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Botao
                    variante="perigo"
                    tamanho="pequeno"
                    disabled={b.protegido || ocupado}
                    onClick={() => setApagando([b])}
                  >
                    {t('backups.apagar')}
                  </Botao>
                  <Botao
                    variante="primario"
                    tamanho="pequeno"
                    disabled={!desligado || restaurando}
                    onClick={() => setConfirmando(b)}
                  >
                    {t('backups.restaurar')}
                  </Botao>
                </div>
              </div>
            </CardImagem>
          ))}
        </div>
      )}

      <Dialogo
        aberto={confirmando !== null}
        titulo={t('backups.restaurarBackup')}
        aoCancelar={() => setConfirmando(null)}
        acao={{
          rotulo: restaurando ? t('backups.restaurando') : t('backups.restaurar'),
          variante: 'perigo',
          aoClicar: restaurar,
          ocupado: restaurando
        }}
      >
        {t('backups.oMundoVoltaPara')} {confirmando ? data(confirmando) : ''}
        {t('backups.oMundoAtualViraUm')}
      </Dialogo>

      <Dialogo
        aberto={apagando !== null}
        titulo={
          apagando?.length === 1
            ? t('backups.apagarEsteBackup')
            : t('backups.apagarBackups', { length: apagando?.length })
        }
        aoCancelar={() => {
          if (ocupado) return
          setApagando(null)
          setNomeDigitado('')
        }}
        acao={{
          rotulo: ocupado ? t('backups.apagando') : t('backups.apagar'),
          variante: 'perigo',
          ocupado,
          desabilitado: todos && nomeDigitado !== info?.nome,
          aoClicar: apagar
        }}
      >
        {apagando && (
          <div className="flex flex-col gap-3 text-[13px]">
            <p>{t('backups.istoEApagadoDeVez')}</p>
            <ul className="flex max-h-48 flex-col gap-1 overflow-auto">
              {apagando.map((b) => (
                <li key={b.arquivo} className="flex items-baseline gap-2">
                  <b>{data(b)}</b>
                  <span className="text-muted">{nomeTipo(b)}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted">{tamanho(b)}</span>
                </li>
              ))}
            </ul>
            <p>
              {t('backups.libera')} <b>{liberar(apagando)}</b>.
            </p>
            {todos && (
              <label className="flex flex-col gap-1">
                <span className="text-warning">
                  {t('backups.saoTodosOsBackupsDeste')} <b>{info?.nome}</b>
                </span>
                <Campo
                  value={nomeDigitado}
                  onChange={(e) => setNomeDigitado(e.target.value)}
                  aria-label={t('backups.nomeDoServidor')}
                />
              </label>
            )}
          </div>
        )}
      </Dialogo>
    </Secao>
  )
}
