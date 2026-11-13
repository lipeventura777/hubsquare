import { app, dialog, type BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { copyFile, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { homedir, tmpdir } from 'os'
import { basename, join, relative } from 'path'
import type {
  AnaliseHubserver,
  ArquivoManual,
  InfoServidor,
  PreviaPassar,
  Progresso
} from '../shared/tipos'
import { compactarMundo, protegerBackup, tar as tarCriar } from './backup'
import { gravarPropriedades, lerArquivoPropriedades } from './config'
import { lerGuardados, registrarPendencias } from './downloadsManuais'
import { ErroApp, detalhar } from './erros'
import { limitarProgresso } from './filaDownloads'
import { tar, temAtalho } from './importarZip'
import { baixarArquivos, limparCacheDe } from './modpacks'
import { downloadPermitido, type ArquivoIndice } from './modpackRegras'
import * as modrinth from './modrinth'
import { sha1 } from './mods'
import {
  acharMesmo,
  ARQUIVOS_DO_PACOTE,
  CHAVES_LIMPAS,
  entradaAceita,
  EXCLUIR_SEMPRE,
  INDICE_HUBSERVER,
  limparPropriedades,
  motivoParaFicar,
  motivoSemAtualizar,
  nomeDoAmigo,
  PASTAS_DE_CONFIG,
  TEXTO,
  validarPacote,
  type PacoteServidor
} from './passarRegras'
import {
  aceitarEula,
  atualizarInfo,
  comServidorDesligado,
  instalarJarEJava,
  lerEstado,
  pastaServidores,
  validarNome,
  validarVersao
} from './servidor'
import { acharItem, ARQUIVO_INFO, lerIndice, lerInfo, registrar } from './servidores'

// Passar o servidor (Fase M7). "Passar para outro amigo" gera um .hubserver (zip) com o mundo,
// as configurações e as listas de jogadores, e os mods só como link oficial + hash. Nada de .jar,
// segredos, convite, túnel, PIN, chave do CurseForge, caminhos deste PC ou backups. Quem recebe
// cria o servidor (loader, Java e mods baixados como sempre) ou, se é o mesmo servidor (mesmo id
// fixo), atualiza o seu com backup antes.

export const idFixoDe = (info: InfoServidor): string => info.idFixo ?? info.id

// ---------- O que vai no pacote ----------

interface Conteudo {
  itens: string[] // da raiz da pasta do servidor (mundos, arquivos e pastas de config)
  excluir: string[] // arquivos de config que ficam (segredo ou caminho deste PC)
  fica: string[]
  tamanho: number
}

async function tamanhoDe(caminho: string): Promise<number> {
  const s = await stat(caminho)
  if (!s.isDirectory()) return s.size
  let total = 0
  for (const item of await readdir(caminho, { recursive: true, withFileTypes: true })) {
    if (item.isFile())
      total += (await stat(join(item.parentPath, item.name)).catch(() => null))?.size ?? 0
  }
  return total
}

async function listarConteudo(info: InfoServidor): Promise<Conteudo> {
  const caminhos = [homedir(), info.pasta, app.getPath('documents'), app.getPath('userData')]
  const itens: string[] = []
  const excluir: string[] = []
  const fica: string[] = []
  let tamanho = 0
  for (const d of await readdir(info.pasta, { withFileTypes: true })) {
    const caminho = join(info.pasta, d.name)
    if (d.isDirectory() && existsSync(join(caminho, 'level.dat'))) {
      itens.push(d.name) // um mundo (também os do Nether e do End no Paper)
      tamanho += await tamanhoDe(caminho)
    } else if (d.isFile() && ARQUIVOS_DO_PACOTE.includes(d.name)) {
      itens.push(d.name)
      tamanho += (await stat(caminho)).size
    } else if (d.isDirectory() && PASTAS_DE_CONFIG.includes(d.name)) {
      let algum = false
      for (const f of await readdir(caminho, { recursive: true, withFileTypes: true })) {
        if (!f.isFile()) continue
        const absoluto = join(f.parentPath, f.name)
        const rel = relative(info.pasta, absoluto).replace(/\\/g, '/')
        if (/\.(jar|exe|dll|bat|cmd|ps1|sh)$/i.test(f.name)) continue // vão como link (ou não vão)
        const s = await stat(absoluto)
        const texto =
          TEXTO.test(f.name) && s.size <= 2 * 1024 * 1024 ? await readFile(absoluto, 'utf8') : null
        const motivo = motivoParaFicar(rel, texto, caminhos)
        if (motivo) {
          excluir.push(rel)
          fica.push(`${rel} (${motivo})`)
        } else {
          algum = true
          tamanho += s.size
        }
      }
      if (algum) itens.push(d.name)
    }
  }
  return { itens, excluir, fica, tamanho }
}

// Mods e plugins ativos: os do Modrinth vão como link + hash; os baixados à mão, só com a
// página oficial; o resto vira aviso para o novo dono.
async function modsDoPacote(
  info: InfoServidor
): Promise<Pick<PacoteServidor, 'mods' | 'manuais' | 'semLink'>> {
  const jars: string[] = []
  for (const pasta of ['mods', 'plugins']) {
    if (!existsSync(join(info.pasta, pasta))) continue
    for (const n of await readdir(join(info.pasta, pasta)))
      if (/\.jar$/i.test(n)) jars.push(`${pasta}/${n}`)
  }
  const mods: ArquivoIndice[] = []
  const manuais: ArquivoManual[] = []
  const semLink: string[] = []
  if (!jars.length) return { mods, manuais, semLink }
  const hashes = await Promise.all(jars.map((j) => sha1(join(info.pasta, j))))
  let versoes: Awaited<ReturnType<typeof modrinth.porHash>>
  try {
    versoes = await modrinth.porHash(hashes)
  } catch (e) {
    throw new ErroApp(
      'Não consegui conferir os mods no Modrinth. Confira sua internet e tente de novo.',
      detalhar(e)
    )
  }
  const guardados = await lerGuardados()
  for (const [i, path] of jars.entries()) {
    const arq = versoes[hashes[i]]?.files.find((f) => f.hashes.sha1 === hashes[i])
    if (arq && downloadPermitido(arq.url)) {
      mods.push({
        path,
        hashes: { sha1: arq.hashes.sha1, sha512: arq.hashes.sha512 },
        downloads: [arq.url],
        fileSize: arq.size
      })
      continue
    }
    const g = guardados[hashes[i]]
    if (g) {
      manuais.push({
        titulo: g.titulo,
        url: g.url,
        arquivo: basename(path),
        tamanho: g.tamanho,
        sha1: hashes[i],
        md5: g.md5
      })
    } else semLink.push(basename(path))
  }
  return { mods, manuais, semLink }
}

const FICA_SEMPRE = [
  'Os .jar do servidor, dos mods e dos plugins (o novo dono baixa pelos links oficiais)',
  'Cópias de segurança, registros (logs) e relatórios de travamento',
  'Convite, pedidos para entrar e o túnel do playit',
  'PIN do celular e chave do CurseForge',
  'Arquivos baixados à mão (o novo dono baixa pela página oficial)',
  'Do server.properties: a senha do RCON e o IP deste PC (saem em branco)'
]

export async function previaPassar(info: InfoServidor): Promise<PreviaPassar> {
  const [c, m] = await Promise.all([listarConteudo(info), modsDoPacote(info)])
  return {
    tamanho: c.tamanho,
    vai: c.itens,
    fica: [...FICA_SEMPRE, ...c.fica],
    mods: m.mods.length,
    manuais: m.manuais.length,
    semLink: m.semLink
  }
}

// Gera o .hubserver (servidor desligado). Depois, o servidor fica marcado "Com <nome> desde <data>".
export async function passarServidor(
  info: InfoServidor,
  para: unknown,
  janela: BrowserWindow | null
): Promise<{ arquivo: string; tamanho: number } | null> {
  let com: string
  try {
    com = nomeDoAmigo(para)
  } catch (e) {
    throw new ErroApp((e as Error).message)
  }
  if (lerEstado() !== 'desligado') throw new ErroApp('Desligue o servidor antes de passar.')
  const opcoes = {
    title: 'Salvar o servidor para passar',
    defaultPath: join(app.getPath('downloads'), `${info.nome}.hubserver`),
    filters: [{ name: 'Servidor do HubSquare', extensions: ['hubserver'] }]
  }
  const escolha = janela
    ? await dialog.showSaveDialog(janela, opcoes)
    : await dialog.showSaveDialog(opcoes)
  if (escolha.canceled || !escolha.filePath) return null
  const destino = escolha.filePath

  return comServidorDesligado(async () => {
    const [conteudo, mods] = await Promise.all([listarConteudo(info), modsDoPacote(info)])
    const idFixo = idFixoDe(info)
    const pacote: PacoteServidor = {
      formato: 1,
      idFixo,
      nome: info.nome,
      tipo: info.tipo,
      versao: info.versao,
      versaoLoader: info.versaoLoader ?? null,
      ram: info.ram,
      pvp: info.pvp,
      javaOtimizado: info.javaOtimizado,
      javaDosMods: info.javaDosMods,
      ...mods,
      geradoEm: new Date().toISOString()
    }
    const montagem = join(tmpdir(), `servsquare-hubserver-${randomUUID()}`)
    const zip = `${montagem}.zip` // o tar escolhe o formato pela extensão
    try {
      await mkdir(montagem, { recursive: true })
      await writeFile(join(montagem, INDICE_HUBSERVER), JSON.stringify(pacote, null, 2))
      const soltos = [INDICE_HUBSERVER]
      if (conteudo.itens.includes('server.properties')) {
        const texto = await readFile(join(info.pasta, 'server.properties'), 'utf8')
        await writeFile(join(montagem, 'server.properties'), limparPropriedades(texto))
        soltos.push('server.properties')
      }
      const daPasta = conteudo.itens.filter((i) => i !== 'server.properties')
      await tarCriar([
        '-a',
        '-c',
        '-f',
        zip,
        ...[...EXCLUIR_SEMPRE, ...conteudo.excluir].flatMap((p) => ['--exclude', p]),
        '-C',
        montagem,
        ...soltos,
        ...(daPasta.length ? ['-C', info.pasta, ...daPasta] : [])
      ])
      await copyFile(zip, destino)
    } catch (e) {
      throw new ErroApp(
        'Não consegui gerar o arquivo do servidor. Confira se tem espaço no disco e tente de novo.',
        detalhar(e)
      )
    } finally {
      await rm(montagem, { recursive: true, force: true }).catch(() => {})
      await rm(zip, { force: true }).catch(() => {})
    }
    await atualizarInfo(info, { idFixo, emprestado: { com, desde: new Date().toISOString() } })
    return { arquivo: basename(destino), tamanho: (await stat(destino)).size }
  })
}

// ---------- Receber ----------

const analisados = new Map<
  string,
  { arquivo: string; pacote: PacoteServidor; mesmo: string | null }
>()

async function listarEntradas(arquivo: string): Promise<string[]> {
  let entradas: string[]
  try {
    entradas = (await tar(['-tf', arquivo])).split(/\r?\n/).filter(Boolean)
  } catch (e) {
    throw new ErroApp(
      'Não consegui abrir esse arquivo. Confira se ele é um .hubserver que não está corrompido.',
      detalhar(e)
    )
  }
  const recusadas = entradas.filter((e) => !entradaAceita(e))
  if (recusadas.length) {
    throw new ErroApp(
      'Esse arquivo tem programas, mods (.jar) ou caminhos que saem da pasta, então ele não foi aberto. Peça um arquivo novo, gerado pelo HubSquare.',
      recusadas.slice(0, 20).join('\n')
    )
  }
  if (!entradas.includes(INDICE_HUBSERVER)) {
    throw new ErroApp('Esse arquivo não é um servidor do HubSquare (falta o hubserver.json).')
  }
  return entradas
}

export async function analisarHubserver(
  janela: BrowserWindow | null
): Promise<AnaliseHubserver | null> {
  const opcoes = {
    title: 'Escolha o arquivo .hubserver',
    properties: ['openFile' as const],
    filters: [{ name: 'Servidor do HubSquare', extensions: ['hubserver'] }]
  }
  const escolha = janela
    ? await dialog.showOpenDialog(janela, opcoes)
    : await dialog.showOpenDialog(opcoes)
  const arquivo = escolha.filePaths[0]
  if (escolha.canceled || !arquivo) return null
  await listarEntradas(arquivo)
  let pacote: PacoteServidor
  try {
    pacote = validarPacote(JSON.parse(await tar(['-xOf', arquivo, INDICE_HUBSERVER])))
  } catch (e) {
    throw new ErroApp(
      e instanceof SyntaxError
        ? 'O hubserver.json desse arquivo está estragado. Peça um arquivo novo.'
        : (e as Error).message,
      detalhar(e)
    )
  }
  const locais: { id: string; nome: string; idFixo: string; info: InfoServidor }[] = []
  for (const item of (await lerIndice()).servidores) {
    const info = await lerInfo(item)
    if (info) locais.push({ id: item.id, nome: info.nome, idFixo: idFixoDe(info), info })
  }
  const mesmo = acharMesmo(pacote.idFixo, locais)
  const token = randomUUID()
  analisados.set(token, { arquivo, pacote, mesmo: mesmo?.id ?? null })
  return {
    token,
    arquivo: basename(arquivo),
    nome: pacote.nome,
    tipo: pacote.tipo,
    versao: pacote.versao,
    mods: pacote.mods.length,
    manuais: pacote.manuais.length,
    semLink: pacote.semLink,
    mesmo: mesmo && {
      id: mesmo.id,
      nome: mesmo.nome,
      motivoSemAtualizar: motivoSemAtualizar(mesmo.info, pacote)
    }
  }
}

// Extrai numa pasta temporária (o zip é conferido de novo: pode ter mudado desde a análise).
async function extrair(arquivo: string): Promise<string> {
  await listarEntradas(arquivo)
  const pasta = join(tmpdir(), `servsquare-hubserver-${randomUUID()}`)
  await mkdir(pasta, { recursive: true })
  try {
    await tar(['-xf', arquivo, '-C', pasta])
    if (await temAtalho(pasta)) {
      throw new ErroApp(
        'Esse arquivo tem atalhos (links) dentro, e por segurança o app não aceita.'
      )
    }
    return pasta
  } catch (e) {
    await rm(pasta, { recursive: true, force: true }).catch(() => {})
    if (e instanceof ErroApp) throw e
    throw new ErroApp(
      'Não consegui abrir esse arquivo. Confira se ele não está corrompido.',
      detalhar(e)
    )
  }
}

let recebendo = false

export async function receberHubserver(
  pedido: unknown,
  aoProgredir: (p: Progresso) => void
): Promise<InfoServidor> {
  const { token, modo, nome, aceitouEula } = (pedido ?? {}) as Record<string, unknown>
  const a = typeof token === 'string' ? analisados.get(token) : undefined
  if (!a) throw new ErroApp('Escolha o arquivo .hubserver de novo.')
  if (modo !== 'novo' && modo !== 'copia' && modo !== 'atualizar') {
    throw new ErroApp('Escolha o que fazer com o arquivo.')
  }
  // Com o mesmo servidor aqui, só atualizar ou cópia (nunca dois servidores com o mesmo id).
  if ((modo === 'novo' && a.mesmo) || (modo === 'atualizar' && !a.mesmo)) {
    throw new ErroApp('Escolha de novo o que fazer com o arquivo.')
  }
  if (recebendo) throw new ErroApp('Já tem um servidor sendo recebido. Espere terminar.')
  recebendo = true
  try {
    const info =
      modo === 'atualizar'
        ? await atualizarMeu(a.mesmo!, a.arquivo, a.pacote, aoProgredir)
        : await criarDoPacote(a.pacote, a.arquivo, modo, nome, aceitouEula, aoProgredir)
    analisados.delete(token as string)
    return info
  } finally {
    recebendo = false
  }
}

async function criarDoPacote(
  p: PacoteServidor,
  arquivo: string,
  modo: 'novo' | 'copia',
  nomeBruto: unknown,
  aceitouEula: unknown,
  aoProgredir: (p: Progresso) => void
): Promise<InfoServidor> {
  if (aceitouEula !== true) {
    throw new ErroApp('Você precisa marcar que aceita o EULA do Minecraft para criar o servidor.')
  }
  const nome = validarNome(nomeBruto)
  const pasta = join(pastaServidores(), nome)
  if (existsSync(pasta))
    throw new ErroApp(`Já existe uma pasta chamada "${nome}". Escolha outro nome.`)
  const versao = await validarVersao(p.tipo, p.versao)
  const avisar = limitarProgresso(aoProgredir)
  // Tudo numa pasta provisória; só no fim ela vira a pasta do servidor.
  const provisoria = join(pastaServidores(), `.recebendo-${randomUUID()}`)
  let extraido: string | null = null
  try {
    avisar({ etapa: 'Abrindo o arquivo', recebido: 0, total: 0 })
    extraido = await extrair(arquivo)
    await mkdir(provisoria, { recursive: true })
    for (const n of await readdir(extraido)) {
      if (n !== INDICE_HUBSERVER) await rename(join(extraido, n), join(provisoria, n))
    }
    const { java, versaoLoader } = await instalarJarEJava(
      provisoria,
      p.tipo,
      versao,
      avisar,
      p.versaoLoader ?? undefined
    )
    await baixarArquivos(p.mods, provisoria, avisar)
    await aceitarEula(provisoria) // só chega aqui com a caixa do EULA marcada
    if (!existsSync(join(provisoria, 'server.properties'))) {
      await gravarPropriedades(provisoria, { 'white-list': 'true', 'enforce-whitelist': 'true' })
    }
    const info = {
      nome,
      tipo: p.tipo,
      versao,
      java,
      versaoLoader,
      ram: p.ram,
      pvp: p.pvp,
      javaOtimizado: p.javaOtimizado,
      javaDosMods: p.javaDosMods,
      // Cópia: outro servidor, com id próprio (ele não atualiza nem é atualizado pelo original).
      idFixo: modo === 'novo' ? p.idFixo : randomUUID()
    }
    await writeFile(join(provisoria, ARQUIVO_INFO), JSON.stringify(info, null, 2))
    await rename(provisoria, pasta)
    const id = await registrar({ nome, pasta, tipo: p.tipo, versao }, lerEstado() === 'desligado')
    await limparCacheDe(p.mods).catch(() => {})
    await registrarPendencias({ ...info, id, pasta }, p.manuais).catch(() => {})
    return { ...info, id, pasta }
  } finally {
    await rm(provisoria, { recursive: true, force: true }).catch(() => {})
    if (extraido) await rm(extraido, { recursive: true, force: true }).catch(() => {})
  }
}

// "Atualizar o meu servidor com este mundo": backup protegido antes de trocar qualquer coisa.
async function atualizarMeu(
  id: string,
  arquivo: string,
  p: PacoteServidor,
  aoProgredir: (p: Progresso) => void
): Promise<InfoServidor> {
  const item = await acharItem(id)
  const info = item ? await lerInfo(item) : null
  if (!info) throw new ErroApp('Esse servidor não está mais na lista.')
  const motivo = motivoSemAtualizar(info, p)
  if (motivo) throw new ErroApp(motivo)
  const avisar = limitarProgresso(aoProgredir)
  return comServidorDesligado(async () => {
    avisar({ etapa: 'Abrindo o arquivo', recebido: 0, total: 0 })
    const extraido = await extrair(arquivo)
    try {
      const itens = (await readdir(extraido)).filter((n) => n !== INDICE_HUBSERVER)
      avisar({ etapa: 'Fazendo o backup do seu servidor', recebido: 0, total: 0 })
      let backup: string | null
      try {
        backup = await compactarMundo(info, undefined, 'atualizar', itens)
        if (backup) await protegerBackup(info, backup, true)
      } catch (e) {
        throw new ErroApp(
          'Não consegui fazer o backup do seu servidor, então nada foi trocado. Confira o espaço no disco e tente de novo.',
          detalhar(e)
        )
      }
      avisar({ etapa: 'Trocando o mundo', recebido: 0, total: 0 })
      for (const n of itens) {
        const origem = join(extraido, n)
        const destino = join(info.pasta, n)
        if (n === 'server.properties') {
          // Os valores deste PC (senha do RCON, IP) ficam; o resto vem do arquivo.
          const props = await lerArquivoPropriedades(extraido)
          for (const k of CHAVES_LIMPAS) props.delete(k)
          await gravarPropriedades(info.pasta, Object.fromEntries(props))
        } else if (PASTAS_DE_CONFIG.includes(n)) {
          // Configurações: só por cima (o que ficou só aqui, como segredos, continua).
          await cp(origem, destino, { recursive: true, force: true })
        } else {
          await rm(destino, { recursive: true, force: true })
          await rename(origem, destino)
        }
      }
      // Mods que o amigo pôs e este servidor não tem: baixados pelos links oficiais.
      const faltam = p.mods.filter((f) => !existsSync(join(info.pasta, f.path)))
      await baixarArquivos(faltam, info.pasta, avisar)
      await limparCacheDe(faltam).catch(() => {})
      const novo: InfoServidor = { ...info, idFixo: idFixoDe(info), emprestado: undefined }
      await atualizarInfo(info, { idFixo: novo.idFixo, emprestado: undefined })
      await registrarPendencias(novo, p.manuais).catch(() => {})
      return novo
    } finally {
      await rm(extraido, { recursive: true, force: true }).catch(() => {})
    }
  })
}

export async function infoPorId(id: unknown): Promise<InfoServidor> {
  const item = await acharItem(id)
  const info = item ? await lerInfo(item) : null
  if (!info) throw new ErroApp('Esse servidor não está mais na lista.')
  return info
}
