// Empacota a reprodução para rodar no processo principal do Electron (npm run repro:modpack:electron).
import { builtinModules } from 'node:module'

export default {
  input: 'scripts/repro-modpack/entrada-electron.ts',
  platform: 'node',
  external: ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
  plugins: [
    {
      name: 'asset-vazio',
      resolveId: (id) => (id.includes('?asset') ? '\0asset' : null),
      load: (id) => (id === '\0asset' ? 'export default ""' : null)
    }
  ],
  output: { dir: '.teste/repro-electron', format: 'esm' }
}
