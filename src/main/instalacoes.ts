import { app, dialog, shell, type BrowserWindow } from 'electron'
import { createHash, randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { copyFile, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, dirname, extname, join, relative } from 'path'
import {
  BIOMAS,
  LOADERS_CLIENTE,
  type Bioma,
  type EdicaoInstalacao,
  type MemoriaJogo,
  type StatusServidorJogo,
  type InfoServidor,
  type EstadoConviteInstalacao,
  type Manifesto,
  type Instalacao,
  type LoaderCliente,
  type PedidoInstalacao,
  type ResultadoJogar,
  type TipoId,
  type SituacaoPedido
} from '../shared/tipos'
import { garantirVersaoCliente, versaoDoLoader } from './clienteLoader'
import { tar as tarCriar } from './backup'
import { urlDoModrinth } from './modsRegras'
import {
  GERIDAS,
  aRemover,
  arquivosDesejados,
  compararManifestos,
  lerConvite as lerConviteTexto,
  modsProibidos,
  precisaAtualizar,
  sobrescreverOverride,
  urlDoManifesto,
  nickValido,
  normalizarUuid,
  MAX_RECADO,
  urlDaSituacao,
  urlDoPedido,
  validarManifesto
} from './conviteRegras'
import { gravarComSeguranca, lerArquivoPropriedades, lerTexto, limitesRam } from './config'
import { detalhar, ErroApp } from './erros'
import { lerIcone } from './icone'
import {
  abrirLauncher,
  anotarFalha,
  detectarLauncher,
  exigirPerfis,
  gravarPerfil,
  ABRIR_LAUNCHER_LIGADO,
  launcherAberto,
  MINECRAFT,
  removerPerfil
} from './launcherOficial'
import {
  escolherShader,
  faltandoNaPasta,
  montarPerfil,
  pastaDoNome,
  servidorNoTopo
} from './launcherRegras'
import { caminhoDoPack, loaderDoIndice, sugerirRam, type ArquivoIndice } from './modpackRegras'
import {
  abrirPack,
  baixarArquivos,
  baixarPack,
  comCancelar,
  descobrirVersaoLoader,
  limparCacheDe,
  montarPacoteAmigos
} from './modpacks'
import { Cancelado, limitarProgresso } from './filaDownloads'
import { apagarEmTrabalhador, hashEmTrabalhador } from './hashTrabalhador'
import * as modrinth from './modrinth'
import { sha1 } from './mods'
import { lerGuardados, registrarPendencias } from './downloadsManuais'
import { javaDaVersao } from './mojang'
import { faltandoDo } from './modsQueFaltam'
import { baixar, buscarJsonOpcional, type AoProgredir } from './rede'
import { lerEstado, ligar } from './servidor'
import { lerJogadores } from './jogadores'
import { ativarServidor } from './listaServidores'
import { pingar, vigiarJogo } from './jogo'
import { ipRadmin, resolverEndereco } from './conexao'
import { lookup } from 'dns/promises'
import { isIP } from 'net'
import { rodarChecagens, type Checagem, type LinhaDiagnostico } from '../shared/diagnosticoRegras'
import { lembrarNick, lerAjustesJogo } from './ajustesJogo'
import { caminhoDaCaptura, type PastaDePrints } from './capturas'
import { contarModsDaInstalacao, dividirMemoria } from './jogoRegras'
import { nomeDeExibicao } from './nomeRegras'
import { totalmem } from 'os'
import { proibidosDoServidor } from './convites'
import { ativarPacks } from './compatRegras'
import { lerIndice as lerIndiceServidores, lerInfo } from './servidores'
import { tiposDeServidor } from './tipos'

// Instalações do PlaySquare (Fase P1). O índice fica em instalacoes.json, na pasta de dados do
// app; cada instalação tem a própria pasta de jogo em Documentos/ServSquare/jogo/<instalação>.
// Mundos, prints e configurações da pasta nunca são apagados por uma atualização: o app só troca
// os arquivos que ele mesmo pôs (anotados em hubsquare-instalacao.json, dentro da pasta).

type Salva = Omit<Instalacao, 'imagem' | 'convite' | 'temFundo' | 'instalada' | 'atualizar'> & {
  arquivoImagem: string | null
  recusados?: string[] // recomendados do convite que o jogador não quer
  perguntouOpcoes?: boolean // já perguntou se copia o options.txt da .minecraft (Fase P3)
  arquivoFundo?: string | null // fundo do banner da tela Jogar (Fase P4)
  instaladaEm?: string // ISO: a pasta foi montada pelo INSTALAR (Correção P1)
  assinaturaInstalada?: string // o que estava no servidor/instalação quando montou
}

interface IndiceInstalacoes {
  instalacoes: Salva[]
  // Servidores cuja instalação o usuário apagou: o app não cria outra sozinho.
  ignorados: string[]
}

const arquivoIndice = (): string => join(app.getPath('userData'), 'instalacoes.json')
export const pastaJogoPadrao = (): string => join(app.getPath('documents'), 'ServSquare', 'jogo')

// Onde ficam as instalações novas (Ajustes do jogo; as que já existem não mudam de lugar).
export async function pastaJogo(): Promise<string> {
  return (await lerAjustesJogo()).pastaInstalacoes ?? pastaJogoPadrao()
}

// Memória das instalações novas: a padrão dos Ajustes do jogo ou, sem ela, a sugestão.
async function memoriaInicial(sugestao: number): Promise<number> {
  const padrao = (await lerAjustesJogo()).memoriaPadrao
  return Math.min(padrao ?? sugestao, limitesRam().max)
}
const REGISTRO = 'hubsquare-instalacao.json' // o que o app pôs na pasta: caminho → SHA-1
const IMAGEM = 'hubsquare-imagem'
const FUNDO = 'hubsquare-fundo'
const TIPOS_IMAGEM: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

let cache: IndiceInstalacoes | null = null
let jogando = false

async function lerIndice(): Promise<IndiceInstalacoes> {
  if (cache) return cache
  const texto = await lerTexto(arquivoIndice())
  cache = texto ? (JSON.parse(texto) as IndiceInstalacoes) : { instalacoes: [], ignorados: [] }
  return cache
}

async function gravar(indice: IndiceInstalacoes): Promise<void> {
  cache = indice
  await gravarComSeguranca(arquivoIndice(), JSON.stringify(indice, null, 2))
}

async function mudar(id: string, mudancas: Partial<Salva>): Promise<Salva> {
  const indice = await lerIndice()
  const atual = indice.instalacoes.find((i) => i.id === id)
  if (!atual) throw new ErroApp('Essa instalação não existe mais. Atualize a lista.')
  const nova = { ...atual, ...mudancas }
  await gravar({
    ...indice,
    instalacoes: indice.instalacoes.map((i) => (i.id === id ? nova : i))
  })
  return nova
}

async function exigir(id: unknown): Promise<Salva> {
  const i = (await lerIndice()).instalacoes.find((x) => x.id === id)
  if (!i) throw new ErroApp('Essa instalação não existe mais. Atualize a lista.')
  return i
}

const loaderDoServidor = (tipo: TipoId): LoaderCliente =>
  tipo === 'paper' || tipo === 'vanilla' ? 'vanilla' : tipo

// Pasta nova dentro de jogo/, sem repetir nome.
async function pastaNova(nome: string): Promise<string> {
  const base = pastaDoNome(nome)
  const raiz = await pastaJogo()
  let pasta = join(raiz, base)
  for (let n = 2; existsSync(pasta); n++) pasta = join(raiz, `${base} (${n})`)
  await mkdir(pasta, { recursive: true })
  return pasta
}

function validarNome(nome: unknown): string {
  if (typeof nome !== 'string' || !nome.trim()) throw new ErroApp('Dê um nome para a instalação.')
  if (nome.trim().length > 48) throw new ErroApp('Use um nome de até 48 letras.')
  return nome.trim()
}

function validarRam(ram: unknown): number {
  const { min, max } = limitesRam()
  if (typeof ram !== 'number' || !Number.isInteger(ram) || ram < min || ram > max) {
    throw new ErroApp(`A RAM precisa ficar entre ${min} e ${max} GB.`)
  }
  return ram
}

function validarLoader(loader: unknown): LoaderCliente {
  if (!LOADERS_CLIENTE.includes(loader as LoaderCliente))
    throw new ErroApp('Escolha um loader da lista.')
  return loader as LoaderCliente
}

async function validarVersao(versao: unknown, loader: LoaderCliente): Promise<string> {
  if (typeof versao !== 'string' || !(await versoesDoLoader(loader)).includes(versao)) {
    throw new ErroApp('Escolha uma versão do Minecraft da lista.')
  }
  return versao
}

export function versoesDoLoader(loader: unknown): Promise<string[]> {
  return tiposDeServidor[validarLoader(loader)].listarVersoes()
}

async function imagemDe(i: Salva): Promise<string | null> {
  if (i.arquivoImagem) {
    const dados = await readFile(join(i.pasta, i.arquivoImagem)).catch(() => null)
    const tipo = TIPOS_IMAGEM[extname(i.arquivoImagem).toLowerCase()]
    if (dados && tipo) return `data:${tipo};base64,${dados.toString('base64')}`
  }
  if (i.origem.tipo === 'servidor') {
    const item = (await lerIndiceServidores()).servidores.find(
      (s) => s.id === (i.origem as { servidorId: string }).servidorId
    )
    return item ? lerIcone(item.pasta) : null
  }
  return null
}

// Cada servidor do ServSquare tem a sua instalação: cria as que faltam e acompanha nome, versão
// e loader do servidor. As de servidores apagados continuam (viram instalações comuns).
async function sincronizarComServidores(): Promise<void> {
  const indice = await lerIndice()
  const servidores = (await lerIndiceServidores()).servidores
  let mudou = false
  const instalacoes = [...indice.instalacoes]
  for (const s of servidores) {
    const info = await lerInfo(s)
    if (!info) continue
    const loader = loaderDoServidor(info.tipo)
    const versaoLoader = loader === 'vanilla' ? null : (info.versaoLoader ?? null)
    const pos = instalacoes.findIndex(
      (i) => i.origem.tipo === 'servidor' && i.origem.servidorId === s.id
    )
    // Fase V3: o nome com os pontos da versão do pack (a pasta da instalação não muda).
    const nome = nomeDeExibicao(info.nome, info.modpack)
    if (pos >= 0) {
      const i = instalacoes[pos]
      if (
        i.versao !== info.versao ||
        i.loader !== loader ||
        i.versaoLoader !== versaoLoader ||
        i.nome !== nome
      ) {
        instalacoes[pos] = { ...i, nome, versao: info.versao, loader, versaoLoader }
        mudou = true
      }
      continue
    }
    if (indice.ignorados.includes(s.id)) continue
    instalacoes.push({
      id: randomUUID().replace(/-/g, ''),
      nome,
      versao: info.versao,
      loader,
      versaoLoader,
      ram: await memoriaInicial(4),
      pasta: await pastaNova(info.nome),
      origem: { tipo: 'servidor', servidorId: s.id },
      criada: new Date().toISOString(),
      ultimoUso: null,
      arquivoImagem: null
    })
    mudou = true
  }
  if (mudou) await gravar({ ...indice, instalacoes })
}

export async function listarInstalacoes(): Promise<Instalacao[]> {
  await sincronizarComServidores()
  const { instalacoes } = await lerIndice()
  return Promise.all(
    instalacoes.map(async ({ arquivoImagem: _a, ...i }) => ({
      ...i,
      imagem: await imagemDe({ ...i, arquivoImagem: _a }),
      convite: await estadoDoConvite({ ...i, arquivoImagem: _a }),
      temFundo: !!i.arquivoFundo && existsSync(join(i.pasta, i.arquivoFundo)),
      ...(await situacaoDaInstalacao({ ...i, arquivoImagem: _a }))
    }))
  )
}

async function adicionar(nova: Salva): Promise<Salva> {
  const indice = await lerIndice()
  await gravar({ ...indice, instalacoes: [...indice.instalacoes, nova] })
  return nova
}

export async function criarDoZero(pedido: unknown): Promise<void> {
  const p = (pedido ?? {}) as Partial<PedidoInstalacao>
  const nome = validarNome(p.nome)
  const loader = validarLoader(p.loader)
  const versao = await validarVersao(p.versao, loader)
  await adicionar({
    id: randomUUID().replace(/-/g, ''),
    nome,
    versao,
    loader,
    versaoLoader: null,
    ram: validarRam(p.ram),
    pasta: await pastaNova(nome),
    origem: { tipo: 'zero' },
    criada: new Date().toISOString(),
    ultimoUso: null,
    arquivoImagem: null
  })
}

// Modpack do Modrinth (busca do Explorar): baixa o .mrpack e põe na pasta o que o jogador usa.
export async function criarDeModpack(projetoId: unknown, aoProgredir: AoProgredir): Promise<void> {
  if (typeof projetoId !== 'string' || !/^[\w-]{1,64}$/.test(projetoId)) {
    throw new ErroApp('Modpack inválido. Escolha um da lista.')
  }
  await comCancelar(async (sinal) => {
    const {
      arquivo,
      temporario,
      versao: v
    } = await baixarPack(projetoId, undefined, aoProgredir, sinal)
    try {
      await instalarPackNoJogo(arquivo, { projetoId, versaoId: v.id }, aoProgredir, sinal)
    } finally {
      await rm(temporario, { recursive: true, force: true }).catch(() => {})
    }
  })
}

// Põe um .mrpack numa instalação nova. Tudo acontece numa pasta provisória, que só vira a
// instalação no fim; cancelar ou falhar não deixa nada pela metade.
export async function instalarPackNoJogo(
  arquivo: string,
  origem: { projetoId: string; versaoId: string },
  aoProgredir: AoProgredir,
  sinal?: AbortSignal
): Promise<string> {
  const { projetoId } = origem
  const avisar = limitarProgresso(aoProgredir)
  let pasta: string | null = null
  let provisoria: string | null = null
  try {
    const pack = await abrirPack(arquivo, avisar, sinal)
    try {
      const { tipo, versaoLoader } = (() => {
        try {
          return loaderDoIndice(pack.indice.dependencies)
        } catch (e) {
          throw new ErroApp((e as Error).message)
        }
      })()
      const versao = pack.indice.dependencies.minecraft
      await javaDaVersao(versao) // confere que a versão existe na Mojang
      const nome = validarNome(pack.indice.name.slice(0, 48))
      pasta = await pastaNova(nome)
      provisoria = join(dirname(pasta), `.instalando-${randomUUID()}`)
      const doJogador = pack.indice.files.filter((f) => f.env?.client !== 'unsupported')
      await aplicarConteudo(
        provisoria,
        doJogador,
        [join(pack.pasta, 'overrides'), join(pack.pasta, 'client-overrides')],
        null,
        avisar,
        sinal
      )
      const projeto = (await modrinth.projetos([projetoId]).catch(() => new Map())).get(projetoId)
      let arquivoImagem: string | null = null
      if (projeto?.icon_url && /^https:\/\/cdn\.modrinth\.com\//.test(projeto.icon_url)) {
        const ext = extname(new URL(projeto.icon_url).pathname).toLowerCase()
        if (TIPOS_IMAGEM[ext]) {
          arquivoImagem = `${IMAGEM}${ext}`
          await baixar(
            projeto.icon_url,
            join(provisoria, arquivoImagem),
            undefined,
            'Baixando a capa',
            () => {}
          ).catch(() => (arquivoImagem = null))
        }
      }
      let arquivoFundo: string | null = null
      const capa =
        projeto?.gallery?.find((g: { featured?: boolean }) => g.featured) ?? projeto?.gallery?.[0]
      if (capa?.url && /^https:\/\/cdn\.modrinth\.com\//.test(capa.url)) {
        const ext = extname(new URL(capa.url).pathname).toLowerCase()
        if (TIPOS_IMAGEM[ext]) {
          arquivoFundo = `${FUNDO}${ext}`
          await baixar(
            capa.url,
            join(provisoria, arquivoFundo),
            undefined,
            'Baixando a capa',
            () => {}
          ).catch(() => (arquivoFundo = null))
        }
      }
      const mods = doJogador.filter((f) => f.path.startsWith('mods/')).length
      if (sinal?.aborted) throw new Cancelado()
      // Pronto: a provisória vira a pasta da instalação (a reservada por pastaNova está vazia).
      await apagarEmTrabalhador(pasta)
      await rename(provisoria, pasta)
      provisoria = null
      const id = randomUUID().replace(/-/g, '')
      await adicionar({
        id,
        nome,
        versao,
        loader: loaderDoServidor(tipo),
        versaoLoader,
        ram: await memoriaInicial(sugerirRam(mods, limitesRam().max).gb),
        pasta,
        origem: {
          tipo: 'modpack',
          projetoId,
          versaoId: origem.versaoId,
          nomePack: pack.indice.name
        },
        criada: new Date().toISOString(),
        ultimoUso: null,
        arquivoImagem,
        arquivoFundo
      })
      pasta = null // deu certo: a pasta fica
      return id
    } finally {
      await apagarEmTrabalhador(pack.pasta).catch(() => {})
    }
  } finally {
    if (provisoria) await apagarEmTrabalhador(provisoria).catch(() => {})
    if (pasta) await apagarEmTrabalhador(pasta).catch(() => {})
  }
}

export async function editarInstalacao(id: unknown, edicao: unknown): Promise<void> {
  const i = await exigir(id)
  const e = (edicao ?? {}) as Partial<EdicaoInstalacao>
  const mudancas: Partial<Salva> = { nome: validarNome(e.nome), ram: validarRam(e.ram) }
  // Versão e loader de uma instalação de servidor seguem o servidor; nas outras, o usuário escolhe.
  if (i.origem.tipo === 'zero' && (e.versao !== undefined || e.loader !== undefined)) {
    const loader = validarLoader(e.loader ?? i.loader)
    mudancas.loader = loader
    mudancas.versao = await validarVersao(e.versao ?? i.versao, loader)
    if (mudancas.versao !== i.versao || loader !== i.loader) mudancas.versaoLoader = null
  }
  await mudar(i.id, mudancas)
}

// A cópia é independente: vira uma instalação comum, com a pasta copiada (mundos inclusive).
export async function duplicarInstalacao(id: unknown, aoProgredir: AoProgredir): Promise<void> {
  const i = await exigir(id)
  const nome = `${i.nome} (cópia)`.slice(0, 48)
  const pasta = await pastaNova(nome)
  aoProgredir({ etapa: `Copiando a pasta de ${i.nome}`, recebido: 0, total: 0 })
  await cp(i.pasta, pasta, { recursive: true, force: false, errorOnExist: false })
  await adicionar({
    ...i,
    id: randomUUID().replace(/-/g, ''),
    nome,
    pasta,
    // A cópia é independente: não segue mais o servidor nem o convite.
    origem:
      i.origem.tipo === 'servidor' || i.origem.tipo === 'convite' ? { tipo: 'zero' } : i.origem,
    criada: new Date().toISOString(),
    ultimoUso: null
  })
}

export async function abrirPastaInstalacao(id: unknown): Promise<void> {
  const i = await exigir(id)
  await mkdir(i.pasta, { recursive: true })
  const erro = await shell.openPath(i.pasta)
  if (erro) throw new ErroApp('Não consegui abrir a pasta da instalação.', erro)
}

// Apagar: o perfil sai do launcher e a pasta vai para a Lixeira (mundos e prints dá para recuperar).
export async function apagarInstalacao(id: unknown): Promise<void> {
  const i = await exigir(id)
  if (await launcherAberto()) {
    throw new ErroApp('Feche o Minecraft Launcher antes de apagar uma instalação.')
  }
  await removerPerfil(chaveDoPerfil(i.id))
  if (existsSync(i.pasta)) {
    try {
      await shell.trashItem(i.pasta)
    } catch (e) {
      throw new ErroApp(
        'Não consegui mandar a pasta da instalação para a Lixeira. Feche o jogo e tente de novo.',
        String(e)
      )
    }
  }
  const indice = await lerIndice()
  await gravar({
    instalacoes: indice.instalacoes.filter((x) => x.id !== i.id),
    ignorados:
      i.origem.tipo === 'servidor'
        ? [...new Set([...indice.ignorados, i.origem.servidorId])]
        : indice.ignorados
  })
}

export async function escolherImagemInstalacao(
  id: unknown,
  janela: BrowserWindow | null
): Promise<void> {
  const i = await exigir(id)
  const opcoes = {
    title: 'Escolha a imagem da instalação',
    properties: ['openFile' as const],
    filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  }
  const escolha = janela
    ? await dialog.showOpenDialog(janela, opcoes)
    : await dialog.showOpenDialog(opcoes)
  const origem = escolha.filePaths[0]
  if (escolha.canceled || !origem) return
  const ext = extname(origem).toLowerCase()
  if (!TIPOS_IMAGEM[ext]) throw new ErroApp('Escolha uma imagem PNG, JPG ou WEBP.')
  if ((await stat(origem)).size > 15 * 1024 * 1024)
    throw new ErroApp('Essa imagem é muito grande. Escolha uma de até 15 MB.')
  await mkdir(i.pasta, { recursive: true })
  const nome = `${IMAGEM}${ext}`
  await copyFile(origem, join(i.pasta, nome))
  if (i.arquivoImagem && i.arquivoImagem !== nome) {
    await rm(join(i.pasta, i.arquivoImagem), { force: true })
  }
  await mudar(i.id, { arquivoImagem: nome })
}

// ---------- Conteúdo da pasta ----------

async function lerRegistro(pasta: string): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(join(pasta, REGISTRO), 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}

// Põe na pasta os arquivos do índice (baixados com hash conferido, ou copiados de `copiarDe` quando
// o mesmo arquivo já está lá) e os overrides. Arquivos geridos que saíram do pack são removidos;
// configurações que o jogador já tem nunca são sobrescritas.
async function aplicarConteudo(
  pasta: string,
  arquivos: ArquivoIndice[],
  overrides: string[],
  copiarDe: string | null,
  aoProgredir: AoProgredir,
  sinal?: AbortSignal // Cancelar (instalação de modpack)
): Promise<void> {
  // Hash num worker: milhares de arquivos de um modpack não travam a janela.
  const sha1 = (c: string): Promise<string> => hashEmTrabalhador(c)
  const avisar = limitarProgresso(aoProgredir)
  const antes = await lerRegistro(pasta)
  const registro: Record<string, string> = {}
  const faltam: ArquivoIndice[] = []
  for (const f of arquivos) {
    if (!caminhoDoPack(f.path)) continue
    const destino = join(pasta, f.path)
    registro[f.path] = f.hashes.sha1
    if (existsSync(destino) && (await sha1(destino)) === f.hashes.sha1) continue
    const local = copiarDe ? join(copiarDe, f.path) : null
    if (local && existsSync(local) && (await sha1(local)) === f.hashes.sha1) {
      await mkdir(dirname(destino), { recursive: true })
      await copyFile(local, destino)
      continue
    }
    faltam.push(f)
  }
  if (faltam.length) await baixarArquivos(faltam, pasta, aoProgredir, undefined, sinal)

  for (const base of overrides) {
    if (!existsSync(base)) continue
    const itens = (await readdir(base, { recursive: true, withFileTypes: true })).filter((x) =>
      x.isFile()
    )
    let feitos = 0
    for (const item of itens) {
      if (sinal?.aborted) throw new Cancelado()
      avisar({
        etapa: `Copiando as configurações: ${++feitos} de ${itens.length} arquivos`,
        recebido: feitos,
        total: itens.length
      })
      const absoluto = join(item.parentPath, item.name)
      const caminho = relative(base, absoluto).replace(/\\/g, '/')
      if (!caminhoDoPack(caminho) || caminho === REGISTRO) continue
      const destino = join(pasta, caminho)
      // Configuração que o jogador já tem: fica a dele.
      if (!sobrescreverOverride(caminho, existsSync(destino))) continue
      if (GERIDAS.test(caminho)) {
        registro[caminho] = await sha1(absoluto)
        if (existsSync(destino) && (await sha1(destino)) === registro[caminho]) continue
      }
      await mkdir(dirname(destino), { recursive: true })
      await copyFile(absoluto, destino)
    }
  }

  // O que o app tinha posto e não faz mais parte: sai (só .jar/packs geridos, nunca mundos).
  for (const caminho of aRemover(antes, registro)) {
    await rm(join(pasta, caminho), { force: true })
  }
  await writeFile(join(pasta, REGISTRO), JSON.stringify(registro, null, 2))
  if (faltam.length) await limparCacheDe(faltam)
}

// Instalação de servidor: os mesmos mods, resource packs e shaders do Pacote pros amigos.
// Correção M1: mods, resource packs e shaders que estão na pasta da instalação ("mods/x.jar").
async function presentesNaPasta(pasta: string): Promise<string[]> {
  const lista: string[] = []
  for (const sub of ['mods', 'resourcepacks', 'shaderpacks']) {
    for (const n of await readdir(join(pasta, sub)).catch(() => [] as string[]))
      lista.push(`${sub}/${n}`)
  }
  return lista
}

// Antes de abrir o launcher: tudo o que a instalação precisa tem que estar na pasta.
async function exigirNaPasta(pasta: string, esperados: string[]): Promise<void> {
  const faltam = faltandoNaPasta(esperados, await presentesNaPasta(pasta))
  if (faltam.length) {
    throw new ErroApp(
      `${faltam.length} arquivos da instalação não chegaram na pasta, então o jogo não foi aberto (abriria sem eles). Clique em INSTALAR de novo.`,
      faltam.join('\n')
    )
  }
}

// Iris (Fabric/NeoForge) ou Oculus (Forge): com shader na pasta, deixa um escolhido.
async function escolherShaderDaPasta(i: Salva): Promise<void> {
  if (i.loader === 'vanilla') return
  const shaders = (await readdir(join(i.pasta, 'shaderpacks')).catch(() => [] as string[])).sort()
  if (!shaders.length) return
  const arquivo = join(
    i.pasta,
    'config',
    i.loader === 'forge' ? 'oculus.properties' : 'iris.properties'
  )
  const antes = await readFile(arquivo, 'utf8').catch(() => '')
  const depois = escolherShader(antes, shaders)
  if (depois === antes) return
  await mkdir(dirname(arquivo), { recursive: true })
  await writeFile(arquivo, depois)
}

async function sincronizarDoServidor(i: Salva, aoProgredir: AoProgredir): Promise<string | null> {
  if (i.origem.tipo !== 'servidor') return null
  const servidorId = i.origem.servidorId
  const item = (await lerIndiceServidores()).servidores.find((s) => s.id === servidorId)
  const info = item ? await lerInfo(item) : null
  // Correção M1: sem o servidor não há de onde tirar os mods; abrir assim seria o jogo vazio.
  if (!info) {
    throw new ErroApp(
      `O servidor da instalação ${i.nome} não existe mais neste PC, então não sei quais mods ela precisa. Apague essa instalação em Instalações e use a do servidor que está em ServSquare › Servidores.`
    )
  }
  aoProgredir({ etapa: 'Conferindo os mods do servidor', recebido: 0, total: 0 })
  const montagem = join(tmpdir(), `hubsquare-sincronia-${randomUUID()}`)
  try {
    const { arquivos } = await montarPacoteAmigos(info, montagem, true)
    const packs = arquivos
      .filter((a) => a.path.startsWith('resourcepacks/'))
      .map((a) => a.path.slice('resourcepacks/'.length))
    await aplicarConteudo(
      i.pasta,
      arquivos,
      [join(montagem, 'overrides'), join(montagem, 'client-overrides')],
      info.pasta,
      aoProgredir
    )
    if (packs.length) await aplicarPacks(i.pasta, packs)
    await exigirNaPasta(
      i.pasta,
      arquivos.map((a) => a.path)
    )
  } finally {
    await apagarEmTrabalhador(montagem).catch(() => {})
  }
  // O jogador entra pelo próprio PC: o endereço é localhost com a porta do servidor.
  const porta = (await lerArquivoPropriedades(info.pasta)).get('server-port') || '25565'
  const dat = join(i.pasta, 'servers.dat')
  const antigo = await readFile(dat).catch(() => null)
  await writeFile(dat, servidorNoTopo(antigo, info.nome, `localhost:${porta}`))
  const ligado = (await lerIndiceServidores()).ativo === servidorId && lerEstado() === 'ligado'
  return ligado
    ? null
    : `O servidor ${info.nome} está desligado. Ligue no ServSquare antes de entrar.`
}

// ---------- Convites (Fase P2), lado do amigo ----------

const APLICADO = 'hubsquare-manifesto.json' // o que está instalado na pasta
const DISPONIVEL = 'hubsquare-manifesto-disponivel.json' // o último que o servidor mandou
const online = new Map<string, boolean>() // id da instalação → conseguiu falar com o servidor

// Fase M7: aplicado com o convite de outro dono conta como nada aplicado (a lista é outra).
const versaoAplicadaDe = (aplicado: Manifesto | null, disponivel: Manifesto): number =>
  aplicado && aplicado.conviteId === disponivel.conviteId ? aplicado.versao : 0

async function lerManifesto(pasta: string, nome: string): Promise<Manifesto | null> {
  try {
    return validarManifesto(JSON.parse(await readFile(join(pasta, nome), 'utf8')))
  } catch {
    return null
  }
}

// Pergunta ao servidor do convite, tentando cada endereço (5 s cada). null: ninguém respondeu.
async function baixarManifesto(enderecos: string[], token: string): Promise<Manifesto | null> {
  for (const e of enderecos) {
    try {
      const r = await fetch(urlDoManifesto(e, token), { signal: AbortSignal.timeout(5000) })
      if (!r.ok) continue
      const texto = await r.text()
      if (texto.length > 5_000_000) continue
      return validarManifesto(JSON.parse(texto))
    } catch {
      // próximo endereço
    }
  }
  return null
}

// Atualiza o manifesto disponível de uma instalação de convite. Devolve se respondeu.
async function verificarUm(i: Salva): Promise<boolean> {
  if (i.origem.tipo !== 'convite') return false
  const m = await baixarManifesto(i.origem.enderecos, i.origem.token)
  const ok = !!m && m.conviteId === i.origem.conviteId
  online.set(i.id, ok)
  if (ok) {
    const atual = await lerManifesto(i.pasta, DISPONIVEL)
    // Nunca volta para trás (ex.: o dono restaurou um backup antigo do convite).
    if (!atual || m!.versao >= atual.versao) {
      await writeFile(join(i.pasta, DISPONIVEL), JSON.stringify(m, null, 2))
    }
  }
  return ok
}

// Ao abrir o PlaySquare: confere todos os convites de uma vez.
export async function verificarConvites(): Promise<void> {
  const { instalacoes } = await lerIndice()
  await Promise.all(
    instalacoes
      .filter((i) => i.origem.tipo === 'convite')
      .map(async (i) => {
        await verificarUm(i)
        await atualizarPedido(i) // pedido que ficou para depois (dono estava desligado)
      })
  )
}

async function estadoDoConvite(i: Salva): Promise<EstadoConviteInstalacao | undefined> {
  if (i.origem.tipo !== 'convite') return undefined
  const aplicado = await lerManifesto(i.pasta, APLICADO)
  const disponivel = (await lerManifesto(i.pasta, DISPONIVEL)) ?? aplicado
  const recusados = i.recusados ?? []
  const { entra, sai } = disponivel
    ? compararManifestos(aplicado, disponivel, recusados)
    : { entra: [], sai: [] }
  return {
    versaoAplicada: disponivel ? versaoAplicadaDe(aplicado, disponivel) : (aplicado?.versao ?? 0),
    versaoDisponivel: disponivel?.versao ?? 0,
    online: online.get(i.id) ?? null,
    entra,
    sai,
    semLink: disponivel?.semLink ?? [],
    opcionais: (disponivel?.arquivos ?? [])
      .filter((a) => !a.obrigatorio)
      .map((a) => ({ path: a.path, recusado: recusados.includes(a.path) }))
  }
}

// ---------- Pedido para entrar na whitelist (Fase M4) ----------

const PEDIDO = 'hubsquare-pedido.json' // na pasta da instalação de convite

interface PedidoAmigo {
  nick: string
  uuid: string
  recado: string
  enviado: boolean // false: o dono estava desligado; tenta de novo depois
  situacao: SituacaoPedido
}

async function lerPedidoAmigo(pasta: string): Promise<PedidoAmigo | null> {
  try {
    const p = JSON.parse(await readFile(join(pasta, PEDIDO), 'utf8')) as PedidoAmigo
    return nickValido(p.nick) && normalizarUuid(p.uuid) ? p : null
  } catch {
    return null
  }
}

// Confere o nick na API pública da Mojang (sem login) e pega o UUID da conta.
async function perfilDoNick(nick: unknown): Promise<{ nick: string; uuid: string }> {
  const nome = typeof nick === 'string' ? nick.trim() : ''
  if (!nickValido(nome)) {
    throw new ErroApp('Nick inválido. Nicks do Minecraft têm de 3 a 16 letras, números ou "_".')
  }
  const perfil = await buscarJsonOpcional<{ id: string; name: string }>(
    `https://api.mojang.com/users/profiles/minecraft/${nome}`
  )
  const uuid = normalizarUuid(perfil?.id)
  if (!perfil || !uuid || !nickValido(perfil.name)) {
    throw new ErroApp(
      `Não existe conta do Minecraft com o nick "${nome}". Confira se digitou certo.`
    )
  }
  return { nick: perfil.name, uuid }
}

// Pede ao dono (ou pergunta a situação, se já pediu). Sem resposta: fica para depois.
async function atualizarPedido(i: Salva): Promise<PedidoAmigo | null> {
  if (i.origem.tipo !== 'convite') return null
  const p = await lerPedidoAmigo(i.pasta)
  if (!p) return null
  for (const e of i.origem.enderecos) {
    try {
      const r = p.enviado
        ? await fetch(urlDaSituacao(e, i.origem.token, p.uuid), {
            signal: AbortSignal.timeout(5000)
          })
        : await fetch(urlDoPedido(e, i.origem.token), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nick: p.nick, uuid: p.uuid, recado: p.recado }),
            signal: AbortSignal.timeout(5000)
          })
      if (r.status !== 200 && r.status !== 409) continue
      const { situacao } = (await r.json()) as { situacao?: SituacaoPedido }
      const novo: PedidoAmigo = {
        ...p,
        enviado: true,
        situacao: ['pendente', 'aprovado', 'recusado', 'desconhecido'].includes(situacao ?? '')
          ? situacao!
          : p.situacao
      }
      await writeFile(join(i.pasta, PEDIDO), JSON.stringify(novo, null, 2))
      return novo
    } catch {
      // próximo endereço
    }
  }
  return p
}

// "Entrar com convite": código, link ou o conteúdo do arquivo .hubsquare.
// Cada convite (de cada dono) vira uma instalação; o mesmo convite de novo só atualiza ela.
// Fase M4: com o nick, o app pede ao dono para entrar na whitelist.
export async function entrarComConvite(texto: unknown, pedido?: unknown): Promise<void> {
  const { nick, recado } = (pedido ?? {}) as { nick?: unknown; recado?: unknown }
  const recadoLimpo = typeof recado === 'string' ? recado.trim() : ''
  if ([...recadoLimpo].length > MAX_RECADO || /\p{C}/u.test(recadoLimpo)) {
    throw new ErroApp(`O recado pode ter até ${MAX_RECADO} caracteres, numa linha só.`)
  }
  // Antes de tudo: nick inexistente não cria nada nem envia nada.
  const perfil = await perfilDoNick(nick)
  await lembrarNick(perfil.nick)
  let convite: ReturnType<typeof lerConviteTexto>
  try {
    convite = lerConviteTexto(texto)
  } catch (e) {
    throw new ErroApp((e as Error).message)
  }
  const baixado = convite.enderecos.length
    ? await baixarManifesto(convite.enderecos, convite.token)
    : null
  const manifesto =
    baixado && (!convite.manifesto || baixado.conviteId === convite.manifesto.conviteId)
      ? baixado
      : convite.manifesto
  if (!manifesto) {
    throw new ErroApp(
      'Não consegui falar com o servidor do convite. Peça ao dono para abrir o HubSquare (e o Radmin ou o túnel do playit, se for o caso) ou para mandar o arquivo de convite.',
      `Endereços tentados: ${convite.enderecos.join(', ')}`
    )
  }
  const origem = {
    tipo: 'convite' as const,
    conviteId: manifesto.conviteId,
    enderecos: convite.enderecos,
    token: convite.token,
    servidor: manifesto.servidor
  }
  const indice = await lerIndice()
  let existente = indice.instalacoes.find(
    (i) => i.origem.tipo === 'convite' && i.origem.conviteId === manifesto.conviteId
  )
  // Fase M7: o mesmo servidor com outro dono (mesmo id fixo): a instalação continua a mesma,
  // só o endereço e o convite mudam.
  if (!existente && manifesto.servidorId) {
    for (const i of indice.instalacoes.filter((x) => x.origem.tipo === 'convite')) {
      const m = (await lerManifesto(i.pasta, DISPONIVEL)) ?? (await lerManifesto(i.pasta, APLICADO))
      if (m?.servidorId === manifesto.servidorId) {
        existente = i
        break
      }
    }
  }
  const pasta = existente?.pasta ?? (await pastaNova(manifesto.servidor))
  await mkdir(pasta, { recursive: true })
  const atual = await lerManifesto(pasta, DISPONIVEL)
  // Dono novo: a contagem de versões é outra (a dele começa do 1).
  if (!atual || atual.conviteId !== manifesto.conviteId || manifesto.versao >= atual.versao) {
    await writeFile(join(pasta, DISPONIVEL), JSON.stringify(manifesto, null, 2))
  }
  const anterior = await lerPedidoAmigo(pasta)
  if (anterior?.uuid !== perfil.uuid || anterior.situacao === 'recusado') {
    const novo: PedidoAmigo = {
      ...perfil,
      recado: recadoLimpo,
      enviado: false,
      situacao: 'desconhecido'
    }
    await writeFile(join(pasta, PEDIDO), JSON.stringify(novo, null, 2))
  }
  if (existente) {
    await mudar(existente.id, { origem })
    await atualizarPedido({ ...existente, origem })
    return
  }
  const id = randomUUID().replace(/-/g, '')
  online.set(id, !!baixado)
  await adicionar({
    id,
    nome: validarNome(manifesto.servidor),
    versao: manifesto.minecraft,
    loader: manifesto.loader,
    versaoLoader: manifesto.versaoLoader,
    ram: await memoriaInicial(
      sugerirRam(
        manifesto.arquivos.filter((a) => a.path.startsWith('mods/')).length,
        limitesRam().max
      ).gb
    ),
    pasta,
    origem,
    criada: new Date().toISOString(),
    ultimoUso: null,
    arquivoImagem: null
  })
  await atualizarPedido((await lerIndice()).instalacoes.find((x) => x.id === id)!)
}

export async function entrarComArquivoDeConvite(
  janela: BrowserWindow | null,
  pedido?: unknown
): Promise<boolean> {
  const opcoes = {
    title: 'Abrir o convite',
    properties: ['openFile' as const],
    filters: [{ name: 'Convite do HubSquare', extensions: ['hubsquare', 'json'] }]
  }
  const escolha = janela
    ? await dialog.showOpenDialog(janela, opcoes)
    : await dialog.showOpenDialog(opcoes)
  const arquivo = escolha.filePaths[0]
  if (escolha.canceled || !arquivo) return false
  if ((await stat(arquivo)).size > 5_000_000) throw new ErroApp('Esse arquivo não é um convite.')
  await entrarComConvite(await readFile(arquivo, 'utf8'), pedido)
  return true
}

// Instalação de convite: põe o que o manifesto pede (só o que veio do servidor muda; os mods
// "meus", mundos, prints e configurações ficam). Devolve avisos ou o motivo de não jogar.
async function prepararConvite(
  i: Salva,
  atualizar: boolean,
  aoProgredir: AoProgredir
): Promise<{ avisos: string[]; parar?: ResultadoJogar; manifesto?: Manifesto }> {
  if (i.origem.tipo !== 'convite') return { avisos: [] }
  aoProgredir({ etapa: `Conferindo o servidor ${i.origem.servidor}`, recebido: 0, total: 0 })
  const respondeu = await verificarUm(i)
  const aplicado = await lerManifesto(i.pasta, APLICADO)
  const disponivel = (await lerManifesto(i.pasta, DISPONIVEL)) ?? aplicado
  if (!disponivel)
    throw new ErroApp('Essa instalação perdeu o convite. Entre com o convite de novo.')
  const avisos: string[] = []
  if (!respondeu) {
    avisos.push(
      `Não consegui falar com o servidor ${i.origem.servidor} agora (ele pode estar desligado). Usei a última lista de mods baixada, versão ${disponivel.versao}.`
    )
  }
  if (precisaAtualizar(versaoAplicadaDe(aplicado, disponivel), disponivel.versao)) {
    if (!atualizar)
      return { avisos, parar: { situacao: 'desatualizada', convite: (await estadoDoConvite(i))! } }
    const arquivos = arquivosDesejados(disponivel, i.recusados ?? []).map((a) => ({
      path: a.path,
      hashes: { sha1: a.sha1, sha512: a.sha512 },
      downloads: a.downloads,
      fileSize: a.tamanho
    }))
    await aplicarConteudo(i.pasta, arquivos, [], null, aoProgredir)
    await writeFile(join(i.pasta, APLICADO), JSON.stringify(disponivel, null, 2))
  }
  // Mods do jogador (que o app não pôs) que o servidor proíbe: não deixa entrar com eles.
  const registro = await lerRegistro(i.pasta)
  const meus = existsSync(join(i.pasta, 'mods'))
    ? (await readdir(join(i.pasta, 'mods'))).filter(
        (n) => /.jar$/i.test(n) && !registro[`mods/${n}`] // só os ativos
      )
    : []
  const proibidos = modsProibidos(meus, disponivel.proibidos)
  if (proibidos.length) return { avisos, parar: { situacao: 'proibidos', arquivos: proibidos } }
  // Fase D: mods que o autor não deixa baixar: o amigo baixa pela página oficial, com o assistente.
  if (disponivel.manuais?.length) {
    await registrarPendencias(await infoDaInstalacao(i.id), disponivel.manuais).catch(() => {})
  }
  if (disponivel.semLink.length) {
    avisos.push(
      `O servidor usa mods que o app não pode baixar por você: ${disponivel.semLink.join(', ')}. Peça ao dono o link de cada um.`
    )
  }
  const endereco = disponivel.enderecos[0]
  if (endereco) {
    const dat = join(i.pasta, 'servers.dat')
    const antigo = await readFile(dat).catch(() => null)
    await writeFile(dat, servidorNoTopo(antigo, disponivel.servidor, endereco))
  }
  return { avisos, manifesto: disponivel }
}

const chaveDoPerfil = (id: string): string => `hubsquare-${id}`

// Resource packs do servidor ligados por cima dos do jogador, na ordem (só a linha resourcePacks).
async function aplicarPacks(pasta: string, packs: string[]): Promise<void> {
  const arquivo = join(pasta, 'options.txt')
  const antes = await readFile(arquivo, 'utf8').catch(() => '')
  const depois = ativarPacks(antes, packs)
  if (depois !== antes) await writeFile(arquivo, depois)
}

// Conteúdo › Recomendados: o jogador escolhe quais recomendados do servidor quer. Vale na hora.
export async function definirRecomendados(
  id: unknown,
  recusados: unknown,
  aoProgredir: AoProgredir
): Promise<void> {
  const i = await exigir(id)
  if (i.origem.tipo !== 'convite') throw new ErroApp('Só instalações de convite têm recomendados.')
  const lista = Array.isArray(recusados)
    ? recusados.filter((r): r is string => typeof r === 'string').slice(0, 500)
    : []
  await mudar(i.id, { recusados: lista })
  const aplicado = await lerManifesto(i.pasta, APLICADO)
  if (!aplicado) return // ainda não instalou: vale na primeira vez que jogar
  const arquivos = arquivosDesejados(aplicado, lista).map((a) => ({
    path: a.path,
    hashes: { sha1: a.sha1, sha512: a.sha512 },
    downloads: a.downloads,
    fileSize: a.tamanho
  }))
  await aplicarConteudo(i.pasta, arquivos, [], null, aoProgredir)
}

// A instalação no formato que as telas de mods do ServSquare usam (Explorar, Instalados, configs).
export async function infoDaInstalacao(id: unknown): Promise<InfoServidor> {
  const i = await exigir(id)
  await mkdir(i.pasta, { recursive: true })
  const registro = await lerRegistro(i.pasta)
  let servidor: string | null = null
  let proibidos: string[] = []
  let obrigatorios = Object.keys(registro)
  if (i.origem.tipo === 'convite') {
    const m = (await lerManifesto(i.pasta, APLICADO)) ?? (await lerManifesto(i.pasta, DISPONIVEL))
    servidor = i.origem.servidor
    proibidos = m?.proibidos ?? []
    obrigatorios = (m?.arquivos ?? []).filter((a) => a.obrigatorio).map((a) => a.path)
  } else if (i.origem.tipo === 'servidor') {
    const servidorId = i.origem.servidorId
    const item = (await lerIndiceServidores()).servidores.find((s) => s.id === servidorId)
    servidor = item?.nome ?? null
    proibidos = item ? await proibidosDoServidor(item.pasta) : []
  }
  return {
    id: `jogo:${i.id}`,
    nome: i.nome,
    tipo: i.loader,
    versao: i.versao,
    java: 0,
    pasta: i.pasta,
    versaoLoader: i.versaoLoader ?? undefined,
    jogador: {
      instalacaoId: i.id,
      servidor,
      proibidos,
      doServidor: Object.keys(registro),
      obrigatorios
    }
  }
}

export interface OpcoesJogar {
  atualizar?: boolean // o jogador viu o que entra e o que sai e confirmou
  recusados?: string[] // recomendados que ele não quer
  copiarOpcoes?: boolean // resposta da primeira vez: copiar o options.txt da .minecraft
}

// Jogar: prepara o que falta, grava o perfil no launcher oficial e abre o launcher.
// Quem faz login e abre o jogo é sempre o launcher oficial.
// Monta a pasta da instalação (mods, packs, shaders, configs e servers.dat), sem tocar no launcher
// nem na .minecraft. Serve ao INSTALAR e, quando ele for religado, ao Jogar.
async function prepararPasta(
  i: Salva,
  o: OpcoesJogar,
  aoProgredir: AoProgredir
): Promise<{ i: Salva; avisos: string[]; parar?: ResultadoJogar }> {
  await mkdir(i.pasta, { recursive: true })

  // Primeira vez: pergunta se copia teclas, vídeo e som da .minecraft normal (só lê de lá).
  const opcoesNormais = join(MINECRAFT(), 'options.txt')
  if (
    !i.perguntouOpcoes &&
    !existsSync(join(i.pasta, 'options.txt')) &&
    existsSync(opcoesNormais)
  ) {
    if (typeof o.copiarOpcoes !== 'boolean')
      return { i, avisos: [], parar: { situacao: 'copiarOpcoes' } }
    if (o.copiarOpcoes) await copyFile(opcoesNormais, join(i.pasta, 'options.txt'))
    i = await mudar(i.id, { perguntouOpcoes: true })
  }

  const convite = await prepararConvite(i, o.atualizar === true, aoProgredir)
  if (convite.parar) return { i, avisos: convite.avisos, parar: convite.parar }
  if (convite.manifesto?.packs?.length) await aplicarPacks(i.pasta, convite.manifesto.packs)
  const avisos: string[] = [...convite.avisos]
  if (convite.manifesto) {
    // A versão e o loader seguem o servidor do convite.
    const m = convite.manifesto
    if (m.minecraft !== i.versao || m.loader !== i.loader || m.versaoLoader !== i.versaoLoader) {
      i = await mudar(i.id, { versao: m.minecraft, loader: m.loader, versaoLoader: m.versaoLoader })
    }
  }
  const aviso = await sincronizarDoServidor(i, aoProgredir)
  if (aviso) avisos.push(aviso)
  if (i.origem.tipo === 'convite') {
    const aplicado = await lerManifesto(i.pasta, APLICADO)
    if (aplicado) {
      await exigirNaPasta(
        i.pasta,
        arquivosDesejados(aplicado, i.recusados ?? []).map((a) => a.path)
      )
    }
  }
  await escolherShaderDaPasta(i)
  return { i, avisos }
}

function recusadosDe(o: OpcoesJogar): string[] | null {
  return Array.isArray(o.recusados)
    ? o.recusados.filter((r): r is string => typeof r === 'string').slice(0, 500)
    : null
}

// INSTALAR (Correção P1): só monta a pasta. Nada abre o launcher nem a Microsoft Store.
export async function instalar(
  id: unknown,
  opcoes: unknown,
  aoProgredir: AoProgredir
): Promise<ResultadoJogar> {
  if (jogando) throw new ErroApp('Já estou preparando uma instalação. Espere terminar.')
  jogando = true
  try {
    let i = await exigir(id)
    const o = (opcoes ?? {}) as OpcoesJogar
    const recusados = recusadosDe(o)
    if (recusados) i = await mudar(i.id, { recusados })
    const r = await prepararPasta(i, o, aoProgredir)
    if (r.parar) return r.parar
    await mudar(i.id, {
      instaladaEm: new Date().toISOString(),
      assinaturaInstalada: await assinatura(r.i)
    })
    return {
      situacao: 'pronto',
      frase: `A instalação "${r.i.nome}" está pronta na pasta ${r.i.pasta}.`,
      avisos: r.avisos
    }
  } finally {
    jogando = false
  }
}

// O que, se mudar, pede "Atualizar": para um servidor deste PC, os mods e o Pacote pros amigos;
// para as outras, versão e loader (convites usam a versão do manifesto, do jeito da Fase P2).
async function assinatura(i: Salva): Promise<string> {
  const partes: string[] = [i.versao, i.loader, i.versaoLoader ?? '']
  if (i.origem.tipo === 'servidor') {
    const servidorId = i.origem.servidorId
    const item = (await lerIndiceServidores()).servidores.find((x) => x.id === servidorId)
    if (item) {
      for (const pasta of ['mods', 'plugins']) {
        const dir = join(item.pasta, pasta)
        for (const n of (await readdir(dir).catch(() => [] as string[])).sort()) {
          const t = await stat(join(dir, n)).catch(() => null)
          partes.push(`${pasta}/${n}:${t?.size ?? 0}`)
        }
      }
      partes.push(
        await readFile(join(item.pasta, 'servsquare-explorar.json'), 'utf8').catch(() => '')
      )
    }
  }
  return createHash('sha1').update(partes.join('\n')).digest('hex')
}

async function situacaoDaInstalacao(i: Salva): Promise<{ instalada: boolean; atualizar: boolean }> {
  if (!i.instaladaEm) return { instalada: false, atualizar: false }
  if (i.origem.tipo === 'convite') {
    const c = await estadoDoConvite(i)
    return { instalada: true, atualizar: !!c && c.versaoDisponivel > c.versaoAplicada }
  }
  return { instalada: true, atualizar: (await assinatura(i)) !== i.assinaturaInstalada }
}

// Jogar: prepara o que falta, grava o perfil no launcher oficial e abre o launcher.
// Quem faz login e abre o jogo é sempre o launcher oficial.
// Com ABRIR_LAUNCHER_LIGADO (launcherOficial.ts) em false, o Jogar fica desligado ("Em breve").
export async function jogar(
  id: unknown,
  opcoes: unknown,
  aoProgredir: AoProgredir
): Promise<ResultadoJogar> {
  if (!ABRIR_LAUNCHER_LIGADO) throw new ErroApp('Em breve: abrir o jogo direto pelo HubSquare.')
  if (jogando) throw new ErroApp('Já estou preparando uma instalação. Espere terminar.')
  jogando = true
  try {
    let i = await exigir(id)
    const o = (opcoes ?? {}) as OpcoesJogar
    const recusados = recusadosDe(o)
    if (recusados) i = await mudar(i.id, { recusados })
    const launcher = await detectarLauncher()
    if (!launcher) {
      await anotarFalha('nenhum Minecraft Launcher encontrado (nem o da Store nem o clássico).')
      return { situacao: 'semLauncher' }
    }
    // O launcher regrava o arquivo de perfis enquanto está aberto: a mudança se perderia.
    if (await launcherAberto()) return { situacao: 'launcherAberto' }
    exigirPerfis()

    const r = await prepararPasta(i, o, aoProgredir)
    if (r.parar) return r.parar
    i = r.i
    const avisos = r.avisos
    const versaoLoader =
      i.origem.tipo === 'servidor' && i.loader !== 'vanilla' && !i.versaoLoader
        ? await descobrirServidor(i).catch(() => null)
        : i.versaoLoader
    const versaoId = await garantirVersaoCliente(i.loader, i.versao, versaoLoader, aoProgredir)

    aoProgredir({ etapa: 'Criando a instalação no Minecraft Launcher', recebido: 0, total: 0 })
    const imagem = await imagemDe(i)
    const agora = new Date().toISOString()
    const ajustes = await lerAjustesJogo()
    await gravarPerfil(
      chaveDoPerfil(i.id),
      montarPerfil({
        nome: i.nome,
        versaoId,
        pasta: i.pasta,
        ram: i.ram,
        resolucao: ajustes.resolucao,
        imagem,
        agora
      })
    )
    await mudar(i.id, { ultimoUso: agora })
    aoProgredir({ etapa: 'Abrindo o Minecraft Launcher', recebido: 0, total: 0 })
    await abrirLauncher(launcher)
    vigiarJogo(i.id, i.pasta)
    const frase =
      i.origem.tipo === 'servidor' || i.origem.tipo === 'convite'
        ? `Clique em JOGAR no launcher: a instalação ${i.nome} já está selecionada. No jogo, vá em Multijogador: o servidor ${i.nome} é o primeiro da lista.`
        : `Clique em JOGAR no launcher: a instalação ${i.nome} já está selecionada.`
    return { situacao: 'pronto', frase, avisos }
  } catch (e) {
    await anotarFalha(detalhar(e))
    throw e
  } finally {
    jogando = false
  }
}

// ---------- Exportar para Modrinth App / Prism Launcher (Correção P1) ----------

const LOADER_MRPACK: Partial<Record<LoaderCliente, string>> = {
  fabric: 'fabric-loader',
  forge: 'forge',
  neoforge: 'neoforge'
}
// Configurações que vão junto (nunca mundos, prints nem logs).
const OVERRIDES = ['config', 'options.txt', 'servers.dat', 'optionsshaders.txt', 'optionsof.txt']

// Gera um .mrpack da instalação: o que é do Modrinth vai como link + hash; o resto (mods postos à
// mão, configs, lista de servidores) vai dentro do pack, em overrides. É para uso próprio.
export async function exportarMrpack(
  id: unknown,
  janela: BrowserWindow | null
): Promise<string | null> {
  const i = await exigir(id)
  if (!i.instaladaEm) throw new ErroApp('Clique em Instalar antes de exportar.')
  const opcoesDialogo = {
    title: 'Salvar para o Modrinth App ou o Prism Launcher',
    defaultPath: join(app.getPath('downloads'), `${pastaDoNome(i.nome)}.mrpack`),
    filters: [{ name: 'Modpack do Modrinth', extensions: ['mrpack'] }]
  }
  const escolha = janela
    ? await dialog.showSaveDialog(janela, opcoesDialogo)
    : await dialog.showSaveDialog(opcoesDialogo)
  if (escolha.canceled || !escolha.filePath) return null

  const montagem = join(tmpdir(), `hubsquare-exportar-${randomUUID()}`)
  try {
    await mkdir(join(montagem, 'overrides'), { recursive: true })
    const locais: { path: string; abs: string; sha1: string }[] = []
    for (const pasta of ['mods', 'resourcepacks', 'shaderpacks']) {
      const dir = join(i.pasta, pasta)
      for (const n of await readdir(dir).catch(() => [] as string[])) {
        if (!/\.(jar|zip)$/i.test(n)) continue // .disabled fica de fora
        const abs = join(dir, n)
        if (!(await stat(abs)).isFile()) continue
        locais.push({ path: `${pasta}/${n}`, abs, sha1: await sha1(abs) })
      }
    }
    const versoes = locais.length
      ? await modrinth
          .porHash(locais.map((l) => l.sha1))
          .catch(() => ({}) as Record<string, modrinth.Versao>)
      : {}
    const arquivos: ArquivoIndice[] = []
    const baixadosAMao = await lerGuardados()
    for (const l of locais) {
      // Fase D: baixado à mão pela página oficial: nunca vai numa exportação.
      if (baixadosAMao[l.sha1]) continue
      const v = (versoes as Record<string, modrinth.Versao>)[l.sha1]
      const a = v?.files.find((x) => x.hashes.sha1 === l.sha1)
      if (a && urlDoModrinth(a.url)) {
        arquivos.push({
          path: l.path,
          hashes: { sha1: a.hashes.sha1, sha512: a.hashes.sha512 },
          env: { client: 'required', server: 'optional' },
          downloads: [a.url],
          fileSize: a.size
        })
      } else {
        await mkdir(dirname(join(montagem, 'overrides', l.path)), { recursive: true })
        await copyFile(l.abs, join(montagem, 'overrides', l.path))
      }
    }
    for (const nome of OVERRIDES) {
      const origem = join(i.pasta, nome)
      if (existsSync(origem))
        await cp(origem, join(montagem, 'overrides', nome), { recursive: true })
    }
    const chave = LOADER_MRPACK[i.loader]
    const versaoLoader = chave ? await versaoDoLoader(i.loader, i.versao, i.versaoLoader) : null
    const indice = {
      formatVersion: 1,
      game: 'minecraft',
      versionId: `hubsquare-${new Date().toISOString().slice(0, 10)}`,
      name: i.nome,
      summary: `Instalação ${i.nome} exportada pelo HubSquare.`,
      files: arquivos,
      dependencies:
        chave && versaoLoader
          ? { minecraft: i.versao, [chave]: versaoLoader }
          : { minecraft: i.versao }
    }
    await writeFile(join(montagem, 'modrinth.index.json'), JSON.stringify(indice, null, 2))
    // O tar escolhe o formato pela extensão: monta como .zip e copia com o nome .mrpack.
    const zip = join(montagem, '..', `${basename(montagem)}.zip`)
    await tarCriar(['-a', '-c', '-f', zip, '-C', montagem, 'modrinth.index.json', 'overrides'])
    await copyFile(zip, escolha.filePath)
    await rm(zip, { force: true })
    return basename(escolha.filePath)
  } finally {
    await apagarEmTrabalhador(montagem).catch(() => {})
  }
}

async function descobrirServidor(i: Salva): Promise<string | null> {
  if (i.origem.tipo !== 'servidor') return null
  const servidorId = i.origem.servidorId
  const item = (await lerIndiceServidores()).servidores.find((s) => s.id === servidorId)
  const info = item ? await lerInfo(item) : null
  return info ? descobrirVersaoLoader(info) : null
}

// ---------- Tela Jogar (Fase P4) ----------

async function imagemComoDataUrl(arquivo: string): Promise<string | null> {
  const tipo = TIPOS_IMAGEM[extname(arquivo).toLowerCase()]
  const dados = tipo ? await readFile(arquivo).catch(() => null) : null
  return dados ? `data:${tipo};base64,${dados.toString('base64')}` : null
}

// Fundo do banner: o da instalação ou, sem ele, null (a tela usa o padrão).
export async function fundoDaInstalacao(id: unknown): Promise<string | null> {
  const i = await exigir(id)
  return i.arquivoFundo ? imagemComoDataUrl(join(i.pasta, i.arquivoFundo)) : null
}

async function escolherImagemDoPC(
  janela: BrowserWindow | null,
  titulo: string
): Promise<string | null> {
  const opcoes = {
    title: titulo,
    properties: ['openFile' as const],
    filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  }
  const escolha = janela
    ? await dialog.showOpenDialog(janela, opcoes)
    : await dialog.showOpenDialog(opcoes)
  const origem = escolha.filePaths[0]
  if (escolha.canceled || !origem) return null
  if (!TIPOS_IMAGEM[extname(origem).toLowerCase()])
    throw new ErroApp('Escolha uma imagem PNG, JPG ou WEBP.')
  if ((await stat(origem)).size > 15 * 1024 * 1024) {
    throw new ErroApp('Essa imagem é muito grande. Escolha uma de até 15 MB.')
  }
  return origem
}

export async function escolherFundoInstalacao(
  id: unknown,
  janela: BrowserWindow | null
): Promise<boolean> {
  const i = await exigir(id)
  const origem = await escolherImagemDoPC(janela, 'Escolha o fundo da instalação')
  if (!origem) return false
  const nome = `${FUNDO}${extname(origem).toLowerCase()}`
  await mkdir(i.pasta, { recursive: true })
  await copyFile(origem, join(i.pasta, nome))
  if (i.arquivoFundo && i.arquivoFundo !== nome)
    await rm(join(i.pasta, i.arquivoFundo), { force: true })
  await mudar(i.id, { arquivoFundo: nome })
  return true
}

export async function removerFundoInstalacao(id: unknown): Promise<void> {
  const i = await exigir(id)
  if (i.arquivoFundo) await rm(join(i.pasta, i.arquivoFundo), { force: true })
  await mudar(i.id, { arquivoFundo: null })
}

// Banner com um bioma (Fase V1); null volta à imagem ou capa da instalação (ou ao padrão).
export async function definirBannerBioma(id: unknown, bioma: unknown): Promise<void> {
  const i = await exigir(id)
  if (bioma !== null && !BIOMAS.includes(bioma as Bioma)) {
    throw new ErroApp('Escolha um bioma da lista.')
  }
  await mudar(i.id, { bannerBioma: bioma as Bioma | null })
}

// Fundo padrão de todas as instalações (sem ele, a arte geométrica do próprio app).
const pastaFundoPadrao = (): string => join(app.getPath('userData'), 'fundo-jogo')

export async function lerFundoPadrao(): Promise<string | null> {
  const nomes = await readdir(pastaFundoPadrao()).catch(() => [] as string[])
  return nomes[0] ? imagemComoDataUrl(join(pastaFundoPadrao(), nomes[0])) : null
}

export async function escolherFundoPadrao(janela: BrowserWindow | null): Promise<boolean> {
  const origem = await escolherImagemDoPC(janela, 'Escolha o fundo padrão da tela Jogar')
  if (!origem) return false
  await rm(pastaFundoPadrao(), { recursive: true, force: true })
  await mkdir(pastaFundoPadrao(), { recursive: true })
  await copyFile(origem, join(pastaFundoPadrao(), `fundo${extname(origem).toLowerCase()}`))
  return true
}

export async function removerFundoPadrao(): Promise<void> {
  await rm(pastaFundoPadrao(), { recursive: true, force: true })
}

async function servidorDa(i: Salva): Promise<InfoServidor | null> {
  if (i.origem.tipo !== 'servidor') return null
  const servidorId = i.origem.servidorId
  const item = (await lerIndiceServidores()).servidores.find((x) => x.id === servidorId)
  return item ? lerInfo(item) : null
}

// Mods que o modpack do servidor manda só para o jogador (o servidor nunca baixou).
async function modsSoDoJogadorDoPack(pasta: string): Promise<string[]> {
  const texto = await lerTexto(join(pasta, 'servsquare-modpack.json')).catch(() => '')
  if (!texto) return []
  try {
    const files = (JSON.parse(texto) as { indice?: { files?: ArquivoIndice[] } }).indice?.files
    return (files ?? [])
      .filter((f) => f.path?.startsWith('mods/') && f.env?.server === 'unsupported')
      .map((f) => f.path)
  } catch {
    return []
  }
}

// Memória: sugestão pelo número de mods e pela memória do PC. Com o servidor no mesmo PC (o
// servidor da instalação é deste ServSquare), o jogo fica com o que sobra.
export async function memoriaDoJogo(id: unknown): Promise<MemoriaJogo> {
  const i = await exigir(id)
  const { min, max } = limitesRam()
  const info = await servidorDa(i)
  // Fase V3: antes de instalar a pasta ainda está vazia; contam também os mods que ela vai
  // receber (os do servidor deste PC ou os do manifesto do convite).
  const naPasta = await readdir(join(i.pasta, 'mods')).catch(() => [] as string[])
  const manifesto =
    i.origem.tipo === 'convite'
      ? ((await lerManifesto(i.pasta, DISPONIVEL)) ?? (await lerManifesto(i.pasta, APLICADO)))
      : null
  const esperados = info
    ? [
        ...(await readdir(join(info.pasta, 'mods')).catch(() => [] as string[])).map(
          (n) => `mods/${n}`
        ),
        ...(await modsSoDoJogadorDoPack(info.pasta))
      ]
    : (manifesto?.arquivos.map((a) => a.path) ?? [])
  const mods = contarModsDaInstalacao(naPasta, esperados)
  const servidor = info ? (info.ram ?? limitesRam().sugerida) : null
  const totalGb = Math.floor(totalmem() / 1024 ** 3)
  const { disponivel, cabe } = dividirMemoria(totalGb, servidor, i.ram)
  const sugerida = Math.min(sugerirRam(mods, max).gb, servidor ? disponivel : max)
  return {
    atual: i.ram,
    sugerida: Math.max(min, sugerida),
    min,
    max,
    servidor,
    disponivel,
    cabe,
    mods
  }
}

export async function definirMemoria(id: unknown, ram: unknown): Promise<MemoriaJogo> {
  const i = await exigir(id)
  await mudar(i.id, { ram: validarRam(ram) })
  return memoriaDoJogo(id)
}

// Usuários que já entraram no servidor (usercache.json): nome → UUID, para as cabeças.
async function uuidsDoServidor(pasta: string): Promise<Map<string, string>> {
  try {
    const lista = JSON.parse(await readFile(join(pasta, 'usercache.json'), 'utf8')) as {
      name?: string
      uuid?: string
    }[]
    return new Map(
      lista.filter((u) => u.name && u.uuid).map((u) => [u.name!.toLowerCase(), u.uuid!])
    )
  } catch {
    return new Map()
  }
}

// Status do servidor ligado à instalação. Dono: o estado do ServSquare. Amigo: o "ping".
export async function statusDoServidor(id: unknown): Promise<StatusServidorJogo | null> {
  const i = await exigir(id)
  if (i.origem.tipo === 'servidor') {
    const info = await servidorDa(i)
    if (!info) return null
    const indice = await lerIndiceServidores()
    const ativo = indice.ativo === info.id
    const estado = lerEstado()
    const ligado = ativo && estado === 'ligado'
    const uuids = ligado ? await uuidsDoServidor(info.pasta) : new Map<string, string>()
    const porta = (await lerArquivoPropriedades(info.pasta)).get('server-port') || '25565'
    return {
      dono: true,
      nome: info.nome,
      online: ligado,
      ligando: ativo && estado === 'ligando',
      jogadores: ligado
        ? lerJogadores().map((nome) => ({ nome, uuid: uuids.get(nome.toLowerCase()) ?? null }))
        : [],
      contagem: null,
      endereco: `localhost:${porta}`,
      mensagem: null,
      podeLigar: !ligado && estado === 'desligado',
      faltando: faltandoDo(info.id)
    }
  }
  if (i.origem.tipo === 'convite') {
    const m = (await lerManifesto(i.pasta, DISPONIVEL)) ?? (await lerManifesto(i.pasta, APLICADO))
    const endereco = m?.enderecos[0] ?? null
    const r = endereco ? await pingar(endereco) : null
    return {
      dono: false,
      nome: i.origem.servidor,
      online: endereco ? !!r : null,
      ligando: false,
      jogadores: r?.amostra ?? [],
      contagem: r ? { online: r.online, max: r.max } : null,
      endereco,
      mensagem: m?.mensagem ?? null,
      podeLigar: false,
      pedido: await atualizarPedido(i).then((p) =>
        p ? { nick: p.nick, situacao: p.enviado ? p.situacao : ('naoEnviado' as const) } : null
      )
    }
  }
  return null
}

// "Ligar servidor e jogar" (só o dono): liga o servidor pelo ServSquare, espera ficar pronto e só
// então prepara o jogo. O botão JOGAR nunca liga nem desliga o servidor.
export async function ligarServidorEJogar(
  id: unknown,
  opcoes: unknown,
  aoProgredir: AoProgredir
): Promise<ResultadoJogar> {
  if (!ABRIR_LAUNCHER_LIGADO) throw new ErroApp('Em breve: abrir o jogo direto pelo HubSquare.')
  const i = await exigir(id)
  const info = await servidorDa(i)
  if (!info) throw new ErroApp('Essa instalação não é de um servidor deste PC.')
  if (lerEstado() !== 'ligado') {
    if (lerEstado() !== 'desligado') {
      throw new ErroApp('O servidor está ligando ou desligando. Espere um pouco e tente de novo.')
    }
    await ativarServidor(info.id) // recusa se outro servidor estiver ligado
    aoProgredir({ etapa: `Ligando o servidor ${info.nome}`, recebido: 0, total: 0 })
    await ligar()
    const inicio = Date.now()
    while (lerEstado() !== 'ligado') {
      if (lerEstado() === 'desligado') {
        throw new ErroApp(
          `O servidor ${info.nome} não ligou. Veja o que aconteceu no Console do ServSquare.`
        )
      }
      if (Date.now() - inicio > 10 * 60_000) {
        throw new ErroApp(
          'O servidor está demorando demais para ligar. Veja o Console do ServSquare.'
        )
      }
      aoProgredir({
        etapa: `Esperando o servidor ${info.nome} ficar pronto (${Math.round((Date.now() - inicio) / 1000)} s)`,
        recebido: 0,
        total: 0
      })
      await new Promise((r) => setTimeout(r, 1000))
    }
  } else if ((await lerIndiceServidores()).ativo !== info.id) {
    throw new ErroApp('Outro servidor está ligado. Desligue ele no ServSquare antes.')
  }
  return jogar(id, opcoes, aoProgredir)
}

// ---------- Fase P5: capturas, atalho e "Testar no meu jogo" ----------

// Pastas de prints: de todas as instalações ou só de uma.
export async function pastasDePrints(id: unknown): Promise<PastaDePrints[]> {
  const { instalacoes } = await lerIndice()
  const lista = id ? instalacoes.filter((i) => i.id === id) : instalacoes
  if (id && !lista.length) throw new ErroApp('Essa instalação não existe mais. Atualize a lista.')
  return lista.map((i) => ({ instalacaoId: i.id, nome: i.nome, pasta: i.pasta }))
}

export async function pastaDePrints(id: unknown): Promise<PastaDePrints> {
  return (await pastasDePrints(id))[0]
}

// "Usar como fundo": copia o print para a instalação (o original fica onde está).
export async function usarCapturaComoFundo(id: unknown, nome: unknown): Promise<void> {
  const i = await exigir(id)
  const origem = caminhoDaCaptura(await pastaDePrints(i.id), nome)
  const destino = `${FUNDO}.png`
  await copyFile(origem, join(i.pasta, destino))
  if (i.arquivoFundo && i.arquivoFundo !== destino)
    await rm(join(i.pasta, i.arquivoFundo), { force: true })
  await mudar(i.id, { arquivoFundo: destino })
}

// Atalho na área de trabalho: só quando o jogador pede. Abre o HubSquare no Jogar da instalação.
export async function criarAtalho(id: unknown): Promise<string> {
  const i = await exigir(id)
  const nome = `${pastaDoNome(i.nome)} - HubSquare.lnk`
  const destino = join(app.getPath('desktop'), nome)
  // Em desenvolvimento o executável é o Electron e precisa do caminho do app; instalado, não.
  const args = [app.isPackaged ? '' : `"${app.getAppPath()}"`, `--jogar=${i.id}`]
    .filter(Boolean)
    .join(' ')
  const ok = shell.writeShortcutLink(destino, existsSync(destino) ? 'replace' : 'create', {
    target: process.execPath,
    args,
    description: `Abre o HubSquare no Jogar de ${i.nome}`,
    icon: process.execPath,
    iconIndex: 0
  })
  if (!ok) throw new ErroApp('Não consegui criar o atalho na área de trabalho.')
  return nome
}

// O HubSquare foi aberto por um atalho: "--jogar=<id>" na linha de comando.
export function instalacaoDoAtalho(argv: string[]): string | null {
  const a = argv.find((x) => x.startsWith('--jogar='))
  const id = a?.slice('--jogar='.length) ?? ''
  return /^[0-9a-f]{32}$/.test(id) ? id : null
}

// ServSquare › Mods › "Testar no meu jogo": a instalação daquele servidor, com os mods já iguais
// aos do servidor. Se o jogador tinha apagado essa instalação, ela volta.
export async function prepararTeste(
  servidorId: unknown,
  aoProgredir: AoProgredir
): Promise<string> {
  if (typeof servidorId !== 'string') throw new ErroApp('Servidor inválido.')
  const indice = await lerIndice()
  if (indice.ignorados.includes(servidorId)) {
    await gravar({ ...indice, ignorados: indice.ignorados.filter((x) => x !== servidorId) })
  }
  await sincronizarComServidores()
  const i = (await lerIndice()).instalacoes.find(
    (x) => x.origem.tipo === 'servidor' && x.origem.servidorId === servidorId
  )
  if (!i) throw new ErroApp('Não encontrei esse servidor. Atualize a lista de servidores.')
  await sincronizarDoServidor(i, aoProgredir)
  return i.id
}

// ---------- Diagnóstico do amigo (Fase M5): "Não consigo entrar" ----------
// Confere em ordem e para no primeiro problema (diagnosticoRegras.ts). Só lê; "Atualizar a
// instalação" é o único conserto daqui, e roda pela tela, com o clique.

export async function diagnosticarInstalacao(id: unknown): Promise<LinhaDiagnostico[]> {
  const i = await exigir(id)
  if (i.origem.tipo !== 'convite') {
    throw new ErroApp(
      'Essa instalação não é de um convite. Para o seu servidor, use Conexão › Testar tudo.'
    )
  }
  const origem = i.origem
  const manifesto =
    (await lerManifesto(i.pasta, DISPONIVEL)) ?? (await lerManifesto(i.pasta, APLICADO))
  const endereco = manifesto?.enderecos[0] ?? null
  const host = endereco ? endereco.replace(/:\d+$/, '') : ''
  const checagens: Checagem[] = [
    {
      id: 'internet',
      nome: 'Internet',
      essencial: true,
      async rodar() {
        try {
          await buscarJsonOpcional(
            'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
          )
          return { resultado: 'ok', frase: 'Este PC está na internet.' }
        } catch {
          return {
            resultado: 'falhou',
            frase: 'Este PC está sem internet. Confira o Wi-Fi ou o cabo.'
          }
        }
      }
    },
    {
      id: 'radmin',
      nome: 'Radmin VPN',
      essencial: true,
      async rodar() {
        if (!/^26\./.test(host)) {
          return {
            resultado: 'ok',
            frase: 'Não precisa: o endereço do servidor não é do Radmin VPN.'
          }
        }
        return ipRadmin()
          ? { resultado: 'ok', frase: `Radmin VPN conectado (${ipRadmin()}).` }
          : {
              resultado: 'falhou',
              frase:
                'O endereço do servidor é do Radmin VPN, mas o Radmin está fechado ou desconectado neste PC. Abra o Radmin VPN e entre na rede do dono.'
            }
      }
    },
    {
      id: 'endereco',
      nome: 'Endereço do servidor',
      essencial: true,
      async rodar() {
        if (!endereco) {
          return {
            resultado: 'falhou',
            frase: 'O convite não trouxe o endereço do servidor. Peça um convite novo ao dono.'
          }
        }
        try {
          if (!isIP(host)) await lookup((await resolverEndereco(endereco)).host)
          return { resultado: 'ok', frase: `O endereço ${endereco} existe.` }
        } catch {
          return {
            resultado: 'falhou',
            frase: `O endereço ${endereco} não foi encontrado. Se o dono usa o túnel do playit.gg, o túnel pode estar desligado: peça para ele conferir em Conexão.`
          }
        }
      }
    },
    {
      id: 'ping',
      nome: 'Servidor respondendo',
      essencial: true,
      async rodar() {
        const r = await pingar(endereco!)
        return r
          ? {
              resultado: 'ok',
              frase: `O servidor ${origem.servidor} está ligado (${r.online}/${r.max} online).`
            }
          : {
              resultado: 'falhou',
              frase: `O servidor ${origem.servidor} não respondeu. Peça ao dono para ligar o servidor (e o túnel ou o Radmin, se for o caso).`
            }
      }
    },
    {
      id: 'manifesto',
      nome: 'Convite respondendo',
      essencial: false,
      async rodar() {
        return (await verificarUm(i))
          ? { resultado: 'ok', frase: 'O convite do dono respondeu com a lista de mods.' }
          : {
              resultado: 'aviso',
              frase:
                'O convite do dono não respondeu. Dá para jogar com a última lista de mods baixada, mas ela pode estar velha.'
            }
      }
    },
    {
      id: 'versao',
      nome: 'Instalação atualizada',
      essencial: true,
      async rodar() {
        const c = await estadoDoConvite(i)
        const { instalada } = await situacaoDaInstalacao(i)
        if (!instalada || !c || c.versaoAplicada < c.versaoDisponivel) {
          return {
            resultado: 'falhou',
            frase: !instalada
              ? 'A instalação ainda não foi montada com os mods do servidor.'
              : `A instalação está na versão ${c?.versaoAplicada} da lista de mods, e o servidor já está na ${c?.versaoDisponivel}.`,
            conserto: 'atualizarInstalacao'
          }
        }
        return {
          resultado: 'ok',
          frase: `Na versão ${c.versaoAplicada} da lista de mods, igual ao servidor.`
        }
      }
    },
    {
      id: 'hashes',
      nome: 'Mods iguais aos do servidor',
      essencial: true,
      async rodar() {
        const aplicado = await lerManifesto(i.pasta, APLICADO)
        const recusados = i.recusados ?? []
        const diferentes: string[] = []
        for (const a of aplicado?.arquivos ?? []) {
          if (!a.obrigatorio && recusados.includes(a.path)) continue
          const arquivo = join(i.pasta, a.path)
          if (!existsSync(arquivo) || (await sha1(arquivo)) !== a.sha1)
            diferentes.push(basename(a.path))
        }
        return diferentes.length
          ? {
              resultado: 'falhou',
              frase: `Arquivos faltando ou diferentes dos do servidor: ${diferentes.slice(0, 5).join(', ')}${diferentes.length > 5 ? '…' : ''}.`,
              conserto: 'atualizarInstalacao'
            }
          : { resultado: 'ok', frase: 'Todos os mods e packs batem com os do servidor.' }
      }
    },
    {
      id: 'nick',
      nome: 'Nick aprovado',
      essencial: true,
      async rodar() {
        const p = await atualizarPedido(i)
        if (!p) {
          return {
            resultado: 'aviso',
            frase:
              'Você não pediu para entrar por este convite. Se o servidor barrar, peça ao dono para pôr seu nick na whitelist.'
          }
        }
        if (!p.enviado) {
          return {
            resultado: 'falhou',
            frase: `O pedido do nick ${p.nick} ainda não chegou ao dono: ele vai quando o dono abrir o HubSquare.`
          }
        }
        if (p.situacao === 'aprovado')
          return { resultado: 'ok', frase: `O nick ${p.nick} está aprovado na whitelist.` }
        return {
          resultado: 'falhou',
          frase:
            p.situacao === 'recusado'
              ? `O dono recusou o nick ${p.nick}. Fale com ele.`
              : `O dono ainda não aprovou o nick ${p.nick}. Mande para ele o resultado (botão Copiar resultado).`
        }
      }
    }
  ]
  return rodarChecagens(checagens)
}
