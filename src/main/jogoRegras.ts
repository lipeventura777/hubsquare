// Regras sem rede nem Electron da tela Jogar (Fase P4): o "ping" que a lista de Multijogador do
// jogo usa (Server List Ping) e a divisão da memória entre o servidor e o jogo no mesmo PC.
// Testadas em tests/jogoRegras.test.ts.

export function varint(n: number): Buffer {
  const bytes: number[] = []
  let v = n >>> 0
  do {
    let b = v & 0x7f
    v >>>= 7
    if (v) b |= 0x80
    bytes.push(b)
  } while (v)
  return Buffer.from(bytes)
}

// Lê um VarInt a partir de `pos`. null: ainda faltam bytes.
export function lerVarint(b: Buffer, pos = 0): { valor: number; fim: number } | null {
  let valor = 0
  for (let i = 0; i < 5; i++) {
    if (pos + i >= b.length) return null
    const byte = b[pos + i]
    valor |= (byte & 0x7f) << (7 * i)
    if (!(byte & 0x80)) return { valor: valor >>> 0, fim: pos + i + 1 }
  }
  throw new Error('VarInt grande demais')
}

function pacote(id: number, corpo: Buffer): Buffer {
  const dados = Buffer.concat([varint(id), corpo])
  return Buffer.concat([varint(dados.length), dados])
}

// "host:porta" (porta padrão 25565). null: endereço inválido.
export function separarEndereco(e: string): { host: string; porta: number } | null {
  const m = e.trim().match(/^([a-z0-9.-]+)(?::(\d{1,5}))?$/i)
  if (!m) return null
  const porta = m[2] ? Number(m[2]) : 25565
  return porta >= 1 && porta <= 65535 ? { host: m[1], porta } : null
}

// Handshake (estado "status") + pedido de status.
export function pedidoDeStatus(host: string, porta: number): Buffer {
  const h = Buffer.from(host, 'utf8')
  const p = Buffer.alloc(2)
  p.writeUInt16BE(porta)
  const handshake = pacote(0, Buffer.concat([varint(767), varint(h.length), h, p, varint(1)]))
  return Buffer.concat([handshake, pacote(0, Buffer.alloc(0))])
}

export interface StatusLido {
  online: number
  max: number
  amostra: { nome: string; uuid: string }[]
}

// Resposta do status, quando chegou inteira. null: ainda faltam bytes.
export function lerRespostaDeStatus(b: Buffer): StatusLido | null {
  const tamanho = lerVarint(b, 0)
  if (!tamanho || b.length < tamanho.fim + tamanho.valor) return null
  const id = lerVarint(b, tamanho.fim)
  if (!id || id.valor !== 0) throw new Error('resposta estranha')
  const comprimento = lerVarint(b, id.fim)
  if (!comprimento) return null
  const json = JSON.parse(
    b.toString('utf8', comprimento.fim, comprimento.fim + comprimento.valor)
  ) as { players?: { online?: number; max?: number; sample?: { name?: string; id?: string }[] } }
  const p = json.players ?? {}
  return {
    online: Number.isFinite(p.online) ? p.online! : 0,
    max: Number.isFinite(p.max) ? p.max! : 0,
    amostra: (Array.isArray(p.sample) ? p.sample : [])
      .filter((s) => typeof s.name === 'string' && typeof s.id === 'string')
      // Servidores com "anonimizar jogadores" mandam nomes falsos com UUID zerado.
      .filter((s) => !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(s.id!))
      .slice(0, 12)
      .map((s) => ({ nome: s.name!.slice(0, 16), uuid: s.id! }))
  }
}

// Memória do jogo quando o servidor roda no mesmo PC: o que sobra deixando 2 GB para o Windows.
export function dividirMemoria(
  totalGb: number,
  servidorGb: number | null,
  jogoGb: number
): { disponivel: number; cabe: boolean } {
  const disponivel = Math.max(1, totalGb - 2 - (servidorGb ?? 0))
  return { disponivel, cabe: jogoGb <= disponivel }
}

// Tempo de sessão em texto curto: "45 s", "12 min", "1 h 05 min".
export function duracao(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} s`
  const min = Math.floor(s / 60)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
}

// Fase V3: mods que a instalação vai ter (para a memória sugerida): os .jar ativos da pasta mais
// os esperados (do servidor ou do convite) que ainda não chegaram. Desligados não contam.
export function contarModsDaInstalacao(naPasta: string[], esperados: string[]): number {
  const nome = (p: string): string => p.split(/[\\/]/).pop()!.toLowerCase()
  const mods = new Set(naPasta.filter((n) => /\.jar$/i.test(n)).map(nome))
  for (const e of esperados) if (/\.jar$/i.test(e)) mods.add(nome(e))
  return mods.size
}
