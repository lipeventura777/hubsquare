// Explicação simples da causa provável de um relatório de travamento (crash-reports/*.txt).
// Testada em tests/causaTravamento.test.ts. A ordem importa: a primeira regra que bate vence.

const REGRAS: { teste: RegExp; causa: (m: RegExpMatchArray) => string }[] = [
  {
    teste: /OutOfMemoryError/,
    causa: () =>
      'O servidor ficou sem memória (RAM). Aumente a RAM em Opções ou diminua a distância de visão.'
  },
  {
    teste: /No space left on device|not enough space on the disk/i,
    causa: () => 'O disco ficou cheio. Libere espaço no PC e ligue o servidor de novo.'
  },
  {
    teste: /BindException|Address already in use|FAILED TO BIND/i,
    causa: () =>
      'A porta do servidor já estava em uso. Feche outro servidor ou programa que use a mesma porta.'
  },
  {
    teste: /UnsupportedClassVersionError/,
    causa: () =>
      'Um plugin, mod ou o próprio servidor precisa de outra versão do Java. Confira se ele é feito para esta versão do jogo.'
  },
  {
    teste: /Could not load '?plugins[\\/]([^'\s]+\.jar)/,
    causa: (m) =>
      `O plugin "${m[1]}" não carregou. Ele pode ser de outra versão do jogo; atualize ou remova o plugin.`
  },
  {
    teste: /Error occurred while enabling (\S+)/,
    causa: (m) =>
      `O plugin "${m[1]}" deu erro ao ligar. Atualize ou remova o plugin e ligue de novo.`
  },
  {
    teste:
      /Incompatible mods? found|ModResolutionException|Missing or unsupported mandatory dependencies|Mod (\S+) requires/i,
    causa: () =>
      'Há um mod incompatível ou faltando outro mod de que ele precisa. Confira as versões dos mods.'
  },
  {
    teste: /Watchdog|The server has stopped responding|single server tick took/i,
    causa: () =>
      'O servidor ficou parado tempo demais num único passo e foi fechado. Costuma ser um plugin pesado ou muita coisa no mundo ao mesmo tempo.'
  },
  {
    teste: /Exception reading .*level\.dat|Failed to load level|Couldn't load chunk|RegionFile/i,
    causa: () =>
      'O mundo parece danificado. Restaure uma cópia de segurança na tela Cópias de segurança.'
  }
]

export function causaProvavel(texto: string): string | null {
  for (const { teste, causa } of REGRAS) {
    const m = texto.match(teste)
    if (m) return causa(m)
  }
  return null
}
