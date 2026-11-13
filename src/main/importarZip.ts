import { dialog, type BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { lstat, mkdir, readdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import type { AnaliseZip, InfoServidor, Progresso, TipoId } from '../shared/tipos'
import { gravarPropriedades } from './config'
import { ErroApp, detalhar } from './erros'
import { nomeLimpo } from './nomeRegras'
import {
  aceitarEula,
  instalarJarEJava,
  lerEstado,
  pastaServidores,
  validarNome,
  validarVersao
} from './servidor'
import { ARQUIVO_INFO, registrar } from './servidores'
import { ehTipo } from './tipos'
import { versaoLoaderValida } from './tipos/versoesLoader'
import {
  caminhoSeguro,
  detectarConteudo,
  detectarLoader,
  versaoDoLevelDat,
  type LoaderDetectado
} from './zipSeguro'

// Importar servidor ou mundo de um .zip (ex.: baixado do Aternos). Usa o tar do Windows,
// que abre .zip, como os backups. Nenhum caminho do zip pode sair da pasta de destino.

export const TAR = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')

// Zips já analisados nesta sessão. A tela só conhece o token; o caminho fica aqui.
const analisados = new Map<
  string,
  { zip: string; conteudo: 'servidor' | 'mundo'; raiz: string; loader?: LoaderDetectado | null }
>()

// Devolve o que o tar escreveu (ex.: lista do -tf, ou um arquivo com -xOf).
export function tar(argumentos: string[]): Promise<string> {
  return new Promise((resolver, falhar) => {
    const filho = spawn(TAR, argumentos, { windowsHide: true })
    let saida = ''
    let erros = ''
    filho.stdout.on('data', (d) => (saida += d))
    filho.stderr.on('data', (d) => (erros += d))
    filho.on('error', falhar)
    filho.on('close', (codigo) =>
      codigo === 0 ? resolver(saida) : falhar(new Error(`tar saiu com código ${codigo}\n${erros}`))
    )
  })
}

export async function analisarZip(janela: BrowserWindow | null): Promise<AnaliseZip | null> {
  const opcoes = {
    title: 'Escolha o arquivo .zip do servidor ou do mundo',
    properties: ['openFile' as const],
    filters: [{ name: 'Arquivo .zip', extensions: ['zip'] }]
  }
  const escolha = janela
    ? await dialog.showOpenDialog(janela, opcoes)
    : await dialog.showOpenDialog(opcoes)
  const zip = escolha.filePaths[0]
  if (escolha.canceled || !zip) return null

  let entradas: string[]
  try {
    entradas = (await tar(['-tf', zip])).split(/\r?\n/).filter(Boolean)
  } catch (e) {
    throw new ErroApp(
      'Não consegui abrir esse arquivo. Confira se ele é um .zip que não está corrompido.',
      detalhar(e)
    )
  }
  const perigosas = entradas.filter((e) => !caminhoSeguro(e))
  if (perigosas.length) {
    throw new ErroApp(
      'Esse .zip tem arquivos que tentam sair da pasta onde seriam colocados, então ele não foi aberto. Use um zip de fonte confiável.',
      perigosas.slice(0, 20).join('\n')
    )
  }
  const conteudo = detectarConteudo(entradas)
  // Pack do CurseForge para o jogo: os mods vêm só como números do CurseForge (sem a API, não dá).
  if (!conteudo && entradas.includes('manifest.json')) {
    throw new ErroApp(
      'Esse é o pacote do CurseForge para o jogo, não o de servidor: a maioria dos mods vem só como uma lista, sem os arquivos. Na página do modpack no CurseForge, baixe o arquivo de servidor ("Server Pack") e importe ele. Ou procure o modpack em Mods › Explorar › Modpacks, na fonte CurseForge, e crie o servidor por lá (o app baixa os mods da lista).'
    )
  }
  if (!conteudo) {
    throw new ErroApp(
      'Não achei um servidor (server.properties) nem um mundo (level.dat) dentro desse .zip. Escolha outro arquivo.'
    )
  }

  // Versão do mundo, lida do level.dat extraído sozinho numa pasta temporária.
  let versaoDoMundo: string | null = null
  if (conteudo.levelDat) {
    const temporaria = join(tmpdir(), `servsquare-zip-${randomUUID()}`)
    try {
      await mkdir(temporaria)
      await tar(['-xf', zip, '-C', temporaria, conteudo.levelDat])
      versaoDoMundo = versaoDoLevelDat(await readFile(join(temporaria, conteudo.levelDat)))
    } catch {
      // sem versão: a tela sugere a mais nova
    } finally {
      await rm(temporaria, { recursive: true, force: true })
    }
  }

  // Server pack com mods: descobre o loader (o variables.txt dos packs do CurseForge diz tudo).
  let loader: LoaderDetectado | null = null
  if (conteudo.tipo === 'servidor') {
    const variaveis = entradas.includes(`${conteudo.raiz}variables.txt`)
      ? await tar(['-xOf', zip, `${conteudo.raiz}variables.txt`]).catch(() => undefined)
      : undefined
    loader = detectarLoader(entradas, conteudo.raiz, variaveis)
    if (loader?.tipo === 'quilt') {
      throw new ErroApp(
        'Esse servidor usa o Quilt, que o HubSquare ainda não aceita. Use um pack para Fabric, Forge ou NeoForge.'
      )
    }
  }

  const token = randomUUID()
  analisados.set(token, { zip, conteudo: conteudo.tipo, raiz: conteudo.raiz, loader })
  const sugestao = nomeLimpo(basename(zip, '.zip'))
  return {
    token,
    arquivo: basename(zip),
    conteudo: conteudo.tipo,
    nomeSugerido: sugestao || 'Servidor importado',
    versaoDoMundo,
    loader: loader && { tipo: loader.tipo as TipoId, versao: loader.versao }
  }
}

// Procura atalhos (links simbólicos) no que foi extraído: eles poderiam apontar para fora.
export async function temAtalho(pasta: string): Promise<boolean> {
  for (const nome of await readdir(pasta)) {
    const caminho = join(pasta, nome)
    const info = await lstat(caminho)
    if (info.isSymbolicLink()) return true
    if (info.isDirectory() && (await temAtalho(caminho))) return true
  }
  return false
}

// Tela Mundos: extrai o zip já analisado (só mundo) numa pasta vazia e devolve a pasta do mundo
// lá dentro. Quem chama move o mundo para o lugar e apaga a pasta temporária.
export async function extrairMundoDoZip(token: string, temporaria: string): Promise<string> {
  const zip = analisados.get(token)
  if (!zip) throw new ErroApp('Escolha o arquivo .zip de novo.')
  if (zip.conteudo !== 'mundo') {
    throw new ErroApp(
      'Esse .zip é de um servidor inteiro, não de um mundo. Para ele, use "Importar de arquivo .zip" na tela Servidores.'
    )
  }
  await mkdir(temporaria, { recursive: true })
  try {
    await tar(['-xf', zip.zip, '-C', temporaria])
  } catch (e) {
    throw new ErroApp(
      'Não consegui abrir esse .zip. Confira se ele não está corrompido.',
      detalhar(e)
    )
  }
  if (await temAtalho(temporaria)) {
    throw new ErroApp(
      'Esse .zip tem atalhos (links) dentro, e por segurança o app não aceita. Use outro arquivo.'
    )
  }
  analisados.delete(token)
  return join(temporaria, zip.raiz).replace(/[\\/]+$/, '')
}

let importando = false

export async function criarDeZip(
  pedido: unknown,
  aoProgredir: (p: Progresso) => void
): Promise<InfoServidor> {
  if (importando) throw new ErroApp('Já tem uma importação em andamento. Espere terminar.')
  const {
    token,
    nome: nomeBruto,
    tipo,
    versao,
    aceitouEula
  } = (pedido ?? {}) as Record<string, unknown>
  const zip = typeof token === 'string' ? analisados.get(token) : undefined
  if (!zip) throw new ErroApp('Escolha o arquivo .zip de novo.')
  if (aceitouEula !== true) {
    throw new ErroApp('Você precisa marcar que aceita o EULA do Minecraft para criar o servidor.')
  }
  if (!ehTipo(tipo)) throw new ErroApp('Tipo de servidor desconhecido. Escolha um tipo da lista.')
  const nome = validarNome(nomeBruto)
  const pasta = join(pastaServidores(), nome)
  if (existsSync(pasta))
    throw new ErroApp(`Já existe uma pasta chamada "${nome}". Escolha outro nome.`)
  const versaoOk = await validarVersao(tipo, versao)

  importando = true
  // Tudo acontece numa pasta provisória; só no fim ela vira a pasta do servidor.
  const provisoria = join(pastaServidores(), `.importando-${randomUUID()}`)
  try {
    const extraido = join(provisoria, 'zip')
    const destino = join(provisoria, 'servidor')
    await mkdir(extraido, { recursive: true })
    await mkdir(destino)
    aoProgredir({ etapa: 'Abrindo o .zip', recebido: 0, total: 0 })
    try {
      await tar(['-xf', zip.zip, '-C', extraido])
    } catch (e) {
      throw new ErroApp(
        'Não consegui abrir esse .zip. Confira se ele não está corrompido.',
        detalhar(e)
      )
    }
    if (await temAtalho(extraido)) {
      throw new ErroApp(
        'Esse .zip tem atalhos (links) dentro, e por segurança o app não aceita. Use outro arquivo.'
      )
    }

    const origem = join(extraido, zip.raiz)
    if (zip.conteudo === 'servidor') {
      // Servidor inteiro: tudo o que está junto do server.properties vai para a pasta nova.
      for (const item of await readdir(origem))
        await rename(join(origem, item), join(destino, item))
      // Server packs não trazem server.properties: liga a whitelist, como num servidor novo.
      if (!existsSync(join(destino, 'server.properties'))) {
        await gravarPropriedades(destino, { 'white-list': 'true', 'enforce-whitelist': 'true' })
      }
    } else {
      // Só o mundo: vira o mundo "world" de um servidor novo, com a whitelist ligada.
      await rename(origem, join(destino, 'world'))
      await gravarPropriedades(destino, { 'white-list': 'true', 'enforce-whitelist': 'true' })
    }

    // Server pack: usa a mesma versão do loader que veio nele, se o usuário manteve o loader e o jogo.
    const det = zip.loader
    const loaderDoPack =
      det && det.tipo === tipo && det.versao === versaoOk && versaoLoaderValida(det.versaoLoader)
        ? det.versaoLoader
        : undefined
    const { java, versaoLoader } = await instalarJarEJava(
      destino,
      tipo,
      versaoOk,
      aoProgredir,
      loaderDoPack
    )
    await aceitarEula(destino) // só chega aqui com a caixa do EULA marcada
    const info = { nome, tipo, versao: versaoOk, java, versaoLoader, javaOtimizado: true }
    await writeFile(join(destino, ARQUIVO_INFO), JSON.stringify(info, null, 2))

    await rename(destino, pasta)
    const id = await registrar({ nome, pasta, tipo, versao: versaoOk }, lerEstado() === 'desligado')
    analisados.delete(token as string)
    return { ...info, id, pasta }
  } finally {
    importando = false
    // A pasta provisória nunca é um servidor registrado; o que sobrou dela pode sair.
    await rm(provisoria, { recursive: true, force: true }).catch(() => {})
  }
}
