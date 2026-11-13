import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { prepararMundoDoPaper } from '../src/main/mundoPaper'

const DO_PAPER = join('dimensions', 'minecraft', 'overworld', 'data', 'minecraft')
const PADRAO = join('data', 'minecraft')

function mundo(): string {
  const pasta = mkdtempSync(join(tmpdir(), 'mundo-'))
  mkdirSync(join(pasta, DO_PAPER), { recursive: true })
  mkdirSync(join(pasta, PADRAO), { recursive: true })
  return pasta
}

test('mundo do Paper ganha as configurações de geração onde os outros softwares procuram', async () => {
  const pasta = mundo()
  writeFileSync(join(pasta, DO_PAPER, 'world_gen_settings.dat'), 'seed do paper')
  assert.equal(await prepararMundoDoPaper(pasta), true)
  assert.equal(readFileSync(join(pasta, PADRAO, 'world_gen_settings.dat'), 'utf8'), 'seed do paper')
})

test('não mexe quando o arquivo já existe no lugar padrão', async () => {
  const pasta = mundo()
  writeFileSync(join(pasta, DO_PAPER, 'world_gen_settings.dat'), 'seed do paper')
  writeFileSync(join(pasta, PADRAO, 'world_gen_settings.dat'), 'seed atual')
  assert.equal(await prepararMundoDoPaper(pasta), false)
  assert.equal(readFileSync(join(pasta, PADRAO, 'world_gen_settings.dat'), 'utf8'), 'seed atual')
})

test('mundo que nunca foi do Paper (ou ainda não existe) fica como está', async () => {
  assert.equal(await prepararMundoDoPaper(mundo()), false)
  assert.equal(await prepararMundoDoPaper(join(tmpdir(), 'nao-existe-servsquare')), false)
})
