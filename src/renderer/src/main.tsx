import './idioma' // Fase I1: primeiro de tudo, para os textos já saírem no idioma certo
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { aplicarBiomaGuardado } from './aparencia/tema'
import { ErroGlobal, LimiteDeErro } from './componentes/ErroGlobal'
import { AvisoVersaoApp } from './componentes/AvisoVersaoApp'
import { AvisoPedido } from './componentes/AvisoPedido'
import { AvisoMigracao } from './componentes/AvisoMigracao'
import { RelatarGlobal } from './componentes/RelatarProblema'

// Antes de desenhar a tela, para não piscar o tema errado.
aplicarBiomaGuardado()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LimiteDeErro>
      <App />
    </LimiteDeErro>
    <ErroGlobal />
    <AvisoVersaoApp />
    <AvisoPedido />
    <AvisoMigracao />
    <RelatarGlobal />
  </StrictMode>
)
