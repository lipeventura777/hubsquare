import { defineConfig } from '@playwright/test'
import { join } from 'node:path'

// Testes de ponta a ponta (Fase M3): o app compilado (out/) aberto pelo Playwright, cada teste
// numa pasta própria em .teste/. Rápido: sem internet (servidor simulado). Lento: downloads de
// verdade, com cache em .teste/cache.
export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.ts',
  outputDir: join(__dirname, '..', '..', '.teste', 'resultados'),
  globalSetup: './global.ts',
  globalTeardown: './global-fim.ts',
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  projects: [
    { name: 'rapido', grepInvert: /@lento|@desempenho/ },
    { name: 'lento', grep: /@lento/, timeout: 15 * 60_000 },
    { name: 'desempenho', grep: /@desempenho/ }
  ]
})
