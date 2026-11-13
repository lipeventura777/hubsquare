import { app, shell } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import { randomBytes } from 'crypto'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { gravarComSeguranca } from './config'
import { ErroApp } from './erros'
import { baixar, buscarJson, type AoProgredir } from './rede'

// Só usa as partes oficiais do playit.gg (agente v1.x do GitHub playit-cloud/playit-agent):
// - "playit claim exchange <código>" troca a aprovação no site pela chave secreta;
// - "playitd --secret-path <arquivo>" mantém os túneis ligados.
// O túnel Minecraft Java é criado pelo usuário no site; o app só guarda o endereço.

const RELEASE = 'https://api.github.com/repos/playit-cloud/playit-agent/releases/latest'
const PROGRAMAS = {
  playit: 'playit-windows-x86_64-signed.exe',
  playitd: 'playitd-windows-x86_64-signed.exe'
}

function pasta(): string {
  return join(app.getPath('userData'), 'playit')
}
const caminho = (nome: keyof typeof PROGRAMAS): string => join(pasta(), `${nome}.exe`)
const arquivoChave = (): string => join(pasta(), 'chave-secreta')

export function vinculado(): boolean {
  return existsSync(arquivoChave())
}

// ---------- Baixar ----------

interface Release {
  assets: { name: string; browser_download_url: string; digest?: string }[]
}

async function baixarProgramas(aoProgredir: AoProgredir): Promise<void> {
  const faltam = (Object.keys(PROGRAMAS) as (keyof typeof PROGRAMAS)[]).filter(
    (nome) => !existsSync(caminho(nome))
  )
  if (!faltam.length) return
  await mkdir(pasta(), { recursive: true })
  const release = await buscarJson<Release>(RELEASE)
  for (const nome of faltam) {
    const arquivo = release.assets.find((a) => a.name === PROGRAMAS[nome])
    const sha256 = arquivo?.digest?.replace(/^sha256:/, '')
    if (!arquivo || !sha256) {
      throw new ErroApp(
        'Não encontrei o programa do playit.gg para Windows. Tente de novo mais tarde.',
        `${PROGRAMAS[nome]} não está na última versão de ${RELEASE}`
      )
    }
    await baixar(
      arquivo.browser_download_url,
      caminho(nome),
      { algoritmo: 'sha256', valor: sha256 },
      'Baixando o playit.gg',
      aoProgredir
    )
  }
}

// ---------- Vincular a conta (uma vez só) ----------

let vinculando = false

export function estaVinculando(): boolean {
  return vinculando
}

export async function vincular(aoProgredir: AoProgredir): Promise<void> {
  if (vinculando) throw new ErroApp('O vínculo com o playit.gg já está em andamento.')
  vinculando = true
  try {
    await baixarProgramas(aoProgredir)
    // Mesmo formato do "playit claim generate" oficial: 5 bytes aleatórios em hexadecimal.
    const codigo = randomBytes(5).toString('hex')
    await shell.openExternal(`https://playit.gg/claim/${codigo}`)
    const chave = await trocarCodigoPorChave(codigo)
    await gravarComSeguranca(arquivoChave(), chave)
  } finally {
    vinculando = false
  }
}

function trocarCodigoPorChave(codigo: string): Promise<string> {
  return new Promise((resolver, falhar) => {
    // Espera até 10 minutos o usuário aprovar no navegador.
    const filho = spawn(caminho('playit'), ['claim', 'exchange', codigo, '--wait', '600'], {
      windowsHide: true
    })
    // Fecha o stdin: se o playit pedir "Press Enter", ele não fica preso esperando.
    filho.stdin.end()
    let saida = ''
    filho.stdout.on('data', (d) => (saida += d))
    filho.stderr.on('data', (d) => (saida += d))
    filho.on('error', (e) =>
      falhar(new ErroApp('Não consegui abrir o programa do playit.gg.', String(e)))
    )
    filho.on('close', (codigoSaida) => {
      // A chave é a última linha que o comando escreve (println da chave no fim do claim_exchange).
      // shortcut: o formato da chave não é documentado; aceito qualquer palavra longa sem espaços.
      const chave = saida.trim().split(/\r?\n/).at(-1)?.trim() ?? ''
      if (codigoSaida === 0 && /^[A-Za-z0-9_-]{16,}$/.test(chave)) return resolver(chave)
      const mensagem = /not approved|rejected/i.test(saida)
        ? 'O vínculo não foi aprovado no site do playit.gg. Clique em "Vincular" e aprove no navegador.'
        : /timed out/i.test(saida)
          ? 'O tempo para aprovar no navegador acabou. Clique em "Vincular" de novo.'
          : 'Não consegui vincular o playit.gg. Tente de novo.'
      falhar(new ErroApp(mensagem, `Código de saída: ${codigoSaida}\n${saida}`))
    })
  })
}

// ---------- Agente ----------

let agente: ChildProcess | null = null
const ultimasLinhas: string[] = []

export function agenteLigado(): boolean {
  return agente !== null
}

export function ligarAgente(): void {
  if (agente || !vinculado() || !existsSync(caminho('playitd'))) return
  const filho = spawn(
    caminho('playitd'),
    [
      '--secret-path',
      arquivoChave(),
      '--socket-path',
      '\\\\.\\pipe\\servsquare-playit',
      '--log-path',
      join(pasta(), 'playitd.log')
    ],
    { windowsHide: true }
  )
  agente = filho
  const guardar = (d: Buffer): void => {
    ultimasLinhas.push(...d.toString().split(/\r?\n/).filter(Boolean))
    ultimasLinhas.splice(0, Math.max(0, ultimasLinhas.length - 30))
  }
  filho.stdout.on('data', guardar)
  filho.stderr.on('data', guardar)
  filho.on('error', (e) => guardar(Buffer.from(String(e))))
  filho.on('close', () => {
    if (agente === filho) agente = null
  })
}

export function desligarAgente(): void {
  agente?.kill()
  agente = null
}

export function detalhesAgente(): string {
  return ultimasLinhas.join('\n')
}
