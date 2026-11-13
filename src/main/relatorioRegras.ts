import { mascararIp } from '../shared/diagnosticoRegras'

// Regras sem rede nem Electron do relatório de erro (Fase M8): a limpeza de tudo o que entra no
// .zip (segredos, tokens, PIN, chaves, cookies, nome do usuário nos caminhos, IP público), o
// corte do fim dos logs e o LEIA-ME. Testadas em tests/relatorioRegras.test.ts.

export const REMOVIDO = '[removido]'
export const USUARIO = '%USERPROFILE%'

export interface Limpeza {
  casas: string[] // pasta do usuário do Windows (C:\Users\<nome>)
  segredos: string[] // valores lidos do próprio PC: tokens, PIN, chave, segredo do playit, cookies
}

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Nomes de campo que guardam segredo (no JSON e em "chave=valor" de texto).
const NOME_SEGREDO =
  '(?:[a-z_-]*token|secret|segredo|senha|password|passwd|pin|pin[-_]?hash|salt|api[-_]?key|chave(?:[-_]?secreta)?|cookies?|authorization|session[-_]?id|sessoes|sessions?)'
const CAMPO_SEGREDO = new RegExp(`^${NOME_SEGREDO}$`, 'i')
const CHAVE_VALOR = new RegExp(
  `(["']?)\\b(${NOME_SEGREDO})\\1(\\s*[:=]\\s*)(?!\\[removido\\])("[^"]*"|'[^']*'|[^\\s,;}\\]]+)`,
  'gi'
)
// Token de convite (Base32 de Crockford, 16 letras/números, com ou sem tracinhos).
const TOKEN_CONVITE =
  /\b(?=[0-9A-Z-]*\d)(?=[0-9A-Z-]*[A-Z])(?:[0-9A-HJKMNP-TV-Z]{4}-?){3}[0-9A-HJKMNP-TV-Z]{4}\b/g

export function limparTexto(texto: string, l: Limpeza): string {
  let s = texto
  // 1. Os segredos deste PC, onde quer que apareçam (os mais longos primeiro).
  const segredos = [...new Set(l.segredos.filter((x) => typeof x === 'string' && x.length >= 6))]
  for (const seg of segredos.sort((a, b) => b.length - a.length)) s = s.split(seg).join(REMOVIDO)
  // 2. O nome do usuário do Windows nos caminhos (com \, / ou \\ do JSON).
  for (const casa of l.casas.filter((c) => c.length > 3)) {
    const partes = casa
      .split(/[\\/]+/)
      .filter(Boolean)
      .map(escapar)
    s = s.replace(new RegExp(partes.join('(?:\\\\\\\\|\\\\|/)'), 'gi'), USUARIO)
  }
  s = s.replace(/\b[A-Za-z]:(\\\\|\\|\/)Users\1(?!Public\b)[^\\/\s"'<>|:*?]+/gi, USUARIO)
  // 3. Cabeçalhos inteiros (cookie e autorização), antes dos campos soltos.
  s = s.replace(/^(\s*(?:set-)?cookie:\s*|\s*authorization:\s*).*$/gim, `$1${REMOVIDO}`)
  // 4. Campos de segredo em texto ("password: x", "token=y", "\"pin\": ...").
  s = s.replace(CHAVE_VALOR, (_m, aspas, chave, sep) => `${aspas}${chave}${aspas}${sep}${REMOVIDO}`)
  // 5. Formatos conhecidos: Bearer, JWT, argumentos do jogo e tokens de convite.
  s = s
    .replace(/\b(Bearer\s+)[\w.~+/-]+=*/gi, `$1${REMOVIDO}`)
    .replace(/\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]*/g, REMOVIDO)
    .replace(/(--(?:accessToken|clientId|xuid|session))(\s+)\S+/gi, `$1$2${REMOVIDO}`)
    .replace(TOKEN_CONVITE, REMOVIDO)
  // 6. IP público com os dois últimos números escondidos (os da casa, Radmin e Tailscale ficam).
  return mascararIp(s)
}

// JSON (configurações de servidores e instalações): campos de segredo saem inteiros; o resto
// passa pela limpeza de texto.
export function limparObjeto(valor: unknown, l: Limpeza): unknown {
  if (typeof valor === 'string') return limparTexto(valor, l)
  if (Array.isArray(valor)) return valor.map((v) => limparObjeto(v, l))
  if (valor && typeof valor === 'object') {
    const saida: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(valor)) {
      saida[limparTexto(k, l)] = CAMPO_SEGREDO.test(k) ? REMOVIDO : limparObjeto(v, l)
    }
    return saida
  }
  return valor
}

// O fim de um log, cortado numa quebra de linha.
export function fimDoTexto(texto: string, limite: number): string {
  if (texto.length <= limite) return texto
  const resto = texto.slice(-limite)
  return `[HubSquare] Arquivo grande: só o final.\n${resto.slice(resto.indexOf('\n') + 1)}`
}

// Última conferência antes de gravar: algum segredo conhecido sobrou? Devolve o nome do arquivo.
export function sobrouSegredo(arquivos: Record<string, string>, segredos: string[]): string | null {
  const lista = segredos.filter((x) => typeof x === 'string' && x.length >= 6)
  for (const [nome, texto] of Object.entries(arquivos)) {
    if (lista.some((seg) => texto.includes(seg))) return nome
  }
  return null
}

// Itens que a tela mostra, na ordem; o usuário pode tirar qualquer um (o LEIA-ME sempre vai).
export const ITENS_RELATORIO = [
  { id: 'erros', nome: 'Erros do app', descricao: 'logs/erros.log' },
  { id: 'servidor', nome: 'Logs do servidor', descricao: 'O fim do latest.log e das ações do app' },
  { id: 'jogo', nome: 'Logs do jogo', descricao: 'O fim do latest.log da instalação' },
  {
    id: 'travamentos',
    nome: 'Relatórios de travamento',
    descricao: 'Os 3 mais recentes de cada um'
  },
  { id: 'sistema', nome: 'Sistema', descricao: 'Versão do app e do Windows, memória e Javas' },
  { id: 'config', nome: 'Configurações', descricao: 'Servidores e instalações, sem segredos' },
  { id: 'mods', nome: 'Lista de mods', descricao: 'Nome, versão e hash (sem os arquivos)' },
  {
    id: 'manifesto',
    nome: 'Versão do convite',
    descricao: 'Do manifesto do servidor e da instalação'
  },
  {
    id: 'diagnostico',
    nome: 'Último diagnóstico',
    descricao: 'O resultado do Testar tudo / Não consigo entrar'
  }
] as const

export type ItemRelatorio = (typeof ITENS_RELATORIO)[number]['id']

export function itensEscolhidos(tirar: unknown): ItemRelatorio[] {
  const fora = Array.isArray(tirar) ? tirar : []
  return ITENS_RELATORIO.map((i) => i.id).filter((id) => !fora.includes(id))
}

// "HubSquare-relatorio-2026-11-13_15-40.zip" (data e hora locais).
export function nomeDoRelatorio(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `HubSquare-relatorio-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}.zip`
}

export function leiaMe(r: {
  geradoEm: string
  versaoApp: string
  windows: string
  servidor: string | null
  instalacao: string | null
  arquivos: string[]
  ultimoErro: string | null
  diagnostico: string | null
}): string {
  return [
    'RELATÓRIO DE ERRO DO HUBSQUARE',
    '',
    `Gerado em: ${r.geradoEm}`,
    `Versão do app: ${r.versaoApp}`,
    `Windows: ${r.windows}`,
    `Servidor escolhido: ${r.servidor ?? '(nenhum)'}`,
    `Instalação escolhida: ${r.instalacao ?? '(nenhuma)'}`,
    '',
    'Último erro do app:',
    r.ultimoErro ?? '(nenhum)',
    '',
    'Último diagnóstico de conexão:',
    r.diagnostico ?? '(nenhum nesta sessão)',
    '',
    'Arquivos neste relatório:',
    ...r.arquivos.map((a) => `- ${a}`),
    '',
    'Segredos, tokens, PIN, chaves e cookies foram removidos; o nome do usuário do Windows virou',
    `${USUARIO} e o IP público aparece com os dois últimos números escondidos. Nenhum mundo nem`,
    'arquivo de mod vai junto. Este arquivo só existe neste PC: o HubSquare não envia nada.',
    'Como ler: docs/como-ler-relatorio.md no repositório do HubSquare.'
  ].join('\n')
}

// Última entrada do erros.log ("[2026-11-13T...] ..."), para o LEIA-ME.
export function ultimaEntrada(log: string): string | null {
  const entradas = log.split(/\r?\n(?=\[\d{4}-\d{2}-\d{2}T)/).filter((e) => e.trim())
  return entradas.length ? entradas[entradas.length - 1].trim().slice(0, 2000) : null
}
