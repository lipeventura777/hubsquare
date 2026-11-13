import { gunzipSync, gzipSync } from 'zlib'
import { mcDoNeoForge } from './tipos/versoesLoader'

// Partes puras da importação de .zip (testadas em tests/zipSeguro.test.ts).

// Um caminho de dentro do zip só é aceito se ficar dentro da pasta de destino:
// nada de caminho absoluto, letra de drive ou "..".
export function caminhoSeguro(entrada: string): boolean {
  const c = entrada.replace(/\\/g, '/')
  if (!c || c.startsWith('/') || /^[a-z]:/i.test(c)) return false
  return !c.split('/').some((parte) => parte === '..')
}

// Descobre se o zip é um servidor inteiro (tem server.properties) ou só um mundo (tem level.dat),
// em qualquer subpasta. Usa o arquivo mais "raso" e devolve a pasta onde ele está.
export function detectarConteudo(
  entradas: string[]
): { tipo: 'servidor' | 'mundo'; raiz: string; levelDat: string | null } | null {
  const arquivos = entradas.map((e) => e.replace(/\\/g, '/')).filter((e) => !e.endsWith('/'))
  const maisRaso = (nome: string): string | undefined =>
    arquivos
      .filter((e) => e === nome || e.endsWith(`/${nome}`))
      // Empate (mundo + Nether + End do Paper): o nome mais curto é o mundo principal.
      .sort((x, y) => x.split('/').length - y.split('/').length || x.length - y.length)[0]
  const pasta = (e: string): string => e.slice(0, e.lastIndexOf('/') + 1)
  const propriedades = maisRaso('server.properties')
  const levelDat = maisRaso('level.dat') ?? null
  if (propriedades) return { tipo: 'servidor', raiz: pasta(propriedades), levelDat }
  // Pack do CurseForge para o jogo: manifest.json na raiz e os mods quase todos só como números
  // dentro dele (overrides/mods traz poucos). Não é servidor: quem chama explica o que baixar.
  if (arquivos.includes('manifest.json')) return null
  // Server packs (ex.: do CurseForge) quase nunca trazem server.properties, mas trazem mods/.
  const mod = arquivos
    .filter((e) => /(^|\/)mods\/[^/]+\.jar$/i.test(e))
    .sort((x, y) => x.split('/').length - y.split('/').length)[0]
  if (mod) {
    return {
      tipo: 'servidor',
      raiz: mod.slice(0, mod.toLowerCase().lastIndexOf('mods/')),
      levelDat
    }
  }
  if (levelDat) return { tipo: 'mundo', raiz: pasta(levelDat), levelDat }
  return null
}

export interface LoaderDetectado {
  tipo: 'fabric' | 'forge' | 'neoforge' | 'quilt'
  versao: string | null // versão do Minecraft, quando dá para saber
  versaoLoader: string | null
}

// Descobre o loader de um server pack pelos arquivos que ele traz (instalador, libraries,
// lançador) e pelo variables.txt dos packs do CurseForge, que diz tudo explicitamente.
export function detectarLoader(
  entradas: string[],
  raiz: string,
  variaveis?: string
): LoaderDetectado | null {
  const nomes = entradas
    .map((e) => e.replace(/\\/g, '/'))
    .filter((e) => e.startsWith(raiz))
    .map((e) => e.slice(raiz.length))
  const achar = (re: RegExp): RegExpMatchArray | undefined =>
    nomes.map((n) => n.match(re)).find((m) => m) ?? undefined

  let achado: LoaderDetectado | null = null
  const neo =
    achar(/^libraries\/net\/neoforged\/neoforge\/([^/]+)\//) ??
    achar(/^neoforge-([\w.+-]+?)-installer\.jar$/)
  const forge =
    achar(/^libraries\/net\/minecraftforge\/forge\/(\d[\w.]*)-([^/]+)\//) ??
    achar(/^forge-(\d[\w.]*)-(\d[\w.]*)(?:-(?:installer|universal|shim))?\.jar$/)
  if (neo) achado = { tipo: 'neoforge', versao: mcDoNeoForge(neo[1]), versaoLoader: neo[1] }
  else if (forge) achado = { tipo: 'forge', versao: forge[1], versaoLoader: forge[2] }
  else if (achar(/^(quilt-server-launch\.jar|libraries\/org\/quiltmc\/)/)) {
    achado = { tipo: 'quilt', versao: null, versaoLoader: null }
  } else if (
    achar(
      /^(fabric-server-launch(er)?\.jar|fabric-server-launcher\.properties|\.fabric\/|libraries\/net\/fabricmc\/|fabric-installer-[^/]*\.jar)/
    )
  ) {
    achado = {
      tipo: 'fabric',
      versao: achar(/^libraries\/net\/fabricmc\/intermediary\/([^/]+)\//)?.[1] ?? null,
      versaoLoader: achar(/^libraries\/net\/fabricmc\/fabric-loader\/([^/]+)\//)?.[1] ?? null
    }
  }

  // variables.txt: MINECRAFT_VERSION=1.20.1, MODLOADER=Forge, MODLOADER_VERSION=47.2.0
  if (variaveis) {
    const valor = (chave: string): string | null =>
      variaveis.match(new RegExp(`^\\s*${chave}\\s*=\\s*"?([^"\\r\\n]+?)"?\\s*$`, 'mi'))?.[1] ??
      null
    const tipo = valor('MODLOADER')?.toLowerCase()
    if (tipo === 'fabric' || tipo === 'forge' || tipo === 'neoforge' || tipo === 'quilt') {
      achado = {
        tipo,
        versao: valor('MINECRAFT_VERSION') ?? achado?.versao ?? null,
        versaoLoader: valor('MODLOADER_VERSION') ?? achado?.versaoLoader ?? null
      }
    }
  }
  return achado
}

// ---------- Leitor mínimo de NBT (formato dos arquivos .dat do jogo) ----------

type Nbt = number | bigint | string | Nbt[] | { [chave: string]: Nbt } | Buffer | Int32Array

function lerValor(buf: Buffer, pos: { i: number }, tipo: number): Nbt {
  switch (tipo) {
    case 1:
      return buf.readInt8(pos.i++)
    case 2:
      return ((pos.i += 2), buf.readInt16BE(pos.i - 2))
    case 3:
      return ((pos.i += 4), buf.readInt32BE(pos.i - 4))
    case 4:
      return ((pos.i += 8), buf.readBigInt64BE(pos.i - 8))
    case 5:
      return ((pos.i += 4), buf.readFloatBE(pos.i - 4))
    case 6:
      return ((pos.i += 8), buf.readDoubleBE(pos.i - 8))
    case 7: {
      const n = buf.readInt32BE(pos.i)
      pos.i += 4 + n
      return buf.subarray(pos.i - n, pos.i)
    }
    case 8: {
      const n = buf.readUInt16BE(pos.i)
      pos.i += 2 + n
      return buf.toString('utf8', pos.i - n, pos.i)
    }
    case 9: {
      const tipoItem = buf.readInt8(pos.i)
      const n = buf.readInt32BE(pos.i + 1)
      pos.i += 5
      return Array.from({ length: n }, () => lerValor(buf, pos, tipoItem))
    }
    case 10: {
      const obj: { [chave: string]: Nbt } = {}
      for (;;) {
        const t = buf.readInt8(pos.i++)
        if (t === 0) return obj
        const nome = lerValor(buf, pos, 8) as string
        obj[nome] = lerValor(buf, pos, t)
      }
    }
    case 11: {
      const n = buf.readInt32BE(pos.i)
      pos.i += 4
      const lista = new Int32Array(n)
      for (let k = 0; k < n; k++) lista[k] = buf.readInt32BE(pos.i + 4 * k)
      pos.i += 4 * n
      return lista
    }
    case 12: {
      const n = buf.readInt32BE(pos.i)
      pos.i += 4 + 8 * n
      return []
    }
    default:
      throw new Error(`Tipo de NBT desconhecido: ${tipo}`)
  }
}

// Lê um arquivo NBT (compactado com gzip ou não) e devolve o compound raiz.
export function lerNbt(dados: Buffer): { [chave: string]: Nbt } {
  const buf = dados[0] === 0x1f && dados[1] === 0x8b ? gunzipSync(dados) : dados
  const pos = { i: 0 }
  const tipo = buf.readInt8(pos.i++)
  if (tipo !== 10) throw new Error('O arquivo não começa com um compound NBT.')
  lerValor(buf, pos, 8) // nome da raiz (geralmente vazio)
  return lerValor(buf, pos, 10) as { [chave: string]: Nbt }
}

// Zera campos da raiz sem reescrever o resto: números viram 0 (mesmo tamanho), listas ficam
// vazias (mesmo tipo de item) e compounds ficam vazios. Todo o resto é copiado byte a byte,
// então nenhum tipo se perde. Devolve compactado se a entrada era compactada.
export function limparNaRaiz(dados: Buffer, campos: string[]): Buffer {
  const gzip = dados[0] === 0x1f && dados[1] === 0x8b
  const buf = gzip ? gunzipSync(dados) : dados
  const pos = { i: 0 }
  if (buf.readInt8(pos.i++) !== 10) throw new Error('O arquivo não começa com um compound NBT.')
  lerValor(buf, pos, 8)
  const partes: Buffer[] = [buf.subarray(0, pos.i)]
  for (;;) {
    const inicio = pos.i
    const tipo = buf.readInt8(pos.i++)
    if (tipo === 0) {
      partes.push(buf.subarray(inicio))
      break
    }
    const nome = lerValor(buf, pos, 8) as string
    const valor = pos.i
    lerValor(buf, pos, tipo)
    if (!campos.includes(nome)) {
      partes.push(buf.subarray(inicio, pos.i))
      continue
    }
    partes.push(buf.subarray(inicio, valor))
    if (tipo >= 1 && tipo <= 6) partes.push(Buffer.alloc(pos.i - valor))
    else if (tipo === 9) partes.push(Buffer.from([buf[valor], 0, 0, 0, 0]))
    else if (tipo === 10) partes.push(Buffer.from([0]))
    else throw new Error(`Não sei zerar o campo ${nome} (tipo ${tipo}).`)
  }
  const saida = Buffer.concat(partes)
  return gzip ? gzipSync(saida) : saida
}

// Versão do jogo gravada no level.dat (Data › Version › Name), se existir.
export function versaoDoLevelDat(dados: Buffer): string | null {
  try {
    const raiz = lerNbt(dados) as { Data?: { Version?: { Name?: unknown } } }
    const nome = raiz.Data?.Version?.Name
    return typeof nome === 'string' ? nome : null
  } catch {
    return null
  }
}
