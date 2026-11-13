import { win32 } from 'path'

// Regras sem rede nem Electron do PlaySquare (Fase P1): o perfil no launcher_profiles.json do
// launcher oficial e a lista de servidores (servers.dat) da pasta da instalação. Testadas em
// tests/launcherRegras.test.ts.

export interface PerfilLauncher {
  name: string
  type: 'custom'
  lastVersionId: string
  gameDir: string
  javaArgs: string
  icon: string
  lastUsed: string
  created?: string
  resolution?: { width: number; height: number }
}

// Os mesmos argumentos que o launcher oficial põe num perfil novo, só com a RAM da instalação.
export function argumentosJava(ram: number): string {
  return `-Xmx${ram}G -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M`
}

// Correção M1: o perfil da instalação. gameDir é sempre o caminho absoluto da pasta (o JSON do
// launcher é gravado por JSON.stringify, nunca montado como texto).
export function montarPerfil(p: {
  nome: string
  versaoId: string
  pasta: string
  ram: number
  resolucao?: { largura: number; altura: number } | null
  imagem?: string | null
  agora: string
}): PerfilLauncher {
  return {
    name: p.nome,
    type: 'custom',
    lastVersionId: p.versaoId,
    gameDir: win32.resolve(p.pasta),
    javaArgs: argumentosJava(p.ram),
    ...(p.resolucao
      ? { resolution: { width: p.resolucao.largura, height: p.resolucao.altura } }
      : {}),
    // O launcher aceita ícone em PNG (data URL); imagens grandes deixariam o arquivo pesado.
    icon:
      p.imagem?.startsWith('data:image/png;base64,') && p.imagem.length < 200_000
        ? p.imagem
        : 'Furnace',
    lastUsed: p.agora
  }
}

// Correção M1: o que devia estar na pasta da instalação (ex.: "mods/x.jar") e não está.
// Desligado pelo jogador ("x.jar.disabled") conta como presente.
export function faltandoNaPasta(esperados: string[], presentes: string[]): string[] {
  const tem = new Set(
    presentes.map((p) =>
      p
        .replace(/\\/g, '/')
        .replace(/\.disabled$/i, '')
        .toLowerCase()
    )
  )
  return esperados.filter((e) => !tem.has(e.replace(/\\/g, '/').toLowerCase()))
}

// Correção M1: iris.properties / oculus.properties. Se o shader escolhido não existe (ou nenhum
// foi escolhido), escolhe o primeiro da pasta shaderpacks e liga os shaders. A escolha do
// jogador, quando o arquivo existe, fica; as outras linhas também.
export function escolherShader(texto: string, shaders: string[]): string {
  if (!shaders.length) return texto
  const linhas = texto ? texto.split(/\r?\n/) : []
  const valor = (chave: string): string | undefined =>
    linhas
      .find((l) => l.startsWith(`${chave}=`))
      ?.slice(chave.length + 1)
      .trim()
  const atual = valor('shaderPack')
  if (atual && shaders.includes(atual)) return texto
  const definir = (chave: string, v: string): void => {
    const i = linhas.findIndex((l) => l.startsWith(`${chave}=`))
    if (i >= 0) linhas[i] = `${chave}=${v}`
    else {
      if (linhas.length && linhas[linhas.length - 1] === '') linhas.pop()
      linhas.push(`${chave}=${v}`, '')
    }
  }
  definir('shaderPack', shaders[0])
  definir('enableShaders', 'true')
  return linhas.join('\n')
}

// Põe (ou atualiza) só o perfil `chave`. Os outros perfis, as configurações e qualquer campo que
// o app não conhece ficam como estavam. Formato estranho: erro, e nada é gravado.
export function aplicarPerfil(texto: string, chave: string, perfil: PerfilLauncher): string {
  let dados: unknown
  try {
    dados = JSON.parse(texto)
  } catch {
    throw new Error('O launcher_profiles.json não é um JSON válido.')
  }
  const perfis = (dados as { profiles?: unknown } | null)?.profiles
  if (!dados || typeof dados !== 'object' || !perfis || typeof perfis !== 'object') {
    throw new Error('O launcher_profiles.json não tem a lista "profiles" que o app conhece.')
  }
  const lista = perfis as Record<string, Record<string, unknown>>
  const anterior = lista[chave] ?? {}
  lista[chave] = {
    ...anterior,
    ...perfil,
    created: (anterior.created as string | undefined) ?? perfil.created ?? perfil.lastUsed
  }
  return JSON.stringify(dados, null, 2)
}

// ---------- servers.dat (NBT sem compressão) ----------
// Lido só o necessário: a lista "servers" vira pedaços crus, para as entradas que o jogador já
// tinha voltarem exatamente iguais.

class Leitor {
  pos = 0
  b: Buffer
  constructor(b: Buffer) {
    this.b = b
  }
  u8(): number {
    return this.b.readUInt8(this.pos++)
  }
  i32(): number {
    const v = this.b.readInt32BE(this.pos)
    this.pos += 4
    return v
  }
  texto(): string {
    const n = this.b.readUInt16BE(this.pos)
    this.pos += 2
    const s = this.b.toString('utf8', this.pos, this.pos + n)
    this.pos += n
    return s
  }
  pular(n: number): void {
    if (n < 0 || this.pos + n > this.b.length) throw new Error('NBT cortado')
    this.pos += n
  }
  // Pula o conteúdo de uma tag do tipo `t`.
  conteudo(t: number): void {
    const fixos: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 4, 6: 8 }
    if (fixos[t]) return this.pular(fixos[t])
    if (t === 7) return this.pular(this.i32())
    if (t === 8) return void this.texto()
    if (t === 9) {
      const filho = this.u8()
      const n = this.i32()
      for (let i = 0; i < n; i++) this.conteudo(filho)
      return
    }
    if (t === 10) {
      for (let f = this.u8(); f !== 0; f = this.u8()) {
        this.texto()
        this.conteudo(f)
      }
      return
    }
    if (t === 11) return this.pular(this.i32() * 4)
    if (t === 12) return this.pular(this.i32() * 8)
    throw new Error(`tag NBT desconhecida: ${t}`)
  }
}

function tagTexto(nome: string, valor: string): Buffer {
  const n = Buffer.from(nome, 'utf8')
  const v = Buffer.from(valor, 'utf8')
  const b = Buffer.alloc(1 + 2 + n.length + 2 + v.length)
  let p = b.writeUInt8(8, 0)
  p = b.writeUInt16BE(n.length, p)
  p += n.copy(b, p)
  p = b.writeUInt16BE(v.length, p)
  v.copy(b, p)
  return b
}

// Uma entrada da lista: pedaço cru do compound (sem o 0 final) e o ip, para achar repetidos.
interface Entrada {
  cru: Buffer
  ip: string | null
}

function lerEntradas(dat: Buffer): Entrada[] {
  const r = new Leitor(dat)
  if (r.u8() !== 10) throw new Error('servers.dat sem compound na raiz')
  r.texto()
  for (let t = r.u8(); t !== 0; t = r.u8()) {
    const nome = r.texto()
    if (nome !== 'servers' || t !== 9) {
      r.conteudo(t)
      continue
    }
    const filho = r.u8()
    const n = r.i32()
    if (n > 0 && filho !== 10) throw new Error('lista "servers" com tipo estranho')
    const entradas: Entrada[] = []
    for (let i = 0; i < n; i++) {
      const inicio = r.pos
      let ip: string | null = null
      for (let f = r.u8(); f !== 0; f = r.u8()) {
        const campo = r.texto()
        if (campo === 'ip' && f === 8) ip = r.texto()
        else r.conteudo(f)
      }
      entradas.push({ cru: dat.subarray(inicio, r.pos - 1), ip })
    }
    return entradas
  }
  return []
}

// Põe o servidor em primeiro na lista de Multijogador. Um servidor com o mesmo endereço sai de
// onde estava (sem duplicar); os outros ficam como estavam, na mesma ordem.
// servers.dat estragado ou ausente: começa uma lista nova.
export function servidorNoTopo(dat: Buffer | null, nome: string, ip: string): Buffer {
  let entradas: Entrada[] = []
  if (dat?.length) {
    try {
      entradas = lerEntradas(dat)
    } catch {
      entradas = []
    }
  }
  const nova = Buffer.concat([tagTexto('name', nome), tagTexto('ip', ip)])
  const lista = [
    nova,
    ...entradas.filter((e) => e.ip?.toLowerCase() !== ip.toLowerCase()).map((e) => e.cru)
  ]
  const cabecalhoLista = Buffer.alloc(1 + 2 + 7 + 1 + 4)
  let p = cabecalhoLista.writeUInt8(9, 0)
  p = cabecalhoLista.writeUInt16BE(7, p)
  p += cabecalhoLista.write('servers', p, 'utf8')
  p = cabecalhoLista.writeUInt8(10, p)
  cabecalhoLista.writeInt32BE(lista.length, p)
  const fim = Buffer.from([0])
  return Buffer.concat([
    Buffer.from([10, 0, 0]), // compound raiz sem nome
    cabecalhoLista,
    ...lista.flatMap((e) => [e, fim]),
    fim
  ])
}

// Para a tela e os testes: nomes e ips da lista, na ordem.
export function lerServidoresDat(dat: Buffer): string[] {
  return lerEntradas(dat).map((e) => e.ip ?? '')
}

// Nome de pasta a partir do nome da instalação (Windows não aceita alguns caracteres).
export function pastaDoNome(nome: string): string {
  const limpo = nome
    // eslint-disable-next-line no-control-regex -- tira caracteres de controle
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 48)
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(limpo) || !limpo ? 'Instalação' : limpo
}

// ---------- Qual launcher abrir (Fase M1) ----------

export type Launcher = { tipo: 'store'; app: string } | { tipo: 'classico'; exe: string }

// Só o app "Minecraft Launcher" da Store/Xbox (pacote Microsoft.4297127D64EC6, app Minecraft).
// O Microsoft.MinecraftJavaEdition é um marcador do Xbox que abre a Microsoft Store: nunca entra,
// nem links ms-windows-store: (a lista é de permitidos, não de proibidos).
const APP_LAUNCHER = /^Microsoft\.4297127D64EC6_[a-z0-9]+!Minecraft$/i
const EXE_CLASSICO = /^[a-z]:\\(?:[^\\/:*?"<>|]+\\)+MinecraftLauncher\.exe$/i

export function launcherSeguro(l: Launcher): boolean {
  return l.tipo === 'store' ? APP_LAUNCHER.test(l.app) : EXE_CLASSICO.test(l.exe)
}

// apps: AUMIDs achados no Windows; exes: caminhos de MinecraftLauncher.exe que existem.
// Prefere o da Store (é o que a Microsoft distribui hoje); sem ele, o clássico.
export function escolherLauncher(apps: string[], exes: string[]): Launcher | null {
  const app = apps.find((a) => APP_LAUNCHER.test(a))
  if (app) return { tipo: 'store', app }
  const exe = exes.find((e) => EXE_CLASSICO.test(e))
  return exe ? { tipo: 'classico', exe } : null
}
