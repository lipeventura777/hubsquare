import { dialog, type BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { cp, readFile, readdir, rename, rm, stat } from 'fs/promises'
import { basename, join } from 'path'
import type { InfoServidor, MundoServidor } from '../shared/tipos'
import { compactarMundo, tar } from './backup'
import { caminhoNoServidor } from './caminhoServidor'
import { gravarPropriedades } from './config'
import { ErroApp, detalhar } from './erros'
import { analisarZip, extrairMundoDoZip } from './importarZip'
import { dentroDe, nivelDoMundo, pastasDoMundo } from './mundo'
import { comServidorDesligado } from './servidor'
import { versaoDoLevelDat } from './zipSeguro'

// Tela Mundos: os mundos são as pastas com level.dat na raiz do servidor; o ativo é o
// level-name do server.properties. Tudo aqui só roda com o servidor desligado.

async function tamanhoDe(caminho: string): Promise<number> {
  const s = await stat(caminho).catch(() => null)
  if (!s) return 0
  if (!s.isDirectory()) return s.size
  let total = 0
  for (const nome of await readdir(caminho)) total += await tamanhoDe(join(caminho, nome))
  return total
}

export async function listarMundos(info: InfoServidor): Promise<MundoServidor[]> {
  const ativo = await nivelDoMundo(info.pasta)
  const pastas: string[] = []
  for (const nome of await readdir(info.pasta)) {
    if (existsSync(join(info.pasta, nome, 'level.dat'))) pastas.push(nome)
  }
  // O Nether e o End do Paper também têm level.dat, mas fazem parte do mundo principal.
  const mundos = pastas.filter(
    (n) => !pastas.some((outro) => n === `${outro}_nether` || n === `${outro}_the_end`)
  )
  const lista = await Promise.all(
    mundos.map(async (nome) => {
      const levelDat = join(info.pasta, nome, 'level.dat')
      const tamanhos = await Promise.all(
        pastasDoMundo(nome).map((p) => tamanhoDe(join(info.pasta, p)))
      )
      return {
        nome,
        ativo: nome.toLowerCase() === ativo.toLowerCase(),
        tamanho: tamanhos.reduce((a, b) => a + b, 0),
        data: (await stat(levelDat)).mtime.toISOString(),
        versao: versaoDoLevelDat(await readFile(levelDat).catch(() => Buffer.alloc(0)))
      }
    })
  )
  return lista.sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome))
}

function validarNomeMundo(valor: unknown): string {
  const nome = typeof valor === 'string' ? valor.trim() : ''
  if (!nome || nome.length > 64 || !/^[\p{L}\p{N} _.-]+$/u.test(nome) || /[. ]$/.test(nome)) {
    throw new ErroApp(
      'Use só letras, números, espaço, ponto, "-" e "_" no nome do mundo (até 64 caracteres, sem terminar em ponto).'
    )
  }
  return nome
}

// Um mundo que existe na lista. Passa pela mesma checagem de caminho da tela Arquivos.
async function mundoExistente(info: InfoServidor, valor: unknown): Promise<string> {
  const nome = validarNomeMundo(valor)
  const pasta = await caminhoNoServidor(info.pasta, nome).catch(() => null)
  if (!pasta || !existsSync(join(pasta, 'level.dat'))) {
    throw new ErroApp(`Não achei o mundo "${nome}". Atualize a lista.`)
  }
  return nome
}

// "Mundo", "Mundo (2)", ... sem repetir nenhuma pasta já existente (nem do Nether/End).
function nomeLivre(info: InfoServidor, desejado: string): string {
  const base =
    desejado
      .replace(/[^\p{L}\p{N} _.-]/gu, ' ')
      .replace(/[. ]+$/, '')
      .trim()
      .slice(0, 56) || 'Mundo importado'
  const livre = (n: string): boolean =>
    pastasDoMundo(n).every((p) => !existsSync(join(info.pasta, p)))
  let nome = base
  for (let i = 2; !livre(nome); i++) nome = `${base} (${i})`
  return nome
}

export function ativarMundo(info: InfoServidor, valor: unknown): Promise<void> {
  return comServidorDesligado(async () => {
    const nome = await mundoExistente(info, valor)
    await gravarPropriedades(info.pasta, { 'level-name': nome })
  })
}

// Mundo novo: o próprio servidor gera na próxima vez que ligar. Antes, backup do mundo ativo.
export function gerarMundo(
  info: InfoServidor,
  valorNome: unknown,
  valorSeed: unknown
): Promise<void> {
  const nome = validarNomeMundo(valorNome)
  const seed = typeof valorSeed === 'string' ? valorSeed.trim() : ''
  if (seed.length > 64 || /[\r\n]/.test(seed))
    throw new ErroApp('A seed pode ter até 64 caracteres.')
  if (nomeLivre(info, nome) !== nome) {
    throw new ErroApp(`Já existe uma pasta chamada "${nome}". Escolha outro nome.`)
  }
  return comServidorDesligado(async () => {
    await compactarMundo(info, undefined, 'mundos')
    await gravarPropriedades(info.pasta, { 'level-name': nome, 'level-seed': seed })
  })
}

// Faz backup do mundo e só então apaga as pastas dele. O mundo ativo não pode ser apagado.
export function apagarMundo(info: InfoServidor, valor: unknown): Promise<void> {
  return comServidorDesligado(async () => {
    const nome = await mundoExistente(info, valor)
    if (nome.toLowerCase() === (await nivelDoMundo(info.pasta)).toLowerCase()) {
      throw new ErroApp('Esse é o mundo ativo. Torne outro mundo ativo antes de apagar este.')
    }
    try {
      await compactarMundo(info, nome, 'mundos')
    } catch (e) {
      throw new ErroApp('O backup do mundo falhou, então nada foi apagado.', detalhar(e))
    }
    for (const p of pastasDoMundo(nome)) {
      const pasta = join(info.pasta, p)
      if (dentroDe(info.pasta, pasta)) await rm(pasta, { recursive: true, force: true })
    }
  })
}

// .zip com a pasta do mundo (e o Nether e o End do Paper, se existirem). false se cancelar.
export function exportarMundo(
  info: InfoServidor,
  valor: unknown,
  janela: BrowserWindow | null
): Promise<boolean> {
  return comServidorDesligado(async () => {
    const nome = await mundoExistente(info, valor)
    const opcoes = {
      title: 'Exportar mundo',
      defaultPath: `${nome}.zip`,
      filters: [{ name: 'Arquivo .zip', extensions: ['zip'] }]
    }
    const escolha = janela
      ? await dialog.showSaveDialog(janela, opcoes)
      : await dialog.showSaveDialog(opcoes)
    if (escolha.canceled || !escolha.filePath) return false
    // O tar decide o formato pela extensão.
    const destino = /\.zip$/i.test(escolha.filePath) ? escolha.filePath : `${escolha.filePath}.zip`
    const pastas = pastasDoMundo(nome).filter((p) => existsSync(join(info.pasta, p)))
    try {
      await tar(['-a', '-c', '-f', destino, '-C', info.pasta, ...pastas])
    } catch (e) {
      throw new ErroApp('Não consegui criar o .zip. Confira se há espaço no disco.', detalhar(e))
    }
    return true
  })
}

// Copia a pasta de um mundo para dentro do servidor, com nome livre. Não muda o mundo ativo.
export async function importarMundoDePasta(
  info: InfoServidor,
  janela: BrowserWindow | null
): Promise<string | null> {
  const saves = join(process.env.APPDATA ?? '', '.minecraft', 'saves')
  const opcoes = {
    title: 'Escolha a pasta do mundo',
    defaultPath: existsSync(saves) ? saves : undefined,
    properties: ['openDirectory' as const]
  }
  const escolha = janela
    ? await dialog.showOpenDialog(janela, opcoes)
    : await dialog.showOpenDialog(opcoes)
  const origem = escolha.filePaths[0]
  if (escolha.canceled || !origem) return null
  if (!existsSync(join(origem, 'level.dat'))) {
    throw new ErroApp(
      'Essa pasta não é um mundo do Minecraft (não tem o arquivo level.dat). Escolha a pasta do mundo, por exemplo dentro de .minecraft\\saves.'
    )
  }
  if (dentroDe(info.pasta, origem)) {
    throw new ErroApp('Essa pasta já está dentro do servidor. Escolha um mundo de fora.')
  }
  return comServidorDesligado(async () => {
    const nome = nomeLivre(info, basename(origem))
    const temporaria = join(info.pasta, `.importando-${randomUUID()}`)
    try {
      // session.lock fica travado se o jogo estiver aberto e não serve para o servidor.
      await cp(origem, temporaria, {
        recursive: true,
        filter: (c) => basename(c) !== 'session.lock'
      })
      await rename(temporaria, join(info.pasta, nome))
    } catch (e) {
      throw new ErroApp(
        'Não consegui copiar o mundo. Feche o Minecraft se ele estiver com esse mundo aberto e tente de novo.',
        detalhar(e)
      )
    } finally {
      await rm(temporaria, { recursive: true, force: true }).catch(() => {})
    }
    return nome
  })
}

// Mesmo fluxo do .zip da Fase 11 (análise + extração seguras), mas só para mundos.
export async function importarMundoDeZip(
  info: InfoServidor,
  janela: BrowserWindow | null
): Promise<string | null> {
  const analise = await analisarZip(janela)
  if (!analise) return null
  return comServidorDesligado(async () => {
    const temporaria = join(info.pasta, `.importando-${randomUUID()}`)
    try {
      const origem = await extrairMundoDoZip(analise.token, temporaria)
      const pastaZip = basename(origem)
      const nome = nomeLivre(
        info,
        pastaZip && pastaZip !== basename(temporaria) ? pastaZip : analise.nomeSugerido
      )
      await rename(origem, join(info.pasta, nome))
      // Nether e End do Paper exportados junto, quando vierem.
      for (const sufixo of ['_nether', '_the_end']) {
        const extra = `${origem}${sufixo}`
        if (pastaZip && existsSync(join(extra, 'level.dat'))) {
          await rename(extra, join(info.pasta, `${nome}${sufixo}`))
        }
      }
      return nome
    } finally {
      await rm(temporaria, { recursive: true, force: true }).catch(() => {})
    }
  })
}
