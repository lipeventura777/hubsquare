import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  intervalo,
  muitosResultados,
  numerosPaginas,
  paginaValida,
  pedidosDaPagina,
  tamanhoValido,
  textoIntervalo,
  totalAlcancavel,
  totalPaginas
} from '../src/shared/paginaRegras.ts'

// Páginas nas listas de mods (Fase V9).

test('total de páginas e página fora do limite', () => {
  assert.equal(totalPaginas(0, 24), 1)
  assert.equal(totalPaginas(24, 24), 1)
  assert.equal(totalPaginas(25, 24), 2)
  assert.equal(paginaValida(9, 50, 24), 3) // passou do fim: a última
  assert.equal(paginaValida(0, 50, 24), 1)
  assert.equal(paginaValida(-3, 50, 24), 1)
  assert.equal(paginaValida(NaN, 50, 24), 1)
  assert.equal(paginaValida(2, 0, 24), 1) // lista vazia
})

test('intervalo mostrado e o texto', () => {
  assert.deepEqual(intervalo(2, 24, 1234), { de: 25, ate: 48 })
  assert.deepEqual(intervalo(52, 24, 1234), { de: 1225, ate: 1234 }) // última, incompleta
  assert.deepEqual(intervalo(1, 24, 0), { de: 0, ate: 0 })
  assert.equal(textoIntervalo(2, 24, 1234), 'Mostrando 25–48 de 1.234')
})

test('números com reticências', () => {
  assert.deepEqual(numerosPaginas(5, 20), [1, '…', 4, 5, 6, '…', 20])
  // Sempre 7 posições: a barra não muda de largura ao trocar de página.
  assert.deepEqual(numerosPaginas(1, 20), [1, 2, 3, 4, '…', 20])
  assert.deepEqual(numerosPaginas(20, 20), [1, '…', 17, 18, 19, 20])
  assert.deepEqual(numerosPaginas(3, 20), [1, 2, 3, 4, '…', 20])
  assert.deepEqual(numerosPaginas(4, 7), [1, 2, 3, 4, 5, 6, 7])
  assert.deepEqual(numerosPaginas(1, 1), [1])
})

test('tamanho da página: só os da lista, senão o padrão', () => {
  assert.equal(tamanhoValido(48), 48)
  assert.equal(tamanhoValido(50), 24)
  assert.equal(tamanhoValido('96'), 24)
})

test('Modrinth: offset/limit, até 100 por pedido', () => {
  assert.deepEqual(pedidosDaPagina('modrinth', 3, 24), [{ offset: 48, limit: 24 }])
  assert.deepEqual(pedidosDaPagina('modrinth', 1, 96), [{ offset: 0, limit: 96 }])
})

test('CurseForge: até 50 por pedido e index + pageSize até 10.000', () => {
  // 96 por página: dois pedidos para a mesma página.
  assert.deepEqual(pedidosDaPagina('curseforge', 2, 96), [
    { offset: 96, limit: 50 },
    { offset: 146, limit: 46 }
  ])
  // A página que cruza o limite só pede até 10.000.
  assert.deepEqual(pedidosDaPagina('curseforge', 105, 96), [{ offset: 9984, limit: 16 }])
  // Além do limite: nenhum pedido.
  assert.deepEqual(pedidosDaPagina('curseforge', 200, 96), [])
  for (const p of pedidosDaPagina('curseforge', 104, 96)) assert.ok(p.offset + p.limit <= 10_000)
  assert.equal(totalAlcancavel('curseforge', 25_000), 10_000)
  assert.equal(totalAlcancavel('modrinth', 25_000), 25_000)
  assert.equal(muitosResultados('curseforge', 10_001), true)
  assert.equal(muitosResultados('curseforge', 10_000), false)
  assert.equal(muitosResultados('modrinth', 50_000), false)
})

test('Hangar: offset/limit, até 25 por pedido', () => {
  assert.deepEqual(pedidosDaPagina('hangar', 1, 48), [
    { offset: 0, limit: 25 },
    { offset: 25, limit: 23 }
  ])
})
