import { app } from 'electron'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import {
  EXTRAS_TIPOS,
  NOMES_TIPOS,
  type AjustesApp,
  type AtualizacoesDisponiveis,
  type InfoServidor,
  type Progresso
} from '../shared/tipos'
import { compararVersoes } from '../shared/versoes'
import { registrarAcao } from './acoes'
import { modoAtual } from './modo'
import { compactarMundo } from './backup'
import { gravarComSeguranca } from './config'
import { ErroApp, detalhar } from './erros'
import { tar } from './importarZip'
import { descobrirVersaoLoader, verificarAtualizacaoModpack } from './modpacks'
import { listarAtualizacoes } from './mods'
import {
  atualizarInfo,
  avisarTela,
  comServidorDesligado,
  instalarJarEJava,
  servidorAtual
} from './servidor'
import { tiposDeServidor } from './tipos'
import { maisNovaEstavel } from './tipos/fabric'
import { versoesForge } from './tipos/forge'
import { versoesNeoForge } from './tipos/neoforge'
import { ultimaBuildPaper } from './tipos/paper'

// Avisos de atualização (Fase 21): ao abrir o app e a cada 6 h, só VERIFICA. Nada é atualizado
// sem o clique do usuário.

const SEIS_HORAS = 6 * 60 * 60 * 1000
const arquivoAjustes = (): string => join(app.getPath('userData'), 'ajustes.json')

// ---------- Ajustes do app ----------

export async function lerAjustes(): Promise<AjustesApp> {
  try {
    const d = JSON.parse(await readFile(arquivoAjustes(), 'utf8')) as Partial<AjustesApp>
    return { verificarAtualizacoes: d.verificarAtualizacoes !== false }
  } catch {
    return { verificarAtualizacoes: true } // ligado por padrão
  }
}

export async function salvarAjustes(valor: unknown): Promise<AjustesApp> {
  const ajustes = {
    verificarAtualizacoes: (valor as Partial<AjustesApp> | null)?.verificarAtualizacoes !== false
  }
  await gravarComSeguranca(arquivoAjustes(), JSON.stringify(ajustes, null, 2))
  if (ajustes.verificarAtualizacoes) void verificar().catch(() => {})
  return ajustes
}

// ---------- Verificar ----------

function sha256(caminho: string): Promise<string> {
  return new Promise((resolver, falhar) => {
    const hash = createHash('sha256')
    createReadStream(caminho)
      .on('error', falhar)
      .on('data', (d) => hash.update(d))
      .on('end', () => resolver(hash.digest('hex')))
  })
}

// Paper: o número da build fica no jar que o próprio Paper gera ao ligar.
async function buildPaperInstalada(info: InfoServidor): Promise<string | null> {
  const jar = join(info.pasta, 'versions', info.versao, `paper-${info.versao}.jar`)
  const manifesto = await tar(['-xOf', jar, 'META-INF/MANIFEST.MF']).catch(() => '')
  return manifesto.match(/^Build-Number:\s*(\d+)/m)?.[1] ?? null
}

async function buildNova(info: InfoServidor): Promise<AtualizacoesDisponiveis['build']> {
  // Servidor de modpack: o loader é o que o pack pede; quem atualiza é o próprio pack.
  if (info.modpack) return null
  if (info.tipo === 'paper') {
    const ultima = await ultimaBuildPaper(info.versao)
    if (!ultima) return null
    const atual = info.versaoLoader ?? (await buildPaperInstalada(info))
    if (atual) return Number(ultima.id) > Number(atual) ? { atual, nova: ultima.id } : null
    // Sem saber a build, compara o jar com o da build mais nova.
    const hash = await sha256(join(info.pasta, 'server.jar')).catch(() => null)
    return hash && hash !== ultima.sha256 ? { atual: null, nova: ultima.id } : null
  }
  let atual = info.versaoLoader ?? null
  let nova: string | undefined
  if (info.tipo === 'fabric') nova = await maisNovaEstavel('loader')
  else if (info.tipo === 'forge') nova = (await versoesForge()).get(info.versao)
  else if (info.tipo === 'neoforge') nova = (await versoesNeoForge()).get(info.versao)
  else return null // o Vanilla não tem builds
  // shortcut: Fabric de antes da Fase 17 não guardou a versão do loader; fica sem aviso de build.
  if (!atual && info.tipo !== 'fabric') atual = await descobrirVersaoLoader(info).catch(() => null)
  if (!nova || !atual) return null
  return compararVersoes(nova.split('-')[0], atual.split('-')[0]) > 0 ? { atual, nova } : null
}

async function minecraftNovo(info: InfoServidor): Promise<string | null> {
  const [maisNova] = await tiposDeServidor[info.tipo].listarVersoes()
  return maisNova && compararVersoes(maisNova, info.versao) > 0 ? maisNova : null
}

// Cada parte que falhar (sem internet, site fora do ar) só fica sem aviso.
async function calcular(info: InfoServidor): Promise<AtualizacoesDisponiveis> {
  const [build, minecraft, mods, modpack] = await Promise.all([
    buildNova(info).catch(() => null),
    minecraftNovo(info).catch(() => null),
    EXTRAS_TIPOS[info.tipo]
      ? listarAtualizacoes(info)
          .then((l) => l.length)
          .catch(() => 0)
      : 0,
    info.modpack ? verificarAtualizacaoModpack(info).catch(() => null) : null
  ])
  return { servidorId: info.id, build, minecraft, mods, modpack, verificadoEm: Date.now() }
}

let ultimo: AtualizacoesDisponiveis | null = null
let emAndamento: Promise<AtualizacoesDisponiveis | null> | null = null

export function verificar(): Promise<AtualizacoesDisponiveis | null> {
  emAndamento ??= (async () => {
    const info = await servidorAtual()
    if (!info) return null
    ultimo = await calcular(info)
    avisarTela('atualizacoes:mudou', ultimo)
    return ultimo
  })().finally(() => (emAndamento = null))
  return emAndamento
}

// O que já se sabe do servidor ativo. Se for outro servidor (trocou de ativo), verifica de novo.
export async function lerAtualizacoes(): Promise<AtualizacoesDisponiveis | null> {
  const info = await servidorAtual()
  if (!info) return null
  if (ultimo?.servidorId === info.id) return ultimo
  if ((await lerAjustes()).verificarAtualizacoes) void verificar().catch(() => {})
  return null
}

// Ao abrir o app (com um respiro) e a cada 6 h, se o usuário deixou ligado.
export function iniciarVerificacao(): void {
  const talvez = async (): Promise<void> => {
    if (modoAtual() !== 'completo') return // modo amigo (Fase M6): não confere servidores
    if ((await lerAjustes()).verificarAtualizacoes) await verificar()
  }
  setTimeout(() => void talvez().catch(() => {}), 15_000)
  setInterval(() => void talvez().catch(() => {}), SEIS_HORAS)
}

// ---------- Atualizar a build (só com o clique) ----------

export async function atualizarBuild(
  info: InfoServidor,
  aoProgredir: (p: Progresso) => void
): Promise<void> {
  const build = await buildNova(info)
  if (!build) throw new ErroApp('O software já está na build mais nova.')
  await comServidorDesligado(async () => {
    aoProgredir({ etapa: 'Fazendo backup do mundo', recebido: 0, total: 0 })
    try {
      await compactarMundo(info, undefined, 'atualizar')
    } catch (e) {
      throw new ErroApp(
        'Não consegui fazer o backup antes de atualizar, então nada foi mudado. Tente de novo.',
        detalhar(e)
      )
    }
    // O Paper sempre baixa a build mais nova; os outros recebem a versão do loader escolhida.
    const { java, versaoLoader } = await instalarJarEJava(
      info.pasta,
      info.tipo,
      info.versao,
      aoProgredir,
      info.tipo === 'paper' ? undefined : build.nova
    )
    await atualizarInfo(info, { java, versaoLoader })
    await registrarAcao(
      info,
      `${NOMES_TIPOS[info.tipo]} atualizado${build.atual ? ` de ${build.atual}` : ''} para ${versaoLoader ?? build.nova} (Minecraft ${info.versao}).`
    )
  })
  void verificar().catch(() => {})
}
