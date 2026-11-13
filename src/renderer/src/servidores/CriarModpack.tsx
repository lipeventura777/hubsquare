import { useCallback, useEffect, useRef, useState } from 'react'
import {
  NOMES_TIPOS,
  type AnaliseModpack,
  type ErroTela,
  type InfoServidor,
  type ModpackBusca,
  type Progresso
} from '../../../shared/tipos'
import { BarraDeEtapas } from '../assistente/Assistente'
import { MensagemErro } from '../componentes/MensagemErro'
import { IconeMods } from '../componentes/icones'
import { classesBotao } from '../componentes/estilos'
import { Esqueleto } from '../componentes/movimento'
import { CardPainel } from '../componentes/paineis'
import { Aviso, Botao, CaixaSelecao, Campo, EstadoVazio, Secao } from '../componentes/ui'
import { IconeProjeto } from '../mods/TelaMods'
import { ListaManuais, separarManuais } from '../mods/ListaManuais'
import { AndamentoModpack as Andamento } from '../componentes/AndamentoModpack'
import type { Fonte } from '../../../shared/fontes'

const ETAPAS = ['Modpack', 'Confirmar', 'Pronto'] as const
const numero = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

function megas(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`
}

// "+ Criar" › "A partir de um modpack" (Fase 17). Mesmo visual do assistente (DESIGN.md, 6.10).
export function CriarModpack({
  projetoInicial,
  aoConcluir,
  aoCancelar
}: {
  projetoInicial?: { id: string; fonte: Fonte } // vindo do Explorar: já abre a confirmação
  aoConcluir: () => void
  aoCancelar: () => void
}): React.JSX.Element {
  const [etapa, setEtapa] = useState(0)
  const [termo, setTermo] = useState('')
  const [itens, setItens] = useState<ModpackBusca[] | null>(null)
  const [total, setTotal] = useState(0)
  const [buscando, setBuscando] = useState(false)
  const [abrindo, setAbrindo] = useState<string | null>(null) // id do pack (ou "arquivo")
  const [analise, setAnalise] = useState<AnaliseModpack | null>(null)
  const [nome, setNome] = useState('')
  const [eula, setEula] = useState(false)
  const [criando, setCriando] = useState(false)
  const [criado, setCriado] = useState<InfoServidor | null>(null)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => window.api.aoProgredir(setProgresso), [])

  const buscar = useCallback(async (texto: string, offset: number): Promise<void> => {
    setBuscando(true)
    setErro(null)
    const r = await window.api.buscarModpacks(texto, offset)
    setBuscando(false)
    if (!r.ok) return setErro(r.erro)
    setTotal(r.valor.total)
    setItens((atuais) => (offset ? [...(atuais ?? []), ...r.valor.itens] : r.valor.itens))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira busca (os mais baixados)
    void buscar('', 0)
  }, [buscar])

  function escolhido(a: AnaliseModpack | null): void {
    if (!a) return
    setAnalise(a)
    setNome(a.nomeSugerido)
    setEula(false)
    setEtapa(1)
  }

  async function abrirDoModrinth(id: string, fonte: Fonte = 'modrinth'): Promise<void> {
    setAbrindo(id)
    setErro(null)
    const r =
      fonte === 'curseforge'
        ? await window.api.analisarModpackCurseForge(id)
        : await window.api.analisarModpackModrinth(id)
    setAbrindo(null)
    setProgresso(null)
    if (!r.ok) return setErro(r.erro.cancelado ? null : r.erro)
    escolhido(r.valor)
  }

  // Vindo do Explorar: analisa o pack escolhido lá e pula para Confirmar.
  const inicial = useRef(projetoInicial)
  useEffect(() => {
    const pack = inicial.current
    inicial.current = undefined
    if (pack) void abrirDoModrinth(pack.id, pack.fonte)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na primeira vez
  }, [])

  async function abrirArquivo(): Promise<void> {
    setAbrindo('arquivo')
    setErro(null)
    const r = await window.api.analisarModpackArquivo()
    setAbrindo(null)
    setProgresso(null)
    if (!r.ok) return setErro(r.erro.cancelado ? null : r.erro)
    escolhido(r.valor)
  }

  async function criar(): Promise<void> {
    if (!analise) return
    setErro(null)
    setCriando(true)
    const r = await window.api.criarDeModpack({ token: analise.token, nome, aceitouEula: eula })
    setCriando(false)
    setProgresso(null)
    if (!r.ok) return setErro(r.erro.cancelado ? null : r.erro)
    setCriado(r.valor)
    setEtapa(2)
  }

  const principal =
    etapa === 1
      ? {
          texto: criando ? 'Criando' : 'Criar servidor',
          aoClicar: criar,
          ativo: eula && !!nome.trim() && !criando
        }
      : etapa === 2
        ? { texto: 'Ir para o painel', aoClicar: aoConcluir, ativo: true }
        : null

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="m-2.5 mb-0 flex shrink-0 flex-col gap-5 bg-panel px-10 py-6">
        <div className="flex items-center gap-3">
          <IconeMods className="h-8 w-8 text-accent" />
          <div>
            <div className="texto-pixel text-[22px]">Servidor a partir de um modpack</div>
            <div className="text-[13px] text-muted">
              O app instala o loader, os mods e as configurações do pack.
            </div>
          </div>
        </div>
        <BarraDeEtapas etapa={etapa} etapas={ETAPAS} />
      </header>

      <div className="vidro-painel m-2.5 min-h-0 flex-1 overflow-auto">
        <div
          className={`mx-auto flex w-full flex-col gap-10 p-10 ${etapa === 0 ? 'max-w-[1200px]' : 'max-w-[720px]'}`}
        >
          {etapa === 0 && (
            <Secao titulo="Escolha o modpack">
              <div className="flex flex-wrap gap-2">
                <form
                  className="flex min-w-[320px] flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    buscar(termo, 0)
                  }}
                >
                  <Campo
                    aria-label="Procurar modpacks"
                    placeholder="Procurar modpacks no Modrinth"
                    value={termo}
                    maxLength={100}
                    onChange={(e) => setTermo(e.target.value)}
                    className="flex-1"
                  />
                  <Botao variante="primario" type="submit" disabled={buscando}>
                    Procurar
                  </Botao>
                </form>
                <Botao onClick={abrirArquivo} disabled={!!abrindo}>
                  {abrindo === 'arquivo' ? 'Abrindo...' : 'Abrir arquivo .mrpack'}
                </Botao>
              </div>
              {abrindo && <Andamento progresso={progresso} />}
              {erro && <MensagemErro erro={erro} />}
              {!itens ? (
                <Esqueleto linhas={6} />
              ) : !itens.length ? (
                <EstadoVazio
                  icone={<IconeMods />}
                  titulo="Nenhum modpack encontrado"
                  texto="Tente outro nome, como está no Modrinth."
                />
              ) : (
                <ul className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2 min-[1300px]:grid-cols-3">
                  {itens.map((p) => (
                    <li
                      key={p.id}
                      className="anim-item flex gap-3 border border-linha bg-panel p-3 transition-colors duration-(--dur-fast) hover:border-muted"
                    >
                      <IconeProjeto url={p.icone} titulo={p.titulo} tam={56} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="truncate text-sm font-bold" title={p.titulo}>
                          {p.titulo}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {p.versaoJogo ? `Minecraft ${p.versaoJogo}` : 'Minecraft'} ·{' '}
                          {p.loaders.map((l) => NOMES_TIPOS[l]).join(', ')} ·{' '}
                          {numero.format(p.downloads)} downloads
                        </p>
                        <p className="line-clamp-2 text-[13px]">{p.descricao}</p>
                        <Botao
                          variante="primario"
                          tamanho="pequeno"
                          className="mt-1 self-start"
                          disabled={!!abrindo}
                          onClick={() => abrirDoModrinth(p.id)}
                        >
                          {abrindo === p.id ? 'Baixando...' : 'Escolher'}
                        </Botao>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {itens && itens.length < total && (
                <Botao
                  className="self-center"
                  disabled={buscando}
                  onClick={() => buscar(termo, itens.length)}
                >
                  {buscando ? 'Carregando...' : 'Carregar mais'}
                </Botao>
              )}
            </Secao>
          )}

          {etapa === 1 && analise && (
            <>
              <Secao titulo="Modpack">
                <CardPainel titulo={`${analise.nome} ${analise.versaoPack}`}>
                  <div className="flex gap-4">
                    <IconeProjeto url={analise.icone} titulo={analise.nome} tam={72} />
                    <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
                      <dt className="text-muted">Jogo</dt>
                      <dd>Minecraft {analise.versaoJogo}</dd>
                      <dt className="text-muted">Loader</dt>
                      <dd>
                        {NOMES_TIPOS[analise.tipo]} {analise.versaoLoader}
                      </dd>
                      <dt className="text-muted">Mods</dt>
                      <dd>
                        {analise.mods} no servidor ({analise.arquivos} arquivos,{' '}
                        {megas(analise.tamanho)} para baixar)
                      </dd>
                    </dl>
                  </div>
                  {analise.resumo && (
                    <p className="mt-3 text-[13px] text-muted">{analise.resumo}</p>
                  )}
                </CardPainel>
                <Aviso tipo={analise.ram.explicacao.includes('lento') ? 'atencao' : 'sucesso'}>
                  {analise.ram.explicacao} Dá para mudar depois em Opções.
                </Aviso>
                <ListaManuais
                  itens={separarManuais(analise.manuais).comAssistente}
                  texto="Os autores destes mods não deixam outros apps baixarem. Depois de criar, a janela Downloads necessários abre a página de cada um; baixe pelo navegador e o app põe na pasta mods sozinho:"
                />
                <ListaManuais
                  itens={separarManuais(analise.manuais).soLink}
                  texto="Os autores destes mods não deixam outros apps baixarem. Baixe cada um pelo site e coloque na pasta mods do servidor antes de ligar:"
                />
              </Secao>
              <Secao titulo="Nome do servidor">
                <Campo
                  aria-label="Nome do servidor"
                  value={nome}
                  maxLength={32}
                  disabled={criando}
                  onChange={(e) => setNome(e.target.value)}
                />
              </Secao>
              <Secao titulo="Termos de uso do jogo">
                <p className="text-[13px] text-muted">
                  Para rodar um servidor, você precisa aceitar o EULA (contrato de uso) da Mojang.
                </p>
                <CaixaSelecao marcada={eula} disabled={criando} aoMudar={setEula}>
                  Li e aceito o{' '}
                  <a
                    href="https://aka.ms/MinecraftEULA"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    EULA do Minecraft
                  </a>
                </CaixaSelecao>
                {criando && <Andamento progresso={progresso} />}
              </Secao>
              {erro && (
                <MensagemErro
                  erro={erro}
                  aoTentarDeNovo={erro.falhas?.length ? criar : undefined}
                />
              )}
            </>
          )}

          {etapa === 2 && criado && (
            <Secao titulo="Tudo pronto!">
              <Aviso tipo="sucesso">
                O servidor {criado.nome} ({analise?.nome}, {NOMES_TIPOS[criado.tipo]}{' '}
                {criado.versao}) foi criado. Agora é só ligar. Para seus amigos entrarem, gere o
                &quot;Pacote pros amigos&quot; na tela Mods.
              </Aviso>
              {analise && (
                <ListaManuais
                  itens={separarManuais(analise.manuais).soLink}
                  texto="Falta baixar pelo site e colocar na pasta mods do servidor (Arquivos › mods) antes de ligar:"
                />
              )}
            </Secao>
          )}
        </div>
      </div>

      <footer className="m-2.5 mt-0 flex h-16 shrink-0 items-center justify-between bg-panel px-10">
        {etapa === 2 ? (
          <span />
        ) : etapa === 0 ? (
          <Botao onClick={aoCancelar} disabled={!!abrindo}>
            Cancelar
          </Botao>
        ) : (
          <Botao
            onClick={() => {
              if (analise) void window.api.descartarModpack(analise.token)
              setAnalise(null)
              setErro(null)
              setEtapa(0)
            }}
            disabled={criando}
          >
            Voltar
          </Botao>
        )}
        {principal && (
          <button
            type="button"
            onClick={principal.ativo ? principal.aoClicar : undefined}
            disabled={!principal.ativo}
            className={classesBotao('primario', 'grande')}
          >
            <span className={criando ? 'pontos' : ''}>{principal.texto}</span>
          </button>
        )}
      </footer>
    </div>
  )
}
