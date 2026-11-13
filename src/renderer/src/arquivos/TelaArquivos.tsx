import { useCallback, useEffect, useRef, useState } from 'react'
import {
  EXTENSOES_TEXTO,
  type ErroTela,
  type ItemArquivo,
  type ListaArquivos
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { dataHora, tamanho } from '../componentes/formato'
import { IconeArquivos, IconeRegistro } from '../componentes/icones'
import { Esqueleto } from '../componentes/movimento'
import { Aviso, Botao, Campo, Dialogo, EstadoVazio, Menu } from '../componentes/ui'
import { useEstadoServidor } from '../servidor/comandos'

const juntar = (pasta: string, nome: string): string => (pasta ? `${pasta}/${nome}` : nome)
const ehTexto = (nome: string): boolean =>
  EXTENSOES_TEXTO.some((e) => nome.toLowerCase().endsWith(e))

type Pedido = { tipo: 'renomear' | 'apagar'; item: ItemArquivo } | { tipo: 'novaPasta' }

// Tela Arquivos (DESIGN.md, 6.22). Só mostra o que está dentro da pasta do servidor ativo:
// o processo principal confere cada caminho antes de qualquer operação.
export function TelaArquivos(): React.JSX.Element {
  const { estado } = useEstadoServidor()
  const [lista, setLista] = useState<ListaArquivos | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [nome, setNome] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const caminho = lista?.caminho ?? ''

  const abrir = useCallback(async (destino: string): Promise<void> => {
    const r = await window.api.listarArquivos(destino)
    if (r.ok) {
      setLista(r.valor)
      setErro(null)
    } else setErro(r.erro)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura da pasta
    void abrir('')
  }, [abrir])

  async function executar(acao: () => Promise<{ ok: boolean; erro?: ErroTela }>): Promise<void> {
    setOcupado(true)
    setErro(null)
    setAviso(null)
    const r = await acao()
    setOcupado(false)
    setPedido(null)
    if (!r.ok && r.erro) setErro(r.erro)
    await abrir(caminho)
  }

  function confirmar(): void {
    if (!pedido) return
    if (pedido.tipo === 'novaPasta') {
      void executar(() => window.api.criarPasta(caminho, nome))
    } else if (pedido.tipo === 'renomear') {
      void executar(() => window.api.renomearArquivo(juntar(caminho, pedido.item.nome), nome))
    } else {
      void executar(() => window.api.apagarArquivo(juntar(caminho, pedido.item.nome)))
    }
  }

  function abrirItem(item: ItemArquivo): void {
    if (item.pasta) void abrir(juntar(caminho, item.nome))
    else if (ehTexto(item.nome)) setEditando(juntar(caminho, item.nome))
  }

  async function baixar(item: ItemArquivo): Promise<void> {
    const r = await window.api.baixarArquivo(juntar(caminho, item.nome))
    if (!r.ok) setErro(r.erro)
    else if (r.valor) setAviso(`Cópia de "${item.nome}" salva.`)
  }

  function soltar(e: React.DragEvent): void {
    e.preventDefault()
    setArrastando(false)
    const arquivos = [...e.dataTransfer.files]
    if (arquivos.length) void executar(() => window.api.enviarArquivos(caminho, arquivos))
  }

  const partes = caminho ? caminho.split('/') : []
  const ligado = estado !== 'desligado'

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex flex-col gap-4 p-10">
        {/* Migalhas: Servidor › plugins › config.yml */}
        <nav aria-label="Pasta atual" className="flex flex-wrap items-center gap-1 text-sm">
          {['Servidor', ...partes].map((p, i) => {
            const destino = partes.slice(0, i).join('/')
            const ultima = i === partes.length && !editando
            return (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted">›</span>}
                <button
                  type="button"
                  disabled={ultima}
                  onClick={() => {
                    setEditando(null)
                    void abrir(destino)
                  }}
                  className={`px-1 font-bold ${ultima ? '' : 'text-accent hover:underline'}`}
                >
                  {p}
                </button>
              </span>
            )
          })}
          {editando && (
            <>
              <span className="text-muted">›</span>
              <span className="px-1 font-bold">{editando.split('/').pop()}</span>
            </>
          )}
        </nav>

        {ligado && (
          <Aviso tipo="atencao">
            O servidor está ligado: mudanças em arquivos de configuração só valem depois de
            reiniciar. A pasta do mundo que está rodando não pode ser apagada nem renomeada.
          </Aviso>
        )}
        {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
        {erro && <MensagemErro erro={erro} />}

        {editando ? (
          <Editor
            key={editando}
            caminho={editando}
            aoFechar={() => setEditando(null)}
            aoSalvar={(reiniciar) =>
              setAviso(
                reiniciar
                  ? 'Salvo. Reinicie o servidor para a mudança valer.'
                  : 'Salvo. A mudança vale na próxima vez que o servidor ligar.'
              )
            }
          />
        ) : !lista ? (
          !erro && <Esqueleto linhas={6} />
        ) : (
          <section
            aria-label="Arquivos da pasta"
            onDragOver={(e) => {
              e.preventDefault()
              setArrastando(true)
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={soltar}
            className={`border bg-panel ${arrastando ? 'border-accent' : 'border-linha'}`}
          >
            <header className="flex h-12 items-center justify-between gap-3 border-b border-linha px-4">
              <span className="text-xs text-muted">
                Arraste arquivos do Windows para cá para enviar.
              </span>
              <div className="flex gap-2">
                <Botao
                  tamanho="pequeno"
                  onClick={() => {
                    setNome('')
                    setPedido({ tipo: 'novaPasta' })
                  }}
                >
                  Nova pasta
                </Botao>
                <Botao
                  tamanho="pequeno"
                  title="Atualizar"
                  aria-label="Atualizar"
                  onClick={() => void abrir(caminho)}
                >
                  ⟳
                </Botao>
              </div>
            </header>
            {lista.itens.length === 0 ? (
              <EstadoVazio icone={<IconeArquivos />} titulo="Pasta vazia" />
            ) : (
              <table className="w-full text-[13px]">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2 font-normal">Nome</th>
                    <th className="w-28 px-2 py-2 text-right font-normal">Tamanho</th>
                    <th className="w-40 px-2 py-2 font-normal">Modificado</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {lista.itens.map((item) => {
                    const abrivel = item.pasta || ehTexto(item.nome)
                    return (
                      <tr key={item.nome} className="border-t border-linha hover:bg-panel-2">
                        <td className="px-4 py-1">
                          <button
                            type="button"
                            disabled={!abrivel}
                            onClick={() => abrirItem(item)}
                            className={`flex min-h-8 items-center gap-2 text-left ${abrivel ? 'hover:underline' : 'cursor-default'}`}
                          >
                            {item.pasta ? (
                              <IconeArquivos className="h-4 w-4 shrink-0 text-accent" />
                            ) : (
                              <IconeRegistro className="h-4 w-4 shrink-0 text-muted" />
                            )}
                            <span className="break-all">{item.nome}</span>
                            {item.protegido && <span className="text-xs text-muted">(em uso)</span>}
                          </button>
                        </td>
                        <td className="px-2 text-right font-mono text-xs text-muted">
                          {item.pasta ? '—' : tamanho(item.tamanho)}
                        </td>
                        <td className="px-2 text-xs text-muted">{dataHora(item.data)}</td>
                        <td className="px-2">
                          <Menu
                            rotulo={`Ações de ${item.nome}`}
                            classeBotao="flex h-8 w-8 items-center justify-center hover:bg-tile-active"
                            itens={[
                              {
                                rotulo: 'Abrir',
                                desabilitado: !abrivel,
                                aoClicar: () => abrirItem(item)
                              },
                              {
                                rotulo: 'Renomear',
                                desabilitado: item.protegido,
                                aoClicar: () => {
                                  setNome(item.nome)
                                  setPedido({ tipo: 'renomear', item })
                                }
                              },
                              {
                                rotulo: 'Baixar',
                                desabilitado: item.pasta,
                                aoClicar: () => void baixar(item)
                              },
                              {
                                rotulo: 'Apagar',
                                desabilitado: item.protegido,
                                aoClicar: () => setPedido({ tipo: 'apagar', item })
                              }
                            ]}
                          >
                            ⋯
                          </Menu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>

      <Dialogo
        aberto={!!pedido}
        titulo={
          pedido?.tipo === 'apagar'
            ? `Apagar "${pedido.item.nome}"?`
            : pedido?.tipo === 'renomear'
              ? 'Renomear'
              : 'Nova pasta'
        }
        aoCancelar={() => setPedido(null)}
        acao={{
          rotulo:
            pedido?.tipo === 'apagar'
              ? 'Apagar'
              : pedido?.tipo === 'renomear'
                ? 'Renomear'
                : 'Criar',
          variante: pedido?.tipo === 'apagar' ? 'perigo' : 'primario',
          aoClicar: confirmar,
          ocupado,
          desabilitado: pedido?.tipo !== 'apagar' && !nome.trim()
        }}
      >
        {pedido?.tipo === 'apagar' ? (
          <p>
            {pedido.item.pasta
              ? 'A pasta e tudo o que tem dentro dela vão ser apagados.'
              : 'O arquivo vai ser apagado.'}{' '}
            Isso não pode ser desfeito.
          </p>
        ) : (
          <Campo
            aria-label="Nome"
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && nome.trim() && confirmar()}
          />
        )}
      </Dialogo>
    </div>
  )
}

// Editor de texto (6.22): monoespaçada de 13px, números de linha, Ctrl+S e aviso de não salvo.
// Também usado no "Editar como texto" dos configs dos mods (Fase 25).
export function Editor({
  caminho,
  aoFechar,
  aoSalvar
}: {
  caminho: string
  aoFechar: () => void
  aoSalvar: (reiniciar: boolean) => void
}): React.JSX.Element {
  const [original, setOriginal] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [descartando, setDescartando] = useState(false)
  const numeros = useRef<HTMLDivElement>(null)
  const alterado = original !== null && texto !== original

  useEffect(() => {
    window.api.lerArquivoTexto(caminho).then((r) => {
      if (!r.ok) return setErro(r.erro)
      setOriginal(r.valor)
      setTexto(r.valor)
    })
  }, [caminho])

  const salvar = useCallback(async (): Promise<void> => {
    setSalvando(true)
    setErro(null)
    const r = await window.api.salvarArquivoTexto(caminho, texto)
    setSalvando(false)
    if (!r.ok) return setErro(r.erro)
    setOriginal(texto)
    aoSalvar(r.valor)
  }, [caminho, texto, aoSalvar])

  useEffect(() => {
    const atalho = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (alterado && !salvando) void salvar()
      }
    }
    window.addEventListener('keydown', atalho)
    return () => window.removeEventListener('keydown', atalho)
  }, [alterado, salvando, salvar])

  if (original === null) return erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={6} />

  const linhas = texto.split('\n').length
  return (
    <section className="flex flex-col border border-linha bg-panel">
      <header className="flex h-12 items-center justify-between gap-3 border-b border-linha px-4">
        <span className="text-xs text-warning" aria-live="polite">
          {alterado ? 'Alterações não salvas' : ''}
        </span>
        <div className="flex gap-2">
          <Botao
            tamanho="pequeno"
            onClick={() => (alterado ? setDescartando(true) : aoFechar())}
            disabled={salvando}
          >
            Cancelar
          </Botao>
          <Botao
            tamanho="pequeno"
            variante="primario"
            disabled={!alterado || salvando}
            onClick={() => void salvar()}
            title="Ctrl+S"
          >
            Salvar
          </Botao>
        </div>
      </header>
      {erro && <MensagemErro erro={erro} />}
      <div className="flex h-[60vh] bg-console font-mono text-[13px] leading-5">
        <div
          ref={numeros}
          aria-hidden="true"
          className="overflow-hidden px-2 py-2 text-right text-console-muted select-none"
        >
          {Array.from({ length: linhas }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          aria-label={`Conteúdo de ${caminho}`}
          spellCheck={false}
          wrap="off"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onScroll={(e) => {
            if (numeros.current) numeros.current.scrollTop = e.currentTarget.scrollTop
          }}
          className="flex-1 resize-none bg-transparent py-2 pr-2 text-on-dark caret-on-dark outline-none"
        />
      </div>
      <Dialogo
        aberto={descartando}
        titulo="Descartar alterações?"
        aoCancelar={() => setDescartando(false)}
        acao={{ rotulo: 'Descartar', variante: 'perigo', aoClicar: aoFechar }}
      >
        As mudanças que você fez neste arquivo vão ser perdidas.
      </Dialogo>
    </section>
  )
}
