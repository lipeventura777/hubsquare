import { app } from 'electron'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { mkdir, readdir, rename, rm } from 'fs/promises'
import { join } from 'path'
import { ErroApp } from './erros'
import { baixar, buscarJson, type AoProgredir } from './rede'

interface PacoteAdoptium {
  binary: { package: { link: string; checksum: string } }
}

// Devolve o caminho do java.exe da versão pedida, baixando o Temurin JRE se faltar.
export async function garantirJava(versao: number, aoProgredir: AoProgredir): Promise<string> {
  const base = join(app.getPath('userData'), 'java')
  const pasta = join(base, String(versao))
  const exe = join(pasta, 'bin', 'java.exe')
  if (existsSync(exe)) return exe

  const arquitetura = process.arch === 'arm64' ? 'aarch64' : 'x64'
  const pacotes = await buscarJson<PacoteAdoptium[]>(
    `https://api.adoptium.net/v3/assets/latest/${versao}/hotspot?architecture=${arquitetura}&image_type=jre&os=windows&vendor=eclipse`
  )
  const pacote = pacotes[0]?.binary.package
  if (!pacote) {
    throw new ErroApp(
      `Não encontrei o Java ${versao} para Windows. Escolha outra versão do Minecraft.`
    )
  }

  await mkdir(base, { recursive: true })
  const zip = join(base, `${versao}.zip`)
  const extraindo = join(base, `${versao}.extraindo`)
  await baixar(
    pacote.link,
    zip,
    { algoritmo: 'sha256', valor: pacote.checksum },
    `Baixando o Java ${versao}`,
    aoProgredir
  )

  aoProgredir({ etapa: `Instalando o Java ${versao}`, recebido: 0, total: 0 })
  await rm(extraindo, { recursive: true, force: true })
  await mkdir(extraindo)
  await extrair(zip, extraindo)
  // O zip tem uma pasta só, por exemplo "jdk-25.0.5+8-jre".
  const [raiz] = await readdir(extraindo)
  await rename(join(extraindo, raiz), pasta)
  await rm(extraindo, { recursive: true, force: true })
  await rm(zip, { force: true })

  if (!existsSync(exe))
    throw new ErroApp(`O Java ${versao} foi baixado, mas veio incompleto. Tente de novo.`)
  return exe
}

// Usa o tar que vem no Windows 10/11, que também abre .zip.
function extrair(zip: string, destino: string): Promise<void> {
  const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
  return new Promise((resolver, falhar) => {
    const processo = spawn(tar, ['-xf', zip, '-C', destino], { windowsHide: true })
    let saida = ''
    processo.stderr.on('data', (d) => (saida += d))
    processo.on('error', (e) =>
      falhar(new ErroApp('Não consegui descompactar o Java. Tente de novo.', String(e)))
    )
    processo.on('close', (codigo) =>
      codigo === 0
        ? resolver()
        : falhar(
            new ErroApp(
              'Não consegui descompactar o Java. Tente de novo.',
              `tar saiu com código ${codigo}\n${saida}`
            )
          )
    )
  })
}
