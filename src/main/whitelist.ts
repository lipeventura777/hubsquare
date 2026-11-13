import { join } from 'path'
import type { Amigo, InfoServidor, ListaId } from '../shared/tipos'
import { LISTAS } from '../shared/tipos'
import { validarIp, validarJogador } from './comandosJogador'
import { gravarComSeguranca, lerArquivoPropriedades, lerTexto } from './config'
import { ErroApp } from './erros'
import { buscarJsonOpcional } from './rede'
import { comServidorDesligado, enviarComando, lerEstado, servidorAtual } from './servidor'

// As quatro listas em .json do servidor: whitelist, OPs, jogadores banidos e IPs banidos.
// Ligado: o servidor cuida do arquivo, então mandamos o comando. Desligado: o app edita o .json
// no mesmo formato que o Minecraft grava, mantendo os campos que ele colocou.

type Entrada = Record<string, unknown>

const LISTA: Record<ListaId, { arquivo: string; adicionar: string; remover: string }> = {
  whitelist: { arquivo: 'whitelist.json', adicionar: 'whitelist add', remover: 'whitelist remove' },
  ops: { arquivo: 'ops.json', adicionar: 'op', remover: 'deop' },
  banidos: { arquivo: 'banned-players.json', adicionar: 'ban', remover: 'pardon' },
  ipsBanidos: { arquivo: 'banned-ips.json', adicionar: 'ban-ip', remover: 'pardon-ip' }
}

function validarLista(valor: unknown): ListaId {
  if (!LISTAS.includes(valor as ListaId)) throw new ErroApp('Lista desconhecida.', String(valor))
  return valor as ListaId
}

const chave = (lista: ListaId): string => (lista === 'ipsBanidos' ? 'ip' : 'name')

async function lerJson(arquivo: string): Promise<Entrada[]> {
  const texto = await lerTexto(arquivo)
  if (!texto.trim()) return []
  const lista = JSON.parse(texto)
  return Array.isArray(lista) ? lista.filter((e) => e && typeof e === 'object') : []
}

const lerEntradas = (info: InfoServidor, lista: ListaId): Promise<Entrada[]> =>
  lerJson(join(info.pasta, LISTA[lista].arquivo))

function paraTela(entradas: Entrada[], lista: ListaId): Amigo[] {
  const k = chave(lista)
  return entradas
    .filter((e) => typeof e[k] === 'string')
    .map((e) => ({ name: e[k] as string, uuid: String(e.uuid ?? '') }))
}

function mesma(e: Entrada, lista: ListaId, valor: string): boolean {
  const v = e[chave(lista)]
  return typeof v === 'string' && v.toLowerCase() === valor.toLowerCase()
}

function servidorRodando(): boolean {
  const estado = lerEstado()
  if (estado === 'desligando') {
    throw new ErroApp('O servidor está desligando. Espere ele desligar e tente de novo.')
  }
  return estado !== 'desligado'
}

// Todos que já entraram no servidor (nome e UUID), guardado pelo próprio Minecraft.
export async function lerUsercache(info: InfoServidor): Promise<Amigo[]> {
  return paraTela(await lerJson(join(info.pasta, 'usercache.json')), 'whitelist')
}

export async function lerLista(info: InfoServidor, lista: ListaId): Promise<Amigo[]> {
  return paraTela(await lerEntradas(info, lista), lista)
}

export function listar(info: InfoServidor, lista: unknown): Promise<Amigo[]> {
  return lerLista(info, validarLista(lista))
}

// Primeiro quem já entrou (funciona também em servidor offline); senão, a conta na Mojang.
async function acharPerfil(info: InfoServidor, nome: string): Promise<Amigo> {
  const conhecido = (await lerUsercache(info)).find(
    (a) => a.name.toLowerCase() === nome.toLowerCase()
  )
  if (conhecido) return conhecido
  const perfil = await buscarJsonOpcional<{ id: string; name: string }>(
    `https://api.mojang.com/users/profiles/minecraft/${nome}`
  )
  if (!perfil) {
    throw new ErroApp(
      `Não existe conta do Minecraft com o nome "${nome}". Confira se digitou certo.`
    )
  }
  // A Mojang devolve o UUID sem tracinhos; os .json usam com tracinhos.
  return {
    uuid: perfil.id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5'),
    name: perfil.name
  }
}

// Data no formato que o Minecraft grava: "2026-11-09 18:30:00 +0000".
const agora = (): string => `${new Date().toISOString().replace('T', ' ').slice(0, 19)} +0000`

async function novaEntrada(info: InfoServidor, lista: ListaId, valor: string): Promise<Entrada> {
  const ban = {
    created: agora(),
    source: 'Server',
    expires: 'forever',
    reason: 'Banned by an operator.'
  }
  if (lista === 'ipsBanidos') return { ip: valor, ...ban }
  const perfil = await acharPerfil(info, valor)
  const base = { uuid: perfil.uuid, name: perfil.name }
  if (lista === 'banidos') return { ...base, ...ban }
  if (lista === 'ops') {
    const nivel = Number((await lerArquivoPropriedades(info.pasta)).get('op-permission-level'))
    return { ...base, level: nivel >= 1 && nivel <= 4 ? nivel : 4, bypassesPlayerLimit: false }
  }
  return base
}

export async function adicionar(
  info: InfoServidor,
  lista: unknown,
  valor: unknown
): Promise<Amigo[]> {
  const id = validarLista(lista)
  const texto = id === 'ipsBanidos' ? validarIp(valor) : validarJogador(valor)
  const nova = await novaEntrada(info, id, texto)
  const juntar = (atuais: Entrada[]): Entrada[] =>
    atuais.some(
      (e) => (nova.uuid && e.uuid === nova.uuid) || mesma(e, id, nova[chave(id)] as string)
    )
      ? atuais
      : [...atuais, nova]

  if (servidorRodando()) {
    enviarComando(`${LISTA[id].adicionar} ${nova[chave(id)]}`)
    return paraTela(juntar(await lerEntradas(info, id)), id)
  }
  return comServidorDesligado(async () => {
    const atuais = juntar(await lerEntradas(info, id))
    await gravarComSeguranca(join(info.pasta, LISTA[id].arquivo), JSON.stringify(atuais, null, 2))
    return paraTela(atuais, id)
  })
}

export async function remover(
  info: InfoServidor,
  lista: unknown,
  valor: unknown
): Promise<Amigo[]> {
  const id = validarLista(lista)
  const texto = id === 'ipsBanidos' ? validarIp(valor) : validarJogador(valor)
  if (servidorRodando()) {
    enviarComando(`${LISTA[id].remover} ${texto}`)
    return paraTela(
      (await lerEntradas(info, id)).filter((e) => !mesma(e, id, texto)),
      id
    )
  }
  return comServidorDesligado(async () => {
    const atuais = (await lerEntradas(info, id)).filter((e) => !mesma(e, id, texto))
    await gravarComSeguranca(join(info.pasta, LISTA[id].arquivo), JSON.stringify(atuais, null, 2))
    return paraTela(atuais, id)
  })
}

// Pedido aprovado (Fase M4): o nick e o UUID já vieram conferidos na Mojang pelo amigo.
// Servidor ativo e ligado: "whitelist add"; senão, direto no whitelist.json com o UUID.
export async function aprovarNaWhitelist(info: InfoServidor, perfil: Amigo): Promise<void> {
  const nome = validarJogador(perfil.name)
  const gravar = async (): Promise<void> => {
    const arquivo = join(info.pasta, LISTA.whitelist.arquivo)
    const atuais = await lerJson(arquivo)
    if (atuais.some((e) => e.uuid === perfil.uuid || mesma(e, 'whitelist', nome))) return
    await gravarComSeguranca(
      arquivo,
      JSON.stringify([...atuais, { uuid: perfil.uuid, name: nome }], null, 2)
    )
  }
  if ((await servidorAtual())?.id !== info.id) return gravar()
  if (servidorRodando()) return enviarComando(`${LISTA.whitelist.adicionar} ${nome}`)
  return comServidorDesligado(gravar)
}
