// Diagnóstico de conexão (Fase M5), sem DOM nem Electron: testado em
// tests/diagnosticoRegras.test.ts. As checagens rodam em ordem; quando uma essencial falha, as
// seguintes ficam "puladas" (o primeiro problema é o que impede a entrada).

export type ResultadoChecagem = 'ok' | 'falhou' | 'pulada' | 'aviso'

// Consertos seguros: sempre com o clique do usuário.
export type Conserto =
  'ligarServidor' | 'religarTunel' | 'recriarFirewall' | 'atualizarInstalacao' | 'abrirPedidos'

export const NOMES_CONSERTOS: Record<Conserto, string> = {
  ligarServidor: 'Ligar o servidor',
  religarTunel: 'Religar o túnel',
  recriarFirewall: 'Liberar o Java no Firewall',
  atualizarInstalacao: 'Atualizar a instalação',
  abrirPedidos: 'Ver os pedidos'
}

export interface LinhaDiagnostico {
  id: string
  nome: string
  resultado: ResultadoChecagem
  frase: string // o que significa, em português simples
  conserto?: Conserto
}

export interface Checagem {
  id: string
  nome: string
  essencial: boolean // falhou: as seguintes são puladas
  rodar: () => Promise<{ resultado: 'ok' | 'falhou' | 'aviso'; frase: string; conserto?: Conserto }>
}

export const FRASE_PULADA = 'Não conferido: resolva o problema acima primeiro.'

export async function rodarChecagens(lista: Checagem[]): Promise<LinhaDiagnostico[]> {
  const linhas: LinhaDiagnostico[] = []
  let parou = false
  for (const c of lista) {
    if (parou) {
      linhas.push({ id: c.id, nome: c.nome, resultado: 'pulada', frase: FRASE_PULADA })
      continue
    }
    let r: Awaited<ReturnType<Checagem['rodar']>>
    try {
      r = await c.rodar()
    } catch {
      r = { resultado: 'falhou', frase: 'Não deu para conferir isto agora. Tente de novo.' }
    }
    linhas.push({ id: c.id, nome: c.nome, ...r })
    if (r.resultado === 'falhou' && c.essencial) parou = true
  }
  return linhas
}

export const primeiroProblema = (linhas: LinhaDiagnostico[]): LinhaDiagnostico | null =>
  linhas.find((l) => l.resultado === 'falhou') ?? null

// IP que não é de rede particular (casa, Radmin 26.x, Tailscale 100.64/10, localhost): esconde
// os dois últimos números, para o texto copiado não levar o IP público completo.
export function mascararIp(texto: string): string {
  return texto.replace(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g, (ip, a, b) => {
    const [x, y] = [Number(a), Number(b)]
    const particular =
      x === 10 ||
      x === 127 ||
      x === 26 ||
      (x === 192 && y === 168) ||
      (x === 172 && y >= 16 && y <= 31) ||
      (x === 100 && y >= 64 && y <= 127)
    return particular ? ip : `${a}.${b}.•••.•••`
  })
}

// Tokens de convite (16 letras/números, com ou sem tracinhos) e chaves longas somem.
const semTokens = (texto: string): string =>
  texto
    .replace(/\b[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}\b/g, '••••')
    .replace(/\b[0-9A-Za-z_-]{16,}\b/g, (p) => (/^[a-z]+$/i.test(p) ? p : '••••'))

export const limparParaCopiar = (texto: string): string => mascararIp(semTokens(texto))

const SIMBOLO: Record<ResultadoChecagem, string> = { ok: '✓', falhou: '✗', aviso: '!', pulada: '–' }

// Texto curto para o amigo mandar ao dono (ou o dono guardar), sem tokens nem IP público.
export function textoParaCopiar(titulo: string, linhas: LinhaDiagnostico[]): string {
  const problema = primeiroProblema(linhas)
  return limparParaCopiar(
    [
      `HubSquare: ${titulo}`,
      problema ? `Problema: ${problema.nome}. ${problema.frase}` : 'Nenhum problema encontrado.',
      ...linhas.map((l) => `${SIMBOLO[l.resultado]} ${l.nome}: ${l.frase}`)
    ].join('\n')
  )
}
