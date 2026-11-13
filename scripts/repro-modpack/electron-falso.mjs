// Substituto do módulo "electron" para rodar o código do processo principal pelo terminal.
// Todas as pastas do app (dados, Documentos, Downloads) apontam para a pasta de testes, então
// nada do usuário é tocado. Diálogos devolvem o arquivo escolhido por REPRO_ARQUIVO.
import { join } from 'node:path'

const base = process.env.REPRO_BASE
if (!base) throw new Error('REPRO_BASE não definido')

const caminhos = {
  userData: join(base, 'dados'),
  appData: join(base, 'dados'),
  documents: join(base, 'Documentos'),
  downloads: join(base, 'Downloads'),
  temp: join(base, 'tmp'),
  logs: join(base, 'logs'),
  home: base,
  desktop: join(base, 'Desktop')
}

export const app = {
  getPath: (nome) => caminhos[nome] ?? join(base, nome),
  setPath: (nome, valor) => (caminhos[nome] = valor),
  getVersion: () => '0.0.0-repro',
  getName: () => 'HubSquare',
  isPackaged: false,
  on: () => {},
  whenReady: () => Promise.resolve()
}
export const dialog = {
  showOpenDialog: async () => ({ canceled: false, filePaths: [process.env.REPRO_ARQUIVO] }),
  showSaveDialog: async () => ({ canceled: true }),
  showMessageBox: async () => ({ response: 0 })
}
export const shell = {
  openExternal: async () => {},
  openPath: async () => '',
  trashItem: async () => {}
}
export const BrowserWindow = { getAllWindows: () => [], fromWebContents: () => null }
export const ipcMain = { handle: () => {}, on: () => {} }
export const safeStorage = {
  isEncryptionAvailable: () => false,
  encryptString: (s) => Buffer.from(s),
  decryptString: (b) => b.toString()
}
export const nativeImage = { createFromPath: () => ({ resize: () => ({}) }) }
export const nativeTheme = { themeSource: 'system', shouldUseDarkColors: true, on: () => {} }
export const clipboard = { writeText: () => {} }
export class Tray {}
export class ClipboardItem {}
export const Menu = { buildFromTemplate: () => ({}), setApplicationMenu: () => {} }
export default { app, dialog, shell, BrowserWindow, ipcMain, safeStorage, nativeImage, nativeTheme }
