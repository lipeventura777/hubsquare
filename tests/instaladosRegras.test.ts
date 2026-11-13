import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fonteDosLinks, metadadosDoJar, vencido } from '../src/main/instaladosRegras'
import { dependentes } from '../src/shared/dependentes'

test('removidos vencem depois de 7 dias', () => {
  const agora = Date.parse('2026-11-20T12:00:00Z')
  assert.equal(vencido('2026-11-14T12:00:00Z', agora), false)
  assert.equal(vencido('2026-11-13T11:00:00Z', agora), true)
  assert.equal(vencido('lixo', agora), true)
})

test('fonte pelos links do autor', () => {
  assert.equal(fonteDosLinks(['https://hangar.papermc.io/x/y']), 'hangar')
  assert.equal(
    fonteDosLinks([null, 'https://www.curseforge.com/minecraft/mc-mods/jei']),
    'curseforge'
  )
  assert.equal(fonteDosLinks(['https://dev.bukkit.org/projects/worldedit']), 'curseforge')
  assert.equal(fonteDosLinks(['https://github.com/x/y']), 'manual')
})

test('metadados de fabric.mod.json, mods.toml e plugin.yml', () => {
  assert.deepEqual(
    metadadosDoJar({
      fabric: JSON.stringify({
        id: 'jei',
        name: 'Just Enough Items',
        version: '19.0.0',
        contact: { homepage: 'https://www.curseforge.com/minecraft/mc-mods/jei' }
      })
    }),
    { nome: 'Just Enough Items', versao: '19.0.0', fonte: 'curseforge' }
  )
  assert.deepEqual(
    metadadosDoJar({
      toml: 'modLoader="javafml"\n[[mods]]\nmodId="create"\nversion="${file.jarVersion}"\ndisplayName="Create"\n'
    }),
    { nome: 'Create', versao: null, fonte: 'manual' }
  )
  assert.deepEqual(
    metadadosDoJar({
      plugin: "name: EssentialsX\nversion: '2.21.0'\nwebsite: https://hangar.papermc.io/x\n"
    }),
    { nome: 'EssentialsX', versao: '2.21.0', fonte: 'hangar' }
  )
  assert.deepEqual(metadadosDoJar({}), { nome: null, versao: null, fonte: 'manual' })
})

test('dependentes, inclusive em cadeia', () => {
  const itens = [
    { chave: 'api', projetoId: 'P7dR8mSH', dependencias: [] },
    { chave: 'lib', projetoId: 'lib1', dependencias: ['P7dR8mSH'] },
    { chave: 'mod', projetoId: 'mod1', dependencias: ['lib1'] },
    { chave: 'solto', projetoId: 'x', dependencias: [] }
  ]
  assert.deepEqual(
    dependentes(itens, ['api']).map((i) => i.chave),
    ['lib', 'mod']
  )
  assert.deepEqual(dependentes(itens, ['api', 'lib', 'mod']), [])
  assert.deepEqual(dependentes(itens, ['solto']), [])
})
