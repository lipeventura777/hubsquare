import { useEffect, useState } from 'react'
import type { EstadoServidor, ModoDeJogo, Resultado, UsoServidor } from '../../../shared/tipos'

// Todos os botões montam o comando aqui e mandam pela mesma porta do campo de comando
// (window.api.enviarComando), que no processo principal escreve no stdin do servidor.
export const comandos = {
  darOp: (nome: string) => `op ${nome}`,
  tirarOp: (nome: string) => `deop ${nome}`,
  expulsar: (nome: string, motivo: string) => `kick ${nome} ${motivo}`.trim(),
  mudarModo: (nome: string, modo: ModoDeJogo) => `gamemode ${modo} ${nome}`
}

export function enviar(comando: string): Promise<Resultado<void>> {
  return window.api.enviarComando(comando)
}

// Estado do servidor para qualquer tela. "erro" fica marcado se ele caiu ou não ligou,
// até a próxima vez que ligar.
export function useEstadoServidor(): { estado: EstadoServidor; comErro: boolean } {
  const [estado, setEstado] = useState<EstadoServidor>('desligado')
  const [comErro, setComErro] = useState(false)
  useEffect(() => {
    window.api.lerConsole().then((c) => setEstado(c.estado))
    return window.api.aoMudarEstado((aviso) => {
      setEstado(aviso.estado)
      if (aviso.erro) setComErro(true)
      else if (aviso.estado === 'ligando') setComErro(false)
    })
  }, [])
  return { estado, comErro }
}

export function useJogadores(): string[] {
  const [nomes, setNomes] = useState<string[]>([])
  useEffect(() => {
    const parar = window.api.aoMudarJogadores(setNomes)
    window.api.lerJogadores().then(setNomes)
    return parar
  }, [])
  return nomes
}

// null enquanto o servidor está desligado ou antes da primeira medida (2 s).
export function useUso(): UsoServidor | null {
  const [uso, setUso] = useState<UsoServidor | null>(null)
  useEffect(() => window.api.aoMedirUso(setUso), [])
  return uso
}

// Cor de cada linha (seção 6.5): INFO cinza, WARN amarelo, ERROR vermelho.
export function corDaLinha(texto: string): string {
  if (/\b(ERROR|SEVERE|FATAL)\b/.test(texto)) return 'text-danger'
  if (/\bWARN(ING)?\b/.test(texto)) return 'text-warning'
  return 'text-console-muted'
}
