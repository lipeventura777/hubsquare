import { createContext, useContext, useMemo } from 'react'

// As telas de mods do ServSquare (Explorar, Instalados, configs) são as mesmas no PlaySquare
// (Fase P3). Dentro de <ApiDaInstalacao>, as chamadas delas vão para a instalação escolhida em vez
// do servidor ativo; fora dele, tudo segue igual (window.api).

type Api = Window['api']

const Contexto = createContext<Api | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useApi(): Api {
  return useContext(Contexto) ?? window.api
}

export function ApiDaInstalacao({
  id,
  children
}: {
  id: string
  children: React.ReactNode
}): React.JSX.Element {
  const api = useMemo(() => ({ ...window.api, ...window.api.paraInstalacao(id) }), [id])
  return <Contexto.Provider value={api}>{children}</Contexto.Provider>
}
