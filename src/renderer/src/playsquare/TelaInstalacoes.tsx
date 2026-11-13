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

// Tela Instalações do PlaySquare (Fase P1, DESIGN.md seção 6.1.4): cards no padrão "notícias",
// com Jogar, editar, duplicar, abrir pasta e apagar. Jogar abre o Minecraft Launcher oficial.

const NOMES_LOADER: Record<LoaderCliente, string> = {
  vanilla: 'Vanilla',
  fabric: 'Fabric',
  forge: 'Forge',
  neoforge: 'NeoForge'
}

function quando(iso: string | null): string {
  if (!iso) return 'Nunca jogada'
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return dias <= 0 ? 'Jogada hoje' : dias === 1 ? 'Jogada ontem' : `Jogada há ${dias} dias`
}

function origemTexto(i: Instalacao): string {
  if (i.origem.tipo === 'servidor') return 'Do seu servidor (o app mantém os mods iguais)'
  if (i.origem.tipo === 'modpack') return `Modpack ${i.origem.nomePack}`
  if (i.origem.tipo === 'convite') {
    const fora = i.convite?.online === false ? ' (fora do ar agora)' : ''
    return `Convite do servidor ${i.origem.servidor}${fora}`
  }
  return 'Criada do zero'
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
          <TituloPagina>Instalações</TituloPagina>
          <div className="flex gap-2">
            <Botao disabled={!!algumOcupado} onClick={() => setDialogo({ tipo: 'convite' })}>
              Entrar com convite
            </Botao>
            <Botao
              variante="primario"
              disabled={!!algumOcupado}
              onClick={() => setDialogo({ tipo: 'nova' })}
            >
              + Nova instalação
            </Botao>
          </div>
        </div>
        <p className="mb-6 -mt-3 text-[13px] text-muted">
          Cada instalação tem a própria pasta de jogo, com mundos, mods e configurações separados. O
          jogo abre pelo Minecraft Launcher oficial, com a sua conta.
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
                rotulo={progresso?.etapa ?? 'Preparando...'}
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
            titulo="Nenhuma instalação ainda"
            texto="Crie uma do zero ou a partir de um modpack. Cada servidor do ServSquare também ganha a sua."
          >
            <Botao variante="primario" onClick={() => setDialogo({ tipo: 'nova' })}>
              + Nova instalação
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
                        ? 'Preparando...'
                        : desatualizada(i)
                          ? 'ATUALIZAR E JOGAR'
                          : 'JOGAR'}
                    </Botao>
                  ) : precisaInstalar(i) || algumOcupado === i.id ? (
                    <Botao
                      variante="primario"
                      className="flex-1"
                      disabled={!!algumOcupado}
                      onClick={() => void fluxo.jogar(i, undefined, 'instalar')}
                    >
                      {algumOcupado === i.id ? 'Instalando...' : rotuloInstalar(i, false)}
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
                      Abrir pasta
                    </Botao>
                  )}
                  {!abrirLigado && <JogarEmBreve />}
                  <Menu
                    rotulo={`Mais ações para ${i.nome}`}
                    desabilitado={!!algumOcupado}
                    classeBotao="flex h-10 w-8 items-center justify-center font-bold hover:bg-tile-active"
                    itens={[
                      { rotulo: 'Editar', aoClicar: () => setDialogo({ tipo: 'editar', i }) },
                      {
                        rotulo: 'Trocar imagem',
                        aoClicar: () =>
                          void executar(i.id, () => window.api.escolherImagemInstalacao(i.id))
                      },
                      ...(i.instalada && !abrirLigado
                        ? [
                            {
                              rotulo: 'Exportar para Modrinth App / Prism Launcher',
                              aoClicar: async () => {
                                const r = await window.api.exportarMrpack(i.id)
                                if (!r.ok) return setErro(r.erro)
                                setErro(null)
                                if (r.valor)
                                  setAvisoAtalho(
                                    `Salvo em Downloads como ${r.valor}. No Modrinth App ou no Prism Launcher, importe esse arquivo.`
                                  )
                              }
                            }
                          ]
                        : []),
                      {
                        rotulo: 'Duplicar',
                        aoClicar: () =>
                          void executar(i.id, () => window.api.duplicarInstalacao(i.id))
                      },
                      {
                        rotulo: 'Abrir pasta',
                        aoClicar: () =>
                          void window.api
                            .abrirPastaInstalacao(i.id)
                            .then((r) => !r.ok && setErro(r.erro))
                      },
                      {
                        // Só quando o jogador pede (nunca automático).
                        rotulo: 'Criar atalho na área de trabalho',
                        aoClicar: async () => {
                          const r = await window.api.criarAtalhoInstalacao(i.id)
                          if (!r.ok) return setErro(r.erro)
                          setErro(null)
                          setAvisoAtalho(
                            `Atalho "${r.valor.replace(/\.lnk$/, '')}" criado na área de trabalho. Ele abre o HubSquare no Jogar de ${i.nome}.`
                          )
                        }
                      },
                      { rotulo: 'Apagar…', aoClicar: () => setDialogo({ tipo: 'apagar', i }) }
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
        titulo={dialogo?.tipo === 'apagar' ? `Apagar ${dialogo.i.nome}?` : 'Apagar'}
        aoCancelar={() => setDialogo(null)}
        acao={{
          rotulo: 'Apagar',
          variante: 'perigo',
          aoClicar: () => {
            if (dialogo?.tipo !== 'apagar') return
            const id = dialogo.i.id
            setDialogo(null)
            void executar(id, () => window.api.apagarInstalacao(id))
          }
        }}
      >
        <p className="text-[13px]">
          A instalação sai do app e do Minecraft Launcher. A pasta dela (com mundos e prints) vai
          para a Lixeira do Windows, de onde dá para recuperar.
        </p>
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
        Loader
        <Selecao
          aria-label="Loader"
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
        Versão do Minecraft
        {versoes === null ? (
          <span className="text-muted">Carregando...</span>
        ) : (
          <Selecao
            aria-label="Versão do Minecraft"
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
      window.api.buscarModpacks(termo, 0).then((r) => setPacks(r.ok ? r.valor.itens : []))
    }, 300)
    return () => clearTimeout(t)
  }, [termo, modo])

  const ramAtual = ram ?? Math.min(4, limites?.max ?? 4)
  const podeCriar = modo === 'zero' ? !!nome.trim() && !!versao : !!pack

  return (
    <Dialogo
      aberto
      titulo="Nova instalação"
      aoCancelar={aoFechar}
      acao={{
        rotulo: 'Criar',
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
      <div role="radiogroup" aria-label="Como criar" className="mb-3 flex gap-2">
        {(
          [
            ['zero', 'Do zero'],
            ['modpack', 'De um modpack']
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
            Nome
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
              rotulo="Memória (RAM)"
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
            placeholder="Procurar modpack no Modrinth"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoFocus
          />
          <ul
            className="flex max-h-[280px] flex-col overflow-y-auto"
            role="listbox"
            aria-label="Modpacks"
          >
            {packs === null ? (
              <Esqueleto linhas={3} />
            ) : packs.length === 0 ? (
              <li className="text-[13px] text-muted">Nenhum modpack encontrado.</li>
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
          <p className="text-xs text-muted">
            O app baixa o pack do Modrinth (com o hash conferido) e põe na pasta da instalação só o
            que roda no jogador.
          </p>
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
      titulo={`Editar ${i.nome}`}
      aoCancelar={aoFechar}
      acao={{
        rotulo: 'Salvar',
        variante: 'primario',
        desabilitado: !nome.trim(),
        aoClicar: () =>
          aoSalvar(livre ? { nome: nome.trim(), ram, loader, versao } : { nome: nome.trim(), ram })
      }}
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[13px]">
          Nome
          <Campo value={nome} maxLength={48} onChange={(e) => setNome(e.target.value)} />
        </label>
        {livre ? (
          <CamposVersao loader={loader} versao={versao} aoMudar={mudarVersao} />
        ) : (
          <p className="text-xs text-muted">
            {i.origem.tipo === 'servidor'
              ? 'A versão e o loader seguem o servidor. Para mudar, use Software no ServSquare.'
              : 'A versão e o loader vêm do modpack.'}
          </p>
        )}
        {limites && (
          <Slider
            rotulo="Memória (RAM)"
            valor={ram}
            min={limites.min}
            max={limites.max}
            aoMudar={setRam}
            formatar={(v) => `${v} GB`}
          />
        )}
        <p className="text-xs text-muted">
          Mundos, prints e configurações da pasta continuam lá, mesmo trocando a versão.
        </p>
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
      titulo="Entrar com convite"
      aoCancelar={aoFechar}
      acao={{
        rotulo: 'Entrar',
        variante: 'primario',
        desabilitado: !texto.trim() || !nickOk,
        aoClicar: () => aoEntrar(() => window.api.entrarComConvite(texto.trim(), pedido))
      }}
    >
      <div className="flex flex-col gap-3 text-[13px]">
        <p>
          Cole o código ou o link que o dono do servidor mandou. O app cria a instalação do servidor
          com os mods certos.
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          autoFocus
          aria-label="Código ou link do convite"
          placeholder="26.12.34.56:8788#K7QF-M2XA-9TBC-H4PZ"
          className="border border-linha bg-panel-2 p-2 font-mono text-[13px]"
        />
        <label className="flex flex-col gap-1">
          Seu nick no Minecraft
          <Campo
            value={nick}
            maxLength={16}
            aria-label="Seu nick no Minecraft"
            placeholder="Steve"
            onChange={(e) => setNick(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          Recado para o dono (opcional)
          <Campo
            value={recado}
            maxLength={100}
            aria-label="Recado para o dono"
            placeholder="Oi, sou o amigo do Discord!"
            onChange={(e) => setRecado(e.target.value)}
          />
        </label>
        <p className="text-xs text-muted">
          O app confere o nick na Mojang e pede ao dono para você entrar na lista de quem pode jogar
          (whitelist). Você vê a resposta na tela Jogar.
        </p>
        <Botao
          className="self-start"
          disabled={!nickOk}
          onClick={() => aoEntrar(() => window.api.entrarComArquivoDeConvite(pedido))}
        >
          Abrir arquivo de convite (.hubsquare)
        </Botao>
      </div>
    </Dialogo>
  )
}
