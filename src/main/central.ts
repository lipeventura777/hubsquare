import { app } from 'electron'
import { randomUUID } from 'crypto'
import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import {
  CORES_ETIQUETA,
  EXTRAS_TIPOS,
  ICONES_ATALHO,
  type Atalho,
  type CorEtiqueta,
  type DadosCentral,
  type HistoricoConsole,
  type IconeAtalho,
  type InfoServidor,
  type ItemCentral,
  type RespostaComando
} from '../shared/tipos'
import {
  acaoDestrutiva,
  capacidades,
  compilarModelos,
  comandoDeAtalho,
  comandoDestrutivo,
  expandirAtalho,
  montarComandos,
  textoDaLinha,
  traduzirResposta,
  type Modelo
} from '../shared/comandos'
import { gravarComSeguranca } from './config'
import { dadosComandos, type DadosComandos } from './dadosComandos'
import { ErroApp } from './erros'
import { tar } from './importarZip'
import { estadoIcones, recursosDaVersao } from './itensDoJogo'
import { enviarDoApp, eventos, lerEstado } from './servidor'

// Central de comandos (Fase 26): monta o comando a partir da ação (validada no módulo
// compartilhado), manda pelo console e mostra a resposta do servidor em português.
// Tudo só com o servidor ligado. Os comandos aparecem no console, como os digitados.

const erroApp = <T>(f: () => T): T => {
  try {
    return f()
  } catch (e) {
    throw e instanceof ErroApp ? e : new ErroApp(e instanceof Error ? e.message : String(e))
  }
}

// ---------- Dados da versão ----------

const modelos = new Map<string, Modelo[]>()

async function dados(info: InfoServidor): Promise<DadosComandos & { modelos: Modelo[] }> {
  const d = await dadosComandos(info.versao)
  if (!modelos.has(info.versao)) modelos.set(info.versao, compilarModelos(d.en))
  return { ...d, modelos: modelos.get(info.versao)! }
}

const nomeDe = (pt: Record<string, string>, id: string, tipos: string[]): string => {
  const [ns, caminho] = id.split(':')
  for (const t of tipos) {
    const n = pt[`${t}.${ns}.${caminho.replace(/\//g, '.')}`]
    if (n) return n
  }
  return caminho.replace(/_/g, ' ')
}

// Itens e efeitos dos mods ativos, pelos arquivos de idioma de dentro de cada .jar
// (pt_br quando o mod tem, senão en_us). Fica na memória enquanto o .jar não mudar.
const doJar = new Map<string, { itens: ItemCentral[]; efeitos: ItemCentral[] }>()

async function itensDosMods(
  info: InfoServidor
): Promise<{ itens: ItemCentral[]; efeitos: ItemCentral[] }> {
  if (EXTRAS_TIPOS[info.tipo] !== 'mods') return { itens: [], efeitos: [] }
  const pasta = join(info.pasta, 'mods')
  const jars = (await readdir(pasta).catch(() => [] as string[])).filter((n) => /\.jar$/i.test(n))
  const itens: ItemCentral[] = []
  const efeitos: ItemCentral[] = []
  for (const jar of jars) {
    const caminho = join(pasta, jar)
    const s = await stat(caminho).catch(() => null)
    if (!s) continue
    const chave = `${caminho}|${s.size}|${s.mtimeMs}`
    let r = doJar.get(chave)
    if (!r) {
      r = { itens: [], efeitos: [] }
      try {
        const langs = (await tar(['-tf', caminho]))
          .split(/\r?\n/)
          .filter((e) => /^assets\/[a-z0-9_.-]+\/lang\/(pt_br|en_us)\.json$/.test(e))
        // pt_br vence o en_us do mesmo mod.
        const porNs = new Map<string, string>()
        for (const l of langs.sort()) porNs.set(l.split('/')[1], l)
        for (const l of porNs.values()) {
          const textos = JSON.parse(await tar(['-xOf', caminho, l])) as Record<string, string>
          for (const [k, nome] of Object.entries(textos)) {
            const m = k.match(/^(item|block|effect)\.([a-z0-9_.-]+)\.([a-z0-9_]+)$/)
            if (!m || m[2] === 'minecraft' || typeof nome !== 'string') continue
            const alvo = m[1] === 'effect' ? r.efeitos : r.itens
            alvo.push({ id: `${m[2]}:${m[3]}`, nome, mod: true })
          }
        }
      } catch {
        // .jar sem idioma legível: seus itens só não aparecem na busca
      }
      doJar.set(chave, r)
    }
    itens.push(...r.itens)
    efeitos.push(...r.efeitos)
  }
  const unicos = (l: ItemCentral[]): ItemCentral[] => [...new Map(l.map((i) => [i.id, i])).values()]
  return { itens: unicos(itens), efeitos: unicos(efeitos) }
}

export async function dadosCentral(info: InfoServidor): Promise<DadosCentral> {
  const d = await dados(info)
  const mods = await itensDosMods(info)
  return {
    capacidades: capacidades(d.arvore),
    arvore: d.arvore,
    itens: [
      ...d.itens.map((id) => ({ id, nome: nomeDe(d.pt, id, ['item', 'block']), mod: false })),
      ...mods.itens
    ],
    efeitos: [
      ...d.efeitos.map((id) => ({ id, nome: nomeDe(d.pt, id, ['effect']), mod: false })),
      ...mods.efeitos
    ],
    iconesBaixados: (await estadoIcones(info)).baixados
  }
}

// Ícones dos itens (cache da Fase 13), só dos que a tela está mostrando.
export async function iconesDosItens(
  info: InfoServidor,
  ids: unknown
): Promise<Record<string, string | null>> {
  const lista = Array.isArray(ids)
    ? ids.filter((i): i is string => typeof i === 'string').slice(0, 200)
    : []
  const r = await recursosDaVersao(info.versao)
  return Object.fromEntries(
    lista.map((id) => [id, id.startsWith('minecraft:') ? r.iconeItem(id.slice(10)) : null])
  )
}

// ---------- Executar com resposta ----------

let fila: Promise<unknown> = Promise.resolve()

function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const r = fila.then(tarefa)
  fila = r.catch(() => {})
  return r
}

const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// Manda cada comando e junta as respostas que o console dá logo depois.
async function rodar(
  info: InfoServidor,
  comandos: string[],
  intervaloMs = 0
): Promise<RespostaComando[]> {
  const d = await dados(info)
  return emFila(async () => {
    const saida: RespostaComando[] = []
    for (const [n, comando] of comandos.entries()) {
      if (lerEstado() !== 'ligado') throw new ErroApp('Ligue o servidor para usar comandos.')
      const linhas: { t: string; quando: number }[] = []
      const ouvir = (t: string): void => {
        linhas.push({ t, quando: Date.now() })
      }
      eventos.on('linha', ouvir)
      try {
        enviarDoApp(comando)
        const inicio = Date.now()
        // Até 1,5 s; para antes se já veio uma resposta conhecida e o console sossegou.
        for (;;) {
          await esperar(100)
          const agora = Date.now()
          const conhecida = linhas.some((l) => traduzirResposta(l.t, d.modelos, d.pt))
          const ultima = linhas.at(-1)?.quando ?? inicio
          if (agora - inicio > 1500 || (conhecida && agora - ultima > 250)) break
        }
      } finally {
        eventos.off('linha', ouvir)
      }
      const traduzidas = linhas.flatMap((l) => traduzirResposta(l.t, d.modelos, d.pt) ?? [])
      saida.push({
        comando,
        ok: traduzidas.length ? traduzidas.every((t) => t.ok) : null,
        texto: traduzidas.length
          ? [...new Set(traduzidas.map((t) => t.texto))].join(' ')
          : 'Comando enviado. O servidor não respondeu nada que o app reconheça; confira no Console.'
      })
      if (intervaloMs && n < comandos.length - 1) await esperar(intervaloMs)
    }
    return saida
  })
}

async function contexto(info: InfoServidor): Promise<Parameters<typeof montarComandos>[1]> {
  const d = await dados(info)
  const mods = await itensDosMods(info)
  return {
    arvore: d.arvore,
    itens: new Set([...d.itens, ...mods.itens.map((i) => i.id)]),
    efeitos: new Set([...d.efeitos, ...mods.efeitos.map((e) => e.id)])
  }
}

// A tela manda a ação (não o texto do comando); o comando é montado e validado aqui.
export async function executarAcao(
  info: InfoServidor,
  acao: unknown,
  confirmado: unknown
): Promise<RespostaComando[]> {
  const ctx = await contexto(info)
  const comandos = erroApp(() => montarComandos(acao, ctx))
  if (acaoDestrutiva(acao as never) && confirmado !== true) {
    throw new ErroApp('Essa ação precisa de confirmação.')
  }
  return rodar(info, comandos)
}

// Valor atual de cada regra do jogo, perguntando ao servidor ("gamerule <nome>").
export async function lerGamerules(info: InfoServidor): Promise<Record<string, string>> {
  const d = await dados(info)
  const regras = capacidades(d.arvore).gamerules
  const modelo = d.modelos.find((m) => m.chave === 'commands.gamerule.query')
  if (!modelo) throw new ErroApp('Não sei ler as regras nesta versão. Use o Console.')
  return emFila(async () => {
    if (lerEstado() !== 'ligado') throw new ErroApp('Ligue o servidor para ler as regras.')
    const valores: Record<string, string> = {}
    const nomes = new Set(regras.map((r) => r.nome))
    // "Game rule keep_inventory is currently set to false" (o texto exato vem da versão).
    const ouvir = (t: string): void => {
      const m = textoDaLinha(t).match(modelo.re)
      const nome = m?.[1].replace(/^minecraft:/, '')
      if (m && nome && nomes.has(nome)) valores[nome] = m[2]
    }
    eventos.on('linha', ouvir)
    try {
      for (const r of regras) enviarDoApp(`gamerule ${r.nome}`)
      const inicio = Date.now()
      while (Object.keys(valores).length < regras.length && Date.now() - inicio < 5000)
        await esperar(100)
    } finally {
      eventos.off('linha', ouvir)
    }
    return valores
  })
}

// ---------- Atalhos ----------

const arquivoAtalhos = (): string => join(app.getPath('userData'), 'atalhos.json')

// Os 4 botões que o Painel tinha antes (Fase 6) viram atalhos com estrela.
const PADRAO: Atalho[] = [
  {
    id: 'dia',
    nome: 'Dia',
    icone: 'mundo',
    cor: 'amarelo',
    comandos: ['time set 1000'],
    intervalo: 0,
    estrela: true
  },
  {
    id: 'noite',
    nome: 'Noite',
    icone: 'mundo',
    cor: 'azul',
    comandos: ['time set 13000'],
    intervalo: 0,
    estrela: true
  },
  {
    id: 'limpo',
    nome: 'Tempo limpo',
    icone: 'automacao',
    cor: 'amarelo',
    comandos: ['weather clear'],
    intervalo: 0,
    estrela: true
  },
  {
    id: 'chuva',
    nome: 'Chuva',
    icone: 'automacao',
    cor: 'azul',
    comandos: ['weather rain'],
    intervalo: 0,
    estrela: true
  }
]

function validarAtalho(v: unknown): Atalho {
  const a = (v ?? {}) as Record<string, unknown>
  const nome = typeof a.nome === 'string' ? a.nome.trim() : ''
  if (!nome || nome.length > 24) throw new ErroApp('Dê um nome de até 24 letras ao atalho.')
  const comandos = Array.isArray(a.comandos) ? a.comandos : []
  if (!comandos.length || comandos.length > 20)
    throw new ErroApp('Use de 1 a 20 comandos no atalho.')
  const intervalo = Number(a.intervalo ?? 0)
  if (!Number.isFinite(intervalo) || intervalo < 0 || intervalo > 60) {
    throw new ErroApp('O intervalo entre os comandos vai de 0 a 60 segundos.')
  }
  return {
    id: typeof a.id === 'string' && /^[\w-]{1,40}$/.test(a.id) ? a.id : randomUUID(),
    nome,
    icone: ICONES_ATALHO.includes(a.icone as IconeAtalho) ? (a.icone as IconeAtalho) : 'console',
    cor: CORES_ETIQUETA.includes(a.cor as CorEtiqueta) ? (a.cor as CorEtiqueta) : 'cinza',
    comandos: comandos.map((c) => erroApp(() => comandoDeAtalho(c))),
    intervalo: Math.round(intervalo * 10) / 10,
    estrela: a.estrela === true
  }
}

export async function listarAtalhos(): Promise<Atalho[]> {
  try {
    const d = JSON.parse(await readFile(arquivoAtalhos(), 'utf8'))
    return Array.isArray(d)
      ? d.flatMap((a) => (a && typeof a === 'object' ? [a as Atalho] : []))
      : PADRAO
  } catch {
    return PADRAO
  }
}

export async function salvarAtalho(v: unknown): Promise<Atalho[]> {
  const novo = validarAtalho(v)
  const lista = await listarAtalhos()
  const i = lista.findIndex((a) => a.id === novo.id)
  if (i >= 0) lista[i] = novo
  else if (lista.length >= 60)
    throw new ErroApp('Já são 60 atalhos. Apague algum para criar outro.')
  else lista.push(novo)
  await gravarComSeguranca(arquivoAtalhos(), JSON.stringify(lista, null, 2))
  return lista
}

export async function apagarAtalho(id: unknown): Promise<Atalho[]> {
  const lista = (await listarAtalhos()).filter((a) => a.id !== id)
  await gravarComSeguranca(arquivoAtalhos(), JSON.stringify(lista, null, 2))
  return lista
}

// Nunca com o servidor desligado; com kill/clear/ban..., só depois de confirmar na tela.
export async function executarAtalho(
  info: InfoServidor,
  id: unknown,
  jogador: unknown,
  confirmado: unknown
): Promise<RespostaComando[]> {
  if (lerEstado() !== 'ligado') throw new ErroApp('Ligue o servidor para usar atalhos.')
  const atalho = (await listarAtalhos()).find((a) => a.id === id)
  if (!atalho) throw new ErroApp('Esse atalho não existe mais.')
  const comandos = erroApp(() =>
    expandirAtalho(
      atalho.comandos.map((c) => comandoDeAtalho(c)),
      typeof jogador === 'string' && jogador ? jogador : null
    )
  )
  if (comandos.some(comandoDestrutivo) && confirmado !== true) {
    throw new ErroApp('Esse atalho apaga coisas ou tira jogadores: confirme antes.')
  }
  return rodar(info, comandos, atalho.intervalo * 1000)
}

// ---------- Histórico e favoritos do console ----------

const arquivoConsole = (): string => join(app.getPath('userData'), 'console.json')

export async function lerHistoricoConsole(): Promise<HistoricoConsole> {
  try {
    const d = JSON.parse(await readFile(arquivoConsole(), 'utf8'))
    const lista = (x: unknown): string[] =>
      Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []
    return { historico: lista(d.historico), favoritos: lista(d.favoritos) }
  } catch {
    return { historico: [], favoritos: [] }
  }
}

const linhaDeComando = (v: unknown): string => {
  const c =
    typeof v === 'string'
      ? v
          .replace(/[\r\n]/g, ' ')
          .trim()
          .slice(0, 1000)
      : ''
  if (!c) throw new ErroApp('Comando vazio.')
  return c
}

let filaConsole: Promise<unknown> = Promise.resolve()

function mudarConsole(f: (h: HistoricoConsole) => void): Promise<HistoricoConsole> {
  const r = filaConsole.then(async () => {
    const h = await lerHistoricoConsole()
    f(h)
    await gravarComSeguranca(arquivoConsole(), JSON.stringify(h))
    return h
  })
  filaConsole = r.catch(() => {})
  return r
}

export function adicionarAoHistorico(v: unknown): Promise<HistoricoConsole> {
  const c = linhaDeComando(v)
  return mudarConsole((h) => {
    h.historico = [...h.historico.filter((x) => x !== c), c].slice(-300)
  })
}

export function mudarFavorito(v: unknown, favorito: unknown): Promise<HistoricoConsole> {
  const c = linhaDeComando(v)
  return mudarConsole((h) => {
    h.favoritos = h.favoritos.filter((x) => x !== c)
    if (favorito === true) h.favoritos = [...h.favoritos, c].slice(-50)
  })
}
