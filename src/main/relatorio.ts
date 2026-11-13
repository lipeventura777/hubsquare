import { app, shell } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, open, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { freemem, homedir, release, tmpdir, totalmem, version } from 'os'
import { dirname, join } from 'path'
import { textoParaCopiar, type LinhaDiagnostico } from '../shared/diagnosticoRegras'
import type { OpcoesRelatorio, RelatorioGerado } from '../shared/tipos'
import { tar } from './backup'
import { lerChave } from './chaveCurseForge'
import { lerTexto } from './config'
import { ErroApp, detalhar } from './erros'
import { sha1 } from './mods'
import { limparPropriedades } from './passarRegras'
import {
  fimDoTexto,
  itensEscolhidos,
  ITENS_RELATORIO,
  leiaMe,
  limparObjeto,
  limparTexto,
  nomeDoRelatorio,
  sobrouSegredo,
  ultimaEntrada,
  type Limpeza
} from './relatorioRegras'
import { lerIndice, lerInfo } from './servidores'

// Relatório de erro (Fase M8): um .zip na Área de Trabalho com o que é preciso para entender um
// problema (logs, travamentos, sistema, configurações, lista de mods, versão do convite e o último
// diagnóstico), tudo passado pela limpeza de relatorioRegras.ts. Nunca leva mundos, arquivos de
// mods nem segredos, e nunca é enviado: só fica neste PC.

const LIMITE_LOG = 2 * 1024 * 1024
const LIMITE_TRAVAMENTO = 1024 * 1024
const TRAVAMENTOS = 3

const dados = (): string => app.getPath('userData')

// ---------- Último diagnóstico (Fase M5), só em memória ----------

let ultimoDiagnostico: { em: string; texto: string } | null = null

export function lembrarDiagnostico(titulo: string, linhas: LinhaDiagnostico[]): void {
  ultimoDiagnostico = { em: new Date().toISOString(), texto: textoParaCopiar(titulo, linhas) }
}

// ---------- O que existe no PC ----------

interface InstalacaoSalva {
  id: string
  nome: string
  pasta: string
  ultimoUso?: string | null
  origem?: { tipo?: string; token?: string }
}

async function lerJson(caminho: string): Promise<unknown> {
  const texto = await lerTexto(caminho).catch(() => '')
  if (!texto) return null
  try {
    return JSON.parse(texto)
  } catch {
    return null
  }
}

async function instalacoes(): Promise<InstalacaoSalva[]> {
  const d = (await lerJson(join(dados(), 'instalacoes.json'))) as { instalacoes?: unknown } | null
  return Array.isArray(d?.instalacoes) ? (d.instalacoes as InstalacaoSalva[]) : []
}

async function servidores(): Promise<{ id: string; nome: string; pasta: string }[]> {
  return (await lerIndice()).servidores.map((s) => ({ id: s.id, nome: s.nome, pasta: s.pasta }))
}

// Todos os valores de texto de um JSON (para os arquivos que são só segredo).
function textosDe(v: unknown): string[] {
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(textosDe)
  if (v && typeof v === 'object') return Object.values(v).flatMap(textosDe)
  return []
}

// Os segredos que existem neste PC: tokens dos convites, PIN e sessões do celular, chave do
// CurseForge, segredo do playit. Eles são trocados onde quer que apareçam.
async function segredosDoPc(): Promise<string[]> {
  const lista: string[] = []
  lista.push(...textosDe(await lerJson(join(dados(), 'celular.json'))))
  lista.push(...textosDe(await lerJson(join(dados(), 'curseforge.json'))))
  lista.push((await lerChave().catch(() => null)) ?? '')
  lista.push((await lerTexto(join(dados(), 'playit', 'chave-secreta')).catch(() => '')).trim())
  for (const s of await servidores()) {
    const c = (await lerJson(join(s.pasta, 'servsquare-convite.json'))) as {
      token?: unknown
    } | null
    if (typeof c?.token === 'string') lista.push(c.token)
  }
  for (const i of await instalacoes()) if (i.origem?.token) lista.push(i.origem.token)
  // Os do celular incluem números e palavras curtas: só valem os que parecem segredo.
  return lista.filter((x) => typeof x === 'string' && x.length >= 6)
}

export async function opcoesRelatorio(): Promise<OpcoesRelatorio> {
  const indice = await lerIndice()
  const lista = await instalacoes()
  const recente = [...lista].sort((a, b) => (b.ultimoUso ?? '').localeCompare(a.ultimoUso ?? ''))[0]
  return {
    servidores: indice.servidores.map((s) => ({ id: s.id, nome: s.nome })),
    instalacoes: lista.map((i) => ({ id: i.id, nome: i.nome })),
    servidorPadrao: indice.ativo,
    instalacaoPadrao: recente?.id ?? null,
    itens: ITENS_RELATORIO.map((i) => ({ ...i }))
  }
}

// ---------- Montagem ----------

async function fimDe(caminho: string, limite: number): Promise<string | null> {
  if (!existsSync(caminho)) return null
  const tamanho = (await stat(caminho)).size
  if (tamanho <= limite) return readFile(caminho, 'utf8')
  // Arquivo grande: lê só o final (o log inteiro pode ter centenas de MB).
  const f = await open(caminho, 'r')
  try {
    const buf = Buffer.alloc(limite)
    await f.read(buf, 0, limite, tamanho - limite)
    return fimDoTexto(`\n${buf.toString('utf8')}`, limite)
  } finally {
    await f.close()
  }
}

async function travamentosDe(pasta: string): Promise<{ nome: string; caminho: string }[]> {
  const dir = join(pasta, 'crash-reports')
  const nomes = (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith('.txt'))
  const com = await Promise.all(
    nomes.map(async (nome) => ({
      nome,
      caminho: join(dir, nome),
      t: (await stat(join(dir, nome))).mtimeMs
    }))
  )
  return com.sort((a, b) => b.t - a.t).slice(0, TRAVAMENTOS)
}

// Nome, versão e hash de cada mod/plugin (os arquivos nunca vão).
async function modsDe(
  pasta: string
): Promise<{ arquivo: string; versao: string | null; sha1: string }[]> {
  const registro = (await lerJson(join(pasta, 'servsquare-mods.json'))) as {
    itens?: { arquivo: string; versao?: string; titulo?: string }[]
  } | null
  const lista: { arquivo: string; versao: string | null; sha1: string }[] = []
  for (const sub of ['mods', 'plugins']) {
    const dir = join(pasta, sub)
    for (const n of await readdir(dir).catch(() => [] as string[])) {
      if (!/\.jar(\.disabled)?$/i.test(n)) continue
      const r = registro?.itens?.find((x) => x.arquivo === n.replace(/\.disabled$/, ''))
      lista.push({
        arquivo: `${sub}/${n}`,
        versao: r ? `${r.titulo ?? ''} ${r.versao ?? ''}`.trim() : null,
        sha1: await sha1(join(dir, n)).catch(() => '')
      })
    }
  }
  return lista
}

async function versaoDoManifesto(caminho: string): Promise<number | null> {
  const m = (await lerJson(caminho)) as { versao?: unknown } | null
  return typeof m?.versao === 'number' ? m.versao : null
}

const javasInstalados = async (): Promise<string[]> =>
  (await readdir(join(dados(), 'java'), { withFileTypes: true }).catch(() => []))
    .filter((d) => d.isDirectory())
    .map((d) => `Java ${d.name}`)

export async function gerarRelatorio(pedido: unknown): Promise<RelatorioGerado> {
  const { servidorId, instalacaoId, tirar } = (pedido ?? {}) as Record<string, unknown>
  const itens = itensEscolhidos(tirar)
  const servidor = (await servidores()).find((s) => s.id === servidorId) ?? null
  const instalacao = (await instalacoes()).find((i) => i.id === instalacaoId) ?? null
  const limpeza: Limpeza = {
    casas: [...new Set([homedir(), process.env.USERPROFILE ?? ''].filter(Boolean))],
    segredos: await segredosDoPc()
  }
  const limpar = (t: string): string => limparTexto(t, limpeza)
  const arquivos: Record<string, string> = {} // nome no zip → conteúdo já limpo
  const log = async (nome: string, caminho: string, limite = LIMITE_LOG): Promise<void> => {
    const t = await fimDe(caminho, limite).catch(() => null)
    if (t !== null) arquivos[nome] = limpar(t)
  }

  if (itens.includes('erros')) await log('erros.log', join(dados(), 'logs', 'erros.log'))
  if (servidor && itens.includes('servidor')) {
    await log('servidor/latest.log', join(servidor.pasta, 'logs', 'latest.log'))
    await log('servidor/servsquare-acoes.log', join(servidor.pasta, 'servsquare-acoes.log'))
  }
  if (instalacao && itens.includes('jogo')) {
    await log('jogo/latest.log', join(instalacao.pasta, 'logs', 'latest.log'))
  }
  if (itens.includes('travamentos')) {
    for (const [lado, pasta] of [
      ['servidor', servidor?.pasta],
      ['jogo', instalacao?.pasta]
    ] as const) {
      if (!pasta) continue
      for (const t of await travamentosDe(pasta))
        await log(`travamentos/${lado}-${t.nome}`, t.caminho, LIMITE_TRAVAMENTO)
    }
  }
  if (itens.includes('sistema')) {
    const sistema = {
      app: app.getVersion(),
      electron: process.versions.electron,
      windows: `${version()} (${release()})`,
      arquitetura: process.arch,
      memoriaTotalGb: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
      memoriaLivreGb: Math.round((freemem() / 1024 ** 3) * 10) / 10,
      javas: await javasInstalados()
    }
    arquivos['sistema.json'] = limpar(JSON.stringify(sistema, null, 2))
  }
  if (itens.includes('config')) {
    const lista: unknown[] = []
    for (const item of (await lerIndice()).servidores) {
      const info = await lerInfo(item)
      const props = await lerTexto(join(item.pasta, 'server.properties')).catch(() => '')
      lista.push({
        ...(info ?? { nome: item.nome, pasta: item.pasta, semServsquareJson: true }),
        serverProperties: props ? limparPropriedades(props).split(/\r?\n/) : null
      })
    }
    arquivos['config/servidores.json'] = limpar(
      JSON.stringify(limparObjeto(lista, limpeza), null, 2)
    )
    arquivos['config/instalacoes.json'] = limpar(
      JSON.stringify(limparObjeto(await instalacoes(), limpeza), null, 2)
    )
  }
  if (itens.includes('mods')) {
    const mods = {
      servidor: servidor ? { nome: servidor.nome, mods: await modsDe(servidor.pasta) } : null,
      instalacao: instalacao
        ? { nome: instalacao.nome, mods: await modsDe(instalacao.pasta) }
        : null
    }
    arquivos['mods.json'] = limpar(JSON.stringify(mods, null, 2))
  }
  if (itens.includes('manifesto')) {
    const convite = servidor
      ? ((await lerJson(join(servidor.pasta, 'servsquare-convite.json'))) as {
          versao?: unknown
        } | null)
      : null
    const manifesto = {
      servidor: servidor ? { nome: servidor.nome, versaoDoConvite: convite?.versao ?? null } : null,
      instalacao: instalacao
        ? {
            nome: instalacao.nome,
            aplicada: await versaoDoManifesto(join(instalacao.pasta, 'hubsquare-manifesto.json')),
            disponivel: await versaoDoManifesto(
              join(instalacao.pasta, 'hubsquare-manifesto-disponivel.json')
            )
          }
        : null
    }
    arquivos['manifesto.json'] = limpar(JSON.stringify(manifesto, null, 2))
  }
  if (itens.includes('diagnostico') && ultimoDiagnostico) {
    arquivos['diagnostico.txt'] = limpar(`Em ${ultimoDiagnostico.em}\n${ultimoDiagnostico.texto}`)
  }
  arquivos['LEIA-ME.txt'] = limpar(
    leiaMe({
      geradoEm: new Date().toLocaleString('pt-BR'),
      versaoApp: app.getVersion(),
      windows: `${version()} (${release()})`,
      servidor: servidor?.nome ?? null,
      instalacao: instalacao?.nome ?? null,
      arquivos: Object.keys(arquivos),
      ultimoErro: arquivos['erros.log'] ? ultimaEntrada(arquivos['erros.log']) : null,
      diagnostico: arquivos['diagnostico.txt'] ?? null
    })
  )

  // Conferência final: se algum segredo conhecido sobrou, nada é gravado.
  const sobrou = sobrouSegredo(arquivos, limpeza.segredos)
  if (sobrou) {
    throw new ErroApp(
      'O relatório não foi gerado porque um segredo não saiu da limpeza. Tire esse item da lista e tente de novo.',
      `Arquivo: ${sobrou}`
    )
  }

  const pasta = app.getPath('desktop')
  const destino = join(pasta, nomeDoRelatorio(new Date()))
  const montagem = join(tmpdir(), `servsquare-relatorio-${randomUUID()}`)
  try {
    for (const [nome, texto] of Object.entries(arquivos)) {
      await mkdir(dirname(join(montagem, nome)), { recursive: true })
      await writeFile(join(montagem, nome), texto)
    }
    await mkdir(pasta, { recursive: true })
    await tar(['-a', '-c', '-f', destino, '-C', montagem, ...Object.keys(arquivos)])
  } catch (e) {
    throw new ErroApp(
      'Não consegui gravar o relatório na Área de Trabalho. Confira o espaço no disco e tente de novo.',
      detalhar(e)
    )
  } finally {
    await rm(montagem, { recursive: true, force: true }).catch(() => {})
  }
  return { arquivo: destino.split(/[\\/]/).pop()!, itens: Object.keys(arquivos) }
}

export async function abrirPastaDoRelatorio(): Promise<void> {
  const erro = await shell.openPath(app.getPath('desktop'))
  if (erro) throw new ErroApp('Não consegui abrir a Área de Trabalho.', erro)
}
