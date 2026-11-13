// Regras da tela Mods sem rede nem arquivos (testadas em tests/modsRegras.test.ts).

const SO_DO_JOGADOR = new Set(['client_only', 'singleplayer_only'])

// "Só do jogador": o Modrinth diz que o projeto não roda num servidor dedicado.
// Usa o campo novo (environment) e, sem ele, o antigo (server_side).
export function soDoJogador(environment?: string[] | null, serverSide?: string): boolean {
  if (environment?.length) return environment.every((e) => SO_DO_JOGADOR.has(e))
  return serverSide === 'unsupported'
}

interface VersaoBasica {
  id: string
  version_type: string
  status?: string
  date_published: string
}

// A versão compatível mais nova, preferindo as "release" às beta/alpha.
export function escolherVersao<V extends VersaoBasica>(versoes: V[]): V | undefined {
  const listadas = versoes
    .filter((v) => !v.status || v.status === 'listed')
    .sort((a, b) => Date.parse(b.date_published) - Date.parse(a.date_published))
  return listadas.find((v) => v.version_type === 'release') ?? listadas[0]
}

// Só oferece atualização para uma versão diferente e publicada depois da atual.
export function ehMaisNova(nova: VersaoBasica, atual: VersaoBasica): boolean {
  return nova.id !== atual.id && Date.parse(nova.date_published) > Date.parse(atual.date_published)
}

// Nome de arquivo que pode ir para a pasta mods/plugins: só o nome, terminando em .jar
// (ou na extensão pedida, ex.: .zip dos datapacks).
export function nomeSeguro(nome: unknown, extensao = /\.jar$/i): nome is string {
  return (
    typeof nome === 'string' &&
    nome.length <= 200 &&
    // eslint-disable-next-line no-control-regex -- recusa caracteres de controle no nome
    /^[^\\/:*?"<>|\x00-\x1f]+$/.test(nome) &&
    extensao.test(nome) &&
    !nome.startsWith('.')
  )
}

// Downloads só do CDN oficial do Modrinth.
export function urlDoModrinth(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'cdn.modrinth.com'
  } catch {
    return false
  }
}
