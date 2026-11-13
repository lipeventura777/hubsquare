import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { aplicarBiomaGuardado } from './aparencia/tema'
import { ErroGlobal, LimiteDeErro } from './componentes/ErroGlobal'
import { AvisoVersaoApp } from './componentes/AvisoVersaoApp'
import { AvisoPedido } from './componentes/AvisoPedido'

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
  </StrictMode>
)
