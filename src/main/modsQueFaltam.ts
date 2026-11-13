import { shell } from 'electron'
import { randomUUID } from 'crypto'
import { rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { downloadPermitido } from '../shared/fontes'
import type { ArquivoManual, InfoServidor, ModFaltando } from '../shared/tipos'
import { modsFaltando } from './consertoRegras'
import { registrarPendencias } from './downloadsManuais'
import { ErroApp } from './erros'
import * as modrinth from './modrinth'
import { metaDoJar } from './metaJar'
import { escolherVersao } from './modsRegras'
import { baixar } from './rede'
import { eventos, servidorAtual } from './servidor'

// O servidor não ligou porque faltam mods e o app não achou no modpack: cada mod é procurado no
// Modrinth (o id do erro costuma ser o slug do projeto), para o Minecraft e o loader do servidor.
// Achado, vira um download do assistente da Fase D: o usuário abre a página, baixa, e o app
// reconhece o arquivo na pasta Downloads PELO HASH e o põe na pasta mods do servidor.
// A tela Jogar mostra o que faltou (fica só na memória, até o servidor ligar).

const ultimos = new Map<string, { quando: string; mods: ModFaltando[] }>()

export function faltandoDo(servidorId: string): { quando: string; mods: ModFaltando[] } | null {
  return ultimos.get(servidorId) ?? null
}

const ID = /^[a-z0-9_.-]{1,64}$/

const MAX_CONFERIR = 100 * 1024 * 1024

// O slug não basta: o mod "athena" do Fabric é o projeto "athena-ctm", e o slug "athena" é um
// plugin do Paper. Candidatos: o projeto com o slug igual ao id e os primeiros da busca; o arquivo
// de cada um é baixado numa pasta temporária (CDN oficial, hash conferido) só para ler o id de
// dentro do .jar, e apagado. Só vira link o que tem o id certo.
async function candidatos(info: InfoServidor, id: string): Promise<string[]> {
  const ids: string[] = []
  const direto = await modrinth.projeto(id).catch(() => null)
  if (direto?.project_type === 'mod') ids.push(direto.id)
  const facets = [[`categories:${info.tipo}`], [`versions:${info.versao}`], ['project_type:mod']]
  const busca = await modrinth.buscar(id, facets, 0, 5).catch(() => null)
  for (const h of busca?.hits ?? []) if (!ids.includes(h.project_id)) ids.push(h.project_id)
  return ids.slice(0, 4)
}

async function temOId(url: string, sha1: string, id: string): Promise<boolean> {
  if (!downloadPermitido(url, 'modrinth')) return false
  const temp = join(tmpdir(), `hubsquare-conferir-${randomUUID()}.jar`)
  try {
    await baixar(url, temp, { algoritmo: 'sha1', valor: sha1 }, 'Conferindo o mod', () => {})
    return !!(await metaDoJar(temp))?.ids.some((x) => x.toLowerCase() === id)
  } finally {
    await rm(temp, { force: true })
  }
}

async function noModrinth(info: InfoServidor, id: string): Promise<ArquivoManual | null> {
  for (const pid of await candidatos(info, id)) {
    const v = escolherVersao(await modrinth.versoes(pid, [info.tipo], info.versao).catch(() => []))
    const f = v && (v.files.find((x) => x.primary) ?? v.files[0])
    if (!v || !f || f.size > MAX_CONFERIR) continue
    if (!(await temOId(f.url, f.hashes.sha1, id).catch(() => false))) continue
    const p = await modrinth.projeto(pid)
    return arquivoManual(p, v, f)
  }
  return null
}

function arquivoManual(
  p: modrinth.ProjetoCompleto,
  v: modrinth.Versao,
  f: modrinth.ArquivoVersao
): ArquivoManual {
  return {
    titulo: p.title,
    url: `https://modrinth.com/mod/${p.slug}/version/${v.id}`,
    arquivo: f.filename,
    tamanho: f.size,
    sha1: f.hashes.sha1,
    icone: p.icon_url,
    projetoId: p.id,
    versaoId: v.id,
    versao: v.version_number,
    fonte: 'modrinth'
  }
}

eventos.on('naoLigou', ({ info, linhas }) => {
  const faltando = modsFaltando(linhas).filter((f) => ID.test(f.id))
  if (!faltando.length) return void ultimos.delete(info.id)
  void (async () => {
    const mods: ModFaltando[] = []
    const manuais: ArquivoManual[] = []
    for (const f of faltando) {
      const m = await noModrinth(info, f.id).catch(() => null)
      if (m) manuais.push(m)
      mods.push({ ...f, titulo: m?.titulo ?? null, arquivo: m?.arquivo ?? null })
    }
    ultimos.set(info.id, { quando: new Date().toISOString(), mods })
    // Mesmo vazio, avisa a tela (downloads:mudou), e a tela Jogar lê o status de novo.
    await registrarPendencias(info, manuais)
  })().catch(() => {})
})

eventos.on('estado', (e) => {
  if (e !== 'ligado') return
  void servidorAtual()
    .then((info) => info && ultimos.delete(info.id))
    .catch(() => {})
})

// Mod que o app não achou no Modrinth: abre a busca do Modrinth com o id.
export async function buscarModFaltando(id: unknown): Promise<void> {
  if (typeof id !== 'string' || !ID.test(id)) throw new ErroApp('Mod inválido.')
  await shell.openExternal(`https://modrinth.com/mods?q=${encodeURIComponent(id)}`)
}
