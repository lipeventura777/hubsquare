import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  escolherArquivoCF,
  escolherVersaoHangar,
  hangarServe,
  loaderDoManifest,
  soDoClienteCF
} from '../src/main/fontesRegras'
import { downloadPermitido, imagemPermitida } from '../src/shared/fontes'

test('downloads e imagens só dos CDNs oficiais', () => {
  assert.equal(downloadPermitido('https://edge.forgecdn.net/files/1/2/a.jar', 'curseforge'), true)
  assert.equal(downloadPermitido('https://edge.forgecdn.net/files/1/2/a.jar', 'modrinth'), false)
  assert.equal(downloadPermitido('http://edge.forgecdn.net/a.jar', 'curseforge'), false)
  assert.equal(downloadPermitido('https://hangarcdn.papermc.io/plugins/x.jar', 'hangar'), true)
  assert.equal(downloadPermitido('https://espelho.exemplo/a.jar', 'curseforge'), false)
  assert.equal(imagemPermitida('https://media.forgecdn.net/avatars/1.png'), true)
  assert.equal(imagemPermitida('https://i.imgur.com/x.png'), false)
})

test('loader do manifest.json do CurseForge', () => {
  assert.deepEqual(loaderDoManifest([{ id: 'forge-47.2.0', primary: true }]), {
    tipo: 'forge',
    versao: '47.2.0'
  })
  assert.deepEqual(loaderDoManifest([{ id: 'neoforge-21.1.77' }]), {
    tipo: 'neoforge',
    versao: '21.1.77'
  })
  assert.throws(() => loaderDoManifest([{ id: 'quilt-0.20.0', primary: true }]), /quilt/)
  assert.throws(() => loaderDoManifest([]), /não diz/)
})

test('arquivo do CurseForge: versão, loader, release e só do cliente', () => {
  const a = (
    id: number,
    data: string,
    tipo: number,
    versoes: string[]
  ): {
    id: number
    fileDate: string
    releaseType: number
    gameVersions: string[]
  } => ({ id, fileDate: data, releaseType: tipo, gameVersions: versoes })
  const lista = [
    a(1, '2026-01-01', 1, ['1.20.1', 'Forge']),
    a(2, '2026-03-01', 2, ['1.20.1', 'Forge']),
    a(3, '2026-04-01', 1, ['1.20.1', 'Fabric']),
    a(4, '2026-02-01', 1, ['1.21.1', 'Forge'])
  ]
  assert.equal(escolherArquivoCF(lista, ['1.20.1'], 'Forge')?.id, 1)
  assert.equal(escolherArquivoCF(lista, ['1.20.1'], 'Fabric')?.id, 3)
  assert.equal(escolherArquivoCF(lista, ['1.19.2'], 'Forge'), undefined)
  assert.equal(
    escolherArquivoCF([a(9, '2026-01-01', 1, ['1.21'])], ['1.21.4', '1.21'], null)?.id,
    9
  )
  assert.equal(soDoClienteCF(['1.20.1', 'Client']), true)
  assert.equal(soDoClienteCF(['1.20.1', 'Client', 'Server']), false)
  assert.equal(soDoClienteCF(['1.20.1']), false)
})

test('versão do Hangar compatível com o Paper do servidor', () => {
  assert.equal(hangarServe(['1.21.11', '26.1.2'], '1.21.4'), true)
  assert.equal(hangarServe(['1.20.6'], '1.21.4'), false)
  assert.equal(hangarServe(['26.3'], '26.3'), true)
  const v = (
    data: string,
    canal: string,
    versoes: string[]
  ): {
    createdAt: string
    channel: { name: string }
    platformDependencies: Record<string, string[]>
  } => ({ createdAt: data, channel: { name: canal }, platformDependencies: { PAPER: versoes } })
  const lista = [
    v('2026-05-01', 'Snapshot', ['1.21.11']),
    v('2026-04-01', 'Release', ['1.21.11']),
    v('2026-06-01', 'Release', ['1.20.6'])
  ]
  assert.equal(escolherVersaoHangar(lista, '1.21.4')?.createdAt, '2026-04-01')
  assert.equal(escolherVersaoHangar(lista, '1.19.4'), undefined)
})
