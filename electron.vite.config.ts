import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    // Fase L1: a chave oficial do CurseForge vem só do ambiente do build (o segredo
    // CURSEFORGE_API_KEY do GitHub, no release.yml). Sem ela, fica vazia e o CurseForge aparece
    // como "em breve". Nunca escreva a chave aqui nem em .env do repositório.
    define: { __CHAVE_CURSEFORGE__: JSON.stringify(process.env.CURSEFORGE_API_KEY ?? '') }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
