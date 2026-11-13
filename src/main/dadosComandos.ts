import { app } from 'electron'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { EstadoDadosComandos, InfoServidor } from '../shared/tipos'
import type { NoComando } from '../shared/comandos'
import { tar as tarSemSaida } from './backup'
import { ErroApp, detalhar } from './erros'
import { tar } from './importarZip'
import { garantirJava } from './java'
import { detalhesVersao, javaDaVersao } from './mojang'
import { baixar, buscarJson, type AoProgredir } from './rede'

// Central de comandos (Fase 26): a sintaxe exata de cada versão vem do próprio servidor.
// O app baixa o server.jar oficial da Mojang dessa versão e roda o gerador de relatórios
// (java -DbundlerMainClass=net.minecraft.data.Main -jar server.jar --reports), que exporta a
// árvore de todos os comandos e os registros (itens, efeitos). Do mesmo .jar sai o en_us.json
// (os modelos das respostas do console) e do índice de assets o pt_br.json (a tradução).
// Fica tudo na pasta de dados do app, por versão; o .jar é apagado no fim.

function pasta(versao: string): string {
  if (!/^[\w.-]+$/.test(versao) || versao.includes('..')) {
    throw new ErroApp('A versão deste servidor tem um nome estranho.', versao)
  }
  return join(app.getPath('userData'), 'jogo', versao, 'comandos')
}

export interface DadosComandos {
  arvore: NoComando
  itens: string[]
  efeitos: string[]
  en: Record<string, string> // modelos das mensagens (commands.*, argument.* ...)
  pt: Record<string, string> // pt_br.json da versão
}

export async function estadoDadosComandos(info: InfoServidor): Promise<EstadoDadosComandos> {
  if (existsSync(join(pasta(info.versao), 'pronto'))) return { pronto: true, tamanho: 0 }
  const v = await detalhesVersao(info.versao)
  return {
    pronto: false,
    tamanho: (v.downloads.server as { size?: number } | undefined)?.size ?? 0
  }
}

// Roda o gerador de relatórios do Java (leva uns segundos).
function gerarRelatorios(java: string, jar: string, saida: string, cwd: string): Promise<void> {
  return new Promise((resolver, falhar) => {
    const filho = spawn(
      java,
      ['-DbundlerMainClass=net.minecraft.data.Main', '-jar', jar, '--reports', '--output', saida],
      { cwd, windowsHide: true }
    )
    let erros = ''
    filho.stderr.on('data', (d) => (erros = (erros + d).slice(-4000)))
    filho.stdout.on('data', () => {})
    const limite = setTimeout(() => filho.kill(), 5 * 60_000)
    filho.on('error', falhar)
    filho.on('close', (codigo) => {
      clearTimeout(limite)
      if (codigo === 0) resolver()
      else falhar(new Error(`O gerador de relatórios saiu com código ${codigo}\n${erros}`))
    })
  })
}

const MENSAGENS = /^(commands|command|argument|arguments|permissions|parsing)\./

let preparando: Promise<void> | null = null

export function prepararDadosComandos(info: InfoServidor, aoProgredir: AoProgredir): Promise<void> {
  preparando ??= preparar(info.versao, aoProgredir).finally(() => (preparando = null))
  return preparando
}

async function preparar(versao: string, aoProgredir: AoProgredir): Promise<void> {
  const destino = pasta(versao)
  const v = await detalhesVersao(versao)
  const servidor = v.downloads.server
  if (!servidor) throw new ErroApp('A Mojang não tem o servidor desta versão para baixar.')
  const temp = join(tmpdir(), `servsquare-comandos-${randomUUID()}`)
  await mkdir(temp, { recursive: true })
  try {
    const jar = join(temp, 'server.jar')
    await baixar(
      servidor.url,
      jar,
      { algoritmo: 'sha1', valor: servidor.sha1 },
      'Baixando o servidor oficial para ler os comandos',
      aoProgredir
    )
    aoProgredir({ etapa: 'Lendo os comandos desta versão', recebido: 0, total: 0 })
    const java = await garantirJava(await javaDaVersao(versao), aoProgredir)
    try {
      await gerarRelatorios(java, jar, join(temp, 'saida'), temp)
    } catch (e) {
      throw new ErroApp('Não consegui ler os comandos desta versão do Minecraft.', detalhar(e))
    }
    const relatorios = join(temp, 'saida', 'reports')
    const arvore = JSON.parse(
      await readFile(join(relatorios, 'commands.json'), 'utf8')
    ) as NoComando
    const registros = JSON.parse(await readFile(join(relatorios, 'registries.json'), 'utf8'))
    const ids = (r: string): string[] => Object.keys(registros[r]?.entries ?? {}).sort()

    // en_us.json: dentro do .jar interno (META-INF/versions/<v>/server-<v>.jar) ou na raiz.
    const entradas = (await tar(['-tf', jar])).split(/\r?\n/)
    const interno = entradas.find((e) => /^META-INF\/versions\/.+\.jar$/.test(e))
    let en: Record<string, string> = {}
    try {
      let origem = jar
      if (interno) {
        await tarSemSaida(['-xf', jar, interno], temp)
        origem = join(temp, ...interno.split('/'))
      }
      const tudo = JSON.parse(await tar(['-xOf', origem, 'assets/minecraft/lang/en_us.json']))
      en = Object.fromEntries(Object.entries(tudo).filter(([k]) => MENSAGENS.test(k))) as Record<
        string,
        string
      >
    } catch {
      en = {} // sem os modelos, as respostas aparecem como vieram do console
    }

    // pt_br.json oficial da versão (o mesmo da Fase 13).
    let pt: Record<string, string> = {}
    const fase13 = join(destino, '..', 'pt_br.json')
    if (existsSync(fase13)) pt = JSON.parse(await readFile(fase13, 'utf8'))
    else if (v.assetIndex) {
      const indice = await buscarJson<{ objects: Record<string, { hash: string }> }>(
        v.assetIndex.url
      )
      const hash = indice.objects['minecraft/lang/pt_br.json']?.hash
      if (hash) {
        const arq = join(temp, 'pt_br.json')
        await baixar(
          `https://resources.download.minecraft.net/${hash.slice(0, 2)}/${hash}`,
          arq,
          { algoritmo: 'sha1', valor: hash },
          'Baixando as mensagens em português',
          aoProgredir
        )
        pt = JSON.parse(await readFile(arq, 'utf8'))
      }
    }
    // Do pt_br, só o que a central usa: mensagens, itens, blocos e efeitos.
    const ptUsado = Object.fromEntries(
      Object.entries(pt).filter(([k]) => MENSAGENS.test(k) || /^(item|block|effect)\./.test(k))
    )

    await mkdir(destino, { recursive: true })
    await writeFile(join(destino, 'arvore.json'), JSON.stringify(arvore))
    await writeFile(
      join(destino, 'dados.json'),
      JSON.stringify({
        itens: ids('minecraft:item'),
        efeitos: ids('minecraft:mob_effect'),
        en,
        pt: ptUsado
      })
    )
    await writeFile(join(destino, 'pronto'), '')
    cache.delete(versao)
  } finally {
    await rm(temp, { recursive: true, force: true }).catch(() => {})
  }
}

const cache = new Map<string, Promise<DadosComandos>>()

export function dadosComandos(versao: string): Promise<DadosComandos> {
  let d = cache.get(versao)
  if (!d) {
    d = (async () => {
      const p = pasta(versao)
      if (!existsSync(join(p, 'pronto'))) {
        throw new ErroApp('Prepare os comandos desta versão primeiro (tela Comandos).')
      }
      const arvore = JSON.parse(await readFile(join(p, 'arvore.json'), 'utf8')) as NoComando
      const dados = JSON.parse(await readFile(join(p, 'dados.json'), 'utf8'))
      return { arvore, ...dados } as DadosComandos
    })()
    d.catch(() => cache.delete(versao))
    cache.set(versao, d)
  }
  return d
}
