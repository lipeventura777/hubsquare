import { spawn, type ChildProcess } from 'child_process'
import { availableParallelism } from 'os'
import { createInterface } from 'readline'
import type { UsoServidor } from '../shared/tipos'
import { avisarTela, eventos } from './servidor'

// Mede CPU e RAM só do processo do servidor, a cada 2 s, sem dependência extra:
// um PowerShell (que já vem no Windows) lê os números do processo e escreve uma linha por medida.
// Ele termina sozinho quando o servidor fecha.
let medidor: ChildProcess | null = null

function script(pid: number): string {
  return `$p = Get-Process -Id ${pid}; while (-not $p.HasExited) { $p.Refresh(); [Console]::Out.WriteLine("$([long]$p.TotalProcessorTime.TotalMilliseconds) $($p.WorkingSet64)"); Start-Sleep -Seconds 2 }`
}

function iniciar(pid: number, ramGb: number): void {
  parar()
  const powershell = `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
  const filho = spawn(powershell, ['-NoProfile', '-NonInteractive', '-Command', script(pid)], {
    windowsHide: true
  })
  medidor = filho
  filho.on('error', () => {}) // sem PowerShell, o painel só fica sem números
  let anterior: { cpuMs: number; quando: number } | null = null

  createInterface({ input: filho.stdout }).on('line', (linha) => {
    const [cpuMs, ram] = linha.trim().split(' ').map(Number)
    if (!Number.isFinite(cpuMs) || !Number.isFinite(ram)) return
    const quando = Date.now()
    if (anterior) {
      // Tempo de CPU gasto / tempo que passou, dividido pelos núcleos = % do PC inteiro.
      const cpu =
        ((cpuMs - anterior.cpuMs) / (quando - anterior.quando) / availableParallelism()) * 100
      const uso: UsoServidor = {
        cpu: Math.max(0, Math.min(100, cpu)),
        ram,
        ramMax: ramGb * 1024 ** 3
      }
      avisarTela('servidor:uso', uso)
      eventos.emit('uso', uso)
    }
    anterior = { cpuMs, quando }
  })
}

function parar(): void {
  medidor?.kill()
  medidor = null
}

eventos.on('processo', ({ pid, ramGb }) => iniciar(pid, ramGb))
eventos.on('estado', (estado) => {
  if (estado === 'desligado') {
    parar()
    avisarTela('servidor:uso', null)
  }
})
