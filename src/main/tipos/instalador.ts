import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { cp, mkdir, readdir, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { createInterface } from 'readline'
import { ErroApp } from '../erros'
import { baixar, buscarBytes, type AoProgredir } from '../rede'
import { argsDoRunBat } from './versoesLoader'
import { t } from '../../shared/i18n'

// Forge e NeoForge: baixam o instalador oficial, rodam em modo servidor numa pasta temporária
// e copiam o resultado para a pasta do servidor (sem apagar mundo, mods nem configurações).

const TEMPORARIA = '.hubsquare-instalador'

export async function rodarInstalador(
  nome: string,
  url: string,
  pasta: string,
  java: string,
  aoProgredir: AoProgredir,
  antigo = false // Fase F1: instalador do Forge de 1.7.10 a 1.12.1
): Promise<void> {
  // Dentro da pasta do servidor: fica no mesmo disco e some junto se a criação falhar.
  const temporaria = join(pasta, TEMPORARIA)
  const saida = join(temporaria, 'saida')
  await rm(temporaria, { recursive: true, force: true })
  await mkdir(saida, { recursive: true })
  try {
    const item = t('p.rede.itemInstalador', { nome })
    const sha1 = (await buscarBytes(`${url}.sha1`, item)).toString('utf8').trim()
    const jar = join(temporaria, 'instalador.jar')
    await baixar(
      url,
      jar,
      { algoritmo: 'sha1', valor: sha1 },
      t('tipos.instalador.baixandoOInstaladorDo', { nome }),
      aoProgredir,
      undefined,
      item
    )
    // O instalador antigo ignora a pasta de destino e instala na pasta atual, sem janela só com o
    // headless (docs/forge-antigo.md).
    if (antigo) {
      await executar(
        java,
        ['-Djava.awt.headless=true', '-jar', jar, '--installServer'],
        saida,
        nome,
        aoProgredir
      )
    } else {
      await executar(java, ['-jar', jar, '--installServer', saida], temporaria, nome, aoProgredir)
    }

    aoProgredir({
      etapa: t('tipos.instalador.copiandoOsArquivosDo', { nome }),
      recebido: 0,
      total: 0
    })
    // Arquivos de inicialização do loader anterior sairiam errados se sobrassem.
    for (const item of await readdir(pasta)) {
      if (/^(run\.(bat|sh)|user_jvm_args\.txt)$|^forge-.*\.jar$/.test(item)) {
        await rm(join(pasta, item), { force: true })
      }
    }
    await cp(saida, pasta, { recursive: true, force: true })
  } finally {
    await rm(temporaria, { recursive: true, force: true }).catch(() => {}) // pasta temporária; o Windows limpa o que sobrar
  }
}

function executar(
  java: string,
  args: string[],
  cwd: string,
  nome: string,
  aoProgredir: AoProgredir
): Promise<void> {
  const etapa = t('tipos.instalador.instalandoOPodeLevarAlguns', { nome })
  aoProgredir({ etapa, recebido: 0, total: 0 })
  return new Promise((resolver, falhar) => {
    const filho = spawn(java, args, { cwd, windowsHide: true })
    const ultimas: string[] = []
    let ultimoAviso = 0
    for (const fluxo of [filho.stdout, filho.stderr]) {
      createInterface({ input: fluxo }).on('line', (linha) => {
        ultimas.push(linha)
        if (ultimas.length > 40) ultimas.shift()
        if (Date.now() - ultimoAviso > 200) {
          ultimoAviso = Date.now()
          aoProgredir({ etapa: `${etapa}: ${linha.trim().slice(0, 80)}`, recebido: 0, total: 0 })
        }
      })
    }
    filho.on('error', (e) =>
      falhar(new ErroApp(t('tipos.instalador.oInstaladorDoNaoAbriu', { nome }), String(e)))
    )
    filho.on('close', (codigo) =>
      codigo === 0
        ? resolver()
        : falhar(
            new ErroApp(
              t('tipos.instalador.naoConseguiInstalarOConfira', { nome }),
              t('tipos.instalador.oInstaladorSaiuComCodigo', { codigo, join: ultimas.join('\n') })
            )
          )
    )
  })
}

// Usa o que o instalador gerou: o arquivo de argumentos do run.bat (Minecraft 1.17 em diante)
// ou o forge-<versão>.jar (Forge antigo, que não gera run.bat).
export async function argumentosDoInstalador(pasta: string, nome: string): Promise<string[]> {
  const bat = join(pasta, 'run.bat')
  if (existsSync(bat)) {
    const arquivo = argsDoRunBat(await readFile(bat, 'utf8'))
    if (arquivo && existsSync(join(pasta, arquivo))) return [`@${arquivo}`, 'nogui']
  }
  const jar = (await readdir(pasta)).find(
    (f) => /^forge-.*\.jar$/.test(f) && !/-(installer|shim)\.jar$/.test(f)
  )
  if (jar) return ['-jar', jar, 'nogui']
  throw new ErroApp(t('tipos.instalador.naoEncontreiOsArquivosDo', { nome }))
}
