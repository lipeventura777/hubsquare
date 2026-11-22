// Fase E2: o app passa a se chamar HubSquare também nas pastas e nos arquivos. Regras sem disco
// nem Electron da migração das pastas antigas do ServSquare (%APPDATA%\ServSquare e
// Documentos\ServSquare). Testadas em tests/migracaoRegras.test.ts; quem mexe no disco é
// src/main/migracao.ts.

export const NOME_ANTIGO = 'ServSquare'
export const NOME_NOVO = 'HubSquare'
export const ARQUIVO_MIGRACAO = 'migracao-hubsquare.json'

// Uma pasta raiz do app: a antiga (do ServSquare) e a nova (do HubSquare).
export interface Raiz {
  antiga: string
  nova: string
}

export interface EstadoRaiz extends Raiz {
  antigaExiste: boolean
  novaExiste: boolean
}

// O que fica em migracao-hubsquare.json, na pasta de dados.
export interface RegistroMigracao {
  data: string
  movido: Raiz[] // tudo o que já foi movido (as trocas de caminho valem para todas)
  concluida: boolean // caminhos e arquivos já reescritos
  perfisPendentes: boolean // gameDir dos perfis do launcher ainda por corrigir
}

// Só move quando a pasta antiga existe e a nova não: nunca mistura nem sobrescreve.
export const precisaMover = (r: EstadoRaiz): boolean => r.antigaExiste && !r.novaExiste

// A pasta usada nesta sessão: a antiga só enquanto ela ainda não foi movida.
export const pastaEmUso = (r: EstadoRaiz): string => (precisaMover(r) ? r.antiga : r.nova)

const normal = (c: string): string => c.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()

// Move cada raiz (rename). Se uma falha, desfaz as que já foram, na ordem contrária: nada é
// apagado e a sessão continua com as pastas antigas. Uma volta que também falha fica em
// "presas" (a raiz já está no lugar novo e é usada assim).
export function executarMovimentos(
  raizes: Raiz[],
  mover: (de: string, para: string) => void
): { movidas: Raiz[]; erro: string | null; presas: Raiz[] } {
  const feitas: Raiz[] = []
  for (const r of raizes) {
    try {
      mover(r.antiga, r.nova)
      feitas.push(r)
    } catch (e) {
      const erro = `${r.antiga} → ${r.nova}: ${e instanceof Error ? e.message : String(e)}`
      const presas: Raiz[] = []
      for (const f of [...feitas].reverse()) {
        try {
          mover(f.nova, f.antiga)
        } catch {
          presas.push(f)
        }
      }
      return { movidas: presas, erro, presas }
    }
  }
  return { movidas: feitas, erro: null, presas: [] }
}

// Linha de comando de um Java aberto que usa uma das pastas antigas (servidor ligado ou jogo
// aberto). Com algum, a migração espera a próxima abertura.
export function processoUsando(linhas: string[], antigas: string[]): string | null {
  const alvos = antigas.map((a) => `${normal(a)}\\`)
  return (
    linhas.find((l) => {
      const x = normal(l.replace(/"/g, ''))
      return alvos.some((a) => `${x}\\`.includes(a))
    }) ?? null
  )
}

// Troca o começo de um caminho guardado. Só o caminho inteiro da raiz conta (ServSquareX não),
// sem diferenciar maiúsculas nem barras; o resto do caminho fica como estava.
export function trocarCaminho(texto: string, trocas: Raiz[]): string {
  const x = normal(texto)
  for (const t of trocas) {
    const a = normal(t.antiga)
    if (x === a) return t.nova
    if (x.startsWith(`${a}\\`)) return t.nova + texto.slice(a.length)
  }
  return texto
}

// Todos os textos de um JSON lido, em qualquer nível.
export function trocarCaminhosEmJson(valor: unknown, trocas: Raiz[]): unknown {
  if (typeof valor === 'string') return trocarCaminho(valor, trocas)
  if (Array.isArray(valor)) return valor.map((v) => trocarCaminhosEmJson(v, trocas))
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, trocarCaminhosEmJson(v, trocas)])
    )
  }
  return valor
}

// Nome novo de um arquivo do app numa pasta de servidor, instalação ou backups
// (servsquare.json → hubsquare.json, .servsquare-mods-pendentes → .hubsquare-mods-pendentes).
// null: não é um arquivo antigo do app.
export function nomeNovo(nome: string): string | null {
  const m = /^(\.?)servsquare(.*)$/i.exec(nome)
  return m ? `${m[1]}hubsquare${m[2]}` : null
}

// Junta o que foi movido agora ao registro (que pode não existir) e marca o resto como pendente.
export function registrarMovidas(
  registro: RegistroMigracao | null,
  movidas: Raiz[],
  data: string
): RegistroMigracao | null {
  if (!movidas.length) return registro
  return {
    data,
    movido: [...(registro?.movido ?? []), ...movidas],
    concluida: false,
    perfisPendentes: true
  }
}

// O registro lido do disco; qualquer coisa estranha vale como "sem registro".
export function validarRegistro(valor: unknown): RegistroMigracao | null {
  const v = valor as Partial<RegistroMigracao> | null
  if (!v || typeof v !== 'object' || !Array.isArray(v.movido)) return null
  const movido = v.movido.filter(
    (r): r is Raiz => !!r && typeof r.antiga === 'string' && typeof r.nova === 'string'
  )
  return {
    data: typeof v.data === 'string' ? v.data : '',
    movido,
    concluida: v.concluida === true,
    perfisPendentes: v.perfisPendentes === true
  }
}
