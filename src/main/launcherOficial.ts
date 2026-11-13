import { app } from 'electron'
import { execFile, spawn } from 'child_process'
import { existsSync } from 'fs'
import { appendFile, copyFile, mkdir, readdir, rm } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'
import { gravarComSeguranca, lerTexto } from './config'
import { detalhar, ErroApp } from './erros'
import {
  aplicarPerfil,
  escolherLauncher,
  launcherSeguro,
  type Launcher,
  type PerfilLauncher
} from './launcherRegras'

// Minecraft Launcher oficial (Fase P1). O app nunca abre o jogo sozinho nem faz login: ele só
// grava um perfil no launcher_profiles.json (com backup antes) e abre o launcher.

const rodar = promisify(execFile)

// Opção interna: com false, o Jogar volta a ser só INSTALAR ("Em breve") e nada do PlaySquare abre
// o launcher. Religada na Fase M1, com a detecção corrigida (docs/pendencias/abrir-launcher.md).
export const ABRIR_LAUNCHER_LIGADO = true

export const LINK_LAUNCHER = 'https://www.minecraft.net/download'
export const MINECRAFT = (): string => join(app.getPath('appData'), '.minecraft')
const PERFIS = ['launcher_profiles.json', 'launcher_profiles_microsoft_store.json']
const MAX_BACKUPS = 10

function exesClassicos(): string[] {
  const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const pf = process.env['ProgramFiles'] ?? 'C:\\Program Files'
  return [
    join(pf86, 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    join(pf, 'Minecraft Launcher', 'MinecraftLauncher.exe')
  ]
}

// Lê do Windows os apps do pacote do launcher (AUMIDs) e onde o instalador clássico disse que
// instalou (registro da Mojang). Quem decide qual abrir é escolherLauncher (launcherRegras.ts).
const CHAVES_REGISTRO = [
  'HKCU:\\SOFTWARE\\Mojang\\InstalledProducts\\Minecraft Launcher',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Mojang\\InstalledProducts\\Minecraft Launcher',
  'HKLM:\\SOFTWARE\\Mojang\\InstalledProducts\\Minecraft Launcher'
]
const SCRIPT_DETECTAR = [
  "$p = Get-AppxPackage -Name 'Microsoft.4297127D64EC6' | Select-Object -First 1",
  'if ($p) { foreach ($a in ($p | Get-AppxPackageManifest).Package.Applications.Application) { "APP $($p.PackageFamilyName)!$($a.Id)" } }',
  `foreach ($k in @(${CHAVES_REGISTRO.map((k) => `'${k}'`).join(',')})) { $r = Get-ItemProperty $k -ErrorAction SilentlyContinue; if ($r.InstallLocation) { "REG $($r.InstallLocation)|$($r.InstallExe)" } }`,
  // Chave do registro que não existe deixa o código de saída em 1; a saída continua valendo.
  'exit 0'
].join('; ')

export async function detectarLauncher(): Promise<Launcher | null> {
  const apps: string[] = []
  const exes = exesClassicos()
  // Testes (HUBSQUARE_DADOS): só o "clássico" de Program Files do ambiente do teste, nunca o
  // launcher instalado no PC.
  if (process.env.HUBSQUARE_DADOS)
    return escolherLauncher(
      [],
      exes.filter((e) => existsSync(e))
    )
  try {
    const { stdout } = await rodar(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', SCRIPT_DETECTAR],
      { windowsHide: true, timeout: 20000 }
    )
    for (const linha of stdout.split(/\r?\n/).map((l) => l.trim())) {
      if (linha.startsWith('APP ')) apps.push(linha.slice(4))
      if (linha.startsWith('REG ')) {
        const [pasta, exe] = linha.slice(4).split('|')
        const nome = exe || 'MinecraftLauncher.exe'
        // O registro guarda a pasta de cima (ex.: "C:\Program Files (x86)\").
        exes.push(join(pasta, 'Minecraft Launcher', nome), join(pasta, nome))
      }
    }
  } catch (e) {
    await anotarFalha(`não consegui procurar o launcher pelo PowerShell: ${detalhar(e)}`)
  }
  return escolherLauncher(
    apps,
    exes.filter((e) => existsSync(e))
  )
}

// Falhas do Jogar vão para logs/erros.log (pasta de dados), com o motivo.
export async function anotarFalha(motivo: string): Promise<void> {
  const pasta = join(app.getPath('userData'), 'logs')
  await mkdir(pasta, { recursive: true })
    .then(() =>
      appendFile(join(pasta, 'erros.log'), `[${new Date().toISOString()}] Jogar: ${motivo}\n`)
    )
    .catch(() => {})
}

// shortcut: procura pelo nome do processo do launcher (clássico e Store usam MinecraftLauncher.exe
// ou Minecraft.exe); se a Microsoft renomear, o app não percebe que ele está aberto.
export async function launcherAberto(): Promise<boolean> {
  try {
    const { stdout } = await rodar('tasklist.exe', ['/FO', 'CSV', '/NH'], {
      windowsHide: true,
      timeout: 15000
    })
    return stdout.split(/\r?\n/).some((l) => /^"(MinecraftLauncher|Minecraft)\.exe"/i.test(l))
  } catch {
    return false
  }
}

export async function abrirLauncher(l: Launcher): Promise<void> {
  // Confere de novo: nada que não seja o launcher (nunca o marcador do Xbox nem a Store).
  if (!launcherSeguro(l)) {
    throw new ErroApp('Não reconheci o Minecraft Launcher deste PC.', JSON.stringify(l))
  }
  // Apps da Store abrem pelo explorer, com o id do app (PackageFamilyName!Id).
  const filho =
    l.tipo === 'classico'
      ? spawn(l.exe, [], { detached: true, stdio: 'ignore', windowsHide: false })
      : spawn('explorer.exe', [`shell:AppsFolder\\${l.app}`], { detached: true, stdio: 'ignore' })
  await new Promise<void>((ok, falhou) => {
    filho.once('spawn', ok)
    filho.once('error', (e) =>
      falhou(new ErroApp('Não consegui abrir o Minecraft Launcher. Tente de novo.', detalhar(e)))
    )
  })
  filho.unref()
}

// Arquivos de perfis que existem. Nenhum: o launcher nunca foi aberto neste PC.
function arquivosDePerfis(): string[] {
  return PERFIS.map((n) => join(MINECRAFT(), n)).filter((a) => existsSync(a))
}

export function exigirPerfis(): void {
  if (!arquivosDePerfis().length) {
    throw new ErroApp(
      'Abra o Minecraft Launcher uma vez e entre na sua conta. Depois clique em Jogar de novo.',
      `Não existe ${PERFIS.join(' nem ')} em ${MINECRAFT()}.`
    )
  }
}

function pastaBackupsPerfis(): string {
  return join(app.getPath('documents'), 'ServSquare', 'backups', 'launcher')
}

// Copia o arquivo de perfis antes de qualquer mudança e guarda só os últimos.
async function backupDosPerfis(arquivo: string): Promise<void> {
  const pasta = pastaBackupsPerfis()
  await mkdir(pasta, { recursive: true })
  const base = arquivo
    .split(/[\\/]/)
    .pop()!
    .replace(/\.json$/, '')
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-')
  await copyFile(arquivo, join(pasta, `${base}-${carimbo}.json`))
  const antigos = (await readdir(pasta)).filter((n) => n.startsWith(`${base}-`)).sort()
  for (const n of antigos.slice(0, Math.max(0, antigos.length - MAX_BACKUPS))) {
    await rm(join(pasta, n), { force: true })
  }
}

// Fotografia dos arquivos de perfis, para desfazer o perfil que os instaladores do Forge e do
// NeoForge criam por conta própria.
export async function fotografarPerfis(): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  for (const a of arquivosDePerfis()) mapa.set(a, await lerTexto(a))
  return mapa
}

export async function restaurarPerfis(foto: Map<string, string>): Promise<void> {
  for (const [a, texto] of foto) {
    if ((await lerTexto(a)) !== texto) await gravarComSeguranca(a, texto)
  }
}

// Grava o perfil da instalação em cada arquivo de perfis que existe, com backup antes.
export async function gravarPerfil(chave: string, perfil: PerfilLauncher): Promise<void> {
  exigirPerfis()
  for (const arquivo of arquivosDePerfis()) {
    const texto = await lerTexto(arquivo)
    let novo: string
    try {
      novo = aplicarPerfil(texto, chave, perfil)
    } catch (e) {
      throw new ErroApp(
        'O Minecraft Launcher mudou o jeito de guardar as instalações, e o app não reconheceu. Nada foi alterado. Procure uma versão nova do HubSquare.',
        `${arquivo}: ${(e as Error).message}`
      )
    }
    await backupDosPerfis(arquivo)
    await gravarComSeguranca(arquivo, novo)
  }
}

// Ao apagar a instalação no app, o perfil dela sai do launcher (só o dela).
export async function removerPerfil(chave: string): Promise<void> {
  for (const arquivo of arquivosDePerfis()) {
    const texto = await lerTexto(arquivo)
    try {
      const dados = JSON.parse(texto) as { profiles?: Record<string, unknown> }
      if (!dados.profiles || !(chave in dados.profiles)) continue
      delete dados.profiles[chave]
      await backupDosPerfis(arquivo)
      await gravarComSeguranca(arquivo, JSON.stringify(dados, null, 2))
    } catch {
      // formato estranho: deixa como está
    }
  }
}
