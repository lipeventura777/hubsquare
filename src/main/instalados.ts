import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import {
  EXTRAS_TIPOS,
  type CategoriaInstalado,
  type InfoServidor,
  type ItemInstalado,
  type ItemRemovido,
  type ListaInstalados,
  type ResultadoRemocao
} from '../shared/tipos'
import { lerArquivoPropriedades } from './config'
import { ErroApp } from './erros'
import {
  lerEstado as lerExplorar,
  pararResourcePack,
  removerDosAmigos,
  restaurarAmigo,
  restaurarResourcePack
} from './explorar'
import { metaDoJar } from './metaJar'
import { verificarProblemas, type MetaJar, type ModAnalise } from './modsProblemas'
import { idDoMod, lerOrganizacao } from './organizacao'
import * as cf from './curseforge'
import * as hangar from './hangar'
import * as modrinth from './modrinth'
import { cancelarRemocaoMod, listarAtualizacoes, listarInstalados, removerMod, sha1 } from './mods'
import { compatibilidade } from './compatRegras'
import { ehMaisNova, urlDoModrinth } from './modsRegras'
import { dentroDe, nivelDoMundo } from './mundo'
import {
  apagarEntrada,
  cancelarAgendado,
  devolverArquivo,
  guardarDados,
  lerAgenda,
  lerEntrada,
  listarEntradas,
  removerArquivo
} from './removidos'

// Aba Instalados da tela Mods (Fase 23.2): tudo o que o servidor tem de adicional, numa lista só.
// Remover manda o arquivo para Removidos recentemente (7 dias); com o servidor ligado, espera
// ele desligar. Só mexe dentro da pasta do servidor ativo e da pasta de backups dele.

const base = {
  versao: null,
  icone: null,
  projetoId: null,
  caminho: null,
  tamanho: null,
  data: null,
  ativo: true,
  atualizacao: false,
  mundo: null,
  mundoAtivo: false,
  obrigatorio: false,
  removerAoDesligar: false,
  pendente: null,
  dependencias: [],
  removivel: true,
  idMod: '', // os que não são mods usam a própria chave (listarTudo)
  problemas: [],
  cor: null,
  nota: '',
  travado: false,
  anterior: null,
  categorias: []
} satisfies Partial<ItemInstalado>

async function tamanhoDe(caminho: string): Promise<number> {
  const s = await stat(caminho).catch(() => null)
  if (!s) return 0
  if (!s.isDirectory()) return s.size
  let total = 0
  for (const n of await readdir(caminho)) total += await tamanhoDe(join(caminho, n))
  return total
}

// ---------- Mods e plugins ----------

async function extras(
  info: InfoServidor
): Promise<{ itens: ItemInstalado[]; semInternet: boolean }> {
  const pasta = EXTRAS_TIPOS[info.tipo]
  if (!pasta) return { itens: [], semInternet: false }
  const [lista, novas] = await Promise.all([
    listarInstalados(info),
    listarAtualizacoes(info).catch(() => [])
  ])
  const comAtualizacao = new Set(novas.map((a) => a.arquivo))
  const org = await lerOrganizacao(info)
  const metas = new Map<string, MetaJar | null>()
  const itens = await Promise.all(
    lista.itens.map(async (m): Promise<ItemInstalado> => {
      const noDisco =
        m.pendente === 'instalar' ? null : `${pasta}/${m.arquivo}${m.ativo ? '' : '.disabled'}`
      const meta = noDisco ? await metaDoJar(join(info.pasta, noDisco)) : null
      metas.set(m.arquivo, meta)
      let titulo = m.titulo
      let versao = m.versao
      // A fonte que o app anotou ao instalar (Fase 24); sem ela, adivinha pelos links do .jar.
      let fonte: ItemInstalado['fonte'] = m.fonte
      if (m.fonte === 'manual' && meta) {
        titulo = meta.nome ?? titulo
        versao = meta.versao
        fonte = meta.fonte
      }
      const idMod = idDoMod(m.fonte, m.projetoId, m.arquivo)
      const nota = org.notas[idMod]
      return {
        ...base,
        chave: `extras:${m.arquivo}`,
        categoria: fonte === 'manual' ? 'outros' : 'extras',
        tipo: pasta === 'plugins' ? 'plugin' : 'mod',
        titulo,
        versao,
        icone: m.icone,
        fonte,
        projetoId: m.projetoId,
        caminho: noDisco,
        tamanho: m.tamanho,
        data: m.data,
        ativo: m.pendente === 'ativar' ? true : m.pendente === 'desativar' ? false : m.ativo,
        atualizacao: comAtualizacao.has(m.arquivo),
        removerAoDesligar: m.pendente === 'remover',
        pendente: m.pendente,
        dependencias: m.dependencias,
        idMod,
        cor: nota?.cor ?? null,
        nota: nota?.nota ?? '',
        travado: org.travados.includes(idMod),
        anterior: org.anteriores[idMod] ? (org.anteriores[idMod].versao ?? 'a anterior') : null,
        categorias: m.categorias
      }
    })
  )

  // Problemas (Fase 25): o que o .jar declara e, se é do Modrinth, o que o Modrinth diz.
  const analises: ModAnalise[] = lista.itens.map((m, i) => ({
    chave: itens[i].chave,
    titulo: itens[i].titulo,
    ativo: itens[i].ativo && m.pendente !== 'instalar' && !itens[i].removerAoDesligar,
    data: m.data,
    projetoId: m.fonte === 'modrinth' ? m.projetoId : null,
    meta: metas.get(m.arquivo) ?? null,
    modrinth:
      m.fonte === 'modrinth' && m.versaoId
        ? {
            jogos: m.jogos,
            loaders: [],
            dependencias: m.dependencias,
            incompativeis: m.incompativeis,
            soDoJogador: m.soDoJogador
          }
        : undefined
  }))
  const problemas = verificarProblemas(analises, info)
  for (const item of itens) item.problemas = problemas[item.chave] ?? []

  // Categorias do CurseForge e do Hangar, na hora (os termos do CurseForge não deixam guardar).
  const cfIds = itens
    .filter((i) => i.fonte === 'curseforge' && i.projetoId)
    .map((i) => Number(i.projetoId))
  const doCF = await cf.mods(cfIds).catch(() => new Map<number, cf.ModCF>())
  await Promise.all(
    itens.map(async (i) => {
      if (i.fonte === 'curseforge' && i.projetoId)
        i.categorias = doCF.get(Number(i.projetoId))?.categories.map((c) => c.name) ?? []
      if (i.fonte === 'hangar' && i.projetoId) {
        const p = await hangar.projeto(i.projetoId).catch(() => null)
        i.categorias = p ? [p.category] : []
      }
    })
  )
  return { itens, semInternet: lista.semInternet }
}

// ---------- Datapacks de cada mundo ----------

// Pastas com level.dat, sem o Nether e o End separados do Paper.
async function mundos(info: InfoServidor): Promise<string[]> {
  const nomes: string[] = []
  for (const n of await readdir(info.pasta)) {
    if (existsSync(join(info.pasta, n, 'level.dat'))) nomes.push(n)
  }
  return nomes.filter((n) => !nomes.some((o) => n === `${o}_nether` || n === `${o}_the_end`))
}

// "bukkit" é o datapack que o Paper cria sozinho em todo mundo.
const DO_SOFTWARE = new Set(['bukkit'])

async function datapacks(
  info: InfoServidor
): Promise<{ itens: ItemInstalado[]; semInternet: boolean }> {
  const ativo = await nivelDoMundo(info.pasta).catch(() => null)
  const agenda = new Set((await lerAgenda(info)).map((a) => a.origem))
  const achados: { mundo: string; nome: string; caminho: string; pasta: boolean }[] = []
  for (const mundo of await mundos(info)) {
    const dir = join(info.pasta, mundo, 'datapacks')
    for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const zip = e.isFile() && /\.zip$/i.test(e.name)
      if (!zip && !(e.isDirectory() && !DO_SOFTWARE.has(e.name.toLowerCase()))) continue
      achados.push({ mundo, nome: e.name, caminho: `${mundo}/datapacks/${e.name}`, pasta: !zip })
    }
  }
  const hashes = new Map<string, string>()
  for (const a of achados)
    if (!a.pasta) hashes.set(a.caminho, await sha1(join(info.pasta, a.caminho)))
  let versoes: Record<string, modrinth.Versao> = {}
  let novas: Record<string, modrinth.Versao> = {}
  let projetos = new Map<string, modrinth.Projeto>()
  let semInternet = false
  try {
    const lista = [...hashes.values()]
    versoes = await modrinth.porHash(lista)
    novas = await modrinth.atualizacoes(lista, ['datapack'], info.versao)
    projetos = await modrinth.projetos([
      ...new Set(Object.values(versoes).map((v) => v.project_id))
    ])
  } catch {
    semInternet = hashes.size > 0
  }
  const itens = await Promise.all(
    achados.map(async (a): Promise<ItemInstalado> => {
      const h = hashes.get(a.caminho)
      const v = h ? versoes[h] : undefined
      const p = v && projetos.get(v.project_id)
      const nova = h ? novas[h] : undefined
      const s = await stat(join(info.pasta, a.caminho)).catch(() => null)
      return {
        ...base,
        chave: `datapack:${a.mundo}/${a.nome}`,
        categoria: v ? 'datapack' : 'outros',
        tipo: 'datapack',
        titulo: p?.title ?? a.nome.replace(/\.zip$/i, ''),
        versao: v?.version_number ?? null,
        icone: p?.icon_url ?? null,
        fonte: v ? 'modrinth' : 'manual',
        projetoId: v?.project_id ?? null,
        caminho: a.caminho,
        tamanho: a.pasta ? await tamanhoDe(join(info.pasta, a.caminho)) : (s?.size ?? null),
        data: s?.mtime.toISOString() ?? null,
        atualizacao: !!(v && nova && ehMaisNova(nova, v)),
        mundo: a.mundo,
        mundoAtivo: a.mundo === ativo,
        removerAoDesligar: agenda.has(a.caminho),
        dependencias: (v?.dependencies ?? []).flatMap((d) =>
          d.dependency_type === 'required' && d.project_id ? [d.project_id] : []
        )
      }
    })
  )
  return { itens, semInternet }
}

// ---------- Resource pack, Pacote pros amigos e modpack ----------

async function doApp(info: InfoServidor): Promise<ItemInstalado[]> {
  const estado = await lerExplorar(info)
  const itens: ItemInstalado[] = []

  const props = await lerArquivoPropriedades(info.pasta).catch(() => new Map<string, string>())
  const url = props.get('resource-pack') ?? ''
  if (url) {
    const r = estado.resourcePack?.url === url ? estado.resourcePack : null
    let nome = url
    try {
      nome = decodeURIComponent(new URL(url).pathname.split('/').pop() || url)
    } catch {
      // link estranho: mostra como está
    }
    itens.push({
      ...base,
      chave: 'resourcepack',
      categoria: 'resourcepack',
      tipo: 'resourcepack',
      titulo: r?.titulo ?? nome,
      versao: r?.versao ?? null,
      fonte: urlDoModrinth(url) ? 'modrinth' : 'manual',
      projetoId: r?.projetoId ?? null,
      data: r?.instalado ?? null,
      obrigatorio: props.get('require-resource-pack') === 'true'
    })
  }

  for (const a of estado.amigos) {
    itens.push({
      ...base,
      chave: `amigos:${a.projetoId}`,
      categoria: 'amigos',
      tipo: a.tipo,
      titulo: a.titulo,
      versao: a.versao ?? null,
      fonte: 'modrinth',
      projetoId: a.projetoId,
      tamanho: a.tamanho,
      data: a.instalado ?? null
    })
  }

  if (info.modpack) {
    const copia = await stat(join(info.pasta, 'servsquare-modpack.mrpack')).catch(() => null)
    itens.push({
      ...base,
      chave: 'modpack',
      categoria: 'modpack',
      tipo: 'modpack',
      titulo: info.modpack.nome,
      versao: info.modpack.versao,
      fonte: info.modpack.projetoId ? 'modrinth' : 'manual',
      projetoId: info.modpack.projetoId,
      tamanho: copia?.size ?? null,
      data: copia?.mtime.toISOString() ?? null,
      removivel: false
    })
  }
  return itens
}

export async function listarTudo(info: InfoServidor): Promise<ListaInstalados> {
  const [e, d, outros] = await Promise.all([extras(info), datapacks(info), doApp(info)])
  const itens = [...e.itens, ...d.itens, ...outros]
  for (const i of itens) i.idMod ||= i.chave
  let semInternet = e.semInternet || d.semInternet
  // Ícones do que veio do Explorar (o Pacote pros amigos guarda só o id).
  const semIcone = itens.filter((i) => i.projetoId && !i.icone)
  if (semIcone.length) {
    try {
      const p = await modrinth.projetos([...new Set(semIcone.map((i) => i.projetoId!))])
      for (const i of semIcone) i.icone = p.get(i.projetoId!)?.icon_url ?? null
    } catch {
      semInternet = true
    }
  }
  if (info.jogador) await marcarNoJogo(info, itens)
  return { itens, semInternet }
}

// PlaySquare (Fase P3): separa o que veio do servidor do que é "meu", põe a explicação de
// compatibilidade em cada item e mostra os resource packs e shaders que o servidor mandou.
async function marcarNoJogo(info: InfoServidor, itens: ItemInstalado[]): Promise<void> {
  const j = info.jogador!
  const doServidor = new Set(j.doServidor)
  const obrigatorios = new Set(j.obrigatorios)
  const mods = existsSync(join(info.pasta, 'mods')) ? await readdir(join(info.pasta, 'mods')) : []
  const temModDeShader = mods.some((n) => /^(iris|oculus)/i.test(n) && n.endsWith('.jar'))
  const metas = await listarInstalados(info).catch(() => null)

  // Packs e shaders que o servidor mandou (os "meus" já estão na lista, pelo Explorar).
  for (const caminho of j.doServidor) {
    const [pasta, nome] = caminho.split('/')
    if ((pasta !== 'resourcepacks' && pasta !== 'shaderpacks') || !nome) continue
    if (itens.some((i) => i.caminho === caminho)) continue
    const tam = await stat(join(info.pasta, caminho)).catch(() => null)
    itens.push({
      ...base,
      chave: `servidor:${caminho}`,
      categoria: 'amigos',
      tipo: pasta === 'shaderpacks' ? 'shader' : 'resourcepack',
      titulo: nome.replace(/\.zip$/i, ''),
      fonte: 'manual',
      caminho,
      tamanho: tam?.size ?? null,
      data: tam?.mtime.toISOString() ?? null,
      idMod: `servidor:${caminho}`
    })
  }

  for (const i of itens) {
    const caminho = i.caminho?.replace(/\.disabled$/, '') ?? null
    const meu = i.categoria === 'amigos' && i.projetoId && !i.chave.startsWith('servidor:')
    i.doServidor = !!caminho && doServidor.has(caminho) && !meu
    if (i.doServidor && obrigatorios.has(caminho!)) i.removivel = false
    const m = metas?.itens.find((x) => `mods/${x.arquivo}` === caminho)
    const ambiente =
      i.tipo !== 'mod'
        ? null
        : m?.soDoJogador
          ? 'jogador'
          : m?.fonte === 'modrinth'
            ? 'ambos'
            : null
    i.compat = compatibilidade({
      tipo: i.tipo,
      ambiente,
      loader: info.tipo,
      versao: info.versao,
      temVersao: true,
      jogador: j,
      noServidor: i.doServidor,
      nomes: [caminho?.split('/').pop() ?? '', i.titulo],
      temModDeShader
    })
  }
}

// ---------- Remover e desfazer ----------

type Feito =
  | { tipo: 'mod'; arquivo: string }
  | { tipo: 'arquivo'; origem: string }
  | { tipo: 'dados'; id: string }

const lotes = new Map<string, { inicio: string; pasta: string; feitos: Feito[] }>()

const NOME = /^[^\\/:*?"<>|]{1,200}$/

// Datapack de um mundo deste servidor, conferido parte por parte.
function caminhoDatapack(info: InfoServidor, resto: string): string {
  const [mundo, nome, ...sobra] = resto.split('/')
  const caminho = `${mundo}/datapacks/${nome}`
  if (
    !sobra.length &&
    NOME.test(mundo ?? '') &&
    NOME.test(nome ?? '') &&
    ![mundo, nome].some((p) => p === '.' || p === '..') &&
    existsSync(join(info.pasta, mundo, 'level.dat')) &&
    existsSync(join(info.pasta, caminho)) &&
    dentroDe(info.pasta, join(info.pasta, caminho))
  )
    return caminho
  throw new ErroApp('Não encontrei esse datapack. Atualize a lista.')
}

// A tela confirma antes de chamar (e já incluiu os dependentes, se o usuário quis).
export async function removerInstalados(
  info: InfoServidor,
  pedidos: unknown
): Promise<ResultadoRemocao> {
  const lista = Array.isArray(pedidos) ? pedidos.slice(0, 200) : []
  if (!lista.length) throw new ErroApp('Escolha pelo menos um item para remover.')
  const inicio = new Date().toISOString()
  const feitos: Feito[] = []
  let agendados = 0
  for (const p of lista) {
    const chave = typeof p?.chave === 'string' ? p.chave : ''
    const titulo = typeof p?.titulo === 'string' ? p.titulo.slice(0, 120) : chave
    const [tipo, ...partes] = chave.split(':')
    const resto = partes.join(':')
    if (info.jogador) {
      const caminho = tipo === 'extras' ? `${EXTRAS_TIPOS[info.tipo]}/${resto}` : resto
      if (tipo === 'servidor' || info.jogador.obrigatorios.includes(caminho)) {
        throw new ErroApp(
          `"${titulo}" veio do servidor e é obrigatório para entrar nele. Não dá para tirar por aqui.`
        )
      }
    }
    if (tipo === 'extras') {
      if (await removerMod(info, resto, titulo)) agendados++
      feitos.push({ tipo: 'mod', arquivo: resto })
    } else if (tipo === 'datapack') {
      const origem = caminhoDatapack(info, resto)
      const categoria: CategoriaInstalado = p?.categoria === 'outros' ? 'outros' : 'datapack'
      if (await removerArquivo(info, origem, { titulo, categoria })) agendados++
      feitos.push({ tipo: 'arquivo', origem })
    } else if (chave === 'resourcepack') {
      const anterior = await pararResourcePack(info)
      const id = await guardarDados(info, { titulo, categoria: 'resourcepack' }, anterior)
      feitos.push({ tipo: 'dados', id })
    } else if (tipo === 'amigos') {
      const saiu = await removerDosAmigos(info, resto)
      if (saiu) {
        const id = await guardarDados(info, { titulo, categoria: 'amigos' }, saiu)
        feitos.push({ tipo: 'dados', id })
      }
    } else {
      throw new ErroApp('Esse item não pode ser removido por aqui.')
    }
  }
  const lote = randomUUID()
  lotes.set(lote, { inicio, pasta: info.pasta, feitos })
  return { lote, removidos: feitos.length - agendados, agendados }
}

// Desfaz um lote: cancela o que ainda espera o servidor desligar e devolve o resto.
export async function desfazerRemocao(info: InfoServidor, lote: unknown): Promise<void> {
  const l = typeof lote === 'string' ? lotes.get(lote) : undefined
  if (!l || l.pasta !== info.pasta) {
    throw new ErroApp('Não dá mais para desfazer por aqui. Use Removidos recentemente.')
  }
  const entradas = (await listarEntradas(info)).filter((e) => e.quando >= l.inicio)
  const pasta = EXTRAS_TIPOS[info.tipo] ?? 'mods'
  for (const f of l.feitos) {
    if (f.tipo === 'dados') {
      await restaurarRemovido(info, f.id)
      continue
    }
    const cancelou =
      f.tipo === 'mod'
        ? await cancelarRemocaoMod(info, f.arquivo)
        : await cancelarAgendado(info, f.origem)
    if (cancelou) continue
    const origens =
      f.tipo === 'mod' ? [`${pasta}/${f.arquivo}`, `${pasta}/${f.arquivo}.disabled`] : [f.origem]
    const e = entradas.find((x) => x.origem && origens.includes(x.origem))
    if (e) await restaurarRemovido(info, e.id)
  }
  lotes.delete(lote as string)
}

export async function listarRemovidos(info: InfoServidor): Promise<ItemRemovido[]> {
  return (await listarEntradas(info)).map(({ id, titulo, categoria, quando }) => ({
    id,
    titulo,
    categoria,
    quando
  }))
}

export async function restaurarRemovido(info: InfoServidor, id: unknown): Promise<void> {
  const e = await lerEntrada(info, id)
  if (e.origem) await devolverArquivo(info, e)
  else if (e.categoria === 'resourcepack') await restaurarResourcePack(info, e.dados)
  else if (e.categoria === 'amigos') await restaurarAmigo(info, e.dados)
  await apagarEntrada(info, e.id)
}
