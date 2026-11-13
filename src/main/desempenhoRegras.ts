import { gunzipSync } from 'zlib'

// Regras da tela Desempenho sem rede nem arquivos. Testadas em tests/desempenhoRegras.test.ts.

// ---------- Flags do Java ----------

// "Flags do Aikar", o conjunto que a documentação do PaperMC publica (docs.papermc.io/paper/aikars-flags).
// Testadas no Java 8, 17, 21 e 25. -Xms igual ao -Xmx, como a documentação pede.
export const FLAGS_AIKAR = [
  '-XX:+UseG1GC',
  '-XX:+ParallelRefProcEnabled',
  '-XX:MaxGCPauseMillis=200',
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+DisableExplicitGC',
  '-XX:+AlwaysPreTouch',
  '-XX:G1NewSizePercent=30',
  '-XX:G1MaxNewSizePercent=40',
  '-XX:G1HeapRegionSize=8M',
  '-XX:G1ReservePercent=20',
  '-XX:G1HeapWastePercent=5',
  '-XX:G1MixedGCCountTarget=4',
  '-XX:InitiatingHeapOccupancyPercent=15',
  '-XX:G1MixedGCLiveThresholdPercent=90',
  '-XX:G1RSetUpdatingPauseTimePercent=5',
  '-XX:SurvivorRatio=32',
  '-XX:+PerfDisableSharedMem',
  '-XX:MaxTenuringThreshold=1',
  '-Dusing.aikars.flags=https://mcflags.emc.gs',
  '-Daikars.new.flags=true'
]

export function flagsOtimizadas(ramGb: number): string[] {
  return [`-Xms${ramGb}G`, ...FLAGS_AIKAR]
}

// ---------- TPS ----------

// Lê o TPS das respostas de "tps" (Paper), "forge tps", "neoforge tps" e "spark tps".
// O spark escreve os números na linha seguinte ao título: `esperando` diz se a anterior era o título.
export function lerTps(
  linha: string,
  esperando: boolean
): { tps: number | null; esperando: boolean } {
  const numero = (re: RegExp): number | null => {
    const m = linha.match(re)
    return m ? Number(m[1]) : null
  }
  if (esperando) {
    const tps = numero(/\*?(\d+(?:\.\d+)?)/)
    if (tps !== null) return { tps, esperando: false }
  }
  if (/TPS from last 5s/i.test(linha)) {
    // spark: título sozinho ou com os números na mesma linha
    const tps = numero(/15m:\s*\*?(\d+(?:\.\d+)?)/)
    return { tps, esperando: tps === null }
  }
  const paper = numero(/TPS from last 1m[^:]*:\s*\*?(\d+(?:\.\d+)?)/i)
  if (paper !== null) return { tps: paper, esperando: false }
  if (/\bOverall\b/i.test(linha)) {
    const forge = numero(/Mean TPS:\s*(\d+(?:\.\d+)?)/i) ?? numero(/(\d+(?:\.\d+)?)\s*TPS/i)
    if (forge !== null) return { tps: forge, esperando: false }
  }
  return { tps: null, esperando: false }
}

// ---------- Dicas ----------

export interface DadosDicas {
  ramUsada: number | null // bytes
  ramMax: number | null // bytes
  ramGb: number
  ramMaxPc: number // GB que o PC deixa usar
  cpu: number | null // % médio dos últimos minutos
  tps: number | null
  jogadores: number
  distanciaVisao: number | null
  distanciaSimulacao: number | null
  mods: number
  javaOtimizado: boolean
}

export function dicas(d: DadosDicas): string[] {
  const r: string[] = []
  if (d.ramUsada !== null && d.ramMax && d.ramUsada / d.ramMax > 0.9) {
    const nova = Math.min(d.ramMaxPc, d.ramGb + 2)
    r.push(
      nova > d.ramGb
        ? `RAM quase cheia: aumente para ${nova} GB em Opções.`
        : 'RAM quase cheia, e o PC não tem mais para dar. Tire mods pesados ou feche outros programas.'
    )
  }
  if (d.tps !== null && d.tps < 18) {
    r.push(
      `O servidor está atrasando (TPS ${d.tps.toFixed(1).replace('.', ',')} de 20). Use a aba Diagnóstico para achar o culpado.`
    )
  }
  if (d.distanciaVisao !== null && d.distanciaVisao > 10 && d.jogadores >= 5) {
    r.push(
      `Distância de visão alta (${d.distanciaVisao}) para ${d.jogadores} jogadores: baixe para 8 no server.properties (tela Arquivos).`
    )
  } else if (d.distanciaVisao !== null && d.distanciaVisao > 16) {
    r.push(
      `Distância de visão muito alta (${d.distanciaVisao}): 10 a 12 já fica bonito e pesa bem menos.`
    )
  }
  if (d.distanciaSimulacao !== null && d.distanciaSimulacao > 10) {
    r.push(
      `Distância de simulação alta (${d.distanciaSimulacao}): baixar para 6 a 8 deixa o servidor mais leve.`
    )
  }
  if (d.cpu !== null && d.cpu > 85) {
    r.push('O processador está quase no limite. Pré-gerar o mundo e fechar outros programas ajuda.')
  }
  if (d.mods > 100 && d.ramGb < 6) {
    r.push(
      `São ${d.mods} mods para ${d.ramGb} GB de RAM: packs grandes costumam pedir 6 GB ou mais.`
    )
  }
  if (!d.javaOtimizado) {
    r.push('Ligue "Usar configuração otimizada do Java" para pausas menores na memória.')
  }
  return r
}

// ---------- Chunky ----------

export type EventoChunky =
  | { tipo: 'progresso'; porcentagem: number; chunks: number; eta: string; velocidade: number }
  | { tipo: 'fim'; chunks: number }
  | { tipo: 'pausado' | 'parado' | 'cancelado' | 'iniciado' }
  | { tipo: 'pergunta'; motivo: 'tarefa-antiga' | 'pouco-espaco'; texto: string }

// Mensagens do Chunky (lang/en.json do projeto): "Task running for ... Processed: N chunks (P%), ETA: h:m:s, Rate: R cps".
export function lerChunky(linha: string): EventoChunky | null {
  let m = linha.match(
    /Task running for .+?\. Processed: (\d+) chunks \(([\d.,]+)%\), ETA: (\d+:\d+:\d+), Rate: ([\d.,]+) cps/
  )
  if (m) {
    return {
      tipo: 'progresso',
      chunks: Number(m[1]),
      porcentagem: Number(m[2].replace(',', '.')),
      eta: m[3],
      velocidade: Number(m[4].replace(',', '.'))
    }
  }
  if ((m = linha.match(/Task finished for .+?\. Processed: (\d+) chunks/))) {
    return { tipo: 'fim', chunks: Number(m[1]) }
  }
  if (/Task started in /.test(linha) || /Task continuing for /.test(linha))
    return { tipo: 'iniciado' }
  if (/Task paused for /.test(linha)) return { tipo: 'pausado' }
  if (/Task cancelled for /.test(linha)) return { tipo: 'cancelado' }
  if (/Task stopped for /.test(linha)) return { tipo: 'parado' }
  if (/A task was already started for this world/.test(linha)) {
    return {
      tipo: 'pergunta',
      motivo: 'tarefa-antiga',
      texto: 'Já existe uma geração começada neste mundo.'
    }
  }
  if (
    (m = linha.match(
      /The server only has (.+?) disk space remaining, but the estimated disk space required for the task is (.+?)\./
    ))
  ) {
    return {
      tipo: 'pergunta',
      motivo: 'pouco-espaco',
      texto: `O disco tem só ${m[1]} livres, e a geração precisa de uns ${m[2]}.`
    }
  }
  return null
}

// ---------- BlueMap ----------

export type EventoBlueMap =
  { tipo: 'progresso'; porcentagem: number } | { tipo: 'ocioso' } | { tipo: 'parado' }

// Status do comando "bluemap" (StatusCommand.java): "progress: 12.345%", "render-threads are idle".
export function lerBlueMap(linha: string): EventoBlueMap | null {
  const m = linha.match(/progress:\s*([\d.,]+)%/)
  if (m) return { tipo: 'progresso', porcentagem: Number(m[1].replace(',', '.')) }
  if (/render-threads? (are|is) idle/.test(linha)) return { tipo: 'ocioso' }
  if (/render-threads are (stopped|paused)/.test(linha)) return { tipo: 'parado' }
  return null
}

// Porta da página do mapa: "port: 8100" (BlueMap, webserver.conf) ou "webserver-port: 8123" (Dynmap).
export function lerPorta(texto: string, chave: 'port' | 'webserver-port'): number | null {
  const m = texto.match(new RegExp(`^\\s*${chave}\\s*:\\s*(\\d{2,5})\\s*$`, 'm'))
  const porta = m ? Number(m[1]) : null
  return porta && porta > 0 && porta < 65536 ? porta : null
}

// "accept-download: false" no core.conf do BlueMap. Só vira true com o clique do usuário.
export function precisaAceitarBlueMap(coreConf: string): boolean {
  return /^\s*accept-download\s*:\s*false\b/m.test(coreConf)
}

export function aceitarBlueMap(coreConf: string): string {
  return coreConf.replace(/^(\s*accept-download\s*:\s*)false\b/m, '$1true')
}

// ---------- spark ----------

export function linkDoSpark(linha: string): string | null {
  return linha.match(/https:\/\/spark\.lucko\.me\/([A-Za-z0-9]+)/)?.[1] ?? null
}

// Leitor mínimo de protobuf: só o que o relatório do spark usa (spark_sampler.proto).
type Valor = number | Uint8Array

function* campos(buf: Uint8Array): Generator<[number, number, Valor]> {
  let i = 0
  const varint = (): number => {
    let r = 0
    let mult = 1
    for (;;) {
      if (i >= buf.length) throw new Error('protobuf cortado')
      const b = buf[i++]
      r += (b & 0x7f) * mult
      if (!(b & 0x80)) return r
      mult *= 128
    }
  }
  while (i < buf.length) {
    const chave = varint()
    const numero = Math.floor(chave / 8)
    const tipo = chave % 8
    if (tipo === 0) yield [numero, tipo, varint()]
    else if (tipo === 1) yield [numero, tipo, buf.subarray(i, (i += 8))]
    else if (tipo === 2) {
      const n = varint()
      yield [numero, tipo, buf.subarray(i, (i += n))]
    } else if (tipo === 5) yield [numero, tipo, buf.subarray(i, (i += 4))]
    else throw new Error(`tipo de campo protobuf ${tipo}`)
  }
}

const texto = (v: Valor): string => new TextDecoder().decode(v as Uint8Array)

// "repeated double" vem empacotado (tipo 2) ou um por um (tipo 1): os dois são blocos de 8 bytes.
function doubles(v: Valor, saida: number[]): void {
  const b = v as Uint8Array
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  for (let k = 0; k + 8 <= b.byteLength; k += 8) saida.push(dv.getFloat64(k, true))
}

// "repeated int32": um varint solto (tipo 0) ou vários varints empacotados (tipo 2).
function inteiros(tipo: number, v: Valor, saida: number[]): void {
  if (tipo === 0) return void saida.push(v as number)
  let r = 0
  let mult = 1
  for (const byte of v as Uint8Array) {
    r += (byte & 0x7f) * mult
    if (byte & 0x80) mult *= 128
    else {
      saida.push(r)
      r = 0
      mult = 1
    }
  }
}

interface No {
  classe: string
  tempo: number
  filhos: number[]
}

interface Linha {
  nome: string
  nos: No[]
  raizes: number[]
}

function lerNo(buf: Uint8Array): No {
  const no: No = { classe: '', tempo: 0, filhos: [] }
  const tempos: number[] = []
  for (const [n, t, v] of campos(buf)) {
    if (n === 3) no.classe = texto(v)
    else if (n === 8) doubles(v, tempos)
    else if (n === 9) inteiros(t, v, no.filhos)
  }
  no.tempo = tempos.reduce((s, x) => s + x, 0)
  return no
}

function lerLinha(buf: Uint8Array): Linha {
  const linha: Linha = { nome: '', nos: [], raizes: [] }
  for (const [n, t, v] of campos(buf)) {
    if (n === 1) linha.nome = texto(v)
    else if (n === 3) linha.nos.push(lerNo(v as Uint8Array))
    else if (n === 5) inteiros(t, v, linha.raizes)
  }
  return linha
}

export interface Culpado {
  nome: string // mod/plugin, ou "minecraft"
  parte: number // 0 a 1 do tempo do servidor (sem o tempo parado do Java)
}

const DO_JAVA = /^(java|javax|jdk|sun|com\.sun)\./
const DO_JOGO =
  /^(net\.minecraft|com\.mojang|io\.papermc|org\.bukkit|org\.spigotmc|ca\.spottedleaf)\./
const DO_LOADER =
  /^(net\.fabricmc|net\.minecraftforge|net\.neoforged|cpw\.mods|org\.spongepowered\.asm)\./

// Quem mais gasta tempo na linha "Server thread": soma o tempo próprio de cada método e
// atribui ao mod/plugin dono da classe (class_sources do spark).
export function culpadosDoSpark(dados: Uint8Array): Culpado[] {
  const buf = dados[0] === 0x1f && dados[1] === 0x8b ? new Uint8Array(gunzipSync(dados)) : dados
  const linhas: Linha[] = []
  const fontes = new Map<string, string>()
  for (const [n, , v] of campos(buf)) {
    if (n === 2) linhas.push(lerLinha(v as Uint8Array))
    else if (n === 3) {
      let chave = ''
      let valor = ''
      for (const [k, , x] of campos(v as Uint8Array)) {
        if (k === 1) chave = texto(x)
        else if (k === 2) valor = texto(x)
      }
      if (chave) fontes.set(chave, valor)
    }
  }
  const servidor = linhas.filter((l) => /server thread/i.test(l.nome))
  const usadas = servidor.length ? servidor : linhas
  const soma = new Map<string, number>()
  for (const l of usadas) {
    for (const no of l.nos) {
      const filhos = no.filhos.reduce((s, i) => s + (l.nos[i]?.tempo ?? 0), 0)
      const proprio = Math.max(0, no.tempo - filhos)
      if (!proprio || DO_JAVA.test(no.classe)) continue
      const dono =
        fontes.get(no.classe) ??
        (DO_JOGO.test(no.classe) ? 'minecraft' : DO_LOADER.test(no.classe) ? 'loader' : 'outros')
      soma.set(dono, (soma.get(dono) ?? 0) + proprio)
    }
  }
  const total = [...soma.values()].reduce((s, x) => s + x, 0)
  if (!total) return []
  return [...soma.entries()]
    .map(([nome, t]) => ({ nome, parte: t / total }))
    .sort((a, b) => b.parte - a.parte)
    .slice(0, 3)
}

export function resumoDosCulpados(culpados: Culpado[]): string {
  if (!culpados.length)
    return 'Não deu para identificar os culpados. Abra o relatório para ver os detalhes.'
  const [maior] = culpados
  if (maior.nome === 'minecraft') {
    return 'A maior parte do tempo vai para o próprio jogo (entidades, redstone, geração de mundo). Pré-gerar o mundo e baixar a distância de simulação costumam ajudar.'
  }
  if (maior.nome === 'loader' || maior.nome === 'outros') {
    return 'Nenhum mod ou plugin se destacou. Abra o relatório para ver os detalhes.'
  }
  return `"${maior.nome}" é o que mais pesa. Se o lag for grande, tente atualizar ou desativar esse mod na tela Mods.`
}
