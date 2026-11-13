import { app } from 'electron'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { TIPOS_BACKUP, type Backup, type InfoServidor, type TipoBackup } from '../shared/tipos'
import { validarAutomacao } from '../shared/automacao'
import { antigosParaApagar } from './backupRegras'
import { gravarComSeguranca } from './config'
import { ErroApp, detalhar } from './erros'
import { dentroDe, guardarMundoAtual, nivelDoMundo, pastasDoMundo } from './mundo'
import { avisarTela, comServidorDesligado, eventos, registrarNoConsole } from './servidor'

// Backups do mundo em .zip, feitos com o tar que vem no Windows (sem biblioteca extra).
// Só apaga arquivos dentro de Documentos/ServSquare/backups.

const TAR = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')

function raizBackups(): string {
  return join(app.getPath('documents'), 'ServSquare', 'backups')
}

// Usa o nome da pasta do servidor (não muda ao renomear), que é o nome dado na criação.
// Instalações do PlaySquare ficam em backups/jogo/<pasta>, para não misturar com um servidor de
// mesmo nome.
export function pastaBackups(info: InfoServidor): string {
  return info.jogador
    ? join(raizBackups(), 'jogo', basename(info.pasta))
    : join(raizBackups(), basename(info.pasta))
}

export function tar(argumentos: string[], cwd?: string): Promise<void> {
  return new Promise((resolver, falhar) => {
    const filho = spawn(TAR, argumentos, { cwd, windowsHide: true })
    let saida = ''
    filho.stderr.on('data', (d) => (saida += d))
    filho.on('error', falhar)
    filho.on('close', (codigo) =>
      codigo === 0 ? resolver() : falhar(new Error(`tar saiu com código ${codigo}\n${saida}`))
    )
  })
}

// Nome com data e hora locais, que também deixa a lista em ordem: 2026-11-09_16-46-05.zip
function nomeDoArquivo(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.zip`
}

const EH_BACKUP = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(-\d+)?\.zip$/

// Tipo e proteção de cada backup (Fase 23.2), na pasta de backups do servidor.
const META = 'servsquare-backups.json'
type Meta = Record<string, { tipo?: TipoBackup; protegido?: boolean }>

async function lerMeta(info: InfoServidor): Promise<Meta> {
  try {
    const d = JSON.parse(await readFile(join(pastaBackups(info), META), 'utf8'))
    return d && typeof d === 'object' ? d : {}
  } catch {
    return {}
  }
}

let filaMeta: Promise<unknown> = Promise.resolve()

function mudarMeta(info: InfoServidor, mudar: (m: Meta) => void): Promise<void> {
  const r = filaMeta.then(async () => {
    const m = await lerMeta(info)
    mudar(m)
    await mkdir(pastaBackups(info), { recursive: true })
    await gravarComSeguranca(join(pastaBackups(info), META), JSON.stringify(m, null, 2))
  })
  filaMeta = r.catch(() => {})
  return r
}

export async function listarBackups(info: InfoServidor): Promise<Backup[]> {
  const pasta = pastaBackups(info)
  let nomes: string[]
  try {
    nomes = (await readdir(pasta)).filter((n) => EH_BACKUP.test(n))
  } catch {
    return []
  }
  const meta = await lerMeta(info)
  const lista = await Promise.all(
    nomes.map(async (arquivo) => {
      const s = await stat(join(pasta, arquivo))
      const m = meta[arquivo] ?? {}
      return {
        arquivo,
        data: s.mtime.toISOString(),
        tamanho: s.size,
        tipo: m.tipo && TIPOS_BACKUP.includes(m.tipo) ? m.tipo : null,
        protegido: m.protegido === true
      }
    })
  )
  return lista.sort((a, b) => b.arquivo.localeCompare(a.arquivo))
}

// Apaga um backup que está mesmo dentro da pasta de backups deste servidor.
async function apagarArquivo(info: InfoServidor, arquivo: string): Promise<void> {
  const caminho = join(pastaBackups(info), arquivo)
  if (EH_BACKUP.test(arquivo) && dentroDe(pastaBackups(info), caminho)) {
    await rm(caminho, { force: true })
  }
}

// Mantém os N mais recentes (tela Automação, padrão 10), contando todos; os protegidos
// nunca saem, mesmo passando de N.
async function apagarAntigos(info: InfoServidor): Promise<void> {
  const manter = validarAutomacao(info.automacao).backup.manter
  const velhos = antigosParaApagar(await listarBackups(info), manter)
  for (const velho of velhos) await apagarArquivo(info, velho.arquivo)
  if (velhos.length) await mudarMeta(info, (m) => velhos.forEach((v) => delete m[v.arquivo]))
}

// Tela Cópias de segurança: apaga os escolhidos. A tela confirma antes; apagar todos exige o
// nome do servidor. Protegidos não saem.
export async function apagarBackups(
  info: InfoServidor,
  arquivos: unknown,
  nomeDigitado: unknown
): Promise<void> {
  const lista = await listarBackups(info)
  const pedidos = Array.isArray(arquivos) ? [...new Set(arquivos)] : []
  const escolhidos = lista.filter((b) => pedidos.includes(b.arquivo))
  if (!escolhidos.length || escolhidos.length !== pedidos.length) {
    throw new ErroApp('Algum desses backups não existe mais. Atualize a lista e tente de novo.')
  }
  if (escolhidos.some((b) => b.protegido)) {
    throw new ErroApp('Backups protegidos não podem ser apagados. Tire o cadeado antes.')
  }
  if (escolhidos.length === lista.length && nomeDigitado !== info.nome) {
    throw new ErroApp(
      'Para apagar todos os backups, digite o nome do servidor exatamente como aparece.'
    )
  }
  for (const b of escolhidos) await apagarArquivo(info, b.arquivo)
  await mudarMeta(info, (m) => escolhidos.forEach((b) => delete m[b.arquivo]))
  avisarTela('backups:mudou', null)
}

export async function protegerBackup(
  info: InfoServidor,
  arquivo: unknown,
  protegido: unknown
): Promise<void> {
  if (
    typeof arquivo !== 'string' ||
    !(await listarBackups(info)).some((b) => b.arquivo === arquivo)
  ) {
    throw new ErroApp('Esse backup não existe mais. Atualize a lista.')
  }
  await mudarMeta(info, (m) => {
    m[arquivo] = { ...m[arquivo], protegido: protegido === true }
  })
  avisarTela('backups:mudou', null)
}

// Compacta o mundo atual (ou o mundo "nivel"). Precisa ser chamado com o servidor desligado e
// a trava pega, ou com o salvamento pausado (backup agendado, ver automacao.ts). Também usado
// antes de apagar um servidor, trocar a versão e mexer em mundos.
export async function compactarMundo(
  info: InfoServidor,
  nivelEscolhido: string | undefined,
  tipo: TipoBackup,
  extras: string[] = [] // Fase M7: outros mundos e arquivos que vão ser trocados
): Promise<string | null> {
  const nivel = nivelEscolhido ?? (await nivelDoMundo(info.pasta))
  const pastas = [...new Set([...pastasDoMundo(nivel), ...extras])].filter((p) =>
    existsSync(join(info.pasta, p))
  )
  if (!pastas.length) return null // servidor ainda nunca ligou: não há mundo

  const pasta = pastaBackups(info)
  await mkdir(pasta, { recursive: true })
  let nome = nomeDoArquivo()
  for (let i = 2; existsSync(join(pasta, nome)); i++)
    nome = nome.replace(/(-\d+)?\.zip$/, `-${i}.zip`)
  // O tar decide o formato pela extensão, então o temporário também termina em .zip.
  const temporario = join(pasta, `criando-${nome}`)
  try {
    // O session.lock fica travado com o servidor ligado (backup agendado) e o jogo recria ele.
    await tar([
      '-a',
      '-c',
      '-f',
      temporario,
      '--exclude',
      'session.lock',
      '-C',
      info.pasta,
      ...pastas
    ])
    await rename(temporario, join(pasta, nome))
  } catch (e) {
    await rm(temporario, { force: true })
    throw e
  }
  // Sem o tipo anotado, o backup ainda vale.
  await mudarMeta(info, (m) => {
    m[nome] = { tipo }
  }).catch(() => {})
  await apagarAntigos(info)
  await rm(join(pasta, FALHOU), { force: true })
  avisarTela('backups:mudou', null)
  return nome
}

// Marca na pasta de backups que o último backup automático falhou (some no próximo que der certo).
const FALHOU = 'ultimo-backup-falhou.txt'

// Motivo do selo ⚠ em Cópias de segurança (DESIGN.md, 6.1), ou null se está tudo bem.
export async function alertaBackups(info: InfoServidor): Promise<string | null> {
  if (existsSync(join(pastaBackups(info), FALHOU))) return 'O último backup falhou'
  if (!(await listarBackups(info)).length) return 'Ainda não há nenhuma cópia de segurança'
  return null
}

// Backup automático sempre que o servidor desliga normalmente (não quando ele cai sozinho).
eventos.on('desligou', ({ normal, info }) => {
  if (!normal) return
  registrarNoConsole('[ServSquare] Fazendo backup do mundo...')
  comServidorDesligado(() => compactarMundo(info, undefined, 'desligar'))
    .then((nome) =>
      registrarNoConsole(
        nome ? `[ServSquare] Backup salvo: ${nome}` : '[ServSquare] Sem mundo para guardar ainda.'
      )
    )
    .catch((e) => marcarFalha(info, e))
})

// Mostra o selo ⚠ em Cópias de segurança até o próximo backup que der certo.
export async function marcarFalha(info: InfoServidor, e: unknown): Promise<void> {
  const motivo = e instanceof Error ? e.message : String(e)
  registrarNoConsole(`[ServSquare] O backup falhou: ${motivo}`)
  await mkdir(pastaBackups(info), { recursive: true })
    .then(() =>
      writeFile(join(pastaBackups(info), FALHOU), `${new Date().toISOString()}\n${motivo}\n`)
    )
    .catch(() => {})
  avisarTela('backups:mudou', null)
}

// Restaura um backup: primeiro abre o zip numa pasta temporária, depois guarda o mundo atual
// (como backup e em "mundos-antigos") e só então coloca o mundo do backup no lugar.
export async function restaurarBackup(info: InfoServidor, valor: unknown): Promise<void> {
  const arquivo = typeof valor === 'string' ? valor : ''
  if (!(await listarBackups(info)).some((b) => b.arquivo === arquivo)) {
    throw new ErroApp('Esse backup não existe mais. Atualize a lista e escolha outro.')
  }
  return comServidorDesligado(async () => {
    const nivel = await nivelDoMundo(info.pasta)
    // Fica dentro da pasta de backups, o único lugar onde o app pode apagar coisas.
    const temporario = join(pastaBackups(info), '.restaurando')
    try {
      await rm(temporario, { recursive: true, force: true }) // sobra de uma tentativa anterior
      await mkdir(temporario)
      await tar(['-x', '-f', join(pastaBackups(info), arquivo), '-C', temporario])
    } catch (e) {
      throw new ErroApp(
        'Não consegui abrir esse backup. O arquivo pode estar corrompido; tente outro backup.',
        detalhar(e)
      )
    }
    if (!existsSync(join(temporario, nivel, 'level.dat'))) {
      throw new ErroApp(
        `Esse backup não tem o mundo "${nivel}". Ele pode ser de antes de mudar o nome do mundo; escolha outro backup.`
      )
    }

    try {
      await compactarMundo(info, undefined, 'restaurar')
      await guardarMundoAtual(info.pasta, nivel)
      for (const nome of pastasDoMundo(nivel)) {
        if (existsSync(join(temporario, nome))) {
          await rename(join(temporario, nome), join(info.pasta, nome))
        }
      }
    } catch (e) {
      throw new ErroApp(
        'Não consegui trocar o mundo. Feche janelas do Explorer abertas na pasta do servidor e tente de novo. Nada foi apagado: o mundo atual está em "mundos-antigos".',
        detalhar(e)
      )
    }
    await rm(temporario, { recursive: true, force: true })
  })
}
