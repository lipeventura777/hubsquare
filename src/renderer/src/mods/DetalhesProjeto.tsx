import { useCallback, useEffect, useState } from 'react'
import { useApi } from '../componentes/api'
import type {
  DetalhesProjeto,
  ErroTela,
  InfoServidor,
  PlanoMods,
  Progresso,
  Resultado,
  TipoConteudo
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { AndamentoModpack } from '../componentes/AndamentoModpack'
import { BarraProgresso, Esqueleto } from '../componentes/movimento'
import { CardPainel } from '../componentes/paineis'
import { Aviso, Botao, CaixaSelecao, Dialogo } from '../componentes/ui'
import { criarComModpack } from '../estrutura/navegar'
import { FraseCompat } from './FraseCompat'
import { useEstadoServidor } from '../servidor/comandos'
import { classesBotao } from '../componentes/estilos'
import type { Fonte } from '../../../shared/fontes'
import { DialogoPlano } from './DialogoPlano'
import { Markdown } from './Markdown'
import { NOMES_AMBIENTE, nomeLoader } from './nomesModrinth'
import { IconeProjeto } from './TelaMods'

const numero = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

const TIPOS_VERSAO: Record<string, string> = { release: 'Estável', beta: 'Beta', alpha: 'Alfa' }

// Cabeçalho da página de detalhes (Explorar e Instalados): ícone de 72px, nome e resumo.
export function CabecalhoDetalhes({
  icone,
  titulo,
  resumo,
  linha
}: {
  icone: string | null
  titulo: string
  resumo?: string
  linha: string
}): React.JSX.Element {
  return (
    <header className="flex flex-wrap items-start gap-4">
      <IconeProjeto url={icone} titulo={titulo} tam={72} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="texto-pixel text-[22px]">{titulo}</h2>
        {resumo && <p className="text-[13px]">{resumo}</p>}
        <p className="text-xs text-muted">{linha}</p>
      </div>
    </header>
  )
}

// Card da ação: a frase de para onde vai e os botões.
export function CardAcao({
  frase,
  children
}: {
  frase: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3 border border-linha bg-panel p-4">
      <p className="border-l-4 border-accent pl-3 text-[13px]">{frase}</p>
      {children}
    </section>
  )
}

// Página de detalhes de um projeto (Explorar, Fase 23; Instalados, Fase 23.2; fontes, Fase 24).
// `extra` entra na linha de botões (ex.: o Remover da aba Instalados).
export function DetalhesDoProjeto({
  projeto,
  tipo,
  info,
  aoVoltar,
  aoMudar,
  rotuloVoltar = '‹ Voltar ao Explorar',
  extra,
  semAcaoPrincipal = false,
  fonte = 'modrinth'
}: {
  projeto: { id: string; titulo: string; autor?: string }
  fonte?: Fonte
  tipo: TipoConteudo
  info: InfoServidor
  aoVoltar: () => void
  aoMudar: (instalado: boolean) => Promise<void>
  rotuloVoltar?: string
  extra?: React.ReactNode
  semAcaoPrincipal?: boolean
}): React.JSX.Element {
  const api = useApi()
  const { estado: estadoServidor } = useEstadoServidor()
  // PlaySquare (Fase P3): o alvo é uma instalação do jogador; o servidor ligado não importa.
  const jogo = !!info.jogador
  const ligado = !jogo && estadoServidor !== 'desligado'
  const [d, setD] = useState<DetalhesProjeto | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null) // qual ação está rodando
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [plano, setPlano] = useState<PlanoMods | null>(null)
  const [removendo, setRemovendo] = useState(false)
  const [foto, setFoto] = useState(0)

  useEffect(() => api.aoProgredir(setProgresso), [api])

  const carregar = useCallback(async (): Promise<void> => {
    const r = await api.detalhesProjeto(projeto.id, tipo, fonte)
    if (r.ok) setD(r.valor)
    else setErro(r.erro)
  }, [api, projeto.id, tipo, fonte])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura
    void carregar()
  }, [carregar])

  // Roda uma ação, mostra o erro ou o aviso e relê a página.
  async function rodar(
    nome: string,
    acao: () => Promise<Resultado<unknown>>,
    depois?: string
  ): Promise<boolean> {
    setOcupado(nome)
    setErro(null)
    setAviso(null)
    const r = await acao()
    setOcupado(null)
    setProgresso(null)
    if (!r.ok) {
      setErro(r.erro.cancelado ? null : r.erro)
      return false
    }
    if (depois) setAviso(depois)
    await carregar()
    return true
  }

  const voltar = (
    <Botao tamanho="pequeno" className="self-start" onClick={aoVoltar}>
      {rotuloVoltar}
    </Botao>
  )

  if (!d) {
    return (
      <div className="flex flex-col gap-4">
        {voltar}
        {erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={6} />}
      </div>
    )
  }

  const extras = info.tipo === 'paper' ? 'plugins' : 'mods'
  const reiniciar = ligado ? ' Com o servidor ligado, ele entra quando o servidor reiniciar.' : ''

  // ---------- Ações de cada destino ----------

  async function instalarNoServidor(): Promise<void> {
    if (!d) return
    if (d.estado === 'atualizar' && d.arquivo) {
      const arquivo = d.arquivo
      await rodar('principal', () => api.atualizarMods([arquivo]), `Atualizado.${reiniciar}`)
      return aoMudar(true)
    }
    setOcupado('principal')
    setErro(null)
    const r = await api.planejarMod(d.id, d.fonte)
    setOcupado(null)
    if (!r.ok) return setErro(r.erro)
    setPlano(r.valor)
  }

  async function confirmarPlano(): Promise<void> {
    if (!plano) return
    const ok = await rodar(
      'plano',
      () => api.instalarMods(plano.token),
      `Instalado na pasta ${extras}.${reiniciar}`
    )
    setPlano(null)
    if (ok) await aoMudar(true)
  }

  async function principal(): Promise<void> {
    if (!d) return
    switch (d.destino) {
      case 'servidor':
        return instalarNoServidor()
      case 'datapack':
        if (
          await rodar(
            'principal',
            () => api.instalarDatapack(d.id, d.fonte),
            ligado
              ? 'Datapack copiado. Rode /reload no console ou reinicie o servidor para ativar.'
              : 'Datapack copiado. Ele ativa quando o servidor ligar.'
          )
        )
          await aoMudar(true)
        return
      case 'resourcepack':
        if (
          await rodar(
            'principal',
            () => api.usarResourcePack(d.id, d.obrigatorio),
            `Pronto: o server.properties aponta para este resource pack.${ligado ? ' Vale depois de reiniciar o servidor.' : ''}`
          )
        )
          await aoMudar(true)
        return
      case 'amigos':
        if (
          await rodar(
            'principal',
            () => api.adicionarAosAmigos(d.id, d.tipo),
            jogo
              ? `Instalado na instalação ${info.nome}.${d.tipo === 'shader' ? ' O mod de shaders veio junto.' : ''}`
              : 'Adicionado. Gere o Pacote pros amigos de novo (aba Instalados) para mandar a versão nova.'
          )
        )
          await aoMudar(true)
        return
      case 'modpack':
        if (jogo) {
          await rodar(
            'principal',
            () => api.criarInstalacaoDeModpack(d.id),
            'Instalação criada. Ela aparece em Instalações.'
          )
          return
        }
        return criarComModpack(d.id, d.fonte)
      case 'incompativel':
        return
    }
  }

  const rotulosJogo: Record<string, Record<string, string>> = {
    servidor: {
      instalar: 'Instalar no meu jogo',
      instalado: 'No meu jogo',
      atualizar: 'Atualizar'
    },
    amigos: { instalar: 'Instalar no meu jogo', instalado: 'No meu jogo', atualizar: 'Atualizar' },
    modpack: { instalar: 'Criar instalação com este modpack' },
    incompativel: { instalar: 'Não serve para esta instalação' }
  }
  const rotulos: Record<string, Record<string, string>> = jogo
    ? rotulosJogo
    : {
        servidor: { instalar: 'Instalar', instalado: 'Instalado', atualizar: 'Atualizar' },
        datapack: { instalar: 'Instalar no mundo', instalado: 'Instalado', atualizar: 'Atualizar' },
        resourcepack: {
          instalar: 'Usar como resource pack do servidor',
          instalado: 'Em uso no servidor',
          atualizar: 'Atualizar no servidor'
        },
        amigos: {
          instalar: 'Adicionar ao Pacote pros amigos',
          instalado: 'No Pacote pros amigos',
          atualizar: 'Atualizar no pacote'
        },
        modpack: { instalar: 'Criar servidor com este modpack' },
        incompativel: { instalar: 'Não serve para este servidor' }
      }
  const rotulo =
    ocupado === 'principal'
      ? d.destino === 'servidor' && d.estado === 'instalar'
        ? 'Verificando...'
        : 'Instalando...'
      : (rotulos[d.destino][d.estado] ?? rotulos[d.destino].instalar)
  const semVersao = d.destino !== 'modpack' && d.destino !== 'incompativel' && !d.versoes.length
  const desabilitado =
    !!ocupado ||
    d.destino === 'incompativel' ||
    d.estado === 'instalado' ||
    semVersao ||
    !!d.compat?.bloqueia ||
    (jogo && d.destino === 'modpack' && d.fonte !== 'modrinth')

  const imagem = d.galeria[foto]

  return (
    <div className="flex flex-col gap-6">
      {voltar}

      <CabecalhoDetalhes
        icone={d.icone}
        titulo={d.titulo}
        resumo={d.descricao}
        linha={[
          projeto.autor && `por ${projeto.autor}`,
          `${numero.format(d.downloads)} downloads`,
          `${numero.format(d.seguidores)} seguidores`,
          d.ambiente && NOMES_AMBIENTE[d.ambiente]
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      {/* Ação principal e, numa frase, para onde vai. */}
      <CardAcao frase={d.frase}>
        <FraseCompat compat={d.compat} />
        {semVersao && (
          <p className="text-[13px] text-warning">
            ⚠ Não há versão para o Minecraft {info.versao}
            {d.destino === 'servidor' ? ` com ${nomeLoader(info.tipo)}` : ''}.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {/* O autor não deixa outros apps baixarem: só o link da página (sem baixar). */}
          {!semAcaoPrincipal && d.baixarPeloSite && d.estado !== 'instalado' && (
            <a
              href={d.baixarPeloSite}
              target="_blank"
              rel="noreferrer"
              className={classesBotao('primario')}
            >
              Baixe pelo site
            </a>
          )}
          {!semAcaoPrincipal && !(d.baixarPeloSite && d.estado !== 'instalado') && (
            <Botao
              variante={d.destino === 'amigos' ? 'destaque' : 'primario'}
              disabled={desabilitado}
              onClick={principal}
            >
              {rotulo}
            </Botao>
          )}
          {extra}

          {/* Na aba Instalados, o Remover vem pelo `extra`. */}
          {!extra && d.destino === 'datapack' && d.estado !== 'instalar' && (
            <Botao variante="perigo" disabled={!!ocupado} onClick={() => setRemovendo(true)}>
              Remover do mundo
            </Botao>
          )}
          {d.destino === 'resourcepack' && d.estado !== 'instalar' && (
            <Botao
              disabled={!!ocupado}
              onClick={async () => {
                if (
                  await rodar(
                    'parar',
                    () => api.pararResourcePack(),
                    'O servidor não manda mais resource pack.'
                  )
                )
                  await aoMudar(d.noPacote)
              }}
            >
              Parar de usar no servidor
            </Botao>
          )}
          {/* Resource pack também pode ir para o pacote; nos outros, o principal já é o pacote. */}
          {(d.destino === 'resourcepack' || d.destino === 'amigos') &&
            (d.noPacote ? (
              <Botao
                disabled={!!ocupado}
                onClick={async () => {
                  if (
                    await rodar(
                      'amigos',
                      () => api.removerDosAmigos(d.id),
                      jogo ? 'Saiu da instalação.' : 'Saiu do Pacote pros amigos.'
                    )
                  )
                    await aoMudar(d.destino === 'resourcepack' && d.estado !== 'instalar')
                }}
              >
                {jogo ? 'Tirar do meu jogo' : 'Tirar do Pacote pros amigos'}
              </Botao>
            ) : (
              d.destino === 'resourcepack' && (
                <Botao
                  variante="destaque"
                  disabled={!!ocupado || semVersao}
                  onClick={async () => {
                    if (
                      await rodar(
                        'amigos',
                        () => api.adicionarAosAmigos(d.id, d.tipo),
                        'Adicionado ao Pacote pros amigos, na pasta resourcepacks.'
                      )
                    )
                      await aoMudar(true)
                  }}
                >
                  {ocupado === 'amigos' ? 'Adicionando...' : 'Adicionar ao Pacote pros amigos'}
                </Botao>
              )
            ))}
        </div>

        {d.destino === 'resourcepack' && (
          <CaixaSelecao
            marcada={d.obrigatorio}
            disabled={!!ocupado}
            aoMudar={(v) => {
              // Em uso: grava na hora. Ainda não: vale quando clicar em "Usar".
              if (d.estado === 'instalar') setD({ ...d, obrigatorio: v })
              else
                void rodar(
                  'obrigatorio',
                  () => api.usarResourcePack(d.id, v),
                  v
                    ? 'Agora é obrigatório: quem recusar o pacote não entra.'
                    : 'Agora é opcional: cada jogador escolhe se baixa.'
                )
            }}
          >
            Obrigatório para entrar (quem recusar o pacote não entra)
          </CaixaSelecao>
        )}
        {d.tipo === 'shader' && !jogo && (
          <p className="text-xs text-muted">
            Para usar shaders, seus amigos precisam de um mod de shaders no jogo (como o Iris).
          </p>
        )}
        {ocupado && jogo && d.tipo === 'modpack' ? (
          <AndamentoModpack progresso={progresso} />
        ) : (
          ocupado &&
          progresso && (
            <div className="flex flex-col gap-1 text-[13px]">
              <span>{progresso.etapa}</span>
              <BarraProgresso
                rotulo={progresso.etapa}
                valor={progresso.recebido}
                maximo={progresso.total}
              />
            </div>
          )
        )}
        {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
        {erro && (
          <MensagemErro
            erro={erro}
            aoTentarDeNovo={
              erro.falhas?.length && jogo && d.tipo === 'modpack'
                ? () => void principal()
                : undefined
            }
          />
        )}
      </CardAcao>

      <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          {imagem && (
            <section aria-label="Galeria" className="flex flex-col gap-2">
              <figure className="flex flex-col gap-1">
                <img
                  src={imagem.url}
                  alt={imagem.titulo ?? `Imagem ${foto + 1} de ${d.titulo}`}
                  className="max-h-[420px] w-full bg-panel-2 object-contain"
                />
                {(imagem.titulo || imagem.descricao) && (
                  <figcaption className="text-xs text-muted">
                    {imagem.titulo && <b className="text-texto">{imagem.titulo}</b>}{' '}
                    {imagem.descricao}
                  </figcaption>
                )}
              </figure>
              {d.galeria.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {d.galeria.map((g, i) => (
                    <button
                      key={g.url}
                      type="button"
                      aria-label={`Ver imagem ${i + 1}`}
                      aria-pressed={i === foto}
                      onClick={() => setFoto(i)}
                      className={`shrink-0 border-2 ${i === foto ? 'border-accent' : 'border-transparent hover:border-muted'}`}
                    >
                      <img src={g.url} alt="" loading="lazy" className="h-16 w-28 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          <CardPainel titulo="Descrição">
            {d.corpo ? <Markdown texto={d.corpo} /> : <p className="text-muted">Sem descrição.</p>}
          </CardPainel>

          <CardPainel
            titulo={
              d.destino === 'modpack'
                ? 'Versões'
                : `Versões para ${info.versao}${d.versoes.length ? ` (${d.versoes.length})` : ''}`
            }
          >
            {!d.versoes.length ? (
              <p className="text-[13px] text-muted">Nenhuma versão compatível com este servidor.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-linha">
                {d.versoes.map((v, i) => (
                  <li key={v.id} className="py-2">
                    <details open={i === 0}>
                      <summary className="flex cursor-pointer flex-wrap items-baseline gap-2 text-[13px]">
                        <b>{v.numero}</b>
                        <span className="bg-panel-2 px-1.5 text-xs">
                          {TIPOS_VERSAO[v.tipo] ?? v.tipo}
                        </span>
                        <span className="text-xs text-muted">
                          {data.format(new Date(v.data))} · {v.loaders.map(nomeLoader).join(', ')} ·{' '}
                          {v.jogos.slice(-3).join(', ')}
                        </span>
                      </summary>
                      <div className="mt-2 pl-2">
                        {v.changelog ? (
                          <Markdown texto={v.changelog} />
                        ) : (
                          <p className="text-xs text-muted">Sem notas desta versão.</p>
                        )}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </CardPainel>
        </div>

        <aside className="flex flex-col gap-6">
          <CardPainel titulo="Licença">
            <p className="text-[13px]">
              {d.licenca.url ? (
                <a
                  href={d.licenca.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline"
                >
                  {d.licenca.nome || d.licenca.id}
                </a>
              ) : (
                d.licenca.nome || d.licenca.id
              )}
            </p>
          </CardPainel>

          {d.links.length > 0 && (
            <CardPainel titulo="Links">
              <ul className="flex flex-col gap-2 text-[13px]">
                {d.links.map((l) => (
                  <li key={l.url}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline"
                    >
                      {l.rotulo}
                    </a>
                  </li>
                ))}
                {d.fonte === 'modrinth' && (
                  <li>
                    <a
                      href={`https://modrinth.com/project/${d.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline"
                    >
                      Página no Modrinth
                    </a>
                  </li>
                )}
              </ul>
            </CardPainel>
          )}

          <CardPainel titulo="Dependências">
            {!d.dependencias.length ? (
              <p className="text-[13px] text-muted">Não precisa de outros projetos.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {d.dependencias.map((dep) => (
                  <li key={dep.id} className="flex items-center gap-2 text-[13px]">
                    <IconeProjeto url={dep.icone} titulo={dep.titulo} tam={28} />
                    <span className="min-w-0 flex-1 truncate" title={dep.titulo}>
                      {dep.titulo}
                    </span>
                    <span className="bg-panel-2 px-1.5 text-xs">
                      {dep.obrigatoria ? 'necessário' : 'opcional'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {d.destino === 'servidor' && d.dependencias.some((x) => x.obrigatoria) && (
              <p className="mt-3 text-xs text-muted">As necessárias são instaladas junto.</p>
            )}
          </CardPainel>
        </aside>
      </div>

      {/* Mods e plugins: mesma confirmação da Fase 16, com as dependências. */}
      <DialogoPlano
        plano={plano}
        titulo={`Instalar ${d.titulo}?`}
        extras={extras}
        ocupado={ocupado === 'plano'}
        progresso={progresso}
        aoCancelar={() => setPlano(null)}
        aoConfirmar={confirmarPlano}
      />

      <Dialogo
        aberto={removendo}
        titulo={`Remover ${d.titulo}?`}
        aoCancelar={() => setRemovendo(false)}
        acao={{
          rotulo: ocupado === 'remover' ? 'Removendo...' : 'Remover',
          variante: 'perigo',
          ocupado: ocupado === 'remover',
          aoClicar: async () => {
            let agendado = false
            const ok = await rodar(
              'remover',
              async () => {
                const r = await api.removerDatapack(d.id)
                agendado = r.ok && r.valor
                return r
              },
              'Pronto. O arquivo fica 7 dias em Mods › Instalados › Removidos recentemente.'
            )
            if (ok && agendado) setAviso('Será removido ao desligar o servidor.')
            setRemovendo(false)
            if (ok) await aoMudar(false)
          }
        }}
      >
        <p>
          O datapack sai da pasta datapacks do mundo ativo e fica 7 dias em Removidos recentemente.
          Coisas que ele já criou no mundo podem continuar lá.
          {ligado && ' Com o servidor ligado, ele só sai quando o servidor desligar.'}
        </p>
      </Dialogo>
    </div>
  )
}
