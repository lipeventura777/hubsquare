import { Menu, Tray, nativeImage } from 'electron'
import icone from '../../resources/icon.png?asset'
import { paraTela } from './erros'
import { avisarTela, desligar, eventos, lerEstado, ligar } from './servidor'
import { t } from '../shared/i18n'

// Ícone na bandeja do Windows: o app continua rodando (e o servidor ligado) com a janela fechada.
// O app nunca se registra para iniciar com o Windows.

let bandeja: Tray | null = null
// Remonta o menu e a dica (ex.: quando o idioma muda).
export let atualizarBandeja = (): void => {}

export function criarBandeja(acoes: { abrir: () => void; sair: () => void }): void {
  bandeja = new Tray(nativeImage.createFromPath(icone).resize({ width: 16, height: 16 }))
  bandeja.on('double-click', acoes.abrir)

  const atualizar = (): void => {
    const estado = lerEstado()
    const itemServidor: Electron.MenuItemConstructorOptions =
      estado === 'desligado'
        ? {
            label: t('p.bandeja.ligarServidor'),
            click: () =>
              ligar().catch((e) => {
                // Mostra o erro na tela, com o "Ver detalhes" de sempre.
                acoes.abrir()
                avisarTela('servidor:estado', { estado: lerEstado(), erro: paraTela(e) })
              })
          }
        : estado === 'ligado'
          ? { label: t('p.bandeja.desligarServidor'), click: () => void desligar() }
          : {
              label: estado === 'ligando' ? t('p.bandeja.ligando') : t('p.bandeja.desligando'),
              enabled: false
            }

    bandeja?.setToolTip(
      t('p.bandeja.hubsquareServidor', {
        v:
          estado === 'ligado'
            ? t('p.bandeja.ligado')
            : estado === 'desligado'
              ? t('p.bandeja.desligado')
              : estado
      })
    )
    bandeja?.setContextMenu(
      Menu.buildFromTemplate([
        { label: t('p.bandeja.abrir'), click: acoes.abrir },
        itemServidor,
        { type: 'separator' },
        { label: t('p.bandeja.sair'), click: acoes.sair }
      ])
    )
  }

  atualizarBandeja = atualizar
  atualizar()
  eventos.on('estado', atualizar)
}
