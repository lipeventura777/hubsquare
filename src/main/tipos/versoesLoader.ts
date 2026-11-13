import { compararVersoes } from '../../shared/versoes'

// Funções sem rede nem arquivos, para os módulos do Forge e do NeoForge (e para os testes).

// NeoForge "21.1.77" é do Minecraft 1.21.1, "21.0.5" do 1.21 e, nas versões por ano,
// "26.1.2.123" é do 26.1.2 e "26.3.0.102" do 26.3.
export function mcDoNeoForge(versao: string): string {
  const [a, b = '0', c = '0'] = versao.split('-')[0].split('.')
  if (Number(a) >= 26) return c === '0' ? `${a}.${b}` : `${a}.${b}.${c}`
  return b === '0' ? `1.${a}` : `1.${a}.${b}`
}

const estavel = (v: string): boolean => !v.includes('-') // "-beta" e "-alpha" ficam atrás

// Para cada versão do Minecraft, a NeoForge estável mais nova (ou a beta mais nova, se não houver).
export function escolherNeoForge(versoes: string[]): Map<string, string> {
  const mapa = new Map<string, string>()
  for (const v of versoes) {
    const mc = mcDoNeoForge(v)
    const atual = mapa.get(mc)
    const melhor =
      !atual ||
      (estavel(v) !== estavel(atual)
        ? estavel(v)
        : compararVersoes(v.split('-')[0], atual.split('-')[0]) > 0)
    if (melhor) mapa.set(mc, v)
  }
  return mapa
}

// promotions_slim.json do Forge: "26.3-recommended": "66.1.5", "26.1-latest": "62.0.9".
// Para cada versão do Minecraft, a recomendada; sem recomendada, a mais nova.
export function escolherForge(promos: Record<string, string>): Map<string, string> {
  const mapa = new Map<string, string>()
  for (const [chave, forge] of Object.entries(promos)) {
    const [, mc, tipo] = chave.match(/^(.+)-(latest|recommended)$/) ?? []
    if (mc && (tipo === 'recommended' || !mapa.has(mc))) mapa.set(mc, forge)
  }
  return mapa
}

// O run.bat do Forge/NeoForge termina em "java @user_jvm_args.txt @libraries/.../win_args.txt %*".
// Devolve só o arquivo de argumentos do loader; RAM e flags vêm do app, não do user_jvm_args.txt.
export function argsDoRunBat(texto: string): string | null {
  return texto.match(/@(libraries[\\/][^\s"]+win_args\.txt)/)?.[1] ?? null
}

// Versão de loader vinda de fora (modpack, server pack): vira parte de uma URL, então só o básico.
export function versaoLoaderValida(v: unknown): v is string {
  return typeof v === 'string' && /^[\w.+-]{1,40}$/.test(v) && !v.includes('..')
}
