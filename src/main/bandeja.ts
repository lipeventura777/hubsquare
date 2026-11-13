import { Menu, Tray, nativeImage } from 'electron'
import icone from '../../resources/icon.png?asset'
import { paraTela } from './erros'
import { avisarTela, desligar, eventos, lerEstado, ligar } from './servidor'

// Ícone na bandeja do Windows: o app continua rodando (e o servidor ligado) com a janela fechada.
// O app nunca se registra para iniciar com o Windows.

let bandeja: Tray | null = null

export function criarBandeja(acoes: { abrir: () => void; sair: () => void }): void {
  bandeja = new Tray(nativeImage.createFromPath(icone).resize({ width: 16, height: 16 }))
  bandeja.on('double-click', acoes.abrir)

  const atualizar = (): void => {
    const estado = lerEstado()
    const itemServidor: Electron.MenuItemConstructorOptions =
      estado === 'desligado'
        ? {
            label: 'Ligar servidor',
            click: () =>
              ligar().catch((e) => {
                // Mostra o erro na tela, com o "Ver detalhes" de sempre.
                acoes.abrir()
                avisarTela('servidor:estado', { estado: lerEstado(), erro: paraTela(e) })
              })
          }
        : estado === 'ligado'
          ? { label: 'Desligar servidor', click: () => void desligar() }
          : { label: estado === 'ligando' ? 'Ligando...' : 'Desligando...', enabled: false }

    bandeja?.setToolTip(
      `HubSquare - servidor ${estado === 'ligado' ? 'ligado' : estado === 'desligado' ? 'desligado' : estado}`
    )
    bandeja?.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Abrir', click: acoes.abrir },
        itemServidor,
        { type: 'separator' },
        { label: 'Sair', click: acoes.sair }
      ])
    )
  }

  atualizar()
  eventos.on('estado', atualizar)
}
