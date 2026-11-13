import { shell } from 'electron'
import { existsSync } from 'fs'
import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  EXTRAS_TIPOS,
  NOMES_TIPOS,
  type AmostraDesempenho,
  type EstadoDiagnostico,
  type EstadoMapa,
  type EstadoPregeracao,
  type Ferramenta,
  type InfoServidor,
  type ResultadoDiagnostico,
  type TarefaChunky,
  type VisaoDesempenho
} from '../shared/tipos'
import { compararVersoes } from '../shared/versoes'
import { limitesRam, ramDoServidor } from './config'
import { ipLocal, ipRadmin } from './conexao'
import {
  FLAGS_AIKAR,
  aceitarBlueMap,
  culpadosDoSpark,
  dicas,
  lerBlueMap,
  lerChunky,
  lerPorta,
  lerTps,
  linkDoSpark,
  precisaAceitarBlueMap,
  resumoDosCulpados
} from './desempenhoRegras'
import { ErroApp, detalhar } from './erros'
import { lerJogadores } from './jogadores'
import * as modrinth from './modrinth'
import { LOADERS, estadoDoProjeto } from './mods'
import { lerPropriedades } from './propriedades'
import { buscarBytes } from './rede'
import { atualizarInfo, enviarDoApp, enviarSilencioso, eventos, lerEstado } from './servidor'

// Tela Desempenho (Fase 18): números do servidor, flags do Java, pré-geração (Chunky),
// diagnóstico (spark) e mapa (BlueMap ou Dynmap). As ferramentas são instaladas pela mesma
// lógica da tela Mods, então aparecem lá também.

// Ids dos projetos no Modrinth.
const CHUNKY = 'fALzjamp'
const SPARK = 'l6YH9Als'
const BLUEMAP = 'swbUV1cr'
const DYNMAP = 'fRQREgAc'

const DEZ_MINUTOS = 10 * 60 * 1000
const INTERVALO_AMOSTRA = 10_000
const INTERVALO_TPS = 30_000
const INTERVALO_BLUEMAP = 15_000

// ---------- O que o console conta ----------

const amostras: AmostraDesempenho[] = []
let ultimoTps: number | null = null
let esperandoTpsDoSpark = false
let pedidoTps = 0
let pedidoBlueMap = 0
let render: EstadoMapa['render'] = null
let aoLinkDoSpark: ((codigo: string) => void) | null = null
let diagnosticoDesde: number | null = null

const TAREFA_PARADA: TarefaChunky = {
  estado: 'parado',
  porcentagem: 0,
  chunks: 0,
  eta: null,
  velocidade: null,
  pergunta: null
}
let tarefa: TarefaChunky = { ...TAREFA_PARADA }

eventos.on('uso', (uso) => {
  const agora = Date.now()
  if (amostras.length && agora - amostras[amostras.length - 1].t < INTERVALO_AMOSTRA) return
  amostras.push({ t: agora, ...uso, jogadores: lerJogadores().length, tps: ultimoTps })
  while (amostras.length && amostras[0].t < agora - DEZ_MINUTOS) amostras.shift()
})

eventos.on('estado', (estado) => {
  if (estado !== 'desligado') return
  amostras.length = 0
  ultimoTps = null
  render = null
  tarefa = { ...TAREFA_PARADA }
})

eventos.on('linha', (texto) => {
  const tps = lerTps(texto, esperandoTpsDoSpark)
  esperandoTpsDoSpark = tps.esperando
  if (tps.tps !== null) ultimoTps = tps.tps

  const c = lerChunky(texto)
  if (c) {
    if (c.tipo === 'progresso') {
      tarefa = { ...tarefa, estado: 'rodando', pergunta: null, ...c }
    } else if (c.tipo === 'fim') {
      tarefa = { ...tarefa, estado: 'concluido', porcentagem: 100, chunks: c.chunks, eta: null }
    } else if (c.tipo === 'pergunta') {
      tarefa = { ...tarefa, estado: 'pergunta', pergunta: { motivo: c.motivo, texto: c.texto } }
    } else if (c.tipo === 'pausado') tarefa = { ...tarefa, estado: 'pausado' }
    else if (c.tipo === 'iniciado') tarefa = { ...tarefa, estado: 'rodando', pergunta: null }
    else tarefa = { ...TAREFA_PARADA }
  }

  const b = lerBlueMap(texto)
  if (b) {
    render =
      b.tipo === 'progresso'
        ? { porcentagem: b.porcentagem, ocioso: false }
        : {
            porcentagem: b.tipo === 'ocioso' ? 100 : (render?.porcentagem ?? null),
            ocioso: b.tipo === 'ocioso'
          }
  }

  const codigo = linkDoSpark(texto)
  if (codigo && aoLinkDoSpark) aoLinkDoSpark(codigo)
})

// ---------- Ferramentas ----------

async function ferramenta(
  info: InfoServidor,
  id: string,
  nome: string,
  arquivo: RegExp
): Promise<Ferramenta> {
  if (!EXTRAS_TIPOS[info.tipo]) {
    return {
      projetoId: null,
      nome,
      estado: 'indisponivel',
      motivo: `O ${NOMES_TIPOS[info.tipo]} não aceita mods nem plugins. Troque o software na tela Software.`
    }
  }
  return { projetoId: id, nome, estado: await estadoDoProjeto(info, id, arquivo), motivo: null }
}

async function temVersao(info: InfoServidor, id: string): Promise<boolean> {
  return (await modrinth.versoes(id, LOADERS[info.tipo] ?? [info.tipo], info.versao)).length > 0
}

// ---------- Visão geral ----------

async function comandoTps(info: InfoServidor): Promise<string | null> {
  if (info.tipo === 'paper') return 'tps'
  if (info.tipo === 'forge') return 'forge tps'
  if (info.tipo === 'neoforge') return 'neoforge tps'
  if (info.tipo === 'fabric') {
    return (await estadoDoProjeto(info, SPARK, /^spark/i)) === 'instalado' ? 'spark tps' : null
  }
  return null
}

async function contarMods(info: InfoServidor): Promise<number> {
  const extras = EXTRAS_TIPOS[info.tipo]
  if (!extras) return 0
  try {
    return (await readdir(join(info.pasta, extras))).filter((n) => /\.jar$/i.test(n)).length
  } catch {
    return 0
  }
}

export async function visaoGeral(info: InfoServidor): Promise<VisaoDesempenho> {
  const comando = await comandoTps(info)
  // O TPS só é pedido enquanto a tela está aberta (ela chama esta função a cada poucos segundos).
  if (comando && lerEstado() === 'ligado' && Date.now() - pedidoTps > INTERVALO_TPS) {
    pedidoTps = Date.now()
    enviarSilencioso(comando)
  }
  const propriedades = lerPropriedades(
    await readFile(join(info.pasta, 'server.properties'), 'utf8').catch(() => '')
  )
  const numero = (chave: string): number | null => {
    const v = Number(propriedades.get(chave))
    return Number.isFinite(v) && propriedades.has(chave) ? v : null
  }
  const ultima = amostras[amostras.length - 1]
  const recentes = amostras.filter((a) => a.t > Date.now() - 2 * 60 * 1000)
  const ligado = lerEstado() === 'ligado'
  return {
    amostras: ligado ? amostras : [],
    tps: ligado ? ultimoTps : null,
    tpsDisponivel: comando !== null,
    javaOtimizado: info.javaOtimizado === true,
    flags: [`-Xms${ramDoServidor(info)}G`, ...FLAGS_AIKAR],
    dicas: dicas({
      ramUsada: ligado ? (ultima?.ram ?? null) : null,
      ramMax: ligado ? (ultima?.ramMax ?? null) : null,
      ramGb: ramDoServidor(info),
      ramMaxPc: limitesRam().max,
      cpu: recentes.length ? recentes.reduce((s, a) => s + a.cpu, 0) / recentes.length : null,
      tps: ligado ? ultimoTps : null,
      jogadores: lerJogadores().length,
      distanciaVisao: numero('view-distance'),
      distanciaSimulacao: numero('simulation-distance'),
      mods: await contarMods(info),
      javaOtimizado: info.javaOtimizado === true
    })
  }
}

// Vale a partir da próxima vez que o servidor ligar.
export async function definirJavaOtimizado(info: InfoServidor, valor: unknown): Promise<void> {
  await atualizarInfo(info, { javaOtimizado: valor === true })
}

// ---------- Pré-gerar (Chunky) ----------

export async function estadoPregeracao(info: InfoServidor): Promise<EstadoPregeracao> {
  return { ferramenta: await ferramenta(info, CHUNKY, 'Chunky', /^chunky/i), tarefa }
}

export async function iniciarPregeracao(info: InfoServidor, raio: unknown): Promise<void> {
  if (!Number.isInteger(raio) || (raio as number) < 16 || (raio as number) > 50_000) {
    throw new ErroApp('Escolha um raio entre 16 e 50.000 blocos.')
  }
  if ((await estadoDoProjeto(info, CHUNKY, /^chunky/i)) !== 'instalado') {
    throw new ErroApp('Instale o Chunky e reinicie o servidor antes de pré-gerar.')
  }
  // Do ponto de nascimento, num quadrado com o raio escolhido.
  enviarDoApp('chunky spawn')
  enviarDoApp(`chunky radius ${raio}`)
  enviarDoApp('chunky start')
  tarefa = { ...TAREFA_PARADA, estado: 'iniciando' }
}

// "confirmar" só é mandado quando o usuário clica no botão da pergunta do Chunky.
export function controlarPregeracao(acao: unknown): void {
  const comandos: Record<string, string[]> = {
    pausar: ['chunky pause'],
    continuar: ['chunky continue'],
    cancelar: ['chunky cancel', 'chunky confirm'],
    confirmar: ['chunky confirm']
  }
  const lista = typeof acao === 'string' ? comandos[acao] : undefined
  if (!lista) throw new ErroApp('Ação desconhecida.')
  for (const c of lista) enviarDoApp(c)
  if (acao === 'cancelar') tarefa = { ...TAREFA_PARADA }
}

// ---------- Diagnóstico (spark) ----------

async function ferramentaSpark(info: InfoServidor): Promise<Ferramenta> {
  if (info.tipo === 'paper') {
    // O Paper 1.21+ já vem com o spark; no Modrinth não há versão para Paper.
    return compararVersoes(info.versao, '1.21') >= 0
      ? { projetoId: null, nome: 'spark', estado: 'embutido', motivo: null }
      : {
          projetoId: null,
          nome: 'spark',
          estado: 'indisponivel',
          motivo: 'O diagnóstico precisa do Paper 1.21 ou mais novo, que já vem com o spark.'
        }
  }
  return ferramenta(info, SPARK, 'spark', /^spark/i)
}

export async function estadoDiagnostico(info: InfoServidor): Promise<EstadoDiagnostico> {
  return { ferramenta: await ferramentaSpark(info), rodandoDesde: diagnosticoDesde }
}

export async function diagnosticar(info: InfoServidor): Promise<ResultadoDiagnostico> {
  const f = await ferramentaSpark(info)
  if (f.estado !== 'instalado' && f.estado !== 'embutido') {
    throw new ErroApp(f.motivo ?? 'Instale o spark e reinicie o servidor antes de diagnosticar.')
  }
  if (diagnosticoDesde) throw new ErroApp('Já tem um diagnóstico rodando. Espere ele terminar.')
  diagnosticoDesde = Date.now()
  try {
    const codigo = await new Promise<string>((resolver, falhar) => {
      const limite = setTimeout(() => {
        aoLinkDoSpark = null
        falhar(new ErroApp('O spark não devolveu o relatório. Veja o console e tente de novo.'))
      }, 150_000)
      aoLinkDoSpark = (c) => {
        clearTimeout(limite)
        aoLinkDoSpark = null
        resolver(c)
      }
      try {
        enviarDoApp('spark profiler start --timeout 60')
      } catch (e) {
        clearTimeout(limite)
        aoLinkDoSpark = null
        falhar(e)
      }
    })
    const link = `https://spark.lucko.me/${codigo}`
    let culpados: ResultadoDiagnostico['culpados'] = []
    try {
      const dados = await buscarBytes(`https://spark-usercontent.lucko.me/${codigo}`)
      const brutos = culpadosDoSpark(new Uint8Array(dados))
      culpados = brutos.map((c) => ({
        nome:
          c.nome === 'minecraft'
            ? 'O próprio jogo'
            : c.nome === 'loader'
              ? 'O loader'
              : c.nome === 'outros'
                ? 'Outros'
                : c.nome,
        porcentagem: Math.round(c.parte * 100)
      }))
      return { link, culpados, resumo: resumoDosCulpados(brutos) }
    } catch (e) {
      return {
        link,
        culpados,
        resumo: `Não deu para ler o relatório aqui; abra o link para ver os detalhes. (${detalhar(e).slice(0, 80)})`
      }
    }
  } finally {
    diagnosticoDesde = null
  }
}

// ---------- Mapa (BlueMap ou Dynmap) ----------

interface Mapa {
  id: string
  nome: 'BlueMap' | 'Dynmap'
  arquivo: RegExp
}

const MAPAS: Mapa[] = [
  { id: BLUEMAP, nome: 'BlueMap', arquivo: /^bluemap/i },
  { id: DYNMAP, nome: 'Dynmap', arquivo: /^dynmap/i }
]

// O que já está instalado; senão, o BlueMap se ele tiver versão para este software, senão o Dynmap.
const escolhaPorServidor = new Map<string, Mapa | null>()

async function escolherMapa(info: InfoServidor): Promise<Mapa | null> {
  for (const m of MAPAS) if ((await estadoDoProjeto(info, m.id, m.arquivo)) !== 'ausente') return m
  const chave = `${info.pasta}|${info.tipo}|${info.versao}`
  if (!escolhaPorServidor.has(chave)) {
    let escolha: Mapa | null = null
    for (const m of MAPAS) {
      if (await temVersao(info, m.id)) {
        escolha = m
        break
      }
    }
    escolhaPorServidor.set(chave, escolha)
  }
  return escolhaPorServidor.get(chave) ?? null
}

function configDoMapa(info: InfoServidor, m: Mapa): { principal: string; web: string } {
  const plugin = info.tipo === 'paper'
  if (m.nome === 'BlueMap') {
    const pasta = plugin
      ? join(info.pasta, 'plugins', 'BlueMap')
      : join(info.pasta, 'config', 'bluemap')
    return { principal: join(pasta, 'core.conf'), web: join(pasta, 'webserver.conf') }
  }
  const arquivo = plugin
    ? join(info.pasta, 'plugins', 'dynmap', 'configuration.txt')
    : join(info.pasta, 'dynmap', 'configuration.txt')
  return { principal: arquivo, web: arquivo }
}

export async function estadoMapa(info: InfoServidor): Promise<EstadoMapa> {
  const m = EXTRAS_TIPOS[info.tipo] ? await escolherMapa(info) : null
  if (!m) {
    return {
      ferramenta: {
        projetoId: null,
        nome: 'Mapa',
        estado: 'indisponivel',
        motivo: EXTRAS_TIPOS[info.tipo]
          ? `Nem o BlueMap nem o Dynmap têm versão para ${NOMES_TIPOS[info.tipo]} ${info.versao}.`
          : `O ${NOMES_TIPOS[info.tipo]} não aceita plugins de mapa. Troque o software na tela Software.`
      },
      precisaAceitar: false,
      configCriada: false,
      porta: null,
      rede: null,
      radmin: null,
      render: null
    }
  }
  const f = await ferramenta(info, m.id, m.nome, m.arquivo)
  const { principal, web } = configDoMapa(info, m)
  const configCriada = existsSync(principal)
  const precisaAceitar =
    m.nome === 'BlueMap' && configCriada && precisaAceitarBlueMap(await readFile(principal, 'utf8'))
  const textoWeb = await readFile(web, 'utf8').catch(() => '')
  const porta =
    m.nome === 'BlueMap'
      ? (lerPorta(textoWeb, 'port') ?? 8100)
      : (lerPorta(textoWeb, 'webserver-port') ?? 8123)

  // Pergunta o andamento ao BlueMap enquanto a tela está aberta.
  if (
    m.nome === 'BlueMap' &&
    f.estado === 'instalado' &&
    !precisaAceitar &&
    lerEstado() === 'ligado' &&
    Date.now() - pedidoBlueMap > INTERVALO_BLUEMAP
  ) {
    pedidoBlueMap = Date.now()
    enviarSilencioso('bluemap')
  }
  const endereco = (ip: string | null): string | null => (ip ? `http://${ip}:${porta}` : null)
  return {
    ferramenta: f,
    precisaAceitar,
    configCriada,
    porta,
    rede: endereco(ipLocal()),
    radmin: endereco(ipRadmin()),
    render: m.nome === 'BlueMap' ? render : null
  }
}

// Só chamado pelo clique do usuário no aceite da tela (o BlueMap baixa arquivos do jogo da Mojang).
export async function aceitarTermosDoMapa(info: InfoServidor): Promise<void> {
  const m = await escolherMapa(info)
  if (m?.nome !== 'BlueMap') return
  const { principal } = configDoMapa(info, m)
  const texto = await readFile(principal, 'utf8').catch(() => null)
  if (texto === null) {
    throw new ErroApp(
      'O BlueMap ainda não criou a configuração. Ligue o servidor uma vez e tente de novo.'
    )
  }
  if (precisaAceitarBlueMap(texto)) await writeFile(principal, aceitarBlueMap(texto))
  if (lerEstado() === 'ligado') enviarDoApp('bluemap reload')
}

export async function abrirMapa(info: InfoServidor): Promise<void> {
  const { porta } = await estadoMapa(info)
  if (!porta) throw new ErroApp('O mapa ainda não está pronto.')
  await shell.openExternal(`http://localhost:${porta}/`)
}
