// Gera release/SHA256SUMS.txt com o SHA-256 dos instaladores (.exe) da versão do package.json, no
// formato do sha256sum ("<hash>  <arquivo>"), para quem baixa conferir o arquivo.
import { createHash } from 'node:crypto'
import { createReadStream, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PASTA = join(import.meta.dirname, '..', 'release')

const sha256 = (caminho) =>
  new Promise((ok, falha) => {
    const h = createHash('sha256')
    createReadStream(caminho)
      .on('data', (d) => h.update(d))
      .on('end', () => ok(h.digest('hex')))
      .on('error', falha)
  })

const { version } = JSON.parse(readFileSync(join(PASTA, '..', 'package.json'), 'utf8'))
const exes = readdirSync(PASTA)
  .filter((n) => n.endsWith(`-${version}.exe`))
  .sort()
if (!exes.length)
  throw new Error(`Nenhum .exe da versão ${version} em release/. Rode npm run dist antes.`)
const linhas = []
for (const n of exes) linhas.push(`${await sha256(join(PASTA, n))}  ${n}`)
writeFileSync(join(PASTA, 'SHA256SUMS.txt'), linhas.join('\n') + '\n')
console.log(linhas.join('\n'))
