// Fase E3: regras sem rede nem Electron para as falhas de download e para a porta do servidor.
// Testadas em tests/redeRegras.test.ts.

// Por que um download falhou. Só "siteComProblema" manda esperar: nas outras, esperar não resolve.
export type FalhaDownload = 'naoExiste' | 'recusado' | 'siteComProblema' | 'semConexao'

// status null: não houve resposta (sem conexão, nome do site não achado ou tempo esgotado).
export function classificarFalha(status: number | null): FalhaDownload {
  if (status === null) return 'semConexao'
  if (status === 404 || status === 410) return 'naoExiste'
  if (status === 429 || status >= 500) return 'siteComProblema'
  return 'recusado' // 401, 403 e os outros 4xx: o site não aceitou o pedido
}

// Linha do erros.log: só o site (host), o status e o item. Nunca o caminho nem a busca da URL
// (podem ter token, chave ou o nome do usuário do Windows).
export function linhaDoLog(url: string, status: number | null, item: string): string {
  let host = '?'
  try {
    host = new URL(url).host
  } catch {
    // URL estranha: fica só o "?"
  }
  return `Download: ${host} · HTTP ${status ?? 'sem resposta'} · ${item}`
}

export const PORTA_PADRAO = 25565

// Porta que o Minecraft aceita no server-port.
export const portaValida = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 65535

// server-port do server.properties; sem ele, ou inválido, o Minecraft usa a 25565.
export function portaDe(valor: string | undefined): number {
  const texto = valor?.trim() ?? ''
  const n = /^\d+$/.test(texto) ? Number(texto) : NaN
  return portaValida(n) ? n : PORTA_PADRAO
}
