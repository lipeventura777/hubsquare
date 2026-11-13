import type { Automacao } from './tipos'

// Usado pela tela e pelo processo principal (testado em tests/automacao.test.ts).

export const AUTOMACAO_PADRAO: Automacao = {
  vazio: { ligado: false, minutos: 15 },
  reinicio: { ligado: false, dias: [], hora: '05:00' },
  backup: { ligado: false, horas: 6, manter: 10 }
}

const limitar = (v: unknown, min: number, max: number, padrao: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : padrao

// Confere o que veio da tela ou do arquivo; o que estiver errado volta para o padrão.
export function validarAutomacao(valor: unknown): Automacao {
  const v = (valor ?? {}) as Partial<Record<keyof Automacao, Record<string, unknown>>>
  const p = AUTOMACAO_PADRAO
  const hora =
    typeof v.reinicio?.hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.reinicio.hora)
      ? v.reinicio.hora
      : p.reinicio.hora
  const dias = Array.isArray(v.reinicio?.dias)
    ? [
        ...new Set(
          v.reinicio.dias.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
        )
      ].sort()
    : []
  return {
    vazio: {
      ligado: v.vazio?.ligado === true,
      minutos: limitar(v.vazio?.minutos, 5, 120, p.vazio.minutos)
    },
    reinicio: { ligado: v.reinicio?.ligado === true, dias, hora },
    backup: {
      ligado: v.backup?.ligado === true,
      horas: limitar(v.backup?.horas, 1, 48, p.backup.horas),
      manter: limitar(v.backup?.manter, 1, 50, p.backup.manter)
    }
  }
}

// Próximo horário de reinício estritamente depois de `depoisDe` (no fuso do PC), ou null sem dias.
export function proximoReinicio(dias: number[], hora: string, depoisDe: Date): Date | null {
  if (!dias.length) return null
  const [h, m] = hora.split(':').map(Number)
  for (let i = 0; i <= 7; i++) {
    const d = new Date(depoisDe)
    d.setDate(d.getDate() + i)
    d.setHours(h, m, 0, 0)
    if (dias.includes(d.getDay()) && d.getTime() > depoisDe.getTime()) return d
  }
  return null
}
