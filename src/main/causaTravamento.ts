import { t } from '../shared/i18n'
// Explicação simples da causa provável de um relatório de travamento (crash-reports/*.txt).
// Testada em tests/causaTravamento.test.ts. A ordem importa: a primeira regra que bate vence.

const REGRAS: { teste: RegExp; causa: (m: RegExpMatchArray) => string }[] = [
  {
    teste: /OutOfMemoryError/,
    causa: () => t('p.causaTravamento.oServidorFicouSemMemoria')
  },
  {
    teste: /No space left on device|not enough space on the disk/i,
    causa: () => t('p.causaTravamento.oDiscoFicouCheioLibere')
  },
  {
    teste: /BindException|Address already in use|FAILED TO BIND/i,
    causa: () => t('p.causaTravamento.aPortaDoServidorJa')
  },
  {
    teste: /UnsupportedClassVersionError/,
    causa: () => t('p.causaTravamento.umPluginModOuO')
  },
  {
    teste: /Could not load '?plugins[\\/]([^'\s]+\.jar)/,
    causa: (m) => t('p.causaTravamento.oPluginNaoCarregouEle', { v: m[1] })
  },
  {
    teste: /Error occurred while enabling (\S+)/,
    causa: (m) => t('p.causaTravamento.oPluginDeuErroAo', { v: m[1] })
  },
  {
    teste:
      /Incompatible mods? found|ModResolutionException|Missing or unsupported mandatory dependencies|Mod (\S+) requires/i,
    causa: () => t('p.causaTravamento.haUmModIncompativelOu')
  },
  {
    teste: /Watchdog|The server has stopped responding|single server tick took/i,
    causa: () => t('p.causaTravamento.oServidorFicouParadoTempo')
  },
  {
    teste: /Exception reading .*level\.dat|Failed to load level|Couldn't load chunk|RegionFile/i,
    causa: () => t('p.causaTravamento.oMundoPareceDanificadoRestaure')
  }
]

export function causaProvavel(texto: string): string | null {
  for (const { teste, causa } of REGRAS) {
    const m = texto.match(teste)
    if (m) return causa(m)
  }
  return null
}
