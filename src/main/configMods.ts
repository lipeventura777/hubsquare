import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { copyFile, mkdir, readdir, readFile, rm, stat } from 'fs/promises'
import { dirname, join, relative, sep } from 'path'
import { EXTRAS_TIPOS, LIMITE_TEXTO, type ConfigLida, type InfoServidor } from '../shared/tipos'
import { pastaBackups } from './backup'
import { gravarComSeguranca } from './config'
import { aplicarMudancas, formatoDe, lerCampos } from './configRegras'
import { ErroApp, detalhar } from './erros'
import { metaDoJar } from './metaJar'
import { dentroDe } from './mundo'
import { pastaLivre } from './pastaLivre'

// Arquivos de config de cada mod (Fase 25): achar, mostrar como formulário e salvar trocando só
// os valores. Antes de salvar ou de "Restaurar padrão", uma cópia vai para os backups.
// Só mexe em config/, defaultconfigs/, plugins/ e <mundo>/serverconfig/ do servidor ativo.

const limpo = (s: string): string => s.toLowerCase().replace(/[-_ .]/g, '')

async function mundos(pasta: string): Promise<string[]> {
  const r: string[] = []
  for (const n of await readdir(pasta).catch(() => [] as string[])) {
    if (existsSync(join(pasta, n, 'level.dat'))) r.push(n)
  }
  return r
}

// Arquivos com formato conhecido dentro de `base`, até 2 pastas abaixo.
async function arquivosEm(base: string, nivel = 0): Promise<string[]> {
  const r: string[] = []
  for (const e of await readdir(base, { withFileTypes: true }).catch(() => [])) {
    const c = join(base, e.name)
    if (e.isDirectory() && nivel < 2) r.push(...(await arquivosEm(c, nivel + 1)))
    else if (e.isFile() && formatoDe(e.name)) r.push(c)
  }
  return r
}

const rel = (info: InfoServidor, c: string): string => relative(info.pasta, c).split(sep).join('/')

export async function configsDoMod(info: InfoServidor, arquivo: unknown): Promise<string[]> {
  const extras = EXTRAS_TIPOS[info.tipo]
  if (!extras || typeof arquivo !== 'string' || /[\\/]/.test(arquivo)) {
    throw new ErroApp('Mod inválido. Atualize a lista.')
  }
  const jar = [
    join(info.pasta, extras, arquivo),
    join(info.pasta, extras, `${arquivo}.disabled`)
  ].find((c) => existsSync(c))
  const meta = jar ? await metaDoJar(jar) : null
  // Nomes que o mod costuma usar nos arquivos: o id (e o que ele fornece) e o nome.
  const nomes = [...(meta?.ids ?? []), ...(meta?.nome ? [meta.nome] : [])]
    .map(limpo)
    .filter((n) => n.length >= 3)
  if (!nomes.length) return []
  const bate = (nome: string): boolean => nomes.some((n) => limpo(nome).startsWith(n))
  const achados: string[] = []

  const procurar = async (pasta: string): Promise<void> => {
    for (const e of await readdir(pasta, { withFileTypes: true }).catch(() => [])) {
      if (!bate(e.name)) continue
      const c = join(pasta, e.name)
      if (e.isDirectory()) achados.push(...(await arquivosEm(c)))
      else if (formatoDe(e.name)) achados.push(c)
    }
  }
  if (extras === 'plugins') await procurar(join(info.pasta, 'plugins'))
  else {
    await procurar(join(info.pasta, 'config'))
    await procurar(join(info.pasta, 'defaultconfigs'))
    // Configs do mundo (Forge/NeoForge): <mundo>/serverconfig/<mod>-server.toml
    for (const m of await mundos(info.pasta)) await procurar(join(info.pasta, m, 'serverconfig'))
  }
  return [...new Set(achados)].slice(0, 40).map((c) => rel(info, c))
}

// Caminho de config aceito: dentro das pastas de config do servidor, com formato conhecido.
async function exigirConfig(info: InfoServidor, valor: unknown): Promise<string> {
  const c = typeof valor === 'string' ? valor : ''
  const partes = c.split('/')
  const raiz = partes[0]
  const naRaiz = ['config', 'defaultconfigs', 'plugins'].includes(raiz)
  const doMundo = partes[1] === 'serverconfig' && (await mundos(info.pasta)).includes(raiz)
  const abs = join(info.pasta, ...partes)
  if (
    !partes.some((p) => p === '..' || p === '.' || !p) &&
    (naRaiz || doMundo) &&
    formatoDe(c) &&
    dentroDe(info.pasta, abs) &&
    existsSync(abs)
  )
    return abs
  throw new ErroApp('Não encontrei esse arquivo de configuração. Atualize a lista.')
}

const hash = (t: string): string => createHash('sha1').update(t).digest('hex')

export async function lerConfigMod(info: InfoServidor, caminho: unknown): Promise<ConfigLida> {
  const abs = await exigirConfig(info, caminho)
  if ((await stat(abs)).size > LIMITE_TEXTO) {
    throw new ErroApp('Esse arquivo passa de 1 MB. Abra pelo "Editar como texto" na tela Arquivos.')
  }
  const texto = await readFile(abs, 'utf8')
  return {
    caminho: caminho as string,
    campos: lerCampos(texto, formatoDe(abs)!),
    hash: hash(texto)
  }
}

// Cópia antes de mexer: backups/<servidor>/configs/<data>/<caminho>. Guarda as 30 últimas.
async function copiarParaBackup(info: InfoServidor, abs: string): Promise<void> {
  const base = join(pastaBackups(info), 'configs')
  const destino = join(base, new Date().toISOString().replace(/[:.]/g, '-'), rel(info, abs))
  await mkdir(dirname(destino), { recursive: true })
  await copyFile(abs, destino)
  const antigas = (await readdir(base)).sort().slice(0, -30)
  for (const n of antigas) {
    const c = join(base, n)
    if (dentroDe(base, c) && c !== base) await rm(c, { recursive: true, force: true })
  }
}

// Devolve true se o servidor está ligado (a mudança só vale depois de reiniciar).
export async function salvarConfigMod(
  info: InfoServidor,
  caminho: unknown,
  hashLido: unknown,
  mudancas: unknown
): Promise<boolean> {
  const abs = await exigirConfig(info, caminho)
  const texto = await readFile(abs, 'utf8')
  if (hash(texto) !== hashLido) {
    throw new ErroApp(
      'Esse arquivo mudou desde que foi aberto (o mod pode ter regravado). Abra de novo e refaça a mudança.'
    )
  }
  if (!mudancas || typeof mudancas !== 'object' || Array.isArray(mudancas)) {
    throw new ErroApp('Nada para salvar.')
  }
  let novo: string
  try {
    novo = aplicarMudancas(texto, formatoDe(abs)!, mudancas as Record<string, unknown>)
  } catch (e) {
    throw new ErroApp(e instanceof Error ? e.message : 'Algum valor não serve.', detalhar(e))
  }
  if (novo === texto) return !pastaLivre(info)
  await copiarParaBackup(info, abs)
  await gravarComSeguranca(abs, novo)
  return !pastaLivre(info)
}

// "Restaurar padrão": cópia nos backups e apaga; o mod recria o arquivo no próximo início.
export async function restaurarConfigPadrao(
  info: InfoServidor,
  caminho: unknown
): Promise<boolean> {
  const abs = await exigirConfig(info, caminho)
  try {
    await copiarParaBackup(info, abs)
  } catch (e) {
    throw new ErroApp(
      'Não consegui fazer a cópia do arquivo, então ele não foi apagado.',
      detalhar(e)
    )
  }
  await rm(abs, { force: true })
  return !pastaLivre(info)
}
