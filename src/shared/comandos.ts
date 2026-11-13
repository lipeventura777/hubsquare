// Central de comandos (Fase 26), sem rede nem arquivos. Usado pela tela (prévia do comando) e
// pelo processo principal (que remonta o comando a partir da ação, sem confiar no texto da tela).
// Testado em tests/comandos.test.ts.
//
// Nenhum texto do usuário vira comando sem passar por aqui: nomes de jogador, ids de item e de
// efeito, números dentro de limites e textos sem quebra de linha nem caracteres de controle.

// Nó da árvore de comandos que o próprio servidor exporta (commands.json do gerador de relatórios).
export interface NoComando {
  type: 'root' | 'literal' | 'argument'
  children?: Record<string, NoComando>
  executable?: boolean
  redirect?: string[]
  parser?: string
  properties?: Record<string, unknown>
}

export function noDoCaminho(arvore: NoComando, caminho: string[]): NoComando | null {
  let no: NoComando | undefined = arvore
  for (const p of caminho) {
    no = no?.children?.[p]
    if (!no) return null
  }
  return no ?? null
}

// Primeiro argumento (não literal) logo abaixo do caminho.
function argumento(arvore: NoComando, caminho: string[]): NoComando | null {
  const no = noDoCaminho(arvore, caminho)
  return Object.values(no?.children ?? {}).find((c) => c.type === 'argument') ?? null
}

export interface RegraDoJogo {
  nome: string
  tipo: 'bool' | 'int'
  min?: number
  max?: number
}

export interface Capacidades {
  comandos: string[] // de primeiro nível
  gamerules: RegraDoJogo[]
  climaComUnidade: boolean // weather aceita "300s" (1.19.4+); antes, segundos
  bordaComUnidade: boolean // worldborder set ... <tempo> em ticks com unidade (1.21.11+)
  efeitoInfinito: boolean
}

export function capacidades(arvore: NoComando): Capacidades {
  const regras = Object.entries(noDoCaminho(arvore, ['gamerule'])?.children ?? {})
    .filter(([nome]) => !nome.includes(':'))
    .flatMap(([nome, no]): RegraDoJogo[] => {
      const arg = Object.values(no.children ?? {})[0]
      if (arg?.parser === 'brigadier:bool') return [{ nome, tipo: 'bool' }]
      if (arg?.parser === 'brigadier:integer') {
        const p = arg.properties ?? {}
        return [
          {
            nome,
            tipo: 'int',
            ...(typeof p.min === 'number' && { min: p.min }),
            ...(typeof p.max === 'number' && { max: p.max })
          }
        ]
      }
      return []
    })
  return {
    comandos: Object.keys(arvore.children ?? {}),
    gamerules: regras.sort((a, b) => a.nome.localeCompare(b.nome)),
    climaComUnidade: argumento(arvore, ['weather', 'clear'])?.parser === 'minecraft:time',
    bordaComUnidade:
      argumento(arvore, ['worldborder', 'set', 'distance'])?.parser === 'minecraft:time',
    efeitoInfinito: !!noDoCaminho(arvore, ['effect', 'give', 'targets', 'effect', 'infinite'])
  }
}

// ---------- Validação ----------

export function nomeJogador(v: unknown): string {
  const nome = typeof v === 'string' ? v.trim() : ''
  if (!/^[A-Za-z0-9_]{3,16}$/.test(nome)) {
    throw new Error('Nome de jogador inválido (3 a 16 letras, números ou "_").')
  }
  return nome
}

export function idRecurso(v: unknown, oQue: string): string {
  const id = typeof v === 'string' ? v.trim().toLowerCase() : ''
  const completo = id.includes(':') ? id : `minecraft:${id}`
  if (!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(completo) || completo.length > 120) {
    throw new Error(`${oQue} inválido.`)
  }
  return completo
}

export function inteiro(v: unknown, min: number, max: number, oQue: string): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${oQue} precisa ser um número inteiro de ${min} a ${max}.`)
  }
  return n
}

function coordenada(v: unknown, limite: number): string {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > limite) {
    throw new Error('Coordenada inválida.')
  }
  return Number.isInteger(n) ? String(n) : n.toFixed(2) // nunca "1e-7"
}

// Texto livre (chat, título, motivo): uma linha, sem caracteres de controle.
export function textoLivre(v: unknown, max: number, oQue: string, vazio = false): string {
  const t = typeof v === 'string' ? v.trim() : ''
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(t))
    throw new Error(`${oQue}: use uma linha só, sem caracteres especiais.`)
  if (!t && !vazio) throw new Error(`Escreva ${oQue.toLowerCase()}.`)
  if (t.length > max) throw new Error(`${oQue}: até ${max} letras.`)
  return t
}

export const CORES_TEXTO = [
  'white',
  'gray',
  'dark_gray',
  'black',
  'red',
  'dark_red',
  'gold',
  'yellow',
  'green',
  'dark_green',
  'aqua',
  'dark_aqua',
  'blue',
  'dark_blue',
  'light_purple',
  'dark_purple'
] as const
export type CorTexto = (typeof CORES_TEXTO)[number]

// Componente de texto. JSON com chaves entre aspas também é SNBT válido (1.21.5+).
export function componente(texto: string, cor: unknown, negrito = false): string {
  const c = CORES_TEXTO.includes(cor as CorTexto) ? (cor as CorTexto) : 'white'
  return JSON.stringify({ text: texto, color: c, ...(negrito && { bold: true }) })
}

// ---------- Ações ----------

export const MODOS_JOGO = ['survival', 'creative', 'adventure', 'spectator'] as const
export const DIFICULDADES = ['peaceful', 'easy', 'normal', 'hard'] as const

type Jogadores = { jogadores: string[] }

export type AcaoCentral =
  | { tipo: 'tempo'; ticks: number }
  | { tipo: 'clima'; clima: 'clear' | 'rain' | 'thunder'; segundos: number | null }
  | { tipo: 'dificuldade'; valor: (typeof DIFICULDADES)[number] }
  | { tipo: 'spawn'; x: number; y: number; z: number }
  | { tipo: 'spawnJogador'; jogador: string }
  | { tipo: 'borda'; tamanho: number; segundos: number | null }
  | { tipo: 'centroBorda'; x: number; z: number }
  | { tipo: 'gamerule'; nome: string; valor: boolean | number }
  | ({ tipo: 'modo'; modo: (typeof MODOS_JOGO)[number] } & Jogadores)
  | ({ tipo: 'tpJogador'; alvo: string } & Jogadores)
  | ({ tipo: 'tpCoord'; x: number; y: number; z: number } & Jogadores)
  | ({ tipo: 'curar' | 'alimentar' | 'limpar' | 'op' | 'limparEfeitos' } & Jogadores)
  | ({ tipo: 'xp'; quantidade: number; unidade: 'points' | 'levels' } & Jogadores)
  | ({ tipo: 'kick' | 'ban'; motivo: string } & Jogadores)
  | ({ tipo: 'dar'; item: string; quantidade: number } & Jogadores)
  | ({
      tipo: 'efeito'
      efeito: string
      nivel: number
      segundos: number | null // null: infinito
      ocultar: boolean
    } & Jogadores)
  | { tipo: 'say'; texto: string }
  | ({ tipo: 'chat' | 'barra'; texto: string; cor: CorTexto; negrito: boolean } & Jogadores)
  | ({ tipo: 'titulo'; titulo: string; subtitulo: string; cor: CorTexto } & Jogadores)

export interface ContextoComandos {
  arvore: NoComando
  itens?: Set<string> // ids aceitos (os do jogo + os dos mods); sem a lista, só o formato
  efeitos?: Set<string>
}

// Comando de primeiro nível que cada ação usa: sem ele na versão, a ação fica escondida.
const COMANDO_DA_ACAO: Record<AcaoCentral['tipo'], string> = {
  tempo: 'time',
  clima: 'weather',
  dificuldade: 'difficulty',
  spawn: 'setworldspawn',
  spawnJogador: 'setworldspawn',
  borda: 'worldborder',
  centroBorda: 'worldborder',
  gamerule: 'gamerule',
  modo: 'gamemode',
  tpJogador: 'tp',
  tpCoord: 'tp',
  curar: 'effect',
  alimentar: 'effect',
  limpar: 'clear',
  op: 'op',
  limparEfeitos: 'effect',
  xp: 'xp',
  kick: 'kick',
  ban: 'ban',
  dar: 'give',
  efeito: 'effect',
  say: 'say',
  chat: 'tellraw',
  barra: 'title',
  titulo: 'title'
}

export function acaoDisponivel(tipo: AcaoCentral['tipo'], arvore: NoComando): boolean {
  return !!arvore.children?.[COMANDO_DA_ACAO[tipo]]
}

// Pedem confirmação antes (limpar inventário, banir, expulsar).
export function acaoDestrutiva(a: AcaoCentral): boolean {
  return a.tipo === 'limpar' || a.tipo === 'ban' || a.tipo === 'kick'
}

const alvos = (j: unknown): string[] => {
  const lista = Array.isArray(j) ? [...new Set(j.map(nomeJogador))] : []
  if (!lista.length) throw new Error('Escolha pelo menos um jogador.')
  if (lista.length > 100) throw new Error('Escolha até 100 jogadores.')
  return lista
}
// Mensagens: sem jogador escolhido, vai para todos (@a).
const alvosOuTodos = (j: unknown): string[] => (Array.isArray(j) && j.length ? alvos(j) : ['@a'])

export function montarComandos(acao: unknown, ctx: ContextoComandos): string[] {
  const a = (acao ?? {}) as AcaoCentral
  if (!a || typeof a !== 'object' || !(a.tipo in COMANDO_DA_ACAO))
    throw new Error('Ação desconhecida.')
  if (!acaoDisponivel(a.tipo, ctx.arvore))
    throw new Error('Esse comando não existe nesta versão do servidor.')
  const cap = capacidades(ctx.arvore)
  const porJogador = (f: (j: string) => string): string[] =>
    alvos((a as Jogadores).jogadores).map(f)
  switch (a.tipo) {
    case 'tempo':
      return [`time set ${inteiro(a.ticks, 0, 24000, 'A hora')}`]
    case 'clima': {
      if (!['clear', 'rain', 'thunder'].includes(a.clima)) throw new Error('Clima inválido.')
      if (a.segundos === null || a.segundos === undefined) return [`weather ${a.clima}`]
      const s = inteiro(a.segundos, 1, 1_000_000, 'A duração')
      return [`weather ${a.clima} ${cap.climaComUnidade ? `${s}s` : s}`]
    }
    case 'dificuldade':
      if (!DIFICULDADES.includes(a.valor)) throw new Error('Dificuldade inválida.')
      return [`difficulty ${a.valor}`]
    case 'spawn':
      return [
        `setworldspawn ${inteiro(a.x, -29_999_999, 29_999_999, 'X')} ${inteiro(a.y, -2048, 2048, 'Y')} ${inteiro(a.z, -29_999_999, 29_999_999, 'Z')}`
      ]
    case 'spawnJogador': {
      const j = nomeJogador(a.jogador)
      return [`execute at ${j} run setworldspawn ~ ~ ~`]
    }
    case 'borda': {
      const t = inteiro(a.tamanho, 1, 59_999_968, 'O tamanho da borda')
      if (a.segundos === null || a.segundos === undefined) return [`worldborder set ${t}`]
      const s = inteiro(a.segundos, 1, 1_000_000, 'O tempo da mudança')
      return [`worldborder set ${t} ${cap.bordaComUnidade ? `${s}s` : s}`]
    }
    case 'centroBorda':
      return [`worldborder center ${coordenada(a.x, 29_999_984)} ${coordenada(a.z, 29_999_984)}`]
    case 'gamerule': {
      const regra = cap.gamerules.find((r) => r.nome === a.nome)
      if (!regra) throw new Error('Essa regra não existe nesta versão.')
      if (regra.tipo === 'bool') {
        if (typeof a.valor !== 'boolean') throw new Error('Essa regra é ligada ou desligada.')
        return [`gamerule ${regra.nome} ${a.valor}`]
      }
      return [
        `gamerule ${regra.nome} ${inteiro(a.valor, regra.min ?? -2_147_483_648, regra.max ?? 2_147_483_647, 'O valor')}`
      ]
    }
    case 'modo':
      if (!MODOS_JOGO.includes(a.modo)) throw new Error('Modo de jogo inválido.')
      return porJogador((j) => `gamemode ${a.modo} ${j}`)
    case 'tpJogador': {
      const alvo = nomeJogador(a.alvo)
      return porJogador((j) => `tp ${j} ${alvo}`)
    }
    case 'tpCoord': {
      const xyz = `${coordenada(a.x, 29_999_999)} ${coordenada(a.y, 20_000_000)} ${coordenada(a.z, 29_999_999)}`
      return porJogador((j) => `tp ${j} ${xyz}`)
    }
    case 'curar': // nível 5: cura 4 × 2⁴ de vida, enche qualquer barra
      return porJogador((j) => `effect give ${j} minecraft:instant_health 1 4 true`)
    case 'alimentar':
      return porJogador((j) => `effect give ${j} minecraft:saturation 1 19 true`)
    case 'limpar':
      return porJogador((j) => `clear ${j}`)
    case 'op':
      return porJogador((j) => `op ${j}`)
    case 'limparEfeitos':
      return porJogador((j) => `effect clear ${j}`)
    case 'xp': {
      if (a.unidade !== 'points' && a.unidade !== 'levels')
        throw new Error('Escolha pontos ou níveis.')
      const n = inteiro(a.quantidade, 1, 1_000_000, 'A quantidade de XP')
      return porJogador((j) => `xp add ${j} ${n} ${a.unidade}`)
    }
    case 'kick':
    case 'ban': {
      const motivo = textoLivre(a.motivo, 100, 'O motivo', true)
      return porJogador((j) => `${a.tipo} ${j}${motivo ? ` ${motivo}` : ''}`)
    }
    case 'dar': {
      const item = idRecurso(a.item, 'Item')
      if (ctx.itens && !ctx.itens.has(item)) throw new Error('Esse item não existe neste servidor.')
      const n = inteiro(a.quantidade, 1, 6400, 'A quantidade')
      return porJogador((j) => `give ${j} ${item} ${n}`)
    }
    case 'efeito': {
      const efeito = idRecurso(a.efeito, 'Efeito')
      if (ctx.efeitos && !ctx.efeitos.has(efeito))
        throw new Error('Esse efeito não existe neste servidor.')
      const amp = inteiro(a.nivel, 1, 256, 'O nível') - 1
      let duracao: string
      if (a.segundos === null) {
        if (!cap.efeitoInfinito) throw new Error('Esta versão não tem efeito infinito.')
        duracao = 'infinite'
      } else duracao = String(inteiro(a.segundos, 1, 1_000_000, 'A duração'))
      return porJogador((j) => `effect give ${j} ${efeito} ${duracao} ${amp} ${a.ocultar === true}`)
    }
    case 'say':
      return [`say ${textoLivre(a.texto, 256, 'A mensagem')}`]
    case 'chat': {
      const t = componente(textoLivre(a.texto, 256, 'A mensagem'), a.cor, a.negrito === true)
      return alvosOuTodos(a.jogadores).map((j) => `tellraw ${j} ${t}`)
    }
    case 'barra': {
      const t = componente(textoLivre(a.texto, 128, 'A mensagem'), a.cor, a.negrito === true)
      return alvosOuTodos(a.jogadores).map((j) => `title ${j} actionbar ${t}`)
    }
    case 'titulo': {
      const titulo = textoLivre(a.titulo, 64, 'O título')
      const sub = textoLivre(a.subtitulo, 96, 'O subtítulo', true)
      // O subtítulo vai antes: ele só aparece junto quando o título é mandado depois.
      return alvosOuTodos(a.jogadores).flatMap((j) => [
        ...(sub ? [`title ${j} subtitle ${componente(sub, a.cor)}`] : []),
        `title ${j} title ${componente(titulo, a.cor, true)}`
      ])
    }
  }
}

// ---------- Atalhos ----------

export const VARIAVEL_JOGADOR = '{jogador}'

// Um comando de atalho: uma linha, até 256 letras, sem "/" na frente.
export function comandoDeAtalho(v: unknown): string {
  const c = textoLivre(v, 256, 'O comando').replace(/^\//, '')
  if (!/^[a-z][\w:-]*/i.test(c)) throw new Error(`"${c}" não parece um comando.`)
  return c
}

export function expandirAtalho(comandos: string[], jogador: string | null): string[] {
  return comandos.map((c) => {
    if (!c.includes(VARIAVEL_JOGADOR)) return c
    if (!jogador) throw new Error('Este atalho precisa de um jogador escolhido.')
    return c.split(VARIAVEL_JOGADOR).join(nomeJogador(jogador))
  })
}

// Comandos que apagam coisas ou tiram gente do jogo: o atalho pede confirmação.
export function comandoDestrutivo(c: string): boolean {
  return /(^|\srun\s+)(kill|clear|ban|ban-ip|kick|stop|deop|pardon|whitelist\s+off|fill|setblock\s+\S+\s+\S+\s+\S+\s+minecraft:air)\b/i.test(
    c.trim()
  )
}

// ---------- Respostas do console ----------

export interface Modelo {
  chave: string
  re: RegExp
  tamanho: number // letras fixas: o maior que bate é o mais específico
}

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Os modelos do en_us.json da versão ("Set the time to %s") viram expressões regulares.
export function compilarModelos(en: Record<string, string>): Modelo[] {
  return Object.entries(en).flatMap(([chave, texto]) => {
    const fixo = texto.replace(/%(\d+\$)?[sd]/g, '')
    if (fixo.trim().length < 8 || !/%|[a-z]/i.test(texto)) return []
    const partes = texto.split(/%(?:\d+\$)?[sd]/g).map(escapar)
    return [{ chave, re: new RegExp(`^${partes.join('(.+?)')}$`), tamanho: fixo.length }]
  })
}

// Tira o começo do log ("[16:32:37] [Server thread/INFO]: " ou "[16:32:37 INFO]: ").
export function textoDaLinha(linha: string): string {
  return linha.replace(/^\[[^\]]*\]\s*(\[[^\]]*\]\s*)?:?\s*/, '').replace(/^\[[^\]]*\]:\s*/, '')
}

const ERRO =
  /(fail|invalid|unknown|notfound|not_found|error|expected|toobig|toosmall|too_big|too_small|nothing|cannot|incompatible|empty|unchanged|missing|unavailable|denied|requires)/i

export function traduzirResposta(
  linha: string,
  modelos: Modelo[],
  pt: Record<string, string>
): { chave: string; ok: boolean; texto: string } | null {
  const t = textoDaLinha(linha)
  let melhor: { m: Modelo; args: string[] } | null = null
  for (const m of modelos) {
    const r = t.match(m.re)
    if (r && (!melhor || m.tamanho > melhor.m.tamanho)) melhor = { m, args: r.slice(1) }
  }
  if (!melhor) return null
  const { chave } = melhor.m
  const modelo = pt[chave] ?? null
  let i = 0
  const texto = modelo
    ? modelo.replace(
        /%(?:(\d+)\$)?[sd]/g,
        (_, pos?: string) => melhor!.args[pos ? Number(pos) - 1 : i++] ?? ''
      )
    : t
  const ok = !ERRO.test(chave) && !/^(argument|arguments|parsing|command\.)/.test(chave)
  return { chave, ok, texto }
}

// ---------- Autocompletar (console) ----------

const SELETORES = ['@a', '@p', '@r', '@s', '@e']

function seguir(raiz: NoComando, no: NoComando): NoComando {
  if (no.redirect) return noDoCaminho(raiz, no.redirect) ?? no
  // "execute ... run" volta para a raiz (no relatório ele não tem filhos).
  if (!no.children && !no.executable) return raiz
  return no
}

export function sugerir(
  arvore: NoComando,
  linha: string,
  fontes: { jogadores: string[]; itens: string[]; efeitos: string[] },
  maximo = 12
): { inicio: number; opcoes: string[] } {
  const semBarra = linha.replace(/^\//, '')
  const desloc = linha.length - semBarra.length
  const partes = semBarra.split(' ')
  const ultima = partes.pop() ?? ''
  const inicio = linha.length - ultima.length
  let no: NoComando | null = arvore
  for (const p of partes) {
    if (!no) break
    const filhos: Record<string, NoComando> = no.children ?? {}
    const literal: NoComando | undefined = filhos[p]
    const proximo = literal ?? Object.values(filhos).find((c) => c.type === 'argument')
    no = proximo ? seguir(arvore, proximo) : null
  }
  if (!no) return { inicio: inicio + 0 * desloc, opcoes: [] }
  const opcoes = new Set<string>()
  const comeca = (x: string): boolean => x.toLowerCase().startsWith(ultima.toLowerCase())
  for (const [nome, filho] of Object.entries(no.children ?? {})) {
    if (filho.type === 'literal') {
      if (comeca(nome)) opcoes.add(nome)
      continue
    }
    const p = filho.parser ?? ''
    const registro = String(filho.properties?.registry ?? '')
    if (/entity|game_profile|score_holder/.test(p)) {
      for (const j of [...fontes.jogadores, ...SELETORES]) if (comeca(j)) opcoes.add(j)
    } else if (/item_stack|item_predicate/.test(p) || registry(registro, 'item')) {
      for (const it of fontes.itens)
        if (comeca(it) || comeca(it.replace(/^minecraft:/, ''))) opcoes.add(it)
    } else if (/mob_effect/.test(p) || registry(registro, 'mob_effect')) {
      for (const e of fontes.efeitos)
        if (comeca(e) || comeca(e.replace(/^minecraft:/, ''))) opcoes.add(e)
    } else if (p === 'brigadier:bool') {
      for (const b of ['true', 'false']) if (comeca(b)) opcoes.add(b)
    }
    if (opcoes.size >= maximo) break
  }
  return { inicio, opcoes: [...opcoes].slice(0, maximo) }
}

const registry = (r: string, nome: string): boolean => r === `minecraft:${nome}` || r === nome
