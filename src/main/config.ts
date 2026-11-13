import { readFile, rename, writeFile } from 'fs/promises'
import { totalmem } from 'os'
import { join } from 'path'
import {
  DIFICULDADES,
  MODOS,
  type DadosConfiguracoes,
  type InfoServidor,
  type LimitesRam
} from '../shared/tipos'
import { MAX_MOTD } from '../shared/motd'
import { ErroApp } from './erros'
import { lerPropriedades, mudarPropriedades } from './propriedades'

// ---------- Arquivos ----------

export async function lerTexto(arquivo: string): Promise<string> {
  try {
    return await readFile(arquivo, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw e
  }
}

// Grava num arquivo temporário e troca no fim: se o PC desligar no meio, o original não se perde.
export async function gravarComSeguranca(arquivo: string, texto: string): Promise<void> {
  await writeFile(`${arquivo}.tmp`, texto)
  await rename(`${arquivo}.tmp`, arquivo)
}

export async function lerArquivoPropriedades(pasta: string): Promise<Map<string, string>> {
  return lerPropriedades(await lerTexto(join(pasta, 'server.properties')))
}

// Se o arquivo ainda não existe (servidor nunca ligou), cria só com essas chaves;
// o Minecraft completa o resto na primeira vez que ligar e mantém o que já está lá.
export async function gravarPropriedades(
  pasta: string,
  mudancas: Record<string, string>
): Promise<void> {
  const arquivo = join(pasta, 'server.properties')
  await gravarComSeguranca(arquivo, mudarPropriedades(await lerTexto(arquivo), mudancas))
}

// ---------- RAM e PvP ----------

export function limitesRam(): LimitesRam {
  const totalGb = Math.floor(totalmem() / 1024 ** 3)
  const max = Math.max(2, totalGb - 2) // deixa uns 2 GB para o Windows
  const sugerida = Math.min(max, Math.max(2, Math.min(8, Math.round(totalGb / 2))))
  return { min: 1, max, sugerida }
}

export function ramDoServidor(info: InfoServidor): number {
  const { min, max, sugerida } = limitesRam()
  return Math.min(max, Math.max(min, Math.round(info.ram ?? sugerida)))
}

// Da 1.21.9 em diante o PvP saiu do server.properties e virou a regra do jogo "pvp".
export function pvpEhRegraDoJogo(versao: string): boolean {
  const [a = 0, b = 0, c = 0] = versao.split('.').map((n) => parseInt(n, 10) || 0)
  return a > 1 || (a === 1 && (b > 21 || (b === 21 && c >= 9)))
}

// ---------- Ler e salvar a tela de configurações ----------

// Versões antigas gravam modo e dificuldade como número (0, 1, 2, 3).
function normalizar<T extends string>(
  valor: string | undefined,
  opcoes: readonly T[],
  padrao: T
): T {
  if (valor && (opcoes as readonly string[]).includes(valor)) return valor as T
  return opcoes[Number(valor)] ?? padrao
}

export async function lerConfiguracoes(info: InfoServidor): Promise<DadosConfiguracoes> {
  const p = await lerArquivoPropriedades(info.pasta)
  return {
    configuracoes: {
      modoDeJogo: normalizar(p.get('gamemode'), MODOS, 'survival'),
      dificuldade: normalizar(p.get('difficulty'), DIFICULDADES, 'easy'),
      maxJogadores: Number(p.get('max-players')) || 20,
      motd: p.get('motd') ?? 'A Minecraft Server',
      pvp: pvpEhRegraDoJogo(info.versao) ? (info.pvp ?? true) : p.get('pvp') !== 'false',
      ramGb: ramDoServidor(info)
    },
    ram: limitesRam()
  }
}

// Valida tudo o que veio da tela, grava no server.properties e devolve o que vai no servsquare.json.
// shortcut: grava modo e dificuldade como nome; versões anteriores à 1.13 só entendem número.
export async function salvarConfiguracoes(
  info: InfoServidor,
  valor: unknown
): Promise<{ ram: number; pvp: boolean }> {
  const c = (valor ?? {}) as Record<string, unknown>
  const { min, max } = limitesRam()
  if (!MODOS.includes(c.modoDeJogo as never)) throw new ErroApp('Escolha um modo de jogo da lista.')
  if (!DIFICULDADES.includes(c.dificuldade as never)) {
    throw new ErroApp('Escolha uma dificuldade da lista.')
  }
  const jogadores = c.maxJogadores
  if (!Number.isInteger(jogadores) || (jogadores as number) < 1 || (jogadores as number) > 1000) {
    throw new ErroApp('O máximo de jogadores precisa ser um número inteiro entre 1 e 1000.')
  }
  // Até duas linhas (separadas por \n), como na lista de servidores do jogo.
  if (
    typeof c.motd !== 'string' ||
    /\r/.test(c.motd) ||
    c.motd.split('\n').length > 2 ||
    c.motd.length > MAX_MOTD
  ) {
    throw new ErroApp(
      `A mensagem do servidor (MOTD) precisa ter até ${MAX_MOTD} caracteres, em no máximo duas linhas.`
    )
  }
  if (typeof c.pvp !== 'boolean') throw new ErroApp('Escolha se o PvP fica ligado ou desligado.')
  const ram = c.ramGb
  if (!Number.isInteger(ram) || (ram as number) < min || (ram as number) > max) {
    throw new ErroApp(`A RAM precisa ficar entre ${min} e ${max} GB.`)
  }

  const mudancas: Record<string, string> = {
    gamemode: c.modoDeJogo as string,
    difficulty: c.dificuldade as string,
    'max-players': String(jogadores),
    motd: c.motd
  }
  if (!pvpEhRegraDoJogo(info.versao)) mudancas.pvp = String(c.pvp)
  await gravarPropriedades(info.pasta, mudancas)
  // Confere lendo de volta (acentos e § são gravados como \uXXXX).
  if ((await lerArquivoPropriedades(info.pasta)).get('motd') !== c.motd) {
    throw new ErroApp(
      'O MOTD foi gravado, mas ao ler de volta ele veio diferente. Feche programas que estejam com o server.properties aberto e salve de novo.'
    )
  }
  return { ram: ram as number, pvp: c.pvp }
}
