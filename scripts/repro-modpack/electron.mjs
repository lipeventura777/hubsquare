// Abre o Electron de verdade com a entrada e os argumentos dados. Tira o ELECTRON_RUN_AS_NODE que o
// VS Code deixa no terminal (com ele, o Electron vira um Node comum).
import { spawn } from 'node:child_process'
import electron from 'electron'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const filho = spawn(electron, process.argv.slice(2), {
  env,
  stdio: 'inherit'
})
filho.on('exit', (c) => process.exit(c ?? 1))
