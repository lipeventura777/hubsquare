import { app, nativeImage } from 'electron'
import { existsSync } from 'fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  OPCOES_EXCLUSAO,
  type DetalhesJogador,
  type EstatisticasJogador,
  type InfoServidor,
  type InventarioJogador,
  type JogadorResumo,
  type LinhaEstatistica,
  type OpcaoExclusao,
  type SlotItem
} from '../shared/tipos'
import { compactarMundo } from './backup'
import { comandoDaAcao, validarJogador } from './comandosJogador'
import { lerArquivoPropriedades } from './config'
import {
  itensDoJogador,
  nomeEncantamento,
  nomeEntidade,
  nomeEstatistica,
  nomeItem,
  resumirEstatisticas,
  resumirJogador,
  rostoComChapeu,
  type EstatisticasBrutas,
  type ItemBruto
} from './dadosJogador'
import { ErroApp, detalhar } from './erros'
import { recursosDaVersao } from './itensDoJogo'
import { ehRespostaDoList, interpretarLinha } from './linhaDeJogador'
import { buscarBytes, buscarJsonOpcional } from './rede'
import {
  aoOcultarDoConsole,
  avisarTela,
  comServidorDesligado,
  enviarComando,
  enviarSilencioso,
  eventos,
  lerEstado
} from './servidor'
import { lerLista, lerUsercache } from './whitelist'
import { lerNbt, limparNaRaiz } from './zipSeguro'

// Quem está online, descoberto pelas linhas do console.
let online: string[] = []

export function lerJogadores(): string[] {
  return online
}

function mudarLista(nova: string[]): void {
  online = nova
  avisarTela('jogadores:lista', online)
}

eventos.on('linha', (texto) => {
  const resultado = interpretarLinha(texto, online)
  if (!resultado) return
  mudarLista(resultado.lista)
  if (resultado.aviso) avisarTela('jogadores:aviso', resultado.aviso)
})

// Confere a lista com o "list" ao ligar e a cada 15 s, sem mostrar no console. "minecraft:list" é o
// comando original, igual em todos os softwares (plugins que mudam o "list" não interferem).
let listaPedidaEm = 0
let conferencia: NodeJS.Timeout | undefined

function conferirLista(): void {
  if (enviarSilencioso('minecraft:list')) listaPedidaEm = Date.now()
}

// Esconde só a resposta que o app pediu (chega em menos de 5 s); um "list" digitado aparece normal.
aoOcultarDoConsole((texto) => {
  if (!listaPedidaEm || Date.now() - listaPedidaEm > 5000 || !ehRespostaDoList(texto)) return false
  listaPedidaEm = 0
  return true
})

eventos.on('estado', (estado) => {
  if (estado === 'ligado') {
    conferirLista()
    conferencia ??= setInterval(conferirLista, 15_000)
  }
  if (estado === 'desligado') {
    clearInterval(conferencia)
    conferencia = undefined
    if (online.length) mudarLista([])
  }
})

const estaOnline = (nome: string): boolean =>
  lerEstado() === 'ligado' && online.some((n) => n.toLowerCase() === nome.toLowerCase())

// ---------- Todos os jogadores ----------

// Junta quem já entrou (usercache) com as listas e os online. Online primeiro, depois por nome.
export async function listarTodos(info: InfoServidor): Promise<JogadorResumo[]> {
  const [cache, whitelist, ops, banidos] = await Promise.all([
    lerUsercache(info),
    lerLista(info, 'whitelist'),
    lerLista(info, 'ops'),
    lerLista(info, 'banidos')
  ])
  const porNome = new Map<string, JogadorResumo>()
  const juntar = (nome: string, uuid: string): JogadorResumo => {
    const k = nome.toLowerCase()
    const atual = porNome.get(k) ?? {
      nome,
      uuid,
      online: estaOnline(nome),
      whitelist: false,
      op: false,
      banido: false
    }
    if (!atual.uuid) atual.uuid = uuid
    porNome.set(k, atual)
    return atual
  }
  for (const a of [...cache, ...whitelist, ...ops, ...banidos]) juntar(a.name, a.uuid)
  for (const a of whitelist) juntar(a.name, a.uuid).whitelist = true
  for (const a of ops) juntar(a.name, a.uuid).op = true
  for (const a of banidos) juntar(a.name, a.uuid).banido = true
  for (const nome of lerEstado() === 'ligado' ? online : []) juntar(nome, '').online = true
  return [...porNome.values()].sort(
    (a, b) => Number(b.online) - Number(a.online) || a.nome.localeCompare(b.nome)
  )
}

// ---------- Detalhes (só leitura do .dat) ----------

const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

// "save-all" grava os jogadores no disco; espera o "Saved the game" (ou 5 s, no máximo).
function salvarEEsperar(): Promise<void> {
  return new Promise((resolve) => {
    const fim = (): void => {
      clearTimeout(timer)
      eventos.off('linha', ouvir)
      resolve()
    }
    const ouvir = (texto: string): void => {
      if (texto.includes('Saved the game')) fim()
    }
    const timer = setTimeout(fim, 5000)
    eventos.on('linha', ouvir)
    enviarComando('save-all')
  })
}

// Arquivos do jogador. 26.x guarda em <mundo>/players/<tipo>; versões antigas, em <mundo>/<tipo>
// (o .dat ficava em "playerdata"). A primeira opção que existir vale.
const PASTAS = {
  dat: [join('players', 'data'), 'playerdata'],
  stats: [join('players', 'stats'), 'stats'],
  avancos: [join('players', 'advancements'), 'advancements']
}

async function arquivoDoJogador(
  info: InfoServidor,
  uuid: string,
  tipo: keyof typeof PASTAS
): Promise<string | null> {
  const mundo = (await lerArquivoPropriedades(info.pasta)).get('level-name') || 'world'
  const nome = `${uuid}.${tipo === 'dat' ? 'dat' : 'json'}`
  for (const pasta of PASTAS[tipo]) {
    const caminho = join(info.pasta, mundo, pasta, nome)
    if (existsSync(caminho)) return caminho
  }
  return null
}

// Acha o jogador e, se estiver online, pede ao servidor para salvar antes de ler o disco.
async function jogadorSalvo(info: InfoServidor, valor: unknown): Promise<JogadorResumo> {
  const nome = validarJogador(valor)
  const resumo = (await listarTodos(info)).find((j) => j.nome.toLowerCase() === nome.toLowerCase())
  if (!resumo) throw new ErroApp(`O jogador "${nome}" nunca entrou neste servidor.`)
  if (resumo.online) await salvarEEsperar()
  return resumo
}

async function lerNbtDoJogador(
  info: InfoServidor,
  resumo: JogadorResumo
): Promise<Record<string, unknown> | null> {
  const caminho = UUID.test(resumo.uuid) ? await arquivoDoJogador(info, resumo.uuid, 'dat') : null
  if (!caminho) return null
  try {
    return lerNbt(await readFile(caminho))
  } catch (e) {
    throw new ErroApp(
      'Não consegui ler os dados deste jogador. O arquivo dele pode estar danificado.',
      String(e)
    )
  }
}

export async function detalhesJogador(
  info: InfoServidor,
  valor: unknown
): Promise<DetalhesJogador> {
  const resumo = await jogadorSalvo(info, valor)
  const nbt = await lerNbtDoJogador(info, resumo)
  return { ...resumo, dados: nbt && resumirJogador(nbt) }
}

// ---------- Inventário e estatísticas (com ícones e nomes, se já baixados) ----------

export async function inventarioJogador(
  info: InfoServidor,
  valor: unknown
): Promise<InventarioJogador> {
  const resumo = await jogadorSalvo(info, valor)
  const nbt = await lerNbtDoJogador(info, resumo)
  const { idioma, iconeItem } = await recursosDaVersao(info.versao)
  const item = (b: ItemBruto | null): SlotItem =>
    b && {
      ...b,
      nome: nomeItem(b.id, idioma),
      encantamentos: b.encantamentos.map((e) => nomeEncantamento(e, idioma)),
      icone: iconeItem(b.id)
    }
  const itens = itensDoJogador(nbt ?? {})
  return {
    online: resumo.online,
    semDados: !nbt,
    armadura: itens.armadura.map(item),
    segundaMao: item(itens.segundaMao),
    inventario: itens.inventario.map(item),
    barra: itens.barra.map(item),
    ender: itens.ender.map(item)
  }
}

// null: o jogador ainda não tem estatísticas salvas (ou são do formato antigo, antes da 1.13).
export async function estatisticasJogador(
  info: InfoServidor,
  valor: unknown
): Promise<EstatisticasJogador | null> {
  const resumo = await jogadorSalvo(info, valor)
  const caminho = UUID.test(resumo.uuid) ? await arquivoDoJogador(info, resumo.uuid, 'stats') : null
  if (!caminho) return null
  let brutas: EstatisticasBrutas | null
  try {
    brutas = resumirEstatisticas(JSON.parse(await readFile(caminho, 'utf8')))
  } catch (e) {
    throw new ErroApp(
      'Não consegui ler as estatísticas deste jogador. O arquivo pode estar danificado.',
      String(e)
    )
  }
  if (!brutas) return null
  const { idioma, iconeItem, iconeEntidade } = await recursosDaVersao(info.versao)
  const linhas = (
    lista: [string, number][],
    nome: (id: string) => string,
    icone?: (id: string) => string | null
  ): LinhaEstatistica[] =>
    lista.map(([id, v]) => ({
      id,
      nome: nome(id),
      valor: v,
      icone: icone?.(id) ?? null
    }))
  return {
    tempo: brutas.tempo,
    abates: brutas.abates,
    mortes: brutas.mortes,
    distancia: linhas(brutas.distancia, (id) => nomeEstatistica(id, idioma)),
    quebrados: linhas(brutas.quebrados, (id) => nomeItem(id, idioma), iconeItem),
    usados: linhas(brutas.usados, (id) => nomeItem(id, idioma), iconeItem),
    mortos: linhas(brutas.mortos, (id) => nomeEntidade(id, idioma), iconeEntidade)
  }
}

// ---------- Zona de perigo: apagar dados do jogador ----------

// Campos da raiz do .dat que cada opção zera. A armadura antiga fica no Inventory; a nova, em "equipment".
const CAMPOS_DAT: Partial<Record<OpcaoExclusao, string[]>> = {
  xp: ['XpLevel', 'XpP', 'XpTotal', 'Score'],
  inventario: ['Inventory', 'equipment'],
  ender: ['EnderItems']
}

// Só com o servidor desligado, e sempre depois de um backup do mundo.
export async function excluirDadosJogador(
  info: InfoServidor,
  valor: unknown,
  opcoesValor: unknown
): Promise<void> {
  const opcoes = Array.isArray(opcoesValor)
    ? OPCOES_EXCLUSAO.filter((o) => opcoesValor.includes(o))
    : []
  if (!opcoes.length) throw new ErroApp('Marque pelo menos uma opção para apagar.')
  if (lerEstado() !== 'desligado') throw new ErroApp('Desligue o servidor e tente de novo.')
  const resumo = await jogadorSalvo(info, valor)
  if (!UUID.test(resumo.uuid)) {
    throw new ErroApp('Não sei o UUID deste jogador, então não acho os arquivos dele.')
  }
  return comServidorDesligado(async () => {
    await compactarMundo(info, undefined, 'jogadores')
    const apagar = async (tipo: keyof typeof PASTAS): Promise<void> => {
      const caminho = await arquivoDoJogador(info, resumo.uuid, tipo)
      if (caminho) await rm(caminho, { force: true })
    }
    try {
      if (opcoes.includes('estatisticas')) await apagar('stats')
      if (opcoes.includes('avancos')) await apagar('avancos')
      if (opcoes.includes('dados')) return await apagar('dat') // apaga o resto do .dat junto
      const campos = opcoes.flatMap((o) => CAMPOS_DAT[o] ?? [])
      const dat = await arquivoDoJogador(info, resumo.uuid, 'dat')
      if (!campos.length || !dat) return
      const temporario = `${dat}.servsquare`
      await writeFile(temporario, limparNaRaiz(await readFile(dat), campos))
      await rename(temporario, dat)
    } catch (e) {
      throw new ErroApp(
        'Não consegui apagar os dados do jogador. O backup do mundo foi feito antes, na tela Cópias de segurança.',
        detalhar(e)
      )
    }
  })
}

export function acaoJogador(valor: unknown, acao: unknown): void {
  const nome = validarJogador(valor)
  if (!estaOnline(nome)) throw new ErroApp('Disponível com o jogador online.')
  enviarComando(comandoDaAcao(nome, acao))
}

// ---------- Cabeça da skin (cache de 24 h na pasta de dados) ----------

const UM_DIA = 24 * 60 * 60 * 1000
const buscando = new Map<string, Promise<string | null>>()

async function baixarCabeca(uuid: string): Promise<Buffer> {
  const perfil = await buscarJsonOpcional<{ properties?: { name: string; value: string }[] }>(
    `https://sessionserver.mojang.com/session/minecraft/profile/${uuid.replace(/-/g, '')}`
  )
  const texturas = perfil?.properties?.find((p) => p.name === 'textures')?.value
  if (!texturas) throw new Error('perfil sem skin')
  const url = new URL(
    JSON.parse(Buffer.from(texturas, 'base64').toString('utf8')).textures.SKIN.url
  )
  if (url.hostname !== 'textures.minecraft.net') throw new Error(`skin fora da Mojang: ${url}`)
  url.protocol = 'https:'
  const skin = nativeImage.createFromBuffer(await buscarBytes(url.href))
  const { width, height } = skin.getSize()
  if (width !== 64 || (height !== 64 && height !== 32)) throw new Error(`skin ${width}×${height}`)
  const rosto = rostoComChapeu(skin.toBitmap(), width)
  return nativeImage.createFromBitmap(rosto, { width: 8, height: 8 }).toPNG()
}

// Data URL do rosto, ou null para a tela usar o fallback (sem internet, sem skin, servidor offline).
export function cabecaJogador(info: InfoServidor, uuid: unknown): Promise<string | null> {
  if (typeof uuid !== 'string' || !UUID.test(uuid)) return Promise.resolve(null)
  const chave = uuid.toLowerCase()
  let pedido = buscando.get(chave)
  if (!pedido) {
    pedido = (async () => {
      // Servidor em modo offline: os UUIDs não são de contas da Mojang.
      if ((await lerArquivoPropriedades(info.pasta)).get('online-mode') === 'false') return null
      const pasta = join(app.getPath('userData'), 'cabecas')
      const arquivo = join(pasta, `${chave}.png`)
      const cache = await stat(arquivo).catch(() => null)
      let png: Buffer | null = null
      if (!cache || Date.now() - cache.mtimeMs > UM_DIA) {
        png = await baixarCabeca(chave).catch(() => null)
        if (png) {
          await mkdir(pasta, { recursive: true })
          await writeFile(arquivo, png)
        }
      }
      png ??= cache ? await readFile(arquivo) : null // sem internet: usa a antiga, se tiver
      return png && `data:image/png;base64,${png.toString('base64')}`
    })().finally(() => buscando.delete(chave))
    buscando.set(chave, pedido)
  }
  return pedido
}
