// Lê o console de um servidor que fechou enquanto ligava e diz o que dá para consertar sozinho.

// Java que o servidor precisa. Fabric: segue só a linha "Fix:" (a solução que ele calculou
// para todos os mods juntos), ex.: "replace [[java 25] -> add:java 21 ...]". Uma mensagem solta
// ("requires version 25 or later of java") pode ser de um pedaço opcional de um mod: o C2ME pede
// Java 25 num módulo que o Fabric deixa de lado, e o Cobblemon exige exatamente o 21.
// Qualquer loader: "class file version 69.0" (69 - 44 = Java 25).
export function javaExigido(linhas: string[]): number | null {
  let n = 0
  for (const l of linhas) {
    const f = /Fix:.*\[java \d+\] -> add:java (\d+)/.exec(l)
    if (f) return Number(f[1])
    const c = /class file version (\d+)\.\d+/.exec(l)
    if (c) n = Math.max(n, Number(c[1]) - 44)
  }
  return n || null
}

const NAO_SAO_MODS = new Set(['java', 'minecraft', 'fabricloader', 'forge', 'neoforge'])

export interface Faltando {
  id: string
  pedidoPor: string // nome do mod que precisa dele
  exige: string | null // versão pedida, como o loader escreveu (ex.: "4.0.2 or later")
}

// Mods que faltam. Fabric: "Mod 'CobbleFurnies' (cobblefurnies) 1.2 requires version 4.0.2 or
// later of athena, which is missing!". Forge/NeoForge: "Mod ID: 'athena', Requested by:
// 'cobblefurnies', Expected range: '[4.0.2,)', Actual version: '[MISSING]'".
export function modsFaltando(linhas: string[]): Faltando[] {
  const achados = new Map<string, Faltando>()
  for (const l of linhas) {
    const f =
      /Mod '([^']+)' \([^)]*\) \S+ requires (?:version (.+?)|any version) of ([a-z0-9_.-]+), which is missing!/i.exec(
        l
      )
    const m = f
      ? { id: f[3], pedidoPor: f[1], exige: f[2] ?? null }
      : (() => {
          const g =
            /Mod ID: '([a-z0-9_.-]+)', Requested by: '([^']+)', Expected range: '([^']*)'.*\[MISSING\]/i.exec(
              l
            )
          return g ? { id: g[1], pedidoPor: g[2], exige: g[3] || null } : null
        })()
    if (!m) continue
    const id = m.id.toLowerCase()
    if (!NAO_SAO_MODS.has(id) && !achados.has(id)) achados.set(id, { ...m, id })
  }
  return [...achados.values()]
}

// Nome do arquivo parece ser do mod? (ex.: "athena-fabric-1.21.1-4.0.6.jar" e "athena").
// Só um palpite para escolher o que baixar: o id de dentro do .jar confirma depois.
export function arquivoPareceDoMod(arquivo: string, id: string): boolean {
  const limpar = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const nome = limpar(arquivo.split('/').pop() ?? '')
  return limpar(id).length >= 3 && nome.startsWith(limpar(id))
}
