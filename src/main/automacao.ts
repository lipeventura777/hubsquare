import { AUTOMACAO_PADRAO, proximoReinicio, validarAutomacao } from '../shared/automacao'
import type { EstadoAutomacao, InfoServidor } from '../shared/tipos'
import { registrarAcao } from './acoes'
import { compactarMundo, marcarFalha } from './backup'
import { detalhar } from './erros'
import { lerJogadores } from './jogadores'
import {
  atualizarInfo,
  desligar,
  enviarDoApp,
  eventos,
  lerEstado,
  reiniciar,
  servidorAtual
} from './servidor'

// Tela Automação (Fase 19): desligar quando vazio, reinício agendado e backup agendado.
// Tudo roda neste processo, então só funciona com o app aberto (a bandeja conta).

const INTERVALO = 15_000
const MIN = 60_000
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

let vazioDesde: number | null = null
let ultimoBackup: number | null = null
let alvoReinicio: number | null = null
let avisou5 = false
let avisou1: number | null = null
let ocupado = false
let backupRodando = false

function zerarReinicio(): void {
  alvoReinicio = null
  avisou5 = false
  avisou1 = null
}

eventos.on('estado', (estado) => {
  if (estado === 'ligado') {
    // Só conta com o servidor online: tudo começa agora.
    vazioDesde = Date.now()
    ultimoBackup = Date.now()
  } else if (estado === 'desligado') {
    vazioDesde = null
    ultimoBackup = null
    zerarReinicio()
  }
})

function config(info: InfoServidor): ReturnType<typeof validarAutomacao> {
  return validarAutomacao(info.automacao ?? AUTOMACAO_PADRAO)
}

// O app manda no chat de todos (comando "say", igual em todos os loaders).
function avisarNoChat(texto: string): void {
  try {
    enviarDoApp(`say [ServSquare] ${texto}`)
  } catch {
    // o servidor saiu do ar no meio: nada para avisar
  }
}

// Espera uma linha do console que combine com `ok` (ou falha com `erro`), até `ms`.
function esperarLinha(ok: RegExp, erro: RegExp | null, ms: number): Promise<void> {
  return new Promise((resolver, falhar) => {
    const ouvir = (texto: string): void => {
      if (ok.test(texto)) fim(() => resolver())
      else if (erro?.test(texto)) fim(() => falhar(new Error(texto)))
    }
    const limite = setTimeout(
      () => fim(() => falhar(new Error('O servidor não respondeu a tempo.'))),
      ms
    )
    const parou = (estado: string): void => {
      if (estado !== 'ligado')
        fim(() => falhar(new Error('O servidor desligou no meio do backup.')))
    }
    const fim = (acao: () => void): void => {
      clearTimeout(limite)
      eventos.off('linha', ouvir)
      eventos.off('estado', parou)
      acao()
    }
    eventos.on('linha', ouvir)
    eventos.on('estado', parou)
  })
}

// Backup com o servidor ligado: pausa a gravação do mundo, força salvar tudo, compacta e volta.
// Mensagens do arquivo de idioma do jogo (commands.save.*).
async function backupComServidorLigado(info: InfoServidor): Promise<void> {
  backupRodando = true
  try {
    const desligado = esperarLinha(
      /Automatic saving is now disabled|already turned off/i,
      null,
      20_000
    )
    enviarDoApp('save-off')
    await desligado
    const salvo = esperarLinha(/Saved the game/, /Unable to save the game/, 180_000)
    enviarDoApp('save-all flush')
    await salvo
    const nome = await compactarMundo(info, undefined, 'agendado')
    await registrarAcao(
      info,
      nome
        ? `Backup agendado feito com o servidor ligado: ${nome}.`
        : 'Backup agendado: ainda não há mundo.'
    )
  } catch (e) {
    await registrarAcao(info, `O backup agendado falhou: ${detalhar(e).split('\n')[0]}`)
    await marcarFalha(info, e)
  } finally {
    // Sempre volta a salvar, mesmo se algo falhou no meio.
    if (lerEstado() === 'ligado') {
      try {
        enviarDoApp('save-on')
      } catch {
        // desligou: ao ligar de novo o salvamento já volta sozinho
      }
    }
    backupRodando = false
  }
}

async function verificar(): Promise<void> {
  if (ocupado || lerEstado() !== 'ligado') return
  const info = await servidorAtual()
  if (!info) return
  const a = config(info)
  const agora = Date.now()
  const jogadores = lerJogadores().length

  // Desligar quando vazio: a contagem recomeça sempre que alguém entra.
  if (jogadores > 0) vazioDesde = null
  else vazioDesde ??= agora
  if (
    a.vazio.ligado &&
    jogadores === 0 &&
    vazioDesde &&
    agora - vazioDesde >= a.vazio.minutos * MIN
  ) {
    ocupado = true
    try {
      await registrarAcao(info, `Desligado por ficar ${a.vazio.minutos} min vazio.`)
      await desligar() // jeito normal: o backup de quando desliga acontece
    } finally {
      ocupado = false
    }
    return
  }

  // Reinício agendado, com aviso no chat 5 min e 1 min antes.
  if (a.reinicio.ligado && a.reinicio.dias.length) {
    alvoReinicio ??=
      proximoReinicio(a.reinicio.dias, a.reinicio.hora, new Date(agora))?.getTime() ?? null
    if (alvoReinicio) {
      const falta = alvoReinicio - agora
      if (falta <= 5 * MIN && falta > MIN && !avisou5) {
        avisou5 = true
        avisarNoChat('O servidor vai reiniciar em 5 minutos.')
      }
      if (falta <= MIN && avisou1 === null) {
        avisou1 = agora
        avisarNoChat('O servidor vai reiniciar em 1 minuto. Volte em seguida!')
      }
      // Com gente online, só reinicia depois de dar ao menos 1 minuto de aviso.
      const avisado = jogadores === 0 || (avisou1 !== null && agora - avisou1 >= MIN - 5000)
      if (falta <= 0 && avisado && !backupRodando) {
        const quando = new Date(alvoReinicio)
        zerarReinicio()
        ocupado = true
        try {
          await registrarAcao(
            info,
            `Reiniciado pelo horário agendado (${DIAS[quando.getDay()]}, ${a.reinicio.hora}).`
          )
          await reiniciar()
        } catch (e) {
          await registrarAcao(info, `O reinício agendado falhou: ${detalhar(e).split('\n')[0]}`)
        } finally {
          ocupado = false
        }
        return
      }
    }
  } else zerarReinicio()

  // Backup agendado, a cada X horas com o servidor ligado.
  if (a.backup.ligado && ultimoBackup && agora - ultimoBackup >= a.backup.horas * 60 * MIN) {
    ocupado = true
    try {
      await backupComServidorLigado(info)
    } finally {
      ultimoBackup = Date.now()
      ocupado = false
    }
  }
}

setInterval(() => {
  verificar().catch(() => {})
}, INTERVALO)

export async function lerAutomacao(info: InfoServidor): Promise<EstadoAutomacao> {
  const a = config(info)
  const ligado = lerEstado() === 'ligado'
  const proximo =
    alvoReinicio ?? proximoReinicio(a.reinicio.dias, a.reinicio.hora, new Date())?.getTime() ?? null
  return {
    config: a,
    vazioDesligaEm:
      ligado && a.vazio.ligado && vazioDesde && lerJogadores().length === 0
        ? vazioDesde + a.vazio.minutos * MIN
        : null,
    proximoReinicio: a.reinicio.ligado ? proximo : null,
    proximoBackup:
      ligado && a.backup.ligado && ultimoBackup ? ultimoBackup + a.backup.horas * 60 * MIN : null,
    backupRodando
  }
}

export async function salvarAutomacao(
  info: InfoServidor,
  valor: unknown
): Promise<EstadoAutomacao> {
  const automacao = validarAutomacao(valor)
  await atualizarInfo(info, { automacao })
  zerarReinicio() // o horário pode ter mudado
  return lerAutomacao({ ...info, automacao })
}
