import { useCallback, useEffect, useState } from 'react'
import { pegarConviteParaColar } from '../estrutura/navegar'
import {
  LOADERS_CLIENTE,
  type ErroTela,
  type Instalacao,
  type LimitesRam,
  type LoaderCliente,
  type ModpackBusca,
  type Progresso
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { desatualizada, useJogar } from './useJogar'
import { JogarEmBreve, precisaInstalar, rotuloInstalar, useAbrirLauncherLigado } from './Instalar'
import { IconeInstalacoes } from '../componentes/icones'
import { BarraProgresso, Esqueleto } from '../componentes/movimento'
import { AndamentoModpack } from '../componentes/AndamentoModpack'
import { TituloPagina } from '../componentes/paineis'
import {
  Aviso,
  Botao,
  CardImagem,
  Campo,
  Dialogo,
  EstadoVazio,
  Menu,
  Selecao,
  Slider
} from '../componentes/ui'
import { t } from '../../../shared/i18n'

// Tela Instalações do PlaySquare (Fase P1, DESIGN.md seção 6.1.4): cards no padrão "notícias",
// com Jogar, editar, duplicar, abrir pasta e apagar. Jogar abre o Minecraft Launcher oficial.

const NOMES_LOADER: Record<LoaderCliente, string> = {
  vanilla: t('telaInstalacoes.vanilla'),
  fabric: t('telaInstalacoes.fabric'),
  forge: t('telaInstalacoes.forge'),
  neoforge: 'NeoForge'
}

function quando(iso: string | null): string {
  if (!iso) return t('telaInstalacoes.nuncaJogada')
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return dias <= 0
    ? t('telaInstalacoes.jogadaHoje')
    : dias === 1
      ? t('telaInstalacoes.jogadaOntem')
      : t('telaInstalacoes.jogadaHaDias', { dias })
}

function origemTexto(i: Instalacao): string {
  if (i.origem.tipo === 'servidor') return t('telaInstalacoes.doSeuServidorOApp')
  if (i.origem.tipo === 'modpack')
    return t('telaInstalacoes.modpack', { nomePack: i.origem.nomePack })
  if (i.origem.tipo === 'convite') {
    const fora = i.convite?.online === false ? t('telaInstalacoes.foraDoArAgora') : ''
    return t('telaInstalacoes.conviteDoServidor', { servidor: i.origem.servidor, fora })
  }
  return t('telaInstalacoes.criadaDoZero')
}

type Dialogos =
  | { tipo: 'nova' }
  | { tipo: 'editar'; i: Instalacao }
  | { tipo: 'apagar'; i: Instalacao }
  | { tipo: 'convite' }
  | null

export function TelaInstalacoes(): React.JSX.Element {
  const [lista, setLista] = useState<Instalacao[] | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null) // id da instalação (ou "nova")
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  // Fase M6: o convite que abriu o app vem colado no "Entrar com convite" (já aberto).
  const [conviteColado] = useState(pegarConviteParaColar)
  const [dialogo, setDialogo] = useState<Dialogos>(conviteColado ? { tipo: 'convite' } : null)
  const [avisoAtalho, setAvisoAtalho] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const r = await window.api.listarInstalacoes()
    if (r.ok) setLista(r.valor)
    else setErro(r.erro)
  }, [])

  // Mostra a lista na hora e, depois de perguntar aos servidores dos convites, de novo com as
  // versões novas (o botão vira "Atualizar e jogar" quando o servidor mudou os mods).
  useEffect(() => {
    const mostrar = (): Promise<void> =>
      window.api.listarInstalacoes().then((r) => (r.ok ? setLista(r.valor) : setErro(r.erro)))
    void mostrar()
      .then(() => window.api.verificarConvites())
      .then(mostrar)
  }, [])
  useEffect(() => window.api.aoProgredir(setProgresso), [])

  // A última ação longa, para "Tentar de novo só os que falharam" (o que já baixou não baixa de novo).
  const [ultima, setUltima] = useState<{
    id: string
    acao: () => Promise<{ ok: true; valor: unknown } | { ok: false; erro: ErroTela }>
  } | null>(null)

  // Roda uma ação longa mostrando a barra de progresso; erro aparece em cima da lista.
  async function executar<T>(
    id: string,
    acao: () => Promise<{ ok: true; valor: T } | { ok: false; erro: ErroTela }>
  ): Promise<T | undefined> {
    setOcupado(id)
    setProgresso(null)
    setErro(null)
    setUltima({ id, acao })
    try {
      const r = await acao()
      if (!r.ok) {
        setErro(r.erro.cancelado ? null : r.erro)
        return undefined
      }
      return r.valor
    } finally {
      setOcupado(null)
      await carregar()
    }
  }

  // Jogar (com os diálogos de cada situação) é o mesmo da tela Jogar.
  const fluxo = useJogar(carregar)
  const abrirLigado = useAbrirLauncherLigado()
  const jogar = (i: Instalacao): Promise<void> => fluxo.jogar(i)
  const algumOcupado = ocupado ?? fluxo.ocupado

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex max-w-[980px] flex-col p-10">
        <div className="flex items-start justify-between gap-3">
          <TituloPagina>{t('telaInstalacoes.instalacoes')}</TituloPagina>
          <div className="flex gap-2">
            <Botao disabled={!!algumOcupado} onClick={() => setDialogo({ tipo: 'convite' })}>
              {t('telaInstalacoes.entrarComConvite')}
            </Botao>
            <Botao
              variante="primario"
              disabled={!!algumOcupado}
              onClick={() => setDialogo({ tipo: 'nova' })}
            >
              {t('telaInstalacoes.novaInstalacao')}
            </Botao>
          </div>
        </div>
        <p className="mb-6 -mt-3 text-[13px] text-muted">
          {t('telaInstalacoes.cadaInstalacaoTemAPropria')}
        </p>

        {avisoAtalho && (
          <div className="mb-4">
            <Aviso tipo="sucesso">{avisoAtalho}</Aviso>
          </div>
        )}
        {(erro ?? fluxo.erro) && (
          <div className="mb-4">
            <MensagemErro
              erro={(erro ?? fluxo.erro)!}
              aoTentarDeNovo={
                erro?.falhas?.length && ultima
                  ? () => void executar(ultima.id, ultima.acao)
                  : undefined
              }
            />
          </div>
        )}
        {ocupado === 'modpack' ? (
          <div className="mb-4">
            <AndamentoModpack progresso={progresso} />
          </div>
        ) : (
          algumOcupado && (
            <div className="mb-4">
              <BarraProgresso
                rotulo={progresso?.etapa ?? t('telaInstalacoes.preparando')}
                valor={progresso?.recebido ?? 0}
                maximo={progresso?.total ?? 0}
              />
            </div>
          )
        )}

        {lista === null ? (
          <Esqueleto linhas={3} />
        ) : lista.length === 0 ? (
          <EstadoVazio
            icone={<IconeInstalacoes />}
            titulo={t('telaInstalacoes.nenhumaInstalacaoAinda')}
            texto={t('telaInstalacoes.crieUmaDoZeroOu')}
          >
            <Botao variante="primario" onClick={() => setDialogo({ tipo: 'nova' })}>
              {t('telaInstalacoes.novaInstalacao')}
            </Botao>
          </EstadoVazio>
        ) : (
          <div className="flex flex-wrap gap-4">
            {lista.map((i, n) => (
              <CardImagem
                key={i.id}
                ordem={n}
                imagem={i.imagem ?? undefined}
                etiqueta={NOMES_LOADER[i.loader]}
                titulo={i.nome}
                info={i.versao}
              >
                <p className="text-xs text-muted">
                  {origemTexto(i)}
                  <br />
                  {quando(i.ultimoUso)}
                </p>
                <div className="flex items-center gap-2">
                  {abrirLigado ? (
                    <Botao
                      variante="primario"
                      className="flex-1"
                      disabled={!!algumOcupado}
                      onClick={() => void jogar(i)}
                    >
                      {algumOcupado === i.id
                        ? t('telaInstalacoes.preparando')
                        : desatualizada(i)
                          ? t('telaInstalacoes.atualizarEJogar')
                          : t('telaInstalacoes.jogar')}
                    </Botao>
                  ) : precisaInstalar(i) || algumOcupado === i.id ? (
                    <Botao
                      variante="primario"
                      className="flex-1"
                      disabled={!!algumOcupado}
                      onClick={() => void fluxo.jogar(i, undefined, 'instalar')}
                    >
                      {algumOcupado === i.id
                        ? t('telaInstalacoes.instalando')
                        : rotuloInstalar(i, false)}
                    </Botao>
                  ) : (
                    <Botao
                      className="flex-1"
                      onClick={() =>
                        void window.api
                          .abrirPastaInstalacao(i.id)
                          .then((r) => !r.ok && setErro(r.erro))
                      }
                    >
                      {t('telaInstalacoes.abrirPasta')}
                    </Botao>
                  )}
                  {!abrirLigado && <JogarEmBreve />}
                  <Menu
                    rotulo={t('telaInstalacoes.maisAcoesPara', { nome: i.nome })}
                    desabilitado={!!algumOcupado}
                    classeBotao="flex h-10 w-8 items-center justify-center font-bold hover:bg-tile-active"
                    itens={[
                      {
                        rotulo: t('telaInstalacoes.editar'),
                        aoClicar: () => setDialogo({ tipo: 'editar', i })
                      },
                      {
                        rotulo: t('telaInstalacoes.trocarImagem'),
                        aoClicar: () =>
                          void executar(i.id, () => window.api.escolherImagemInstalacao(i.id))
                      },
                      ...(i.instalada && !abrirLigado
                        ? [
                            {
                              rotulo: t('telaInstalacoes.exportarParaModrinthAppPrism'),
                              aoClicar: async () => {
                                const r = await window.api.exportarMrpack(i.id)
                                if (!r.ok) return setErro(r.erro)
                                setErro(null)
                                if (r.valor)
                                  setAvisoAtalho(
                                    t('telaInstalacoes.salvoEmDownloadsComoNo', { valor: r.valor })
                                  )
                              }
                            }
                          ]
                        : []),
                      {
                        rotulo: t('telaInstalacoes.duplicar'),
                        aoClicar: () =>
                          void executar(i.id, () => window.api.duplicarInstalacao(i.id))
                      },
                      {
                        rotulo: t('telaInstalacoes.abrirPasta'),
                        aoClicar: () =>
                          void window.api
                            .abrirPastaInstalacao(i.id)
                            .then((r) => !r.ok && setErro(r.erro))
                      },
                      {
                        // Só quando o jogador pede (nunca automático).
                        rotulo: t('telaInstalacoes.criarAtalhoNaAreaDe'),
                        aoClicar: async () => {
                          const r = await window.api.criarAtalhoInstalacao(i.id)
                          if (!r.ok) return setErro(r.erro)
                          setErro(null)
                          setAvisoAtalho(
                            t('telaInstalacoes.atalhoCriadoNaAreaDe', {
                              replace: r.valor.replace(/\.lnk$/, ''),
                              nome: i.nome
                            })
                          )
                        }
                      },
                      {
                        rotulo: t('telaInstalacoes.apagar'),
                        aoClicar: () => setDialogo({ tipo: 'apagar', i })
                      }
                    ]}
                  >
                    ⋯
                  </Menu>
                </div>
              </CardImagem>
            ))}
          </div>
        )}
      </div>

      {dialogo?.tipo === 'nova' && (
        <DialogoNova
          aoFechar={() => setDialogo(null)}
          aoCriar={async (acao, id) => {
            setDialogo(null)
            await executar(id, acao)
          }}
        />
      )}
      {dialogo?.tipo === 'editar' && (
        <DialogoEditar
          i={dialogo.i}
          aoFechar={() => setDialogo(null)}
          aoSalvar={async (edicao) => {
            const id = dialogo.i.id
            setDialogo(null)
            await executar(id, () => window.api.editarInstalacao(id, edicao))
          }}
        />
      )}
      <Dialogo
        aberto={dialogo?.tipo === 'apagar'}
        titulo={
          dialogo?.tipo === 'apagar'
            ? t('telaInstalacoes.apagar2', { nome: dialogo.i.nome })
            : t('telaInstalacoes.apagar3')
        }
        aoCancelar={() => setDialogo(null)}
        acao={{
          rotulo: t('telaInstalacoes.apagar3'),
          variante: 'perigo',
          aoClicar: () => {
            if (dialogo?.tipo !== 'apagar') return
            const id = dialogo.i.id
            setDialogo(null)
            void executar(id, () => window.api.apagarInstalacao(id))
          }
        }}
      >
        <p className="text-[13px]">{t('telaInstalacoes.aInstalacaoSaiDoApp')}</p>
      </Dialogo>
      {fluxo.dialogo}
      {dialogo?.tipo === 'convite' && (
        <DialogoConvite
          inicial={conviteColado ?? ''}
          aoFechar={() => setDialogo(null)}
          aoEntrar={async (acao) => {
            setDialogo(null)
            await executar('convite', acao)
          }}
        />
      )}
    </div>
  )
}

function useVersoes(loader: LoaderCliente): string[] | null {
  // Guarda de qual loader é a lista: trocar de loader mostra "Carregando..." até a nova chegar.
  const [carregadas, setCarregadas] = useState<{ loader: LoaderCliente; lista: string[] } | null>(
    null
  )
  useEffect(() => {
    let vivo = true
    window.api
      .versoesDoLoader(loader)
      .then((r) => vivo && setCarregadas({ loader, lista: r.ok ? r.valor : [] }))
    return () => {
      vivo = false
    }
  }, [loader])
  return carregadas?.loader === loader ? carregadas.lista : null
}

function useLimites(): LimitesRam | null {
  const [limites, setLimites] = useState<LimitesRam | null>(null)
  useEffect(() => {
    window.api.limitesRam().then(setLimites)
  }, [])
  return limites
}

function CamposVersao({
  loader,
  versao,
  aoMudar
}: {
  loader: LoaderCliente
  versao: string
  aoMudar: (loader: LoaderCliente, versao: string) => void
}): React.JSX.Element {
  const versoes = useVersoes(loader)
  // A mais nova vem escolhida quando a lista chega (ou quando a versão não existe nesse loader).
  useEffect(() => {
    if (versoes?.length && !versoes.includes(versao)) aoMudar(loader, versoes[0])
  }, [versoes, versao, loader, aoMudar])
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="flex flex-col gap-1 text-[13px]">
        {t('telaInstalacoes.loader')}
        <Selecao
          aria-label={t('telaInstalacoes.loader')}
          value={loader}
          onChange={(e) => aoMudar(e.target.value as LoaderCliente, versao)}
        >
          {LOADERS_CLIENTE.map((l) => (
            <option key={l} value={l}>
              {NOMES_LOADER[l]}
            </option>
          ))}
        </Selecao>
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        {t('telaInstalacoes.versaoDoMinecraft')}
        {versoes === null ? (
          <span className="text-muted">{t('telaInstalacoes.carregando')}</span>
        ) : (
          <Selecao
            aria-label={t('telaInstalacoes.versaoDoMinecraft')}
            value={versao}
            onChange={(e) => aoMudar(loader, e.target.value)}
          >
            {versoes.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Selecao>
        )}
      </label>
    </div>
  )
}

function DialogoNova({
  aoFechar,
  aoCriar
}: {
  aoFechar: () => void
  aoCriar: (
    acao: () => Promise<{ ok: true; valor: void } | { ok: false; erro: ErroTela }>,
    id: 'nova' | 'modpack' // "modpack": mostra etapa e Cancelar
  ) => void
}): React.JSX.Element {
  const limites = useLimites()
  const [modo, setModo] = useState<'zero' | 'modpack'>('zero')
  const [nome, setNome] = useState('')
  const [loader, setLoader] = useState<LoaderCliente>('vanilla')
  const [versao, setVersao] = useState('')
  const [ram, setRam] = useState<number | null>(null)
  const [termo, setTermo] = useState('')
  const [packs, setPacks] = useState<ModpackBusca[] | null>(null)
  const [pack, setPack] = useState<string | null>(null)
  const mudarVersao = useCallback((l: LoaderCliente, v: string) => {
    setLoader(l)
    setVersao(v)
  }, [])

  useEffect(() => {
    if (modo !== 'modpack') return
    const t = setTimeout(() => {
      window.api.buscarModpacks(termo, 1, 24).then((r) => setPacks(r.ok ? r.valor.itens : []))
    }, 300)
    return () => clearTimeout(t)
  }, [termo, modo])

  const ramAtual = ram ?? Math.min(4, limites?.max ?? 4)
  const podeCriar = modo === 'zero' ? !!nome.trim() && !!versao : !!pack

  return (
    <Dialogo
      aberto
      titulo={t('telaInstalacoes.novaInstalacao2')}
      aoCancelar={aoFechar}
      acao={{
        rotulo: t('telaInstalacoes.criar'),
        variante: 'primario',
        desabilitado: !podeCriar,
        aoClicar: () =>
          aoCriar(
            () =>
              modo === 'zero'
                ? window.api.criarInstalacao({ nome: nome.trim(), loader, versao, ram: ramAtual })
                : window.api.criarInstalacaoDeModpack(pack!),
            modo === 'zero' ? 'nova' : 'modpack'
          )
      }}
    >
      <div
        role="radiogroup"
        aria-label={t('telaInstalacoes.comoCriar')}
        className="mb-3 flex gap-2"
      >
        {(
          [
            ['zero', t('telaInstalacoes.doZero')],
            ['modpack', t('telaInstalacoes.deUmModpack')]
          ] as const
        ).map(([m, rotulo]) => (
          <Botao
            key={m}
            role="radio"
            aria-checked={modo === m}
            variante={modo === m ? 'primario' : 'secundario'}
            onClick={() => setModo(m)}
          >
            {rotulo}
          </Botao>
        ))}
      </div>

      {modo === 'zero' ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[13px]">
            {t('telaInstalacoes.nome')}
            <Campo
              value={nome}
              maxLength={48}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
            />
          </label>
          <CamposVersao loader={loader} versao={versao} aoMudar={mudarVersao} />
          {limites && (
            <Slider
              rotulo={t('telaInstalacoes.memoriaRam')}
              valor={ramAtual}
              min={limites.min}
              max={limites.max}
              aoMudar={setRam}
              formatar={(v) => `${v} GB`}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Campo
            placeholder={t('telaInstalacoes.procurarModpackNoModrinth')}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoFocus
          />
          <ul
            className="flex max-h-[280px] flex-col overflow-y-auto"
            role="listbox"
            aria-label={t('telaInstalacoes.modpacks')}
          >
            {packs === null ? (
              <Esqueleto linhas={3} />
            ) : packs.length === 0 ? (
              <li className="text-[13px] text-muted">
                {t('telaInstalacoes.nenhumModpackEncontrado')}
              </li>
            ) : (
              packs.map((p) => (
                <li key={p.id} className="list-none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={pack === p.id}
                    onClick={() => setPack(p.id)}
                    className={`flex w-full items-center gap-3 p-2 text-left transition-colors duration-(--dur-fast) hover:bg-tile-active ${
                      pack === p.id ? 'bg-tile-active outline-2 outline-accent' : ''
                    }`}
                  >
                    {p.icone ? (
                      <img src={p.icone} alt="" className="h-10 w-10 shrink-0 object-cover" />
                    ) : (
                      <span aria-hidden="true" className="banner-padrao h-10 w-10 shrink-0" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold" title={p.titulo}>
                        {p.titulo}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {p.versaoJogo ?? ''} · {p.descricao}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <p className="text-xs text-muted">{t('telaInstalacoes.oAppBaixaOPack')}</p>
        </div>
      )}
    </Dialogo>
  )
}

function DialogoEditar({
  i,
  aoFechar,
  aoSalvar
}: {
  i: Instalacao
  aoFechar: () => void
  aoSalvar: (e: { nome: string; ram: number; versao?: string; loader?: LoaderCliente }) => void
}): React.JSX.Element {
  const limites = useLimites()
  const [nome, setNome] = useState(i.nome)
  const [ram, setRam] = useState(i.ram)
  const [loader, setLoader] = useState(i.loader)
  const [versao, setVersao] = useState(i.versao)
  const mudarVersao = useCallback((l: LoaderCliente, v: string) => {
    setLoader(l)
    setVersao(v)
  }, [])
  const livre = i.origem.tipo === 'zero'
  return (
    <Dialogo
      aberto
      titulo={t('telaInstalacoes.editar2', { nome: i.nome })}
      aoCancelar={aoFechar}
      acao={{
        rotulo: t('telaInstalacoes.salvar'),
        variante: 'primario',
        desabilitado: !nome.trim(),
        aoClicar: () =>
          aoSalvar(livre ? { nome: nome.trim(), ram, loader, versao } : { nome: nome.trim(), ram })
      }}
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[13px]">
          {t('telaInstalacoes.nome')}
          <Campo value={nome} maxLength={48} onChange={(e) => setNome(e.target.value)} />
        </label>
        {livre ? (
          <CamposVersao loader={loader} versao={versao} aoMudar={mudarVersao} />
        ) : (
          <p className="text-xs text-muted">
            {i.origem.tipo === 'servidor'
              ? t('telaInstalacoes.aVersaoEOLoader')
              : t('telaInstalacoes.aVersaoEOLoader2')}
          </p>
        )}
        {limites && (
          <Slider
            rotulo={t('telaInstalacoes.memoriaRam')}
            valor={ram}
            min={limites.min}
            max={limites.max}
            aoMudar={setRam}
            formatar={(v) => `${v} GB`}
          />
        )}
        <p className="text-xs text-muted">{t('telaInstalacoes.mundosPrintsEConfiguracoesDa')}</p>
      </div>
    </Dialogo>
  )
}

function DialogoConvite({
  inicial,
  aoFechar,
  aoEntrar
}: {
  inicial: string
  aoFechar: () => void
  aoEntrar: (
    acao: () => Promise<{ ok: true; valor: unknown } | { ok: false; erro: ErroTela }>
  ) => void
}): React.JSX.Element {
  const [texto, setTexto] = useState(inicial)
  // Fase M4: o nick vai junto, para o dono aprovar a entrada na whitelist (lembrado do último).
  const [nick, setNick] = useState('')
  const [recado, setRecado] = useState('')
  useEffect(() => {
    window.api.lerAjustesJogo().then((r) => r.ok && r.valor.nick && setNick(r.valor.nick))
  }, [])
  const pedido = { nick: nick.trim(), recado: recado.trim() }
  const nickOk = /^[A-Za-z0-9_]{3,16}$/.test(pedido.nick)
  return (
    <Dialogo
      aberto
      titulo={t('telaInstalacoes.entrarComConvite')}
      aoCancelar={aoFechar}
      acao={{
        rotulo: t('telaInstalacoes.entrar'),
        variante: 'primario',
        desabilitado: !texto.trim() || !nickOk,
        aoClicar: () => aoEntrar(() => window.api.entrarComConvite(texto.trim(), pedido))
      }}
    >
      <div className="flex flex-col gap-3 text-[13px]">
        <p>{t('telaInstalacoes.coleOCodigoOuO')}</p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          autoFocus
          aria-label={t('telaInstalacoes.codigoOuLinkDoConvite')}
          placeholder="26.12.34.56:8788#K7QF-M2XA-9TBC-H4PZ"
          className="border border-linha bg-panel-2 p-2 font-mono text-[13px]"
        />
        <label className="flex flex-col gap-1">
          {t('telaInstalacoes.seuNickNoMinecraft')}
          <Campo
            value={nick}
            maxLength={16}
            aria-label={t('telaInstalacoes.seuNickNoMinecraft')}
            placeholder={t('telaInstalacoes.steve')}
            onChange={(e) => setNick(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          {t('telaInstalacoes.recadoParaODonoOpcional')}
          <Campo
            value={recado}
            maxLength={100}
            aria-label={t('telaInstalacoes.recadoParaODono')}
            placeholder={t('telaInstalacoes.oiSouOAmigoDo')}
            onChange={(e) => setRecado(e.target.value)}
          />
        </label>
        <p className="text-xs text-muted">{t('telaInstalacoes.oAppConfereONick')}</p>
        <Botao
          className="self-start"
          disabled={!nickOk}
          onClick={() => aoEntrar(() => window.api.entrarComArquivoDeConvite(pedido))}
        >
          {t('telaInstalacoes.abrirArquivoDeConviteHubsquare')}
        </Botao>
      </div>
    </Dialogo>
  )
}
