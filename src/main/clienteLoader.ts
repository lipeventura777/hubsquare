import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { mkdir, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { LoaderCliente } from '../shared/tipos'
import { ErroApp } from './erros'
import { garantirJava } from './java'
import { fotografarPerfis, MINECRAFT, exigirPerfis, restaurarPerfis } from './launcherOficial'
import { javaDaVersao } from './mojang'
import { baixar, buscarBytes, buscarJson, type AoProgredir } from './rede'
import { maisNovaEstavel } from './tipos/fabric'
import { versoesForge } from './tipos/forge'
import { versoesNeoForge } from './tipos/neoforge'

// Loaders em modo cliente para o launcher oficial (Fase P1), só de fontes oficiais. O resultado
// fica em .minecraft/versions e libraries (onde o launcher procura). O jogo em si o launcher baixa.

const FABRIC = 'https://meta.fabricmc.net/v2'
const FORGE = 'https://maven.minecraftforge.net/net/minecraftforge/forge'
const NEOFORGE = 'https://maven.neoforged.net/releases/net/neoforged/neoforge'

const idSeguro = (id: string): boolean => /^[\w.+-]{1,80}$/.test(id) && !id.includes('..')
const temVersao = (id: string): boolean =>
  existsSync(join(MINECRAFT(), 'versions', id, `${id}.json`))

export async function versaoDoLoader(
  loader: LoaderCliente,
  versao: string,
  fixa: string | null
): Promise<string | null> {
  if (loader === 'vanilla') return null
  if (fixa) return fixa
  if (loader === 'fabric') return maisNovaEstavel('loader')
  const mapa = loader === 'forge' ? await versoesForge() : await versoesNeoForge()
  const numero = mapa.get(versao)
  if (!numero) {
    throw new ErroApp(
      `O ${loader === 'forge' ? 'Forge' : 'NeoForge'} ainda não tem o Minecraft ${versao}. Escolha outra versão.`
    )
  }
  return numero
}

// Deixa a versão pronta no launcher e devolve o id dela (o "lastVersionId" do perfil).
export async function garantirVersaoCliente(
  loader: LoaderCliente,
  versao: string,
  versaoLoader: string | null,
  aoProgredir: AoProgredir
): Promise<string> {
  if (loader === 'vanilla') return versao
  const numero = (await versaoDoLoader(loader, versao, versaoLoader))!

  if (loader === 'fabric') {
    const id = `fabric-loader-${numero}-${versao}`
    if (!idSeguro(id)) throw new ErroApp('Versão do Fabric inválida.')
    if (temVersao(id)) return id
    aoProgredir({ etapa: `Preparando o Fabric ${numero}`, recebido: 0, total: 0 })
    // Perfil oficial do Fabric para o launcher; ele baixa as bibliotecas sozinho ao abrir.
    const perfil = await buscarJson<{ id: string }>(
      `${FABRIC}/versions/loader/${encodeURIComponent(versao)}/${encodeURIComponent(numero)}/profile/json`
    )
    if (perfil.id !== id) throw new ErroApp('O Fabric respondeu uma versão diferente da pedida.')
    const pasta = join(MINECRAFT(), 'versions', id)
    await mkdir(pasta, { recursive: true })
    await writeFile(join(pasta, `${id}.json`), JSON.stringify(perfil, null, 2))
    // O instalador oficial do Fabric também cria esse .jar vazio; o launcher espera achar um.
    await writeFile(join(pasta, `${id}.jar`), '')
    return id
  }

  const nome = loader === 'forge' ? 'Forge' : 'NeoForge'
  const id = loader === 'forge' ? `${versao}-forge-${numero}` : `neoforge-${numero}`
  if (!idSeguro(id)) throw new ErroApp(`Versão do ${nome} inválida.`)
  if (temVersao(id)) return id
  exigirPerfis() // o instalador do Forge/NeoForge recusa uma pasta sem launcher_profiles.json

  const url =
    loader === 'forge'
      ? `${FORGE}/${versao}-${numero}/forge-${versao}-${numero}-installer.jar`
      : `${NEOFORGE}/${numero}/neoforge-${numero}-installer.jar`
  const temporaria = join(tmpdir(), `hubsquare-instalador-${randomUUID()}`)
  await mkdir(temporaria, { recursive: true })
  const foto = await fotografarPerfis()
  const antes = new Set(await readdir(join(MINECRAFT(), 'versions')).catch(() => []))
  try {
    const sha1 = (await buscarBytes(`${url}.sha1`)).toString('utf8').trim()
    const jar = join(temporaria, 'instalador.jar')
    await baixar(
      url,
      jar,
      { algoritmo: 'sha1', valor: sha1 },
      `Baixando o instalador do ${nome}`,
      aoProgredir
    )
    const java = await garantirJava(await javaDaVersao(versao), aoProgredir)
    await executar(
      java,
      ['-jar', jar, '--installClient', MINECRAFT()],
      temporaria,
      `${nome} ${numero}`,
      aoProgredir
    )
  } finally {
    // O instalador cria um perfil "forge"/"NeoForge" no launcher: os perfis voltam a ser os de antes.
    await restaurarPerfis(foto).catch(() => {})
    await rm(temporaria, { recursive: true, force: true }).catch(() => {})
  }
  if (temVersao(id)) return id
  // Nome diferente do esperado (instalador mudou o padrão): usa a versão que ele acabou de criar.
  const novas = (await readdir(join(MINECRAFT(), 'versions')).catch(() => [])).filter(
    (v) => !antes.has(v) && idSeguro(v) && v.includes(numero) && temVersao(v)
  )
  if (novas.length !== 1) {
    throw new ErroApp(
      `O instalador do ${nome} terminou, mas a versão ${id} não apareceu. Tente de novo.`
    )
  }
  return novas[0]
}

function executar(
  java: string,
  args: string[],
  cwd: string,
  nome: string,
  aoProgredir: AoProgredir
): Promise<void> {
  const etapa = `Instalando o ${nome} (pode levar alguns minutos)`
  aoProgredir({ etapa, recebido: 0, total: 0 })
  return new Promise((resolver, falhar) => {
    const filho = spawn(java, args, { cwd, windowsHide: true })
    const ultimas: string[] = []
    let aviso = 0
    const linha = (d: Buffer): void => {
      for (const l of d.toString('utf8').split(/\r?\n/).filter(Boolean)) {
        ultimas.push(l)
        if (ultimas.length > 40) ultimas.shift()
        if (Date.now() - aviso > 200) {
          aviso = Date.now()
          aoProgredir({ etapa: `${etapa}: ${l.trim().slice(0, 80)}`, recebido: 0, total: 0 })
        }
      }
    }
    filho.stdout.on('data', linha)
    filho.stderr.on('data', linha)
    filho.on('error', (e) =>
      falhar(new ErroApp(`O instalador do ${nome} não abriu. Tente de novo.`, String(e)))
    )
    filho.on('close', (codigo) =>
      codigo === 0
        ? resolver()
        : falhar(
            new ErroApp(
              `Não consegui instalar o ${nome}. Confira sua internet e tente de novo.`,
              `O instalador saiu com código ${codigo}\n\n${ultimas.join('\n')}`
            )
          )
    )
  })
}
