// Entrada da reprodução dentro do Electron de verdade (empacotada pelo rolldown, porque o
// Electron não roda .ts direto). O "electron" embutido fica em globalThis para o repro.ts.
// Sem await no topo: no ESM, o "ready" do Electron só chega depois que a entrada termina.
import electron from 'electron'

;(globalThis as Record<string, unknown>).__electronReal = electron
electron.app.on('window-all-closed', () => {})
void electron.app.whenReady().then(() => import('./repro.ts'))
