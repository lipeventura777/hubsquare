import { app, nativeImage } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import type { EstadoIcones, InfoServidor } from '../shared/tipos'
import { tar } from './backup'
import { texturasDaEntidade, texturasDoItem, type Idioma } from './dadosJogador'
import { ErroApp, detalhar } from './erros'
import { detalhesVersao } from './mojang'
import { baixar, buscarJson, type AoProgredir } from './rede'

// Ícones e nomes traduzidos de itens (DESIGN.md, seção 1): baixados só quando o usuário pede,
// do client.jar oficial e do pt_br.json da versão, e guardados na pasta de dados do app.
// Fica só o que a tela usa (texturas de itens e blocos e o idioma); o client.jar é apagado.

function pastaDaVersao(versao: string): string {
  if (!/^[\w.-]+$/.test(versao) || versao.includes('..')) {
    throw new ErroApp('A versão deste servidor tem um nome estranho.', versao)
  }
  return join(app.getPath('userData'), 'jogo', versao)
}

const baixados = (versao: string): boolean => existsSync(join(pastaDaVersao(versao), 'pronto'))

export async function estadoIcones(info: InfoServidor): Promise<EstadoIcones> {
  if (baixados(info.versao)) return { baixados: true, tamanho: 0 }
  const cliente = (await detalhesVersao(info.versao)).downloads.client
  return { baixados: false, tamanho: cliente?.size ?? 0 }
}

let baixando: Promise<void> | null = null

export function baixarIcones(info: InfoServidor, aoProgredir: AoProgredir): Promise<void> {
  baixando ??= baixarAgora(info.versao, aoProgredir).finally(() => (baixando = null))
  return baixando
}

async function baixarAgora(versao: string, aoProgredir: AoProgredir): Promise<void> {
  const pasta = pastaDaVersao(versao)
  const v = await detalhesVersao(versao)
  if (!v.downloads.client || !v.assetIndex) {
    throw new ErroApp('Esta versão não tem ícones para baixar.')
  }
  await mkdir(pasta, { recursive: true })
  const jar = join(pasta, 'client.jar')
  try {
    await baixar(
      v.downloads.client.url,
      jar,
      { algoritmo: 'sha1', valor: v.downloads.client.sha1 },
      'Baixando ícones dos itens',
      aoProgredir
    )
    // shortcut: só o formato da 1.13+ (textures/item e lang em .json); antes disso, falha aqui.
    const parte = (caminho: string): string => `assets/minecraft/${caminho}`
    await tar(
      ['-x', '-f', jar, parte('textures/item'), parte('textures/block'), parte('models')],
      pasta
    ).catch((e) => {
      throw new ErroApp(
        'Não consegui separar os ícones desta versão. Eles funcionam a partir da versão 1.13.',
        detalhar(e)
      )
    })
    // A pasta "items" só existe a partir da 1.21.4.
    await tar(['-x', '-f', jar, parte('items')], pasta).catch(() => {})
  } finally {
    await rm(jar, { force: true })
  }

  const indice = await buscarJson<{ objects: Record<string, { hash: string }> }>(v.assetIndex.url)
  const hash = indice.objects['minecraft/lang/pt_br.json']?.hash
  if (hash) {
    await baixar(
      `https://resources.download.minecraft.net/${hash.slice(0, 2)}/${hash}`,
      join(pasta, 'pt_br.json'),
      { algoritmo: 'sha1', valor: hash },
      'Baixando nomes em português',
      aoProgredir
    )
  }
  await writeFile(join(pasta, 'pronto'), '')
  recursos.delete(versao)
}

// Ícones são data URL, ou null para a tela usar o bloco "?".
export interface Recursos {
  idioma: Idioma
  iconeItem: (id: string) => string | null
  iconeEntidade: (id: string) => string | null
}

const recursos = new Map<string, Promise<Recursos>>()

export function recursosDaVersao(versao: string): Promise<Recursos> {
  let pedido = recursos.get(versao)
  if (!pedido) {
    pedido = carregar(versao)
    recursos.set(versao, pedido)
  }
  return pedido
}

async function carregar(versao: string): Promise<Recursos> {
  if (!baixados(versao)) return { idioma: {}, iconeItem: () => null, iconeEntidade: () => null }
  const pasta = pastaDaVersao(versao)
  const assets = join(pasta, 'assets', 'minecraft')
  const idioma: Idioma = await readFile(join(pasta, 'pt_br.json'), 'utf8')
    .then((t) => JSON.parse(t) as Idioma)
    .catch(() => ({}))
  const ler = (caminho: string): unknown => {
    try {
      return JSON.parse(readFileSync(join(assets, `${caminho}.json`), 'utf8'))
    } catch {
      return null
    }
  }
  const icones = new Map<string, string | null>()
  const icone = (chave: string, texturas: () => string[]): string | null => {
    if (!icones.has(chave)) {
      let url: string | null = null
      for (const t of texturas()) {
        const arquivo = join(assets, 'textures', `${t}.png`)
        if (!existsSync(arquivo)) continue
        let imagem = nativeImage.createFromPath(arquivo)
        const { width, height } = imagem.getSize()
        // Texturas animadas são uma tira vertical; fica só o primeiro quadro.
        if (height > width) imagem = imagem.crop({ x: 0, y: 0, width, height: width })
        url = imagem.isEmpty() ? null : imagem.toDataURL()
        break
      }
      icones.set(chave, url)
    }
    return icones.get(chave) ?? null
  }
  return {
    idioma,
    iconeItem: (id) => icone(id, () => texturasDoItem(id, ler)),
    iconeEntidade: (id) => icone(`entidade:${id}`, () => texturasDaEntidade(id))
  }
}
