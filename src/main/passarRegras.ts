import type { ArquivoManual, TipoId } from '../shared/tipos'
import { reconhecivel } from './downloadsRegras'
import { caminhoDoPack, downloadPermitido, type ArquivoIndice } from './modpackRegras'

// Regras sem rede nem Electron do "Passar o servidor" (Fase M7): o que entra no .hubserver, o
// que fica no PC, como o server.properties sai sem segredos, como o pacote é conferido ao abrir e
// como o app decide entre servidor novo, atualizar o meu e cópia. Testadas em
// tests/passarRegras.test.ts.

export const FORMATO_HUBSERVER = 1
export const INDICE_HUBSERVER = 'hubserver.json'

// O que vai dentro do hubserver.json (o resto do zip são os arquivos do servidor, na raiz).
export interface PacoteServidor {
  formato: 1
  idFixo: string // o mesmo servidor em qualquer PC
  nome: string
  tipo: TipoId
  versao: string
  versaoLoader: string | null
  ram?: number
  pvp?: boolean
  javaOtimizado?: boolean
  javaDosMods?: number
  mods: ArquivoIndice[] // mods/plugins só como link oficial + hash; os .jar nunca vão
  manuais: ArquivoManual[] // baixados à mão (CurseForge): só página oficial + hash
  semLink: string[] // .jar sem link oficial: o novo dono põe à mão
  geradoEm: string
}

// Arquivos soltos da pasta do servidor que vão no pacote.
export const ARQUIVOS_DO_PACOTE = [
  'server.properties',
  'whitelist.json',
  'ops.json',
  'banned-players.json',
  'banned-ips.json',
  'server-icon.png'
]
// Pastas de configuração dos mods (o Paper guarda as dos plugins dentro de plugins/<nome>).
export const PASTAS_DE_CONFIG = ['config', 'defaultconfigs', 'plugins']

// Nunca vão, em pasta nenhuma: programas, mods e a trava do mundo.
const EXECUTAVEL = /\.(jar|exe|dll|bat|cmd|ps1|sh|vbs|msi|com|scr)$/i
export const EXCLUIR_SEMPRE = [
  '*.jar',
  '*.exe',
  '*.dll',
  '*.bat',
  '*.cmd',
  '*.ps1',
  '*.sh',
  'session.lock'
]

// Chaves do server.properties que são segredo ou só valem neste PC: saem em branco.
export const CHAVES_LIMPAS = ['rcon.password', 'management-server-secret', 'server-ip']

export function limparPropriedades(texto: string): string {
  return texto
    .split(/\r?\n/)
    .map((linha) => {
      const chave = linha.match(/^\s*([^#!=:\s][^=:]*?)\s*[=:]/)?.[1]
      return chave && CHAVES_LIMPAS.includes(chave) ? `${chave}=` : linha
    })
    .join('\n')
}

// Arquivos de texto que dá para conferir antes de mandar.
export const TEXTO = /\.(ya?ml|json5?|toml|properties|txt|cfg|conf|ini|snbt|js|md)$/i

// Segredo com valor preenchido (password: abc, "token": "x", api-key = y). Vazio, número,
// true/false e null não contam.
const CHAVE_SEGREDO =
  /(?:^|["'\s{,._-])(?:password|passwd|senha|secret|token|api[-_ ]?key|webhook(?:[-_]?url)?|private[-_ ]?key)["']?\s*[:=]\s*(.*)$/i

export function temSegredo(texto: string): boolean {
  return texto.split(/\r?\n/).some((linha) => {
    const valor = linha
      .match(CHAVE_SEGREDO)?.[1]
      ?.trim()
      .replace(/[,;]$/, '')
      .replace(/^["']|["']$/g, '')
      .trim()
    return !!valor && !/^(null|none|true|false|[{[]|-?\d+(\.\d+)?)$/i.test(valor)
  })
}

// Por que um arquivo de configuração fica no PC (null: pode ir). `caminhos` são os do PC do dono
// (pasta do usuário, pasta do servidor) que não podem sair.
export function motivoParaFicar(
  relativo: string,
  texto: string | null,
  caminhos: string[]
): string | null {
  if (EXECUTAVEL.test(relativo)) return 'programa ou mod (.jar): nunca vai no pacote'
  if (texto === null) return null
  const minusculo = texto.toLowerCase()
  for (const c of caminhos.filter((x) => x.length > 3)) {
    const variantes = [c, c.replace(/\\/g, '/'), c.replace(/\\/g, '\\\\')].map((v) =>
      v.toLowerCase()
    )
    if (variantes.some((v) => minusculo.includes(v))) return 'tem caminhos de pastas deste PC'
  }
  if (temSegredo(texto)) return 'parece ter senha, token ou chave'
  return null
}

// Uma entrada do zip só é aceita se ficar dentro da pasta e não for programa nem mod.
export function entradaAceita(entrada: string): boolean {
  const e = entrada.replace(/\\/g, '/').replace(/\/$/, '')
  return e === '' || (caminhoDoPack(e) && !EXECUTAVEL.test(e))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VERSAO = /^[\w.+-]{1,40}$/
const TIPOS: TipoId[] = ['paper', 'vanilla', 'fabric', 'forge', 'neoforge']
const hex = (v: unknown, n: number): v is string =>
  typeof v === 'string' && new RegExp(`^[0-9a-f]{${n}}$`, 'i').test(v)

export function validarPacote(dado: unknown): PacoteServidor {
  const p = dado as Partial<PacoteServidor> | null
  const erro = (o: string): never => {
    throw new Error(`Esse arquivo .hubserver veio com problema (${o}). Peça um arquivo novo.`)
  }
  if (!p || typeof p !== 'object' || p.formato !== FORMATO_HUBSERVER) erro('formato')
  if (typeof p!.idFixo !== 'string' || !UUID.test(p!.idFixo)) erro('id')
  if (!TIPOS.includes(p!.tipo as TipoId)) erro('tipo')
  if (typeof p!.versao !== 'string' || !VERSAO.test(p!.versao)) erro('versão')
  if (
    p!.versaoLoader != null &&
    !(typeof p!.versaoLoader === 'string' && VERSAO.test(p!.versaoLoader))
  )
    erro('versão do loader')
  if (!Array.isArray(p!.mods) || p!.mods.length > 2000) erro('mods')
  const mods = p!.mods!.map((f) => {
    if (!caminhoDoPack(f?.path) || !/^(mods|plugins)\/[^/]+\.jar$/i.test(f.path)) erro('caminho')
    if (!hex(f.hashes?.sha1, 40) || !hex(f.hashes.sha512, 128)) erro('hash')
    const downloads = Array.isArray(f.downloads) ? f.downloads.filter(downloadPermitido) : []
    if (!downloads.length) erro('link')
    return {
      path: f.path,
      hashes: { sha1: f.hashes.sha1, sha512: f.hashes.sha512 },
      downloads,
      fileSize: Number.isFinite(f.fileSize) ? Math.max(0, f.fileSize) : 0
    }
  })
  const nome = typeof p!.nome === 'string' ? p!.nome.slice(0, 32) : 'Servidor recebido'
  const num = (v: unknown, min: number, max: number): number | undefined =>
    Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : undefined
  return {
    formato: 1,
    idFixo: p!.idFixo!.toLowerCase(),
    nome,
    tipo: p!.tipo!,
    versao: p!.versao!,
    versaoLoader: p!.versaoLoader ?? null,
    ram: num(p!.ram, 1, 256),
    pvp: typeof p!.pvp === 'boolean' ? p!.pvp : undefined,
    javaOtimizado: p!.javaOtimizado !== false,
    javaDosMods: num(p!.javaDosMods, 8, 99),
    mods,
    manuais: Array.isArray(p!.manuais) ? p!.manuais.slice(0, 500).filter(reconhecivel) : [],
    semLink: Array.isArray(p!.semLink)
      ? p!.semLink
          .filter((x): x is string => typeof x === 'string')
          .map((x) => x.slice(0, 200))
          .slice(0, 500)
      : [],
    geradoEm: typeof p!.geradoEm === 'string' ? p!.geradoEm : ''
  }
}

// O mesmo servidor já está neste PC? Compara o id fixo de cada servidor salvo.
export function acharMesmo<T extends { idFixo: string }>(idFixo: string, locais: T[]): T | null {
  return locais.find((s) => s.idFixo.toLowerCase() === idFixo.toLowerCase()) ?? null
}

// "Atualizar o meu servidor" só com o mesmo tipo e a mesma versão (um mundo aberto numa versão
// mais nova não volta para a antiga). null: pode atualizar.
export function motivoSemAtualizar(
  local: { tipo: TipoId; versao: string },
  pacote: { tipo: TipoId; versao: string }
): string | null {
  if (local.tipo !== pacote.tipo || local.versao !== pacote.versao) {
    return `O arquivo é de ${pacote.tipo} ${pacote.versao} e o seu servidor é ${local.tipo} ${local.versao}. Troque a versão na tela Software antes, ou crie uma cópia.`
  }
  return null
}

// "Com Bia desde 13/11/2026"
export function textoEmprestado(e: { com: string; desde: string }): string {
  const d = new Date(e.desde)
  const data = Number.isNaN(d.getTime()) ? '' : ` desde ${d.toLocaleDateString('pt-BR')}`
  return `Com ${e.com}${data}`
}

export function nomeDoAmigo(valor: unknown): string {
  const nome = typeof valor === 'string' ? valor.trim() : ''
  if (!nome || [...nome].length > 32 || /\p{C}/u.test(nome)) {
    throw new Error('Escreva o nome de quem vai hospedar (até 32 letras, numa linha só).')
  }
  return nome
}
