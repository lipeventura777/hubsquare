import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { EventEmitter } from 'events'
import { createServer } from 'net'
import { join } from 'path'
import { createInterface } from 'readline'
import type {
  AvisoEstado,
  EstadoServidor,
  ErroTela,
  InfoServidor,
  LinhaConsole,
  Progresso,
  TipoId,
  UsoServidor
} from '../shared/tipos'
import { gravarComSeguranca, gravarPropriedades, pvpEhRegraDoJogo, ramDoServidor } from './config'
import { flagsOtimizadas } from './desempenhoRegras'
import { ErroApp } from './erros'
import { javaExigido } from './consertoRegras'
import { garantirJava } from './java'
import { textoEmprestado } from './passarRegras'
import { javaDaVersao } from './mojang'
import {
  ARQUIVO_INFO,
  atualizarItem,
  pastaServidores,
  registrar as registrarNoIndice,
  servidorAtual
} from './servidores'
import { ehTipo, tiposDeServidor } from './tipos'

export { pastaServidores, servidorAtual } from './servidores'

const LIMITE_CONSOLE = 5000
// shortcut: porta fixa; quando a tela de configurações mudar a porta, ler do server.properties.
export const PORTA = 25565
const TEMPO_PARA_DESLIGAR = 30_000

type Enviar = (canal: string, dado: unknown) => void
let enviar: Enviar = () => {}

// O index.ts diz como mandar avisos para a janela.
export function aoAvisar(funcao: Enviar): void {
  enviar = funcao
}

export function avisarTela(canal: string, dado: unknown): void {
  enviar(canal, dado)
}

// Outros módulos (jogadores, uso de CPU/RAM) escutam o servidor por aqui.
export const eventos = new EventEmitter<{
  linha: [texto: string]
  estado: [estado: EstadoServidor]
  processo: [dados: { pid: number; ramGb: number }]
  desligou: [dados: { normal: boolean; info: InfoServidor }]
  // Fechou enquanto ligava e o app não conseguiu consertar sozinho (console daquela tentativa).
  naoLigou: [dados: { info: InfoServidor; linhas: string[] }]
  uso: [uso: UsoServidor]
}>()

export async function exigirServidor(): Promise<InfoServidor> {
  const info = await servidorAtual()
  if (!info) throw new ErroApp('Nenhum servidor encontrado. Crie um servidor na tela Servidores.')
  return info
}

export async function atualizarInfo(
  info: InfoServidor,
  mudancas: Partial<Omit<InfoServidor, 'pasta' | 'id'>>
): Promise<void> {
  const { pasta, id, ...resto } = { ...info, ...mudancas }
  await gravarComSeguranca(join(pasta, ARQUIVO_INFO), JSON.stringify(resto, null, 2))
  // O índice guarda nome, tipo e versão para a lista de servidores.
  await atualizarItem(id, { nome: resto.nome, tipo: resto.tipo, versao: resto.versao, pasta })
}

// Garante o Java certo e instala o loader na pasta. Devolve a versão do Java e a do loader.
// Usado ao criar, ao importar de .zip, ao trocar de software e pelos modpacks.
export async function instalarJarEJava(
  pasta: string,
  tipo: TipoId,
  versao: string,
  aoProgredir: (p: Progresso) => void,
  versaoLoader?: string
): Promise<{ java: number; versaoLoader?: string }> {
  const java = await javaDaVersao(versao)
  // O Java vem antes: os instaladores do Forge e do NeoForge rodam com ele.
  const exe = await garantirJava(java, aoProgredir)
  const loader = await tiposDeServidor[tipo].instalar(versao, pasta, exe, aoProgredir, versaoLoader)
  return { java, versaoLoader: loader ?? undefined }
}

// Só pode ser chamado depois de o usuário marcar a caixa do EULA.
export async function aceitarEula(pasta: string): Promise<void> {
  await writeFile(
    join(pasta, 'eula.txt'),
    `# Aceito pelo usuário no ServSquare em ${new Date().toISOString()} (https://aka.ms/MinecraftEULA)\neula=true\n`
  )
}

// Confere a versão pedida contra a lista do tipo.
export async function validarVersao(tipo: TipoId, versao: unknown): Promise<string> {
  if (
    typeof versao !== 'string' ||
    !(await tiposDeServidor[tipo].listarVersoes()).includes(versao)
  ) {
    throw new ErroApp('Essa versão não está na lista. Escolha uma versão da lista.')
  }
  return versao
}

export async function listarVersoes(tipo: unknown): Promise<string[]> {
  if (!ehTipo(tipo)) throw new ErroApp('Tipo de servidor desconhecido. Escolha um tipo da lista.')
  return tiposDeServidor[tipo].listarVersoes()
}

export function validarNome(valor: unknown): string {
  const nome = typeof valor === 'string' ? valor.trim() : ''
  // Fase V3: pontos valem (ex.: "Cobbleverse 1.7.42"), só não no fim (o Windows não aceita).
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,31}$/u.test(nome) || nome.endsWith('.')) {
    throw new ErroApp(
      'Nome inválido. Use até 32 letras, números, espaços, ".", "-" ou "_", começando com letra ou número e sem ponto no fim.'
    )
  }
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(nome)) {
    throw new ErroApp('Esse nome é reservado pelo Windows. Escolha outro nome.')
  }
  return nome
}

let criando = false

export async function criarServidor(
  pedido: unknown,
  aoProgredir: (p: Progresso) => void
): Promise<InfoServidor> {
  if (criando) throw new ErroApp('O servidor já está sendo criado. Espere terminar.')
  criando = true
  try {
    const { tipo, versao, nome: nomeBruto, aceitouEula } = (pedido ?? {}) as Record<string, unknown>
    if (aceitouEula !== true) {
      throw new ErroApp('Você precisa marcar que aceita o EULA do Minecraft para criar o servidor.')
    }
    if (!ehTipo(tipo)) throw new ErroApp('Tipo de servidor desconhecido. Escolha um tipo da lista.')
    const nome = validarNome(nomeBruto)
    const pasta = join(pastaServidores(), nome)
    if (existsSync(join(pasta, ARQUIVO_INFO))) {
      throw new ErroApp(`Já existe um servidor chamado "${nome}". Escolha outro nome.`)
    }
    const versaoOk = await validarVersao(tipo, versao)

    await mkdir(pasta, { recursive: true })
    const { java, versaoLoader } = await instalarJarEJava(pasta, tipo, versaoOk, aoProgredir)
    // Só chega aqui se o usuário marcou a caixa do EULA.
    await aceitarEula(pasta)
    // Whitelist ligada por padrão: só entra quem o usuário adicionar.
    await gravarPropriedades(pasta, { 'white-list': 'true', 'enforce-whitelist': 'true' })
    // Servidores novos já usam a configuração otimizada do Java (tela Desempenho).
    const info = { nome, tipo, versao: versaoOk, java, versaoLoader, javaOtimizado: true }
    // Gravado por último: a pasta só conta como servidor quando tudo acima deu certo.
    await writeFile(join(pasta, ARQUIVO_INFO), JSON.stringify(info, null, 2))
    // Vira o ativo, a não ser que outro servidor esteja ligado (só o ativo pode estar ligado).
    const id = await registrarNoIndice(
      { nome, pasta, tipo, versao: versaoOk },
      estado === 'desligado'
    )
    return { ...info, id, pasta }
  } finally {
    criando = false
  }
}

// ---------- Ligar, desligar, console ----------

let processo: ChildProcess | null = null
let terminou: Promise<void> = Promise.resolve()
let estado: EstadoServidor = 'desligado'
const historico: LinhaConsole[] = []
let proximaLinha = 0
let lote: LinhaConsole[] = []
let envioAgendado: NodeJS.Timeout | undefined

function mudarEstado(novo: EstadoServidor, erro?: ErroTela): void {
  estado = novo
  enviar('servidor:estado', { estado, erro } satisfies AvisoEstado)
  eventos.emit('estado', novo)
}

function registrar(texto: string): void {
  const linha = { n: proximaLinha++, texto }
  historico.push(linha)
  while (historico.length > LIMITE_CONSOLE) historico.shift()
  lote.push(linha)
  // Junta as linhas em pacotes de 50 ms para não travar a tela quando o servidor escreve muito.
  envioAgendado ??= setTimeout(() => {
    enviar('servidor:console', lote)
    lote = []
    envioAgendado = undefined
  }, 50)
}

// Outros módulos (ex.: backup) escrevem avisos no console do app por aqui.
export function registrarNoConsole(texto: string): void {
  registrar(texto)
}

export function servidorLigado(): boolean {
  return processo !== null
}

export function lerEstado(): EstadoServidor {
  return estado
}

// Trava para tarefas que mexem nos arquivos do servidor (importar mundo, editar whitelist.json):
// enquanto rodam, o servidor não liga.
let ocupado = false
let tarefaAtual: Promise<unknown> = Promise.resolve()

export function comServidorDesligado<T>(tarefa: () => Promise<T>): Promise<T> {
  if (estado !== 'desligado') {
    return Promise.reject(new ErroApp('Desligue o servidor e tente de novo.'))
  }
  if (ocupado) {
    return Promise.reject(new ErroApp('Espere a tarefa atual terminar e tente de novo.'))
  }
  // Trava na hora (sem esperar nada antes), para o backup que começa ao desligar
  // já segurar o servidor antes de alguém clicar em Ligar.
  ocupado = true
  const execucao = tarefa().finally(() => (ocupado = false))
  tarefaAtual = execucao.catch(() => {})
  return execucao
}

// Espera a tarefa em andamento (ex.: backup) terminar. Usado ao reiniciar e ao sair do app.
export function esperarTarefas(): Promise<unknown> {
  return tarefaAtual
}

// Ao sair do app, nada pode ligar o servidor de novo.
let encerrando = false

export function impedirLigar(): void {
  encerrando = true
}

function escrever(comando: string): void {
  registrar(`> ${comando}`)
  processo?.stdin?.write(`${comando}\n`)
}

// Linhas que o app pediu sozinho e não devem aparecer no console (a linha ainda é lida pelo app).
let ocultarDoConsole: (texto: string) => boolean = () => false

export function aoOcultarDoConsole(filtro: (texto: string) => boolean): void {
  ocultarDoConsole = filtro
}

// Comando que o app manda sozinho (ex.: medir o TPS): não aparece como "> comando" no console.
export function enviarSilencioso(comando: string): boolean {
  if (!processo || estado !== 'ligado') return false
  processo.stdin?.write(`${comando}\n`)
  return true
}

// Comando que o usuário pediu por um botão (ex.: "chunky start"): aparece no console.
export function enviarDoApp(comando: string): void {
  if (!processo || estado !== 'ligado') {
    throw new ErroApp('Ligue o servidor e espere ele terminar de ligar.')
  }
  escrever(comando)
}

// No Paper cada mundo tem suas regras; no Vanilla a regra vale para o servidor todo.
function aplicarPvp(info: InfoServidor): void {
  if (info.pvp === undefined || !pvpEhRegraDoJogo(info.versao)) return
  escrever(`gamerule pvp ${info.pvp}`)
  if (info.tipo === 'paper') {
    for (const mundo of ['the_nether', 'the_end']) {
      escrever(`execute in minecraft:${mundo} run gamerule pvp ${info.pvp}`)
    }
  }
}

export function lerConsole(): { estado: EstadoServidor; historico: LinhaConsole[] } {
  return { estado, historico }
}

function portaLivre(porta: number): Promise<boolean> {
  return new Promise((resolver) => {
    const teste = createServer()
    teste.once('error', () => resolver(false))
    teste.listen(porta, () => teste.close(() => resolver(true)))
  })
}

// Rodam logo antes de abrir o Java (ex.: a tela Mods aplica as mudanças pendentes).
const antesDeLigar: ((info: InfoServidor) => Promise<void>)[] = []

export function aoLigar(tarefa: (info: InfoServidor) => Promise<void>): void {
  antesDeLigar.push(tarefa)
}

// Java que o servidor usa: o que os mods pedem (o loader calculou) ou o da versão do Minecraft.
export function javaDoServidor(info: InfoServidor): number {
  return info.javaDosMods ?? info.java
}

// Consertos quando o servidor fecha enquanto liga: recebem o console daquela tentativa e
// devolvem o que consertaram (vazio = nada). Com algo consertado, o app liga de novo uma vez.
type Conserto = (info: InfoServidor, linhas: string[]) => Promise<string[]>
const consertos: Conserto[] = []
let depoisDoConserto = false

export function aoFalharAoLigar(conserto: Conserto): void {
  consertos.push(conserto)
}

async function consertarELigar(info: InfoServidor, linhas: string[]): Promise<void> {
  const feitos: string[] = []
  for (const c of consertos) {
    feitos.push(
      ...(await c(info, linhas).catch((e) => {
        registrar(
          `[ServSquare] Não deu para consertar sozinho: ${e instanceof Error ? e.message : e}`
        )
        return []
      }))
    )
  }
  if (!feitos.length) return void eventos.emit('naoLigou', { info, linhas })
  for (const f of feitos) registrar(`[ServSquare] ${f}`)
  registrar('[ServSquare] Ligando de novo...')
  await esperarTarefas()
  await ligar(true).catch((e) =>
    registrar(`[ServSquare] Não ligou de novo: ${e instanceof Error ? e.message : e}`)
  )
}

aoFalharAoLigar(async (info, linhas) => {
  const n = javaExigido(linhas)
  if (!n || n === javaDoServidor(info)) return []
  await atualizarInfo(info, { javaDosMods: n === info.java ? undefined : n })
  return [`Os mods deste servidor precisam do Java ${n}. O servidor passa a usar o Java ${n}.`]
})

// Fase M7: o "Ligar mesmo assim" de um servidor passado a um amigo libera só o próximo ligar.
let liberadoEmprestado = false
export async function ligarMesmoEmprestado(): Promise<void> {
  liberadoEmprestado = true
  try {
    await ligar()
  } finally {
    liberadoEmprestado = false
  }
}

export async function ligar(depoisDeConsertar = false): Promise<void> {
  if (estado !== 'desligado') throw new ErroApp('O servidor já está ligado.')
  if (ocupado) throw new ErroApp('Espere a tarefa atual terminar e tente de novo.')
  if (encerrando) throw new ErroApp('O HubSquare está fechando.')
  // Muda o estado antes de qualquer espera, para dois cliques não abrirem dois servidores.
  mudarEstado('ligando')
  let info: InfoServidor | null
  let java: string
  let argumentosDoLoader: string[]
  try {
    info = await servidorAtual()
    if (!info) throw new ErroApp('Nenhum servidor encontrado. Crie um servidor primeiro.')
    // Fase M7: passado a um amigo. Só liga depois do "Ligar mesmo assim" (vale uma vez).
    if (info.emprestado && !liberadoEmprestado) {
      throw new ErroApp(
        `Este servidor está ${textoEmprestado(info.emprestado).replace(/^Com/, 'com')}. Enquanto seu amigo hospeda, não ligue este servidor aqui, ou os dois mundos vão se separar. Ligue só se ele parou de hospedar.`,
        '',
        { emprestado: true }
      )
    }
    liberadoEmprestado = false
    if (!(await portaLivre(PORTA))) {
      throw new ErroApp(
        `A porta ${PORTA} já está em uso. Feche outro servidor de Minecraft aberto no PC e tente de novo.`
      )
    }
    java = await garantirJava(javaDoServidor(info), (p) => enviar('download:progresso', p))
    for (const tarefa of antesDeLigar) await tarefa(info)
    argumentosDoLoader = await tiposDeServidor[info.tipo].argumentos(info.pasta)
  } catch (e) {
    mudarEstado('desligado')
    throw e
  }
  // O app começou a fechar enquanto esperava: não abre um Java que ficaria sozinho.
  if (encerrando) return mudarEstado('desligado')
  depoisDoConserto = depoisDeConsertar
  const linhasAoLigar: string[] = [] // console desta tentativa, para os consertos

  const ram = ramDoServidor(info)
  const otimizado = info.javaOtimizado === true
  registrar(
    `[ServSquare] Ligando ${info.nome} com ${ram} GB de RAM${otimizado ? ' e a configuração otimizada do Java' : ''}...`
  )
  const filho = spawn(
    java,
    [
      `-Xmx${ram}G`,
      ...(otimizado ? flagsOtimizadas(ram) : []),
      '-Dstdout.encoding=UTF-8',
      '-Dstderr.encoding=UTF-8',
      ...argumentosDoLoader
    ],
    { cwd: info.pasta, windowsHide: true }
  )
  processo = filho
  if (filho.pid) eventos.emit('processo', { pid: filho.pid, ramGb: ram })
  let avisarFim = (): void => {}
  terminou = new Promise((r) => (avisarFim = r))
  // Escrever no stdin de um processo que já fechou gera erro; ignorar é seguro.
  filho.stdin?.on('error', () => {})

  for (const fluxo of [filho.stdout, filho.stderr]) {
    if (!fluxo) continue
    createInterface({ input: fluxo }).on('line', (bruta) => {
      // Tira os códigos de cor do terminal (começam com o caractere ESC).
      // eslint-disable-next-line no-control-regex
      const texto = bruta.replace(/\x1b\[[0-9;]*m/g, '')
      if (!ocultarDoConsole(texto)) registrar(texto)
      eventos.emit('linha', texto)
      if (estado === 'ligando' && linhasAoLigar.length < 5000) linhasAoLigar.push(texto)
      if (estado === 'ligando' && /\bDone \(/.test(texto)) {
        mudarEstado('ligado')
        aplicarPvp(info)
      }
    })
  }

  const fim = (codigo: number | null, falha?: Error): void => {
    if (processo !== filho) return
    processo = null
    let erro: ErroTela | undefined
    if (falha) {
      erro = {
        mensagem: 'O Java não iniciou. Tente ligar de novo ou reinicie o PC.',
        detalhes: String(falha)
      }
    } else if (codigo !== 0 && estado !== 'desligando') {
      erro = {
        mensagem:
          estado === 'ligando'
            ? 'O servidor fechou sozinho enquanto ligava. Veja o console para entender o motivo.'
            : 'O servidor desligou sozinho. Veja o console para entender o motivo.',
        detalhes:
          `Código de saída: ${codigo}\n\n` +
          historico
            .slice(-30)
            .map((l) => l.texto)
            .join('\n')
      }
    }
    const falhouAoLigar = !falha && codigo !== 0 && estado === 'ligando'
    registrar(`[ServSquare] Servidor desligado (código ${codigo ?? 'encerrado à força'}).`)
    mudarEstado('desligado', erro)
    eventos.emit('desligou', { normal: !erro, info })
    avisarFim()
    // Uma tentativa só: se o conserto não bastou, o erro fica na tela.
    if (falhouAoLigar && !depoisDoConserto && !encerrando) void consertarELigar(info, linhasAoLigar)
    else if (falhouAoLigar) eventos.emit('naoLigou', { info, linhas: linhasAoLigar })
  }
  filho.on('error', (e) => fim(null, e))
  filho.on('close', (codigo) => fim(codigo))
}

export async function desligar(): Promise<void> {
  const filho = processo
  if (!filho) return
  if (estado !== 'desligando') {
    mudarEstado('desligando')
    filho.stdin?.write('stop\n')
  }
  const forcar = setTimeout(() => {
    registrar('[ServSquare] O servidor demorou mais de 30 s para desligar. Encerrando à força.')
    filho.kill()
  }, TEMPO_PARA_DESLIGAR)
  await terminou
  clearTimeout(forcar)
}

export async function reiniciar(): Promise<void> {
  await desligar()
  await esperarTarefas() // o backup feito ao desligar precisa terminar antes de ligar
  await ligar()
}

export function enviarComando(valor: unknown): void {
  if (!processo || estado === 'desligando') {
    throw new ErroApp('O servidor está desligado. Ligue o servidor para enviar comandos.')
  }
  const comando =
    typeof valor === 'string'
      ? valor
          .replace(/[\r\n]/g, ' ')
          .trim()
          .slice(0, 1000)
      : ''
  if (!comando) return
  if (/^\/?stop$/i.test(comando)) mudarEstado('desligando')
  escrever(comando)
}
