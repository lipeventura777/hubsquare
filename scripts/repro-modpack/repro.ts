// Reprodução da instalação de modpack pelo terminal, com o MESMO código do app.
// Uso: npm run repro:modpack -- <modo> [arquivo]
//   servidor          importar o .mrpack e criar o servidor (ServSquare)
//   jogador           instalar o .mrpack numa instalação nova (PlaySquare)
//   cancelar          criar o servidor e cancelar no meio dos downloads e, de novo, no meio da cópia
//   cancelar-jogador  instalar no PlaySquare e cancelar no meio da cópia
//   queda             criar o servidor com a internet "caindo" (simulado): conexões que caem no
//                     meio e 20 s sem internet; depois "Tentar de novo só os que falharam"
// Tudo acontece em .teste/repro/<modo> (servidores, instalações, pasta de dados e temporários).
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const modo = process.argv[2] ?? 'servidor'
const raiz = resolve(import.meta.dirname, '..', '..')
const arquivo = resolve(process.argv[3] ?? join(raiz, '.teste', 'COBBLEVERSE 1.0.0.mrpack'))
const base = join(raiz, '.teste', 'repro', process.versions.electron ? `electron-${modo}` : modo)

if (!existsSync(arquivo)) throw new Error(`Não achei ${arquivo}`)
rmSync(base, { recursive: true, force: true })
for (const p of ['tmp', 'dados', 'Documentos', 'Downloads'])
  mkdirSync(join(base, p), { recursive: true })
process.env.REPRO_BASE = base
process.env.REPRO_ARQUIVO = arquivo
process.env.TEMP = process.env.TMP = join(base, 'tmp') // os.tmpdir() do app cai aqui

// Dentro do Electron de verdade (npm run repro:modpack:electron): as pastas do app vão para a
// pasta de testes e a escolha de arquivo responde sozinha.
const electron = process.versions.electron
  ? ((globalThis as Record<string, unknown>).__electronReal as typeof import('electron'))
  : null
if (electron) {
  const pastas = {
    userData: 'dados',
    documents: 'Documentos',
    downloads: 'Downloads',
    temp: 'tmp',
    logs: 'logs'
  }
  for (const [nome, pasta] of Object.entries(pastas))
    electron.app.setPath(nome as 'userData', join(base, pasta))
  electron.dialog.showOpenDialog = (async () => ({
    canceled: false,
    filePaths: [arquivo]
  })) as never
}

const { log, progresso, resumo, arquivoLog } = await import('./medidor.ts')

// ---------- Internet simulada (só para cdn.modrinth.com, os downloads do pack) ----------

const fetchReal = globalThis.fetch
let regra: (url: string) => 'antes' | 'meio' | null = () => null
const pedidosCdn: string[] = []
globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = String(entrada instanceof Request ? entrada.url : entrada)
  if (!url.startsWith('https://cdn.modrinth.com/')) return fetchReal(entrada, init)
  pedidosCdn.push(url)
  const r0 = regra(url)
  if (r0 === 'antes') throw new TypeError('fetch failed (simulado: sem internet)')
  const r = await fetchReal(entrada, init)
  if (r0 !== 'meio' || !r.body) return r
  // A conexão cai depois de 32 KB.
  const leitor = r.body.getReader()
  let enviados = 0
  const corpo = new ReadableStream<Uint8Array>({
    async pull(c) {
      if (enviados > 32 * 1024) {
        void leitor.cancel()
        return c.error(new TypeError('a conexão caiu (simulado)'))
      }
      const { done, value } = await leitor.read()
      if (done) return c.close()
      enviados += value.length
      c.enqueue(value)
    },
    cancel: () => void leitor.cancel()
  })
  return new Response(corpo, { status: r.status, headers: r.headers })
}) as typeof fetch

// ---------- Conferências ----------

function contar(pasta: string): number {
  if (!pasta || !existsSync(pasta)) return 0
  let n = 0
  for (const e of readdirSync(pasta, { recursive: true, withFileTypes: true })) if (e.isFile()) n++
  return n
}

const servidores = join(base, 'Documentos', 'ServSquare', 'servidores')
const jogo = join(base, 'Documentos', 'ServSquare', 'jogo')
const cache = join(base, 'dados', 'cache-modpacks')
const lista = (p: string): string[] => (existsSync(p) ? readdirSync(p) : [])

// O que sobrou fora do lugar: pastas provisórias, temporárias e servidores/instalações registrados.
function conferirSobras(esperado: {
  servidores: number
  instalacoes: number
  tmp: boolean
}): boolean {
  const provisorias = [...lista(servidores), ...lista(jogo)].filter((n) => n.startsWith('.'))
  const tmp = lista(join(base, 'tmp'))
  const json = (n: string, campo: string): number =>
    existsSync(join(base, 'dados', n))
      ? JSON.parse(readFileSync(join(base, 'dados', n), 'utf8'))[campo].length
      : 0
  const reg = json('servidores.json', 'servidores')
  const inst = json('instalacoes.json', 'instalacoes')
  const pastasServ = lista(servidores).filter((n) => !n.startsWith('.')).length
  const pastasJogo = lista(jogo).filter((n) => !n.startsWith('.')).length
  // Cache: só arquivos inteiros, cada um com o nome igual ao próprio hash.
  const quebrados = lista(cache).filter((n) => {
    const algo = n.length === 128 ? 'sha512' : 'sha1'
    return (
      createHash(algo)
        .update(readFileSync(join(cache, n)))
        .digest('hex') !== n
    )
  })
  const ok =
    !provisorias.length &&
    (esperado.tmp || !tmp.length) &&
    reg === esperado.servidores &&
    pastasServ === esperado.servidores &&
    inst === esperado.instalacoes &&
    pastasJogo === esperado.instalacoes &&
    !quebrados.length
  log(
    `conferência: provisórias ${provisorias.length ? provisorias.join(', ') : 'nenhuma'}; temporários ${tmp.length ? tmp.join(', ') : 'nenhum'}; servidores ${reg} registrados / ${pastasServ} pastas; instalações ${inst} / ${pastasJogo} pastas; cache ${lista(cache).length} arquivos inteiros, ${quebrados.length} pela metade → ${ok ? 'OK, nada pela metade' : 'PROBLEMA'}`
  )
  return ok
}

process.on('unhandledRejection', (e) => log(`PROMESSA REJEITADA SEM TRATAMENTO: ${String(e)}`))
process.on('uncaughtException', (e) => log(`EXCEÇÃO SEM TRATAMENTO: ${e.stack}`))

type Aviso = Parameters<typeof progresso>[0]

// Cancela quando a etapa chegar onde o teste quer (simula o clique em Cancelar).
// `ponto`: frase da etapa com "(\d+) de"; cancela quando o número chega em `minimo` (o progresso
// chega no máximo a cada 250 ms, então o número exato pode não aparecer).
function cancelarEm(
  modpacks: { cancelarModpack: () => void },
  ponto: RegExp,
  minimo: number
): (p: Aviso) => void {
  let feito = false
  return (p) => {
    progresso(p)
    const m = p.etapa.match(ponto)
    if (!feito && m && Number(m[1]) >= minimo) {
      feito = true
      log(`>>> clicando em Cancelar em "${p.etapa}"`)
      modpacks.cancelarModpack()
    }
  }
}

const falhasDe = (e: unknown): string[] => (e as { falhas?: string[] }).falhas ?? []
const canceladoDe = (e: unknown): boolean => !!(e as { cancelado?: boolean }).cancelado
const erroDe = (e: unknown): string =>
  `${(e as Error).message}${falhasDe(e).length ? ` (falharam: ${falhasDe(e).length})` : ''}`

log(`modo ${modo}, arquivo ${arquivo} (${(statSync(arquivo).size / 1048576).toFixed(0)} MB)`)
log(`log em ${arquivoLog}`)
let destino = ''
let passou = true
try {
  const modpacks = await import('../../src/main/modpacks.ts')
  // Como o app ao abrir: lê (e cria) o índice de servidores antes de qualquer criação.
  await (await import('../../src/main/servidores.ts')).lerIndice()
  const pedido = (token: string): unknown => ({
    token,
    nome: 'Cobbleverse teste',
    aceitouEula: true
  })
  const analisar = async (): Promise<string> => {
    log('analisando o pack (Importar de arquivo)')
    const a = await modpacks.analisarDeArquivo(null)
    if (!a) throw new Error('análise vazia')
    log(`análise: ${a.nome}, ${a.mods} mods, ${a.arquivos} downloads`)
    return a.token
  }

  if (modo === 'servidor') {
    destino = (await modpacks.criarDeModpack(pedido(await analisar()), progresso)).pasta
    passou = conferirSobras({ servidores: 1, instalacoes: 0, tmp: false })
  } else if (modo === 'jogador') {
    const { instalarPackNoJogo } = await import('../../src/main/instalacoes.ts')
    const id = await instalarPackNoJogo(
      arquivo,
      { projetoId: 'arquivo-local', versaoId: 'local' },
      progresso
    )
    destino = join(
      jogo,
      lista(jogo).find((n) => !n.startsWith('.'))!
    )
    log(`instalação ${id} pronta`)
    passou = conferirSobras({ servidores: 0, instalacoes: 1, tmp: false })
  } else if (modo === 'cancelar') {
    const token = await analisar()
    const pontos: [RegExp, number][] = [
      [/^Baixando ([0-9]+) de/, 40],
      [/^Copiando as configurações do modpack: ([0-9]+) de/, 3000]
    ]
    for (const [ponto, minimo] of pontos) {
      try {
        await modpacks.criarDeModpack(pedido(token), cancelarEm(modpacks, ponto, minimo))
        log('ERRO: a criação terminou sem cancelar')
        passou = false
      } catch (e) {
        log(`resultado: ${erroDe(e)} (cancelado: ${canceladoDe(e)})`)
        passou = canceladoDe(e) && passou
      }
      passou = conferirSobras({ servidores: 0, instalacoes: 0, tmp: false }) && passou
    }
    await modpacks.descartarAnalise(token)
  } else if (modo === 'cancelar-jogador') {
    const { instalarPackNoJogo } = await import('../../src/main/instalacoes.ts')
    try {
      await modpacks.comCancelar((sinal) =>
        instalarPackNoJogo(
          arquivo,
          { projetoId: 'arquivo-local', versaoId: 'local' },
          cancelarEm(modpacks, /^Copiando as configurações: ([0-9]+) de/, 3000),
          sinal
        )
      )
      log('ERRO: a instalação terminou sem cancelar')
      passou = false
    } catch (e) {
      log(`resultado: ${erroDe(e)} (cancelado: ${canceladoDe(e)})`)
      passou = canceladoDe(e)
    }
    passou = conferirSobras({ servidores: 0, instalacoes: 0, tmp: false }) && passou
  } else if (modo === 'queda') {
    const token = await analisar()
    // 1) Cada arquivo perde a conexão no meio na primeira vez (a nova tentativa resolve).
    // 2) Aos 4 s de downloads, a internet some por 20 s (mais que as 3 tentativas aguentam).
    const caiuUmaVez = new Set<string>()
    let inicioDownloads = 0
    regra = (url) => {
      if (!inicioDownloads) inicioDownloads = Date.now()
      const t = Date.now() - inicioDownloads
      if (t > 4000 && t < 24_000) return 'antes'
      if (!caiuUmaVez.has(url)) {
        caiuUmaVez.add(url)
        return 'meio'
      }
      return null
    }
    let falhas: string[] = []
    try {
      await modpacks.criarDeModpack(pedido(token), progresso)
      log('ERRO: a criação terminou sem falhas (a queda não pegou nenhum download)')
      passou = false
    } catch (e) {
      falhas = falhasDe(e)
      log(`resultado: ${erroDe(e)}`)
      if (!falhas.length) throw e
    }
    log(`1ª tentativa: ${pedidosCdn.length} pedidos ao CDN; ${falhas.length} arquivos falharam`)
    // tmp: true — o pack extraído fica guardado para tentar de novo sem extrair outra vez.
    passou = conferirSobras({ servidores: 0, instalacoes: 0, tmp: true }) && passou
    // 3) A internet volta: "Tentar de novo só os que falharam".
    regra = () => null
    const antes = pedidosCdn.length
    destino = (await modpacks.criarDeModpack(pedido(token), progresso)).pasta
    const novos = pedidosCdn.length - antes
    log(`"Tentar de novo só os que falharam": ${novos} downloads (falharam ${falhas.length})`)
    passou =
      novos === falhas.length &&
      conferirSobras({ servidores: 1, instalacoes: 0, tmp: false }) &&
      passou
  } else {
    throw new Error(`modo desconhecido: ${modo}`)
  }
  if (destino) log(`pronto em ${destino}`)
} catch (e) {
  log(
    `FALHOU: ${erroDe(e)}\n${(e as { detalhes?: string }).detalhes?.slice(0, 2000) ?? (e as Error).stack}`
  )
  passou = false
}
console.log('\n' + resumo(contar(destino)))
log(passou ? 'RESULTADO: PASSOU' : 'RESULTADO: NÃO PASSOU')
process.exitCode = passou ? 0 : 1
if (electron) electron.app.exit(process.exitCode)
else setTimeout(() => process.exit(process.exitCode), 200).unref()
