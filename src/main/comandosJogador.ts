import { isIPv4 } from 'net'
import { MODOS, type AcaoJogador } from '../shared/tipos'
import { ErroApp } from './erros'

// Tudo que vira comando do servidor passa por aqui antes: nada de texto solto do usuário.

export function validarJogador(valor: unknown): string {
  const nome = typeof valor === 'string' ? valor.trim() : ''
  if (!/^[A-Za-z0-9_]{3,16}$/.test(nome)) {
    throw new ErroApp('Nome inválido. Nomes do Minecraft têm de 3 a 16 letras, números ou "_".')
  }
  return nome
}

// O ban-ip do Minecraft só aceita IPv4.
export function validarIp(valor: unknown): string {
  const ip = typeof valor === 'string' ? valor.trim() : ''
  if (!isIPv4(ip)) throw new ErroApp('Endereço inválido. Use o formato 123.45.67.89.')
  return ip
}

function coordenada(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 30_000_000) {
    throw new ErroApp('Local inválido para teleportar.')
  }
  return v.toFixed(3) // nunca vira "1e-7", que o comando não entende
}

export function comandoDaAcao(nome: string, valor: unknown): string {
  const acao = (valor ?? {}) as AcaoJogador
  switch (acao.tipo) {
    case 'matar':
      return `kill ${nome}`
    case 'curar': // nível 5: cura 4 × 2⁴ = 64 de vida, enche qualquer barra
      return `effect give ${nome} minecraft:instant_health 1 4 true`
    case 'alimentar':
      return `effect give ${nome} minecraft:saturation 1 19 true`
    case 'faminto':
      return `effect give ${nome} minecraft:hunger 20 4`
    case 'modo':
      if (!MODOS.includes(acao.modo)) break
      return `gamemode ${acao.modo} ${nome}`
    case 'teleportar': {
      const l = acao.local
      if (
        !l ||
        typeof l.dimensao !== 'string' ||
        !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(l.dimensao)
      ) {
        throw new ErroApp('Local inválido para teleportar.')
      }
      const xyz = [l.x, l.y, l.z].map(coordenada).join(' ')
      return `execute in ${l.dimensao} run tp ${nome} ${xyz}`
    }
  }
  throw new ErroApp('Ação desconhecida.', JSON.stringify(valor))
}
