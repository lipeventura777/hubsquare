import { execFile } from 'child_process'
import { connect } from 'net'
import { promisify } from 'util'
import type { EstadoJogo, InfoServidor } from '../shared/tipos'
import { lerRespostaDeStatus, pedidoDeStatus, separarEndereco, type StatusLido } from './jogoRegras'
import { listarTravamentos } from './logs'

// Tela Jogar (Fase P4): o status de um servidor (o mesmo "ping" da lista de Multijogador) e a
// sessão do jogo. Quem abre o jogo é o launcher oficial; o app só observa se o Java da pasta da
// instalação está rodando, para mostrar "Jogando" e o tempo da sessão.

const rodar = promisify(execFile)

// ---------- Status do servidor ----------

export function pingar(endereco: string, ms = 4000): Promise<StatusLido | null> {
  const alvo = separarEndereco(endereco)
  if (!alvo) return Promise.resolve(null)
  // shortcut: sem registro SRV do DNS (endereços sem porta usam a 25565); resolver o SRV se
  // algum servidor de amigo precisar.
  return new Promise((resolver) => {
    let dados = Buffer.alloc(0)
    const s = connect(alvo.porta, alvo.host, () => s.write(pedidoDeStatus(alvo.host, alvo.porta)))
    const fim = (r: StatusLido | null): void => {
      s.destroy()
      resolver(r)
    }
    s.setTimeout(ms, () => fim(null))
    s.on('error', () => fim(null))
    s.on('data', (d: Buffer) => {
      dados = Buffer.concat([dados, d])
      if (dados.length > 1_000_000) return fim(null)
      try {
        const r = lerRespostaDeStatus(dados)
        if (r) fim(r)
      } catch {
        fim(null)
      }
    })
  })
}

// ---------- Sessão do jogo ----------

const estados = new Map<string, EstadoJogo>()
let avisar: (id: string, estado: EstadoJogo | null) => void = () => {}

export function aoMudarJogo(f: (id: string, estado: EstadoJogo | null) => void): void {
  avisar = f
}

export function estadosDoJogo(): Record<string, EstadoJogo> {
  return Object.fromEntries(estados)
}

function mudar(id: string, e: EstadoJogo | null): void {
  if (e) estados.set(id, e)
  else estados.delete(id)
  avisar(id, e)
}

// Linhas de comando dos Java abertos (o jogo roda em javaw.exe, com --gameDir da instalação).
async function javasAbertos(): Promise<string[]> {
  try {
    const { stdout } = await rodar(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='javaw.exe' OR Name='java.exe'\" | ForEach-Object { $_.CommandLine }"
      ],
      { windowsHide: true, timeout: 15000, maxBuffer: 8 * 1024 * 1024 }
    )
    return stdout.split(/\r?\n/).filter(Boolean)
  } catch {
    return []
  }
}

const vigiando = new Set<string>()
const ESPERA_MAXIMA = 15 * 60_000 // o jogador tem 15 min para clicar em JOGAR no launcher

// Depois de abrir o launcher: espera o jogo desta instalação abrir e fechar.
export function vigiarJogo(id: string, pasta: string): void {
  if (vigiando.has(id)) return
  vigiando.add(id)
  const marca = `--gamedir ${pasta}`.toLowerCase()
  const abriu = (linhas: string[]): boolean =>
    linhas.some((l) => {
      const x = l.toLowerCase().replace(/"/g, '')
      return x.includes(marca) || x.includes(marca.replace(/\\/g, '/'))
    })
  const inicioEspera = Date.now()
  mudar(id, { fase: 'abrindo', desde: new Date().toISOString() })
  let jogandoDesde: number | null = null

  const passo = async (): Promise<void> => {
    const aberto = abriu(await javasAbertos())
    if (jogandoDesde === null) {
      if (aberto) {
        jogandoDesde = Date.now()
        mudar(id, { fase: 'jogando', desde: new Date(jogandoDesde).toISOString() })
      } else if (Date.now() - inicioEspera > ESPERA_MAXIMA) {
        vigiando.delete(id)
        return mudar(id, null) // não abriu: volta para "Jogar"
      }
    } else if (!aberto) {
      vigiando.delete(id)
      const desde = jogandoDesde
      // Travou se apareceu um relatório de travamento depois que o jogo abriu.
      const relatorios = await listarTravamentos({ pasta } as InfoServidor).catch(() => [])
      const travou = relatorios.some((r) => Date.parse(r.data) >= desde - 5000)
      return mudar(id, {
        fase: 'fechou',
        duracaoMs: Date.now() - desde,
        travou,
        quando: new Date().toISOString()
      })
    }
    setTimeout(() => void passo(), 4000)
  }
  setTimeout(() => void passo(), 4000)
}

// A tela fechou o card de "sessão encerrada".
export function dispensarSessao(id: unknown): void {
  if (typeof id === 'string' && estados.get(id)?.fase === 'fechou') mudar(id, null)
}
