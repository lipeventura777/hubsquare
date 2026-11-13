import { useCallback, useEffect, useState } from 'react'
import { useApi } from '../componentes/api'
import {
  CORES_ETIQUETA,
  type CampoConfig,
  type ConfigLida,
  type CorEtiqueta,
  type CorrecaoMod,
  type ErroTela,
  type ItemInstalado,
  type Progresso,
  type VersoesDoMod
} from '../../../shared/tipos'
import { Editor } from '../arquivos/TelaArquivos'
import { MensagemErro } from '../componentes/MensagemErro'
import { campo as classeCampo } from '../componentes/estilos'
import { dataHora, tamanho } from '../componentes/formato'
import { BarraProgresso, Esqueleto } from '../componentes/movimento'
import { CardPainel } from '../componentes/paineis'
import {
  Aviso,
  Botao,
  Campo,
  Dialogo,
  EstadoVazio,
  Interruptor,
  LinhaControle,
  Selecao
} from '../componentes/ui'
import { IconeMods } from '../componentes/icones'
import { COR_ETIQUETA } from './etiquetas'
import { AbasDeTipo } from './partesExplorar'
import { IconeProjeto } from './TelaMods'

type Aba = 'geral' | 'config' | 'versoes'

// Painel lateral de um mod ou plugin (Fase 25): Visão geral · Configuração · Versões.
export function PainelMod({
  item,
  ligado,
  ocupado,
  aoFechar,
  aoMudar,
  aoCorrigir,
  aoRemover,
  aoAlternar,
  aoAbrirPagina
}: {
  item: ItemInstalado
  ligado: boolean
  ocupado: boolean
  aoFechar: () => void
  aoMudar: () => Promise<void>
  aoCorrigir: (c: CorrecaoMod) => void
  aoRemover: () => void
  aoAlternar: (ativo: boolean) => void
  aoAbrirPagina: (() => void) | null
}): React.JSX.Element {
  const [aba, setAba] = useState<Aba>('geral')

  useEffect(() => {
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) aoFechar()
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aoFechar])

  const arquivo = item.chave.slice('extras:'.length)

  return (
    <aside
      aria-label={`Mod ${item.titulo}`}
      className="anim-item fixed inset-y-0 right-0 z-30 flex w-[560px] max-w-full flex-col border-l-2 border-linha bg-panel shadow-2xl"
    >
      <header className="flex shrink-0 items-start gap-3 border-b border-linha p-4">
        <IconeProjeto url={item.icone} titulo={item.titulo} tam={48} />
        <div className="min-w-0 flex-1">
          <h2 className="texto-pixel truncate text-lg" title={item.titulo}>
            {item.titulo}
          </h2>
          <p className="truncate text-xs text-muted">
            {item.versao ?? 'Sem versão'} · {item.caminho ?? arquivo}
          </p>
        </div>
        <Botao tamanho="pequeno" onClick={aoFechar} aria-label="Fechar o painel">
          ×
        </Botao>
      </header>
      <div className="shrink-0 px-4 pt-2">
        <AbasDeTipo<Aba>
          rotulo="Partes do mod"
          abas={[
            { id: 'geral', nome: 'Visão geral' },
            { id: 'config', nome: 'Configuração' },
            { id: 'versoes', nome: 'Versões' }
          ]}
          ativa={aba}
          aoEscolher={setAba}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {aba === 'geral' && (
          <VisaoGeral
            item={item}
            ocupado={ocupado}
            aoMudar={aoMudar}
            aoCorrigir={aoCorrigir}
            aoRemover={aoRemover}
            aoAlternar={aoAlternar}
            aoAbrirPagina={aoAbrirPagina}
          />
        )}
        {aba === 'config' && <Configuracao arquivo={arquivo} ligado={ligado} />}
        {aba === 'versoes' && <Versoes item={item} arquivo={arquivo} aoMudar={aoMudar} />}
      </div>
    </aside>
  )
}

// ---------- Visão geral ----------

function VisaoGeral({
  item,
  ocupado,
  aoMudar,
  aoCorrigir,
  aoRemover,
  aoAlternar,
  aoAbrirPagina
}: {
  item: ItemInstalado
  ocupado: boolean
  aoMudar: () => Promise<void>
  aoCorrigir: (c: CorrecaoMod) => void
  aoRemover: () => void
  aoAlternar: (ativo: boolean) => void
  aoAbrirPagina: (() => void) | null
}): React.JSX.Element {
  const api = useApi()
  const [cor, setCor] = useState<CorEtiqueta | null>(item.cor)
  const [nota, setNota] = useState(item.nota)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const mudou = cor !== item.cor || nota !== item.nota

  async function salvar(): Promise<void> {
    setSalvando(true)
    setErro(null)
    const r = await api.mudarEtiquetaMod(item.idMod, cor, nota)
    setSalvando(false)
    if (!r.ok) return setErro(r.erro)
    await aoMudar()
  }

  return (
    <div className="flex flex-col gap-4">
      {item.problemas.length > 0 && (
        <CardPainel titulo={`Problemas (${item.problemas.length})`}>
          <ul className="flex flex-col gap-3">
            {item.problemas.map((p, i) => (
              <li
                key={i}
                className="flex flex-col gap-2 border-l-4 border-warning pl-3 text-[13px]"
              >
                <span>⚠ {p.texto}</span>
                {p.correcao && (
                  <Botao
                    tamanho="pequeno"
                    variante="atencao"
                    className="self-start"
                    disabled={ocupado}
                    onClick={() => aoCorrigir(p.correcao!)}
                  >
                    {p.correcao.rotulo}
                  </Botao>
                )}
              </li>
            ))}
          </ul>
        </CardPainel>
      )}

      <CardPainel titulo="Sobre">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
          <dt className="text-muted">Fonte</dt>
          <dd>{item.fonte === 'manual' ? 'Instalado manualmente' : item.fonte}</dd>
          <dt className="text-muted">Versão</dt>
          <dd>
            {item.versao ?? '—'}
            {item.travado && ' (travada)'}
          </dd>
          <dt className="text-muted">Tamanho</dt>
          <dd>{item.tamanho !== null ? tamanho(item.tamanho) : '—'}</dd>
          <dt className="text-muted">Instalado em</dt>
          <dd>{item.data ? dataHora(item.data) : '—'}</dd>
          {item.categorias.length > 0 && (
            <>
              <dt className="text-muted">Categorias</dt>
              <dd>{item.categorias.join(', ')}</dd>
            </>
          )}
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {item.pendente !== 'instalar' && (
            <span className="flex items-center gap-2 text-[13px]">
              <Interruptor
                ligado={item.ativo}
                rotulo={`${item.titulo}: ${item.ativo ? 'ativo' : 'desativado'}`}
                disabled={ocupado || item.removerAoDesligar}
                aoMudar={aoAlternar}
              />
              {item.ativo ? 'Ativo' : 'Desativado'}
            </span>
          )}
          {aoAbrirPagina && (
            <Botao tamanho="pequeno" onClick={aoAbrirPagina}>
              Página completa
            </Botao>
          )}
          {item.removivel && (
            <Botao
              tamanho="pequeno"
              variante="perigo"
              disabled={ocupado || item.removerAoDesligar}
              onClick={aoRemover}
            >
              {item.removerAoDesligar ? 'Será removido ao desligar' : 'Remover'}
            </Botao>
          )}
        </div>
      </CardPainel>

      <CardPainel titulo="Etiqueta e nota">
        <div
          className="flex flex-wrap items-center gap-2"
          role="radiogroup"
          aria-label="Cor da etiqueta"
        >
          <button
            type="button"
            role="radio"
            aria-checked={!cor}
            onClick={() => setCor(null)}
            className={`h-7 border-2 px-2 text-xs ${!cor ? 'border-accent' : 'border-linha'}`}
          >
            Sem cor
          </button>
          {CORES_ETIQUETA.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={cor === c}
              aria-label={COR_ETIQUETA[c].nome}
              title={COR_ETIQUETA[c].nome}
              onClick={() => setCor(c)}
              style={{ background: COR_ETIQUETA[c].hex }}
              className={`h-7 w-7 border-2 ${cor === c ? 'border-texto' : 'border-transparent'}`}
            />
          ))}
        </div>
        <textarea
          aria-label="Nota sobre o mod"
          placeholder="Uma nota para você (ex.: por que este mod está aqui)"
          maxLength={500}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          className={`${classeCampo} mt-3 h-20 resize-none py-2`}
        />
        <div className="mt-2 flex justify-end">
          <Botao
            tamanho="pequeno"
            variante="primario"
            disabled={!mudou || salvando}
            onClick={salvar}
          >
            {salvando ? 'Salvando...' : 'Salvar etiqueta'}
          </Botao>
        </div>
        {erro && <MensagemErro erro={erro} />}
      </CardPainel>
    </div>
  )
}

// ---------- Configuração ----------

function Configuracao({
  arquivo,
  ligado
}: {
  arquivo: string
  ligado: boolean
}): React.JSX.Element {
  const api = useApi()
  const [arquivos, setArquivos] = useState<string[] | null>(null)
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [config, setConfig] = useState<ConfigLida | null>(null)
  const [mudancas, setMudancas] = useState<Record<string, CampoConfig['valor']>>({})
  const [texto, setTexto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    api.configsDoMod(arquivo).then((r) => {
      if (!r.ok) return setErro(r.erro)
      setArquivos(r.valor)
      setEscolhido(r.valor[0] ?? null)
    })
  }, [api, arquivo])

  const abrir = useCallback(
    async (caminho: string): Promise<void> => {
      setConfig(null)
      setMudancas({})
      setErro(null)
      const r = await api.lerConfigMod(caminho)
      if (r.ok) setConfig(r.valor)
      else setErro(r.erro)
    },
    [api]
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abre o arquivo escolhido
    if (escolhido && !texto) void abrir(escolhido)
  }, [escolhido, texto, abrir])

  async function salvar(): Promise<void> {
    if (!config) return
    setSalvando(true)
    setErro(null)
    setAviso(null)
    const r = await api.salvarConfigMod(config.caminho, config.hash, mudancas)
    setSalvando(false)
    if (!r.ok) return setErro(r.erro)
    setAviso(
      r.valor
        ? 'Salvo. Reinicie o servidor para o mod ler a mudança. Se o mod regravar o arquivo ao desligar e a mudança sumir, salve de novo com o servidor desligado.'
        : 'Salvo. Vale na próxima vez que o servidor ligar.'
    )
    await abrir(config.caminho)
  }

  async function restaurar(): Promise<void> {
    if (!escolhido) return
    const r = await api.restaurarConfigMod(escolhido)
    setRestaurando(false)
    if (!r.ok) return setErro(r.erro)
    setAviso(
      `Arquivo apagado (a cópia ficou nos backups). O mod cria um novo, com os valores padrão, ${r.valor ? 'quando o servidor reiniciar' : 'na próxima vez que o servidor ligar'}.`
    )
    const lista = (arquivos ?? []).filter((a) => a !== escolhido)
    setArquivos(lista)
    setEscolhido(lista[0] ?? null)
    setConfig(null)
  }

  if (!arquivos) return erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={4} />
  if (!arquivos.length) {
    return (
      <EstadoVazio
        icone={<IconeMods />}
        titulo="Nenhum arquivo de configuração"
        texto="Não achei arquivos deste mod em config, defaultconfigs, plugins ou serverconfig. Muitos mods só criam o arquivo depois de o servidor ligar uma vez."
      />
    )
  }

  const editaveis = config?.campos.filter((c) => c.tipo !== 'leitura').length ?? 0
  const secoes = config ? [...new Set(config.campos.map((c) => c.secao ?? ''))] : []
  const alterado = Object.keys(mudancas).length > 0

  return (
    <div className="flex flex-col gap-4">
      {ligado && (
        <Aviso tipo="atencao">
          O servidor está ligado: o que você salvar aqui só vale depois de reiniciar.
        </Aviso>
      )}
      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {erro && <MensagemErro erro={erro} />}

      <div className="flex flex-wrap items-center gap-2">
        <Selecao
          aria-label="Arquivo de configuração"
          value={escolhido ?? ''}
          onChange={(e) => {
            setEscolhido(e.target.value)
            setTexto(false)
            setAviso(null)
          }}
          className="min-w-0 flex-1"
        >
          {arquivos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Selecao>
        <Botao tamanho="pequeno" onClick={() => setTexto(!texto)}>
          {texto ? 'Ver como formulário' : 'Editar como texto'}
        </Botao>
        <Botao tamanho="pequeno" variante="perigo" onClick={() => setRestaurando(true)}>
          Restaurar padrão
        </Botao>
      </div>

      {texto && escolhido ? (
        <Editor
          caminho={escolhido}
          aoFechar={() => setTexto(false)}
          aoSalvar={(reiniciar) => {
            setAviso(reiniciar ? 'Salvo. Reinicie o servidor para o mod ler a mudança.' : 'Salvo.')
            setTexto(false)
          }}
        />
      ) : !config ? (
        !erro && <Esqueleto linhas={6} />
      ) : !config.campos.length ? (
        <p className="text-[13px] text-muted">
          Não consegui montar um formulário para este arquivo. Use &quot;Editar como texto&quot;.
        </p>
      ) : (
        <>
          {editaveis < config.campos.length && (
            <p className="text-xs text-muted">
              Algumas opções só dá para mudar pelo &quot;Editar como texto&quot; (aparecem em
              cinza).
            </p>
          )}
          {secoes.map((s) => (
            <section key={s} className="flex flex-col gap-3">
              {s && (
                <h3 className="text-xs font-bold tracking-[.02em] text-muted uppercase">{s}</h3>
              )}
              {config.campos
                .filter((c) => (c.secao ?? '') === s)
                .map((c) => (
                  <CampoDoForm
                    key={c.id}
                    campo={c}
                    valor={c.id in mudancas ? mudancas[c.id] : c.valor}
                    aoMudar={(v) =>
                      setMudancas((m) => {
                        const novo = { ...m }
                        if (JSON.stringify(v) === JSON.stringify(c.valor)) delete novo[c.id]
                        else novo[c.id] = v
                        return novo
                      })
                    }
                  />
                ))}
            </section>
          ))}
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-linha bg-panel py-3">
            <Botao disabled={!alterado || salvando} onClick={() => setMudancas({})}>
              Desfazer
            </Botao>
            <Botao variante="primario" disabled={!alterado || salvando} onClick={salvar}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Botao>
          </div>
        </>
      )}

      <Dialogo
        aberto={restaurando}
        titulo="Restaurar o padrão deste arquivo?"
        aoCancelar={() => setRestaurando(false)}
        acao={{ rotulo: 'Restaurar padrão', variante: 'perigo', aoClicar: restaurar }}
      >
        <p>
          Antes, uma cópia de <b>{escolhido}</b> vai para os backups do servidor (pasta configs).
          Depois o arquivo é apagado, e o mod cria um novo com os valores padrão na próxima vez que
          o servidor ligar.
          {ligado && ' Com o servidor ligado, isso só acontece depois de reiniciar.'}
        </p>
      </Dialogo>
    </div>
  )
}

function CampoDoForm({
  campo: c,
  valor,
  aoMudar
}: {
  campo: CampoConfig
  valor: CampoConfig['valor']
  aoMudar: (v: CampoConfig['valor']) => void
}): React.JSX.Element {
  const descricao = c.descricao && (
    <p className="text-xs whitespace-pre-line text-muted">{c.descricao}</p>
  )
  if (c.tipo === 'bool') {
    return (
      <LinhaControle rotulo={c.nome} ligado={valor === true} aoMudar={(v) => aoMudar(v)}>
        {c.descricao && <span className="whitespace-pre-line">{c.descricao}</span>}
      </LinhaControle>
    )
  }
  return (
    <label className="flex flex-col gap-1 text-[13px]">
      <span className={`font-bold ${c.tipo === 'leitura' ? 'text-muted' : ''}`}>{c.nome}</span>
      {descricao}
      {c.tipo === 'lista' ? (
        <textarea
          value={(valor as string[]).join('\n')}
          onChange={(e) => aoMudar(e.target.value.split('\n').filter((x) => x.trim() !== ''))}
          className={`${classeCampo} h-24 resize-y py-2 font-mono`}
          aria-describedby={undefined}
          placeholder="Um item por linha"
        />
      ) : c.tipo === 'leitura' ? (
        <span className="font-mono text-xs break-all text-muted">
          {String(valor).slice(0, 120) || '(valor de várias linhas)'}
        </span>
      ) : (
        <Campo
          value={String(valor)}
          inputMode={c.tipo === 'numero' ? 'decimal' : undefined}
          onChange={(e) => aoMudar(e.target.value)}
          className="font-mono"
        />
      )}
    </label>
  )
}

// ---------- Versões ----------

function Versoes({
  item,
  arquivo,
  aoMudar
}: {
  item: ItemInstalado
  arquivo: string
  aoMudar: () => Promise<void>
}): React.JSX.Element {
  const api = useApi()
  const [dados, setDados] = useState<VersoesDoMod | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => api.aoProgredir(setProgresso), [api])

  const carregar = useCallback(async (): Promise<void> => {
    const r = await api.versoesDoMod(arquivo)
    if (r.ok) setDados(r.valor)
    else setErro(r.erro)
  }, [api, arquivo])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura
    void carregar()
  }, [carregar])

  async function rodar(
    nome: string,
    acao: () => Promise<{ ok: boolean; erro?: ErroTela }>,
    depois: string
  ): Promise<void> {
    setOcupado(nome)
    setErro(null)
    setAviso(null)
    const r = await acao()
    setOcupado(null)
    setProgresso(null)
    if (!r.ok && r.erro) return setErro(r.erro)
    setAviso(depois)
    await aoMudar()
  }

  if (!dados) return erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={5} />

  const reiniciar = ' Com o servidor ligado, a troca acontece quando ele desligar.'
  return (
    <div className="flex flex-col gap-4">
      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {erro && <MensagemErro erro={erro} />}
      <LinhaControle
        rotulo="Travar versão"
        ligado={dados.travado}
        aoMudar={async (v) => {
          const r = await api.travarVersaoMod(dados.idMod, v)
          if (!r.ok) return setErro(r.erro)
          await Promise.all([carregar(), aoMudar()])
        }}
      >
        Travada, ela não aparece em Atualizações.
      </LinhaControle>
      {dados.anterior && (
        <div className="flex flex-wrap items-center gap-3 border-l-4 border-accent bg-panel-2 px-3 py-2 text-[13px]">
          <span className="flex-1">
            Versão anterior guardada: <b>{dados.anterior}</b>
          </span>
          <Botao
            tamanho="pequeno"
            disabled={!!ocupado}
            onClick={() =>
              rodar(
                'voltar',
                () => api.voltarVersaoMod(arquivo),
                `Pronto: voltou para ${dados.anterior}. A versão ficou travada para não atualizar sozinha.${reiniciar}`
              )
            }
          >
            {ocupado === 'voltar' ? 'Voltando...' : 'Voltar para a versão anterior'}
          </Botao>
        </div>
      )}
      {ocupado && progresso && (
        <BarraProgresso
          rotulo={progresso.etapa}
          valor={progresso.recebido}
          maximo={progresso.total}
        />
      )}
      {!dados.versoes.length ? (
        <p className="text-[13px] text-muted">
          {item.fonte === 'manual'
            ? 'Este mod foi instalado à mão: o app não sabe de onde vêm as outras versões.'
            : 'Não achei versões deste mod compatíveis com o servidor.'}
        </p>
      ) : (
        <CardPainel titulo={`Versões compatíveis (${dados.versoes.length})`}>
          <ul className="flex flex-col divide-y divide-linha">
            {dados.versoes.map((v) => (
              <li key={v.id} className="flex items-center gap-3 py-2 text-[13px]">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold" title={v.nome}>
                    {v.nome}
                  </p>
                  <p className="text-xs text-muted">
                    {dataHora(v.data)} ·{' '}
                    {v.tipo === 'release' ? 'Estável' : v.tipo === 'beta' ? 'Beta' : 'Alfa'}
                  </p>
                </div>
                {v.atual ? (
                  <span className="bg-accent px-1.5 py-0.5 text-xs text-accent-text">
                    Instalada
                  </span>
                ) : (
                  <Botao
                    tamanho="pequeno"
                    disabled={!!ocupado}
                    onClick={() =>
                      rodar(
                        v.id,
                        () => api.trocarVersaoMod(arquivo, v.id),
                        `Trocado para ${v.nome}. A versão de antes ficou guardada para voltar.${reiniciar}`
                      )
                    }
                  >
                    {ocupado === v.id ? 'Trocando...' : 'Usar esta versão'}
                  </Botao>
                )}
              </li>
            ))}
          </ul>
        </CardPainel>
      )}
    </div>
  )
}
