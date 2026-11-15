import {
  NOMES_TIPOS,
  type Ambiente,
  type Compat,
  type ContextoJogador,
  type TipoConteudo,
  type TipoId
} from '../shared/tipos'
import { t } from '../shared/i18n'

// Explicação de compatibilidade no jogo do jogador (Fase P3): uma frase curta dizendo se vai
// funcionar e por quê. Sem rede nem arquivos (testada em tests/compatRegras.test.ts).

export interface EntradaCompat {
  tipo: TipoConteudo
  ambiente: Ambiente | null
  loader: TipoId // da instalação: vanilla, fabric, forge ou neoforge
  versao: string // Minecraft da instalação
  temVersao: boolean // o projeto tem versão para esse loader e esse Minecraft
  jogador: ContextoJogador
  noServidor: boolean // o mesmo arquivo veio do servidor
  nomes: string[] // nome do arquivo e título, para conferir a lista de proibidos
  temModDeShader: boolean // Iris ou Oculus já está na instalação
}

const deMods = (l: TipoId): boolean => l === 'fabric' || l === 'forge' || l === 'neoforge'

// Iris no Fabric e no NeoForge; Oculus (porte do Iris) no Forge.
export function modDeShader(loader: TipoId): { id: string; nome: string } | null {
  if (loader === 'fabric' || loader === 'neoforge')
    return { id: 'iris', nome: t('p.compatRegras.iris') }
  if (loader === 'forge') return { id: 'oculus', nome: t('p.compatRegras.oculus') }
  return null
}

export function proibido(nomes: string[], proibidos: string[]): boolean {
  return nomes.some((n) => proibidos.some((p) => p && n.toLowerCase().includes(p)))
}

export function compatibilidade(e: EntradaCompat): Compat {
  const alvo = `${NOMES_TIPOS[e.loader]} ${e.versao}`
  const nao = (frase: string, aviso: Compat['aviso'], bloqueia = false): Compat => ({
    vai: false,
    frase: t('p.compatRegras.naoVaiFuncionar', { frase }),
    aviso,
    bloqueia
  })
  const sim = (frase: string, aviso: Compat['aviso'] = null): Compat => ({
    vai: true,
    frase: t('p.compatRegras.vaiFuncionar', { frase }),
    aviso,
    bloqueia: false
  })
  const servidor = e.jogador.servidor

  if (e.noServidor)
    return sim(t('p.compatRegras.veioDoServidor', { v: servidor ?? '' }).trim() + '.')
  if (e.tipo === 'mod' && !deMods(e.loader)) {
    return nao(t('p.compatRegras.modsPrecisamDeFabricForge'), 'loader', true)
  }
  if (e.tipo === 'shader' && !modDeShader(e.loader)) {
    return nao(t('p.compatRegras.shadersPrecisamDoIrisOu'), 'loader', true)
  }
  if (e.tipo === 'plugin' || e.tipo === 'datapack') {
    return nao(
      e.tipo === 'plugin'
        ? t('p.compatRegras.pluginsRodamSoEmServidores')
        : t('p.compatRegras.datapacksFicamDentroDeCada'),
      'loader',
      true
    )
  }
  if (!e.temVersao) return nao(t('p.compatRegras.naoTemVersaoPara', { alvo }), 'versao', true)
  if (servidor && proibido(e.nomes, e.jogador.proibidos)) {
    return nao(t('p.compatRegras.oServidorProibiuEsteMod', { servidor }), 'proibido')
  }
  if (e.tipo === 'mod' && e.ambiente === 'servidor') {
    return nao(t('p.compatRegras.esteModRodaSoNo'), 'soServidor')
  }
  // Só quando a fonte diz que roda dos dois lados (mod à mão, sem essa informação, não avisa).
  if (e.tipo === 'mod' && servidor && e.ambiente === 'ambos') {
    return nao(t('p.compatRegras.esteModPrecisaEstarTambem', { servidor }), 'precisaServidor')
  }
  if (e.tipo === 'shader') {
    const mod = modDeShader(e.loader)!
    return sim(
      e.temModDeShader
        ? t('p.compatRegras.usaOQueJaEsta', { nome: mod.nome })
        : t('p.compatRegras.esteShaderPrecisaDoQue', { nome: mod.nome }),
      'shader'
    )
  }
  if (e.tipo === 'resourcepack')
    return sim(t('p.compatRegras.compativelComOMinecraft', { versao: e.versao }))
  return sim(t('p.compatRegras.compativelCom', { alvo }))
}

// options.txt: liga os resource packs do servidor por cima dos do jogador, na ordem do servidor
// (o primeiro da lista do servidor fica por cima). Só a linha resourcePacks muda.
export function ativarPacks(optionsTxt: string, packs: string[]): string {
  const servidor = packs.map((p) => `file/${p}`)
  const linhas = optionsTxt ? optionsTxt.split(/\r?\n/) : []
  const i = linhas.findIndex((l) => l.startsWith('resourcePacks:'))
  let atuais: string[] = ['vanilla']
  if (i >= 0) {
    try {
      const lido = JSON.parse(linhas[i].slice('resourcePacks:'.length))
      if (Array.isArray(lido)) atuais = lido.filter((x): x is string => typeof x === 'string')
    } catch {
      // linha estranha: começa do padrão
    }
  }
  // No jogo, o último da lista fica por cima.
  const doJogador = atuais.filter((p) => !servidor.includes(p))
  const nova = `resourcePacks:${JSON.stringify([...doJogador, ...[...servidor].reverse()])}`
  if (i >= 0) linhas[i] = nova
  else {
    if (linhas.length && linhas[linhas.length - 1] === '') linhas.pop()
    linhas.push(nova, '')
  }
  return linhas.join('\n')
}
