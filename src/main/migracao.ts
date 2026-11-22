import { app } from 'electron'
import { execFileSync } from 'child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import {
  ARQUIVO_MIGRACAO,
  NOME_ANTIGO,
  NOME_NOVO,
  executarMovimentos,
  nomeNovo,
  pastaEmUso,
  precisaMover,
  processoUsando,
  registrarMovidas,
  trocarCaminhosEmJson,
  validarRegistro,
  type EstadoRaiz,
  type Raiz,
  type RegistroMigracao
} from '../shared/migracaoRegras'
import { t } from '../shared/i18n'

// Fase E2: na primeira abertura depois da atualização, %APPDATA%\ServSquare vira
// %APPDATA%\HubSquare e Documentos\ServSquare vira Documentos\HubSquare (rename, nada copiado nem
// apagado). Roda no começo do processo principal, antes de qualquer leitura dos dados, e por isso
// é toda síncrona. Se não der (servidor ou jogo aberto, arquivo em uso, outro disco, sem
// permissão), a sessão usa as pastas antigas, avisa na tela e tenta de novo na próxima abertura.
// Regras em src/shared/migracaoRegras.ts.

let dados = ''
let documentos = ''
let falhou: string | null = null
let trocas: Raiz[] = []
const pastasFeitas = new Set<string>()

// Documentos\HubSquare (ou a antiga, enquanto a migração não terminou): servidores, backups e jogo.
export const raizDocumentos = (): string => documentos || join(app.getPath('documents'), NOME_NOVO)

// Texto do aviso na tela quando a migração não terminou nesta abertura (null: nada a avisar).
export const avisoDaMigracao = (): string | null =>
  falhou ? t('p.migracao.naoDeuParaMoverAsPastas', { antiga: NOME_ANTIGO, nova: NOME_NOVO }) : null

function registrarErro(texto: string): void {
  try {
    mkdirSync(join(dados, 'logs'), { recursive: true })
    appendFileSync(
      join(dados, 'logs', 'erros.log'),
      `[${new Date().toISOString()}] Migração para ${NOME_NOVO}: ${texto}\n`
    )
  } catch {
    // sem log: o aviso na tela ainda aparece
  }
}

function lerJson(arquivo: string): unknown {
  try {
    return JSON.parse(readFileSync(arquivo, 'utf8'))
  } catch {
    return null
  }
}

// Grava por cima com um temporário + rename: um arquivo pela metade nunca fica no lugar.
function gravarJson(arquivo: string, valor: unknown): void {
  const temporario = `${arquivo}.migrando`
  writeFileSync(temporario, JSON.stringify(valor, null, 2))
  renameSync(temporario, arquivo)
}

function reescreverJson(arquivo: string): void {
  if (!trocas.length) return
  const antes = lerJson(arquivo)
  if (antes === null) return
  const depois = trocarCaminhosEmJson(antes, trocas)
  if (JSON.stringify(depois) !== JSON.stringify(antes)) gravarJson(arquivo, depois)
}

const ehPasta = (p: string): boolean => {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

// Pasta de um servidor, de uma instalação ou de backups: servsquare*.json → hubsquare*.json (só se
// o nome novo ainda não existe) e os caminhos de dentro trocados. Também vale para pastas fora de
// Documentos, backups restaurados e .zip importados (por isso é chamada ao abrir cada pasta).
export function migrarPasta(pasta: string): void {
  if (pastasFeitas.has(pasta)) return
  pastasFeitas.add(pasta)
  try {
    if (!ehPasta(pasta)) return
    for (const nome of readdirSync(pasta)) {
      const novo = nomeNovo(nome)
      if (novo && !existsSync(join(pasta, novo))) renameSync(join(pasta, nome), join(pasta, novo))
    }
    for (const nome of readdirSync(pasta)) {
      if (/^hubsquare.*\.json$/i.test(nome)) reescreverJson(join(pasta, nome))
    }
  } catch (e) {
    pastasFeitas.delete(pasta)
    registrarErro(`${pasta}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// Linhas de comando dos Java abertos (servidor e jogo), como em jogo.ts, mas síncrono.
function javasAbertos(): string[] {
  try {
    return execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='javaw.exe' OR Name='java.exe'\" | ForEach-Object { $_.CommandLine }"
      ],
      { windowsHide: true, timeout: 15000, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
    )
      .split(/\r?\n/)
      .filter(Boolean)
  } catch {
    return [] // sem PowerShell: o rename falha sozinho se algo estiver em uso
  }
}

// Reescreve os caminhos guardados e renomeia os arquivos do app em cada pasta conhecida.
function reescreverTudo(): void {
  const indices: string[] = []
  for (const nome of readdirSync(dados)) {
    if (nome.endsWith('.json') && nome !== ARQUIVO_MIGRACAO) indices.push(join(dados, nome))
  }
  indices.push(join(dados, 'downloads-manuais', 'indice.json'))
  for (const arquivo of indices) {
    try {
      reescreverJson(arquivo)
    } catch (e) {
      registrarErro(`${arquivo}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const servidores = lerJson(join(dados, 'servidores.json')) as {
    servidores?: { pasta?: unknown }[]
  } | null
  const instalacoes = lerJson(join(dados, 'instalacoes.json')) as {
    instalacoes?: { pasta?: unknown }[]
  } | null
  for (const item of [...(servidores?.servidores ?? []), ...(instalacoes?.instalacoes ?? [])]) {
    if (typeof item.pasta === 'string') migrarPasta(item.pasta)
  }
  const backups = join(raizDocumentos(), 'backups')
  if (ehPasta(backups)) for (const nome of readdirSync(backups)) migrarPasta(join(backups, nome))
}

// Decide e faz a migração. Devolve a pasta de dados desta sessão (para o setPath('userData')).
export function migrarSePrecisar(): string {
  const raizes: Raiz[] = [
    {
      antiga: join(app.getPath('appData'), NOME_ANTIGO),
      nova: join(app.getPath('appData'), NOME_NOVO)
    },
    {
      antiga: join(app.getPath('documents'), NOME_ANTIGO),
      nova: join(app.getPath('documents'), NOME_NOVO)
    }
  ]
  const estado = (): EstadoRaiz[] =>
    raizes.map((r) => ({
      ...r,
      antigaExiste: existsSync(r.antiga),
      novaExiste: existsSync(r.nova)
    }))

  const pendentes = estado()
    .filter(precisaMover)
    .map(({ antiga, nova }) => ({ antiga, nova }))
  let movidas: Raiz[] = []
  if (pendentes.length) {
    const ocupado = processoUsando(
      javasAbertos(),
      pendentes.map((r) => r.antiga)
    )
    if (ocupado) {
      falhou = `servidor ou jogo aberto: ${ocupado}`
    } else {
      const r = executarMovimentos(pendentes, renameSync)
      movidas = r.movidas
      falhou = r.erro
    }
  }
  const [d, doc] = estado()
  dados = pastaEmUso(d)
  documentos = pastaEmUso(doc)
  if (falhou) registrarErro(falhou)

  const marcador = join(dados, ARQUIVO_MIGRACAO)
  let registro: RegistroMigracao | null = validarRegistro(lerJson(marcador))
  registro = registrarMovidas(registro, movidas, new Date().toISOString())
  trocas = registro?.movido ?? []
  if (registro && !registro.concluida) {
    try {
      mkdirSync(dados, { recursive: true })
      gravarJson(marcador, registro) // primeiro anota o que foi movido; depois reescreve
      reescreverTudo()
      registro = { ...registro, concluida: true }
      gravarJson(marcador, registro)
    } catch (e) {
      registrarErro(e instanceof Error ? e.message : String(e))
    }
  }
  return dados
}

// gameDir dos perfis hubsquare-<id> ainda por corrigir (corrigirPerfisMigrados, em
// launcherOficial.ts): as trocas de caminho, ou null quando não há nada pendente.
export function perfisParaCorrigir(): Raiz[] | null {
  const registro = validarRegistro(lerJson(join(dados, ARQUIVO_MIGRACAO)))
  return registro?.perfisPendentes ? registro.movido : null
}

export function perfisCorrigidos(): void {
  const marcador = join(dados, ARQUIVO_MIGRACAO)
  const registro = validarRegistro(lerJson(marcador))
  if (registro) gravarJson(marcador, { ...registro, perfisPendentes: false })
}

export function erroDaMigracao(texto: string): void {
  registrarErro(texto)
}
