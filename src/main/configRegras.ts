// Formulário dos arquivos de config dos mods (Fase 25), sem biblioteca e sem rede.
// Testado em tests/configRegras.test.ts.
//
// Regra de ouro: ao salvar, só o trecho do VALOR é trocado. Tudo o mais (comentários, ordem,
// espaços, quebras de linha) fica byte a byte igual. O que o leitor não entende com segurança
// (string de várias linhas, tabela inline, âncora do YAML...) vira campo "só leitura" e fica
// para o "Editar como texto".
import type { CampoConfig, TipoCampo } from '../shared/tipos'
import { codificarPropriedade, decodificarPropriedade } from './propriedades'

export type { CampoConfig }

export type Formato = 'toml' | 'json' | 'json5' | 'yml' | 'properties'

export function formatoDe(nome: string): Formato | null {
  const ext = nome.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  if (ext === 'yaml' || ext === 'yml') return 'yml'
  if (ext === 'toml' || ext === 'json' || ext === 'json5' || ext === 'properties') return ext
  return null
}

type Aspas = '"' | "'" | ''
type Jeito =
  | { t: 'bool' }
  | { t: 'num'; decimal: boolean }
  | { t: 'str'; aspas: Aspas }
  | { t: 'lista'; aspas: Aspas; numerica: boolean; bloco?: { indent: string; quebra: string } }
  | { t: 'leitura' }

interface Trecho {
  campo: CampoConfig
  inicio: number
  fim: number
  jeito: Jeito
}

const NUMERO = /^[+-]?(\d[\d_]*)(\.\d[\d_]*)?([eE][+-]?\d+)?$/

function campo(
  inicio: number,
  fim: number,
  jeito: Jeito,
  partes: string[],
  secao: string | null,
  valor: CampoConfig['valor'],
  descricao: string[]
): Trecho {
  const tipo: TipoCampo =
    jeito.t === 'bool'
      ? 'bool'
      : jeito.t === 'num'
        ? 'numero'
        : jeito.t === 'str'
          ? 'texto'
          : jeito.t === 'lista'
            ? 'lista'
            : 'leitura'
  const texto = descricao.join('\n').trim()
  return {
    inicio,
    fim,
    jeito,
    campo: {
      id: String(inicio),
      chave: partes.join('.'),
      nome: partes[partes.length - 1] ?? '',
      secao,
      tipo,
      valor,
      descricao: texto || null
    }
  }
}

// Linhas com a posição de começo de cada uma (sem o \r do fim).
function linhas(texto: string): { t: string; ini: number }[] {
  const r: { t: string; ini: number }[] = []
  let ini = 0
  for (const l of texto.split('\n')) {
    r.push({ t: l.endsWith('\r') ? l.slice(0, -1) : l, ini })
    ini += l.length + 1
  }
  return r
}

// Fim de uma string entre aspas que começa em `i` (posição da aspa). -1 se não fecha na linha.
function fimDaString(s: string, i: number, aspas: string, escapeDobrado = false): number {
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\' && aspas === '"') {
      j++
      continue
    }
    if (s[j] === aspas) {
      if (escapeDobrado && s[j + 1] === aspas) {
        j++
        continue
      }
      return j + 1
    }
  }
  return -1
}

// Itens de uma lista inline "[a, 'b', 3]" (sem listas ou tabelas dentro). null se não der.
function itensDaLista(
  corpo: string,
  formato: Formato
): { itens: string[]; aspas: Aspas; numerica: boolean } | null {
  const itens: string[] = []
  let aspas: Aspas = ''
  let numerica = true
  let i = 0
  const pular = (): void => {
    while (i < corpo.length && /[\s,]/.test(corpo[i])) i++
  }
  pular()
  while (i < corpo.length) {
    const c = corpo[i]
    if (c === '"' || c === "'") {
      const fim = fimDaString(corpo, i, c, formato === 'yml' && c === "'")
      if (fim < 0) return null
      const bruto = corpo.slice(i, fim)
      const v = lerString(bruto, formato)
      if (v === null) return null
      itens.push(v)
      if (!aspas) aspas = c
      numerica = false
      i = fim
    } else if (c === '[' || c === '{' || c === '#' || c === '/') {
      return null
    } else {
      const m = corpo.slice(i).match(/^[^,\s\]]+/)
      if (!m) return null
      const v = m[0]
      if (NUMERO.test(v)) itens.push(v)
      else if (formato === 'yml') {
        itens.push(v)
        numerica = false
      } else return null
      i += v.length
    }
    pular()
  }
  if (!itens.length) numerica = false
  return { itens, aspas: aspas || (formato === 'yml' ? '' : '"'), numerica }
}

function lerString(bruto: string, formato: Formato): string | null {
  const a = bruto[0]
  const meio = bruto.slice(1, -1)
  if (a === "'") return formato === 'yml' ? meio.replace(/''/g, "'") : meio.replace(/\\'/g, "'")
  try {
    return JSON.parse(bruto) as string
  } catch {
    return null
  }
}

// ---------- TOML ----------

function analisarToml(texto: string): Trecho[] {
  const r: Trecho[] = []
  const ls = linhas(texto)
  let comentarios: string[] = []
  let secao: string | null = null
  for (let n = 0; n < ls.length; n++) {
    const { t, ini } = ls[n]
    const s = t.trim()
    if (!s) {
      comentarios = []
      continue
    }
    if (s.startsWith('#')) {
      comentarios.push(s.replace(/^#+\s?/, ''))
      continue
    }
    const cab = s.match(/^\[\[?\s*([^\]]+?)\s*\]\]?\s*(#.*)?$/)
    if (cab) {
      secao = cab[1].replace(/["']/g, '')
      comentarios = []
      continue
    }
    // chave = valor (a chave pode ter aspas e pontos)
    let k = 0
    let eq = -1
    while (k < t.length) {
      if (t[k] === '"' || t[k] === "'") {
        const f = fimDaString(t, k, t[k])
        if (f < 0) break
        k = f
        continue
      }
      if (t[k] === '=') {
        eq = k
        break
      }
      k++
    }
    if (eq < 0) {
      comentarios = []
      continue
    }
    const chave = t
      .slice(0, eq)
      .trim()
      .split('.')
      .map((p) => p.trim().replace(/^["']|["']$/g, ''))
    const partes = secao ? [...secao.split('.'), ...chave] : chave
    let v = eq + 1
    while (t[v] === ' ' || t[v] === '\t') v++
    const resto = t.slice(v)
    const inicio = ini + v
    const desc = comentarios
    comentarios = []

    if (resto.startsWith('"""') || resto.startsWith("'''")) {
      // String de várias linhas: só leitura; pula até fechar.
      const marca = resto.slice(0, 3)
      let fimLinha = n
      if (resto.indexOf(marca, 3) < 0) {
        while (fimLinha + 1 < ls.length && !ls[++fimLinha].t.includes(marca));
      }
      r.push(campo(inicio, inicio, { t: 'leitura' }, partes, secao, resto, desc))
      n = fimLinha
      continue
    }
    if (resto[0] === '"' || resto[0] === "'") {
      const f = fimDaString(resto, 0, resto[0])
      const valor = f > 0 ? lerString(resto.slice(0, f), 'toml') : null
      if (valor === null) {
        r.push(campo(inicio, inicio, { t: 'leitura' }, partes, secao, resto, desc))
        continue
      }
      r.push(
        campo(
          inicio,
          inicio + f,
          { t: 'str', aspas: resto[0] as Aspas },
          partes,
          secao,
          valor,
          desc
        )
      )
      continue
    }
    if (resto[0] === '[') {
      // Lista: pode continuar nas próximas linhas.
      let corpo = ''
      let profundidade = 0
      let fimAbs = -1
      let comComentario = false
      let m = n
      let pos = v
      outer: for (; m < ls.length; m++) {
        const linha = ls[m].t
        for (let j = m === n ? pos : 0; j < linha.length; j++) {
          const c = linha[j]
          if (c === '"' || c === "'") {
            const f = fimDaString(linha, j, c)
            if (f < 0) break outer
            corpo += linha.slice(j, f)
            j = f - 1
            continue
          }
          if (c === '#') {
            comComentario = true
            break
          }
          if (c === '[') profundidade++
          if (c === ']') profundidade--
          corpo += c
          if (profundidade === 0) {
            fimAbs = ls[m].ini + j + 1
            break outer
          }
        }
        corpo += '\n'
        pos = 0
      }
      if (fimAbs < 0) {
        r.push(campo(inicio, inicio, { t: 'leitura' }, partes, secao, resto, desc))
        continue
      }
      const itens = !comComentario ? itensDaLista(corpo.slice(1, -1), 'toml') : null
      r.push(
        itens
          ? campo(
              inicio,
              fimAbs,
              { t: 'lista', aspas: itens.aspas, numerica: itens.numerica },
              partes,
              secao,
              itens.itens,
              desc
            )
          : campo(inicio, inicio, { t: 'leitura' }, partes, secao, corpo, desc)
      )
      n = m
      continue
    }
    if (resto[0] === '{') {
      r.push(campo(inicio, inicio, { t: 'leitura' }, partes, secao, resto, desc))
      continue
    }
    const tok = resto.match(/^[^\s#,]+/)?.[0] ?? ''
    if (tok === 'true' || tok === 'false') {
      r.push(campo(inicio, inicio + tok.length, { t: 'bool' }, partes, secao, tok === 'true', desc))
    } else if (NUMERO.test(tok)) {
      r.push(
        campo(
          inicio,
          inicio + tok.length,
          { t: 'num', decimal: /[.eE]/.test(tok) },
          partes,
          secao,
          tok,
          desc
        )
      )
    } else {
      r.push(campo(inicio, inicio, { t: 'leitura' }, partes, secao, tok, desc))
    }
  }
  return r
}

// ---------- YAML (o que os plugins e alguns mods usam) ----------

const PLANO_SEGURO = /^[A-Za-z0-9_./][^#]*$/
const PALAVRAS_YAML = /^(true|false|yes|no|on|off|null|~|y|n)$/i

function valorPlanoYaml(v: string): string {
  return PLANO_SEGURO.test(v) &&
    !/: |\s$|^\s/.test(v) &&
    !PALAVRAS_YAML.test(v) &&
    !NUMERO.test(v) &&
    !v.endsWith(':')
    ? v
    : JSON.stringify(v)
}

function analisarYaml(texto: string): Trecho[] {
  const r: Trecho[] = []
  const ls = linhas(texto)
  const pilha: { indent: number; chave: string }[] = []
  let comentarios: string[] = []
  const indentDe = (l: string): number => l.match(/^ */)![0].length
  for (let n = 0; n < ls.length; n++) {
    const { t, ini } = ls[n]
    const s = t.trim()
    if (!s || s === '---' || s === '...') {
      comentarios = []
      continue
    }
    if (s.startsWith('#')) {
      comentarios.push(s.replace(/^#+\s?/, ''))
      continue
    }
    if (s.startsWith('- ') || s === '-' || t.includes('\t')) {
      comentarios = []
      continue // item de lista de mapas (ou tab, que o YAML não aceita para recuo): só como texto
    }
    // Acha o ":" da chave fora de aspas.
    const indent = indentDe(t)
    let k = indent
    let doisPontos = -1
    if (t[k] === '"' || t[k] === "'") {
      const f = fimDaString(t, k, t[k], t[k] === "'")
      k = f < 0 ? t.length : f
    }
    for (; k < t.length; k++) {
      if (t[k] === ':' && (k + 1 === t.length || t[k + 1] === ' ')) {
        doisPontos = k
        break
      }
      if (t[k] === '#' && t[k - 1] === ' ') break
    }
    if (doisPontos < 0) {
      comentarios = []
      continue
    }
    const chave = t
      .slice(indent, doisPontos)
      .trim()
      .replace(/^["']|["']$/g, '')
    while (pilha.length && pilha[pilha.length - 1].indent >= indent) pilha.pop()
    const pais = pilha.map((p) => p.chave)
    const partes = [...pais, chave]
    const secao = pais.length ? pais.join('.') : null
    const desc = comentarios
    comentarios = []
    let v = doisPontos + 1
    while (t[v] === ' ') v++
    const resto = t.slice(v)
    const inicio = ini + v

    if (!resto || resto.startsWith('#')) {
      // Mapa ou lista em bloco nas próximas linhas.
      let m = n + 1
      while (m < ls.length && (!ls[m].t.trim() || ls[m].t.trim().startsWith('#'))) m++
      const prox = ls[m]?.t ?? ''
      if (/^\s*- /.test(prox) && indentDe(prox) >= indent) {
        const indItem = prox.match(/^\s*/)![0]
        const itens: string[] = []
        let aspas: Aspas = ''
        let ok = true
        let ultimo = m
        for (let j = m; j < ls.length; j++) {
          const l = ls[j].t
          if (!l.startsWith(indItem + '- ')) {
            if (!l.trim() || indentDe(l) <= indent) break
            ok = false // algo mais dentro da lista (mapa): só leitura
            continue
          }
          if (j !== m && !ls[j - 1].t.startsWith(indItem + '- ')) ok = false // comentário no meio
          const item = l.slice(indItem.length + 2).trim()
          if (/^[{[&*!|>]/.test(item) || /: |:$/.test(item) || / #/.test(item)) ok = false
          else if (item[0] === '"' || item[0] === "'") {
            const lido = lerString(item, 'yml')
            if (lido === null) ok = false
            else {
              itens.push(lido)
              aspas ||= item[0] as Aspas
            }
          } else itens.push(item)
          ultimo = j
        }
        const quebra = texto.includes('\r\n') ? '\r\n' : '\n'
        const fimAbs = ls[ultimo].ini + ls[ultimo].t.length
        r.push(
          ok && ultimo >= m
            ? campo(
                ls[m].ini,
                fimAbs,
                {
                  t: 'lista',
                  aspas,
                  numerica: itens.every((x) => NUMERO.test(x)),
                  bloco: { indent: indItem, quebra }
                },
                partes,
                secao,
                itens,
                desc
              )
            : campo(inicio, inicio, { t: 'leitura' }, partes, secao, '', desc)
        )
        n = ultimo
        continue
      }
      pilha.push({ indent, chave })
      continue
    }
    if (/^[|>]/.test(resto)) {
      // Texto em bloco: só leitura; pula as linhas mais recuadas.
      let m = n + 1
      while (m < ls.length && (!ls[m].t.trim() || indentDe(ls[m].t) > indent)) m++
      r.push(campo(inicio, inicio, { t: 'leitura' }, partes, secao, resto, desc))
      n = m - 1
      continue
    }
    if (/^[&*!{]/.test(resto)) {
      r.push(campo(inicio, inicio, { t: 'leitura' }, partes, secao, resto, desc))
      continue
    }
    if (resto[0] === '[') {
      const f = resto.lastIndexOf(']')
      const itens =
        f > 0 && !/ #/.test(resto.slice(0, f)) ? itensDaLista(resto.slice(1, f), 'yml') : null
      r.push(
        itens
          ? campo(
              inicio,
              inicio + f + 1,
              { t: 'lista', aspas: itens.aspas, numerica: itens.numerica },
              partes,
              secao,
              itens.itens,
              desc
            )
          : campo(inicio, inicio, { t: 'leitura' }, partes, secao, resto, desc)
      )
      continue
    }
    if (resto[0] === '"' || resto[0] === "'") {
      const f = fimDaString(resto, 0, resto[0], resto[0] === "'")
      const lido = f > 0 ? lerString(resto.slice(0, f), 'yml') : null
      r.push(
        lido === null
          ? campo(inicio, inicio, { t: 'leitura' }, partes, secao, resto, desc)
          : campo(
              inicio,
              inicio + f,
              { t: 'str', aspas: resto[0] as Aspas },
              partes,
              secao,
              lido,
              desc
            )
      )
      continue
    }
    const plano = resto.replace(/\s+#.*$/, '').replace(/\s+$/, '')
    const fim = inicio + plano.length
    if (/^(true|false)$/i.test(plano)) {
      r.push(campo(inicio, fim, { t: 'bool' }, partes, secao, plano.toLowerCase() === 'true', desc))
    } else if (NUMERO.test(plano)) {
      r.push(
        campo(inicio, fim, { t: 'num', decimal: /[.eE]/.test(plano) }, partes, secao, plano, desc)
      )
    } else {
      r.push(campo(inicio, fim, { t: 'str', aspas: '' }, partes, secao, plano, desc))
    }
  }
  return r
}

// ---------- JSON e JSON5 ----------

function analisarJson(texto: string, formato: Formato): Trecho[] {
  const r: Trecho[] = []
  let i = 0
  let comentarios: string[] = []
  const pular = (): void => {
    for (;;) {
      while (i < texto.length && /\s/.test(texto[i])) i++
      if (texto.startsWith('//', i)) {
        const f = texto.indexOf('\n', i)
        comentarios.push(texto.slice(i + 2, f < 0 ? texto.length : f).trim())
        i = f < 0 ? texto.length : f
      } else if (texto.startsWith('/*', i)) {
        const f = texto.indexOf('*/', i + 2)
        comentarios.push(
          texto
            .slice(i + 2, f < 0 ? texto.length : f)
            .replace(/^\s*\*+/gm, '')
            .trim()
        )
        i = f < 0 ? texto.length : f + 2
      } else return
    }
  }
  const erro = (): never => {
    throw new Error('json')
  }
  const lerChave = (): string => {
    const c = texto[i]
    if (c === '"' || c === "'") {
      const f = fimDaString(texto, i, c)
      if (f < 0) erro()
      const v = lerString(texto.slice(i, f), formato)
      i = f
      return v ?? erro()
    }
    const m = texto.slice(i).match(/^[A-Za-z_$][\w$]*/)
    if (!m) erro()
    i += m![0].length
    return m![0]
  }
  const valor = (partes: string[], desc: string[]): void => {
    pular()
    const secao = partes.length > 1 ? partes.slice(0, -1).join('.') : null
    const c = texto[i]
    const inicio = i
    if (c === '{') {
      i++
      for (;;) {
        comentarios = []
        pular()
        if (texto[i] === '}') {
          i++
          return
        }
        const d = comentarios
        const k = lerChave()
        pular()
        if (texto[i] !== ':') erro()
        i++
        valor([...partes, k], d)
        pular()
        if (texto[i] === ',') i++
        else if (texto[i] !== '}') erro()
      }
    }
    if (c === '[') {
      // Lista só de valores simples vira um campo; com objetos dentro, cada um vira campos.
      const antes = r.length
      const comentAntes = comentarios.length
      i++
      let n = 0
      let simples = true
      for (;;) {
        pular()
        if (texto[i] === ']') {
          i++
          break
        }
        if (texto[i] === '{' || texto[i] === '[') simples = false
        valor([...partes.slice(0, -1), `${partes[partes.length - 1] ?? ''}[${n++}]`], [])
        pular()
        if (texto[i] === ',') i++
        else if (texto[i] !== ']') erro()
      }
      if (simples) {
        const filhos = r.splice(antes)
        const temComentario = comentarios.length > comentAntes
        const itens = filhos.map((f) => f.campo.valor)
        const ok =
          !temComentario &&
          filhos.every((f) => f.jeito.t === 'str' || f.jeito.t === 'num' || f.jeito.t === 'bool')
        const aspas =
          (filhos.find((f) => f.jeito.t === 'str')?.jeito as { aspas: Aspas })?.aspas ?? '"'
        r.push(
          ok
            ? campo(
                inicio,
                i,
                {
                  t: 'lista',
                  aspas,
                  numerica: filhos.length > 0 && filhos.every((f) => f.jeito.t === 'num')
                },
                partes,
                secao,
                itens.map(String),
                desc
              )
            : campo(inicio, inicio, { t: 'leitura' }, partes, secao, texto.slice(inicio, i), desc)
        )
      }
      return
    }
    if (c === '"' || c === "'") {
      const f = fimDaString(texto, i, c)
      if (f < 0) erro()
      const v = lerString(texto.slice(i, f), formato)
      i = f
      r.push(
        v === null
          ? campo(inicio, inicio, { t: 'leitura' }, partes, secao, '', desc)
          : campo(
              inicio,
              f,
              { t: 'str', aspas: formato === 'json' ? '"' : (c as Aspas) },
              partes,
              secao,
              v,
              desc
            )
      )
      return
    }
    const tok = texto.slice(i).match(/^[^\s,\]}/]+/)?.[0] ?? erro()
    i += tok.length
    if (tok === 'true' || tok === 'false')
      r.push(campo(inicio, i, { t: 'bool' }, partes, secao, tok === 'true', desc))
    else if (NUMERO.test(tok))
      r.push(campo(inicio, i, { t: 'num', decimal: /[.eE]/.test(tok) }, partes, secao, tok, desc))
    else r.push(campo(inicio, inicio, { t: 'leitura' }, partes, secao, tok, desc))
  }
  try {
    valor([], [])
  } catch {
    return [] // arquivo que o leitor não entende: só "Editar como texto"
  }
  return r
}

// ---------- .properties ----------

function analisarProperties(texto: string): Trecho[] {
  const r: Trecho[] = []
  let comentarios: string[] = []
  const ls = linhas(texto)
  for (let n = 0; n < ls.length; n++) {
    const { t, ini } = ls[n]
    const s = t.trimStart()
    if (!s) {
      comentarios = []
      continue
    }
    if (s.startsWith('#') || s.startsWith('!')) {
      comentarios.push(s.replace(/^[#!]+\s?/, ''))
      continue
    }
    const base = t.length - s.length
    const m = s.match(/^((?:\\.|[^=:\s])+)\s*[=:]?\s*/)
    if (!m) continue
    const chave = decodificarPropriedade(m[1])
    const v = base + m[0].length
    const bruto = t.slice(v)
    const desc = comentarios
    comentarios = []
    // Valor que continua na próxima linha (termina com "\"): só leitura.
    if (/(^|[^\\])(\\\\)*\\$/.test(bruto)) {
      while (n + 1 < ls.length && /\\$/.test(ls[n].t)) n++
      r.push(campo(ini + v, ini + v, { t: 'leitura' }, [chave], null, bruto, desc))
      continue
    }
    const valor = decodificarPropriedade(bruto)
    const jeito: Jeito = /^(true|false)$/.test(valor)
      ? { t: 'bool' }
      : NUMERO.test(valor)
        ? { t: 'num', decimal: valor.includes('.') }
        : { t: 'str', aspas: '' }
    r.push(
      campo(
        ini + v,
        ini + t.length,
        jeito,
        [chave],
        null,
        jeito.t === 'bool' ? valor === 'true' : valor,
        desc
      )
    )
  }
  return r
}

// ---------- Ler e salvar ----------

function analisar(texto: string, formato: Formato): Trecho[] {
  switch (formato) {
    case 'toml':
      return analisarToml(texto)
    case 'yml':
      return analisarYaml(texto)
    case 'properties':
      return analisarProperties(texto)
    default:
      return analisarJson(texto, formato)
  }
}

export function lerCampos(texto: string, formato: Formato): CampoConfig[] {
  return analisar(texto, formato).map((t) => t.campo)
}

function texto1(v: string, jeito: { aspas: Aspas }, formato: Formato): string {
  if (/[\r\n]/.test(v)) throw new Error('Use uma linha só (para mais, use "Editar como texto").')
  if (formato === 'properties') return codificarPropriedade(v)
  if (jeito.aspas === "'") {
    if (formato === 'yml') return `'${v.replace(/'/g, "''")}'`
    if (!v.includes("'")) return `'${v}'`
  }
  if (formato === 'yml' && jeito.aspas === '') return valorPlanoYaml(v)
  return JSON.stringify(v)
}

function numero(v: string, decimal: boolean): string {
  const s = v.trim()
  if (!NUMERO.test(s)) throw new Error(`"${v}" não é um número.`)
  // Config que espera número com vírgula (ex.: 1.0) continua com casa decimal.
  return decimal && !/[.eE]/.test(s) ? `${s}.0` : s
}

function serializar(t: Trecho, valor: unknown, formato: Formato): string {
  const j = t.jeito
  switch (j.t) {
    case 'bool':
      if (typeof valor !== 'boolean') throw new Error(`"${t.campo.chave}" precisa ser sim ou não.`)
      return String(valor)
    case 'num':
      return numero(String(valor), j.decimal)
    case 'str':
      return texto1(String(valor ?? ''), j, formato)
    case 'lista': {
      if (!Array.isArray(valor)) throw new Error(`"${t.campo.chave}" precisa ser uma lista.`)
      const itens = valor.map((x) => String(x))
      const um = (x: string): string =>
        j.numerica
          ? numero(x, false)
          : texto1(x, { aspas: j.aspas || (formato === 'yml' ? '' : '"') }, formato)
      if (j.bloco) {
        if (!itens.length)
          throw new Error(`A lista "${t.campo.chave}" precisa de pelo menos um item.`)
        return itens.map((x) => `${j.bloco!.indent}- ${um(x)}`).join(j.bloco.quebra)
      }
      return `[${itens.map(um).join(', ')}]`
    }
    case 'leitura':
      throw new Error(`"${t.campo.chave}" só pode ser mudado pelo "Editar como texto".`)
  }
}

// Troca só os valores pedidos ({ id: novo valor }). Erro se algum valor não serve.
export function aplicarMudancas(
  texto: string,
  formato: Formato,
  mudancas: Record<string, unknown>
): string {
  const trechos = new Map(analisar(texto, formato).map((t) => [t.campo.id, t]))
  const lista = Object.entries(mudancas).map(([id, valor]) => {
    const t = trechos.get(id)
    if (!t) throw new Error('O arquivo mudou desde que foi aberto. Abra de novo.')
    return { t, novo: serializar(t, valor, formato) }
  })
  let saida = texto
  for (const { t, novo } of lista.sort((a, b) => b.t.inicio - a.t.inicio)) {
    saida = saida.slice(0, t.inicio) + novo + saida.slice(t.fim)
  }
  return saida
}
