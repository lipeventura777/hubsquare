import { idiomaAtual, numero, t } from '../shared/i18n'
// Página do painel pelo celular (Fase 20): leve, sem biblioteca, para telas de 360 a 430 px.
// Tokens do DESIGN.md (tema escuro). Tudo o que vem do servidor entra com textContent, nunca HTML.

// Fase I1: a página sai no idioma do app, montada na hora em que é servida.
const e = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const html = (): string => `<!doctype html>
<html lang="${idiomaAtual()}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#2b2b2b">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icone-32.png">
<link rel="apple-touch-icon" href="/icone.png">
<link rel="stylesheet" href="/app.css">
<title>HubSquare</title>
</head>
<body>
<main id="login" hidden>
  <h1 class="pixel">HubSquare</h1>
  <p class="muted">${e(t('celular.digiteOPin'))}</p>
  <form id="form-login">
    <input id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="current-password" placeholder="PIN" aria-label="PIN">
    <button class="botao primario" type="submit">${e(t('celular.entrar'))}</button>
  </form>
  <p id="erro-login" class="erro" role="alert"></p>
</main>

<main id="painel" hidden>
  <header class="cartao">
    <span id="faixa" class="faixa"></span>
    <div class="cresce">
      <select id="servidores" aria-label="${e(t('celular.servidor'))}"></select>
      <p id="detalhe" class="muted pequeno"></p>
    </div>
    <span class="status"><span id="bolinha" class="bolinha"></span><span id="status-texto"></span></span>
  </header>

  <button id="principal" class="botao grande pixel"></button>
  <button id="reiniciar" class="botao secundario">${e(t('celular.reiniciar'))}</button>
  <p id="erro" class="erro" role="alert"></p>

  <section class="cartao coluna">
    <h2>${e(t('celular.endereco'))}</h2>
    <div class="linha">
      <input id="endereco" readonly aria-label="${e(t('celular.enderecoDoServidor'))}">
      <button id="copiar" class="botao destaque">${e(t('celular.copiar'))}</button>
    </div>
  </section>

  <section class="cartao numeros">
    <div><span class="muted pequeno">CPU</span><b id="cpu">—</b></div>
    <div><span class="muted pequeno">RAM</span><b id="ram">—</b></div>
    <div><span class="muted pequeno">${e(t('celular.jogadores'))}</span><b id="contagem">0</b></div>
  </section>

  <section class="cartao coluna">
    <h2>${e(t('celular.jogadoresOnline'))}</h2>
    <ul id="jogadores"></ul>
  </section>

  <section class="cartao coluna">
    <h2>${e(t('celular.console'))}</h2>
    <pre id="console"></pre>
  </section>

  <footer>
    <span id="aparelho" class="muted pequeno"></span>
    <button id="sair" class="botao secundario pequeno">${e(t('celular.sair'))}</button>
  </footer>
</main>

<div id="fundo" hidden>
  <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="dialogo-titulo">
    <h2 id="dialogo-titulo" class="pixel"></h2>
    <p id="dialogo-texto"></p>
    <div class="linha fim">
      <button id="dialogo-nao" class="botao secundario">${e(t('celular.cancelar'))}</button>
      <button id="dialogo-sim" class="botao primario"></button>
    </div>
  </div>
</div>
<script src="/app.js"></script>
</body>
</html>`

export function css(accent: string, textoAccent: string): string {
  return `:root{--bg-app:#1e1e1e;--bg-sidebar:#2b2b2b;--bg-panel:#262626;--bg-panel-2:#313131;--bg-console:#0f0f0f;
--border:#141414;--text:#fff;--text-muted:#b4b4b4;--accent:${accent};--accent-text:${textoAccent};
--accent-shadow:color-mix(in srgb,var(--accent) 65%,#000);--danger:#c42b2b;--danger-shadow:#7a1717;
--warning:#e8c22b;--warning-shadow:#b08f12;--highlight:#7e3ff2;--highlight-shadow:#5a2ab0;
--secondary:#d0d1d4;--secondary-shadow:#8c8d90;--online:#52a535;--ligando:#e8c22b;--offline:#8a8a8a;--erro:#c42b2b}
*{box-sizing:border-box;border-radius:0}
html,body{margin:0;background:var(--bg-app);color:var(--text);font:14px/1.4 "Noto Sans",system-ui,sans-serif}
main{max-width:430px;margin:0 auto;padding:16px;display:flex;flex-direction:column;gap:12px}
[hidden]{display:none!important}
.pixel{font-family:"Pixelify Sans",ui-monospace,monospace;text-shadow:2px 2px 0 rgba(0,0,0,.6)}
h1{font-size:32px;color:var(--accent);margin:24px 0 0}
h2{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:var(--text-muted);margin:0}
.muted{color:var(--text-muted)}.pequeno{font-size:12px;margin:0}.erro{color:#ff6b6b;min-height:1em;margin:0}
.cartao{background:var(--bg-panel);border:1px solid var(--border);padding:12px;display:flex;gap:12px;align-items:center;position:relative}
.coluna{flex-direction:column;align-items:stretch}
.cresce{flex:1;min-width:0}
.faixa{position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--offline)}
.status{display:flex;align-items:center;gap:6px;font-size:12px;white-space:nowrap}
.bolinha{width:8px;height:8px;border-radius:50%;background:var(--offline)}
.ligando .bolinha{animation:pulso 1.2s infinite}
@keyframes pulso{50%{transform:scale(1.4);opacity:.5}}
@media (prefers-reduced-motion:reduce){.ligando .bolinha{animation:none}}
select,input{width:100%;height:36px;background:var(--bg-panel-2);color:var(--text);border:1px solid var(--border);padding:0 8px;font:inherit}
select{font-weight:700;font-size:16px}
input:focus,select:focus,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#pin{height:52px;font-size:28px;letter-spacing:.3em;text-align:center}
.linha{display:flex;gap:8px;align-items:center}.linha input{flex:1;min-width:0;width:auto}.fim{justify-content:flex-end}
.botao{min-height:40px;padding:0 18px;border:0;border-bottom:3px solid;box-shadow:inset 0 1px 0 rgba(255,255,255,.25);font:700 13px "Noto Sans",system-ui,sans-serif;cursor:pointer}
.botao:active{transform:translateY(2px);border-bottom-width:1px}
.botao:disabled{opacity:.5;cursor:not-allowed}
.primario{background:var(--accent);color:var(--accent-text);border-color:var(--accent-shadow)}
.secundario{background:var(--secondary);color:#1b1b1b;border-color:var(--secondary-shadow)}
.destaque{background:var(--highlight);color:#fff;border-color:var(--highlight-shadow)}
.grande{min-height:64px;font-size:26px;text-transform:uppercase;width:100%}
.ligar{background:var(--accent);color:var(--accent-text);border-color:var(--accent-shadow)}
.desligar{background:var(--danger);color:#fff;border-color:var(--danger-shadow)}
.espera{background:var(--warning);color:#1b1b1b;border-color:var(--warning-shadow)}
.pequeno.botao{min-height:32px}
.numeros{justify-content:space-around;text-align:center}.numeros div{display:flex;flex-direction:column}.numeros b{font-size:18px}
#jogadores{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
#jogadores li{display:flex;align-items:center;gap:8px}
.cabeca{width:28px;height:28px;image-rendering:pixelated;background:var(--bg-panel-2);display:flex;align-items:center;justify-content:center;font-weight:700}
#console{margin:0;background:var(--bg-console);padding:8px;height:220px;overflow:auto;font:12px/1.35 "Cascadia Mono",Consolas,monospace;white-space:pre-wrap;word-break:break-word;color:var(--text-muted)}
footer{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px}
#fundo{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}
.dialogo{background:var(--bg-panel);border:2px solid var(--border);padding:16px;max-width:400px;width:100%;display:flex;flex-direction:column;gap:12px}
.dialogo h2{font-size:20px;color:var(--text);text-transform:none;letter-spacing:0}
.dialogo p{margin:0}`
}

const CHAVES_JS = [
  'desligado',
  'ligando',
  'online',
  'desligando',
  'semConexao',
  'nenhumServidor',
  'ligar',
  'desligar',
  'configureAConexao',
  'ligueParaGerar',
  'ninguemOnline',
  'conectadoComo',
  'naoDeuCerto',
  'naoDeuParaEntrar',
  'desligarOServidor',
  'temJogadores',
  'backupAoDesligar',
  'reiniciarOServidor',
  'eleDesligaELiga',
  'reiniciar',
  'trocarDeServidor',
  'estaLigado',
  'trocar',
  'copiado',
  'copiar'
] as const

export const js = (): string => `(() => {
'use strict'
const $ = (id) => document.getElementById(id)
const T = ${JSON.stringify(Object.fromEntries(CHAVES_JS.map((k) => [k, t(`celular.${k}`)]))).replace(/</g, '\\u003c')}
const DECIMAL = ${JSON.stringify(numero(1.5).charAt(1))}
const TEXTO = { desligado: T.desligado, ligando: T.ligando, ligado: T.online, desligando: T.desligando }
const COR = { desligado: 'var(--offline)', ligando: 'var(--ligando)', ligado: 'var(--online)', desligando: 'var(--ligando)' }
let csrf = ''
let dados = null
let ocupado = false

async function api(caminho, corpo) {
  const opcoes = corpo === undefined
    ? { credentials: 'same-origin' }
    : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF': csrf }, body: JSON.stringify(corpo) }
  try {
    const r = await fetch(caminho, opcoes)
    const j = await r.json().catch(() => ({}))
    return Object.assign({ status: r.status }, j)
  } catch {
    return { status: 0, erro: T.semConexao }
  }
}

function mostrar(qual) {
  $('login').hidden = qual !== 'login'
  $('painel').hidden = qual !== 'painel'
}

function perguntar(titulo, texto, sim) {
  return new Promise((resolver) => {
    $('dialogo-titulo').textContent = titulo
    $('dialogo-texto').textContent = texto
    $('dialogo-sim').textContent = sim
    $('fundo').hidden = false
    const fim = (r) => { $('fundo').hidden = true; resolver(r) }
    $('dialogo-sim').onclick = () => fim(true)
    $('dialogo-nao').onclick = () => fim(false)
  })
}

function desenhar(d) {
  dados = d
  const e = d.estado
  const nome = d.servidor ? d.servidor.nome : T.nenhumServidor
  $('faixa').style.background = COR[e]
  $('bolinha').style.background = COR[e]
  $('status-texto').textContent = TEXTO[e]
  document.querySelector('.status').className = 'status' + (e === 'ligando' || e === 'desligando' ? ' ligando' : '')
  $('detalhe').textContent = d.servidor ? d.servidor.descricao : ''
  document.title = nome + ' · HubSquare'

  const sel = $('servidores')
  if (document.activeElement !== sel) {
    sel.replaceChildren(...d.servidores.map((s) => {
      const o = document.createElement('option')
      o.value = s.id
      o.textContent = s.nome
      o.selected = s.ativo
      return o
    }))
  }

  const p = $('principal')
  p.textContent = e === 'desligado' ? T.ligar : e === 'ligado' ? T.desligar : e === 'ligando' ? T.ligando : T.desligando
  p.className = 'botao grande pixel ' + (e === 'desligado' ? 'ligar' : e === 'ligado' ? 'desligar' : 'espera')
  p.disabled = ocupado || !d.servidor || (e !== 'desligado' && e !== 'ligado')
  $('reiniciar').disabled = ocupado || e !== 'ligado'

  $('endereco').value = d.endereco || (e === 'ligado' ? T.configureAConexao : T.ligueParaGerar)
  $('copiar').disabled = !d.endereco
  $('cpu').textContent = d.uso ? Math.round(d.uso.cpu) + '%' : '—'
  $('ram').textContent = d.uso ? (d.uso.ram / 1073741824).toFixed(1).replace('.', DECIMAL) + ' GB' : '—'
  $('contagem').textContent = String(d.jogadores.length)

  $('jogadores').replaceChildren(...(d.jogadores.length ? d.jogadores : [null]).map((j) => {
    const li = document.createElement('li')
    if (!j) { li.className = 'muted'; li.textContent = T.ninguemOnline; return li }
    const cab = document.createElement(j.uuid ? 'img' : 'span')
    cab.className = 'cabeca'
    if (j.uuid) {
      cab.src = '/api/cabeca?uuid=' + encodeURIComponent(j.uuid)
      cab.alt = ''
      cab.onerror = () => { const s = document.createElement('span'); s.className = 'cabeca'; s.textContent = j.nome[0].toUpperCase(); cab.replaceWith(s) }
    } else cab.textContent = j.nome[0].toUpperCase()
    const n = document.createElement('span')
    n.textContent = j.nome
    li.append(cab, n)
    return li
  }))

  const c = $('console')
  const noFim = c.scrollHeight - c.scrollTop - c.clientHeight < 24
  c.textContent = d.console.join('\\n')
  if (noFim) c.scrollTop = c.scrollHeight
  $('aparelho').textContent = T.conectadoComo.replace('{nome}', d.aparelho)
}

async function atualizar() {
  const r = await api('/api/estado')
  if (r.status === 401) return mostrar('login')
  if (r.status !== 200) { if (r.erro) $('erro').textContent = r.erro; return }
  csrf = r.csrf
  $('erro').textContent = ''
  mostrar('painel')
  desenhar(r)
}

async function agir(caminho, corpo) {
  ocupado = true
  if (dados) desenhar(dados)
  const r = await api(caminho, corpo)
  ocupado = false
  $('erro').textContent = r.status === 200 ? '' : (r.erro || T.naoDeuCerto)
  await atualizar()
}

$('form-login').onsubmit = async (ev) => {
  ev.preventDefault()
  const r = await api('/api/login', { pin: $('pin').value })
  $('pin').value = ''
  if (r.status === 200) { $('erro-login').textContent = ''; return atualizar() }
  $('erro-login').textContent = r.erro || T.naoDeuParaEntrar
}

$('principal').onclick = async () => {
  if (!dados) return
  if (dados.estado === 'desligado') return agir('/api/acao', { acao: 'ligar' })
  if (await perguntar(T.desligarOServidor, dados.jogadores.length ? T.temJogadores.replace('{n}', dados.jogadores.length) : T.backupAoDesligar, T.desligar)) agir('/api/acao', { acao: 'desligar' })
}
$('reiniciar').onclick = async () => {
  if (await perguntar(T.reiniciarOServidor, T.eleDesligaELiga, T.reiniciar)) agir('/api/acao', { acao: 'reiniciar' })
}
$('servidores').onchange = async (ev) => {
  const id = ev.target.value
  const alvo = dados && dados.servidores.find((s) => s.id === id)
  if (!dados || !alvo || alvo.ativo) return
  const ligado = dados.estado !== 'desligado'
  if (ligado) {
    const ok = await perguntar(T.trocarDeServidor, T.estaLigado.replace('{atual}', dados.servidor.nome).replace('{novo}', alvo.nome), T.trocar)
    if (!ok) return desenhar(dados)
  }
  agir('/api/trocar', { id, ligar: ligado })
}
$('copiar').onclick = () => {
  const campo = $('endereco')
  const texto = campo.value
  const pronto = () => { $('copiar').textContent = T.copiado; setTimeout(() => ($('copiar').textContent = T.copiar), 1500) }
  // Sem HTTPS o navegador pode bloquear a área de transferência moderna: usa o jeito antigo.
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(texto).then(pronto)
  campo.select()
  if (document.execCommand('copy')) pronto()
}
$('sair').onclick = async () => { await api('/api/sair', {}); mostrar('login') }

atualizar()
setInterval(() => { if (!document.hidden && $('fundo').hidden) atualizar() }, 3000)
})()`

export const manifesto = (): string =>
  JSON.stringify({
    name: 'HubSquare',
    short_name: 'HubSquare',
    description: t('p.celularPagina.painelDoSeuServidorDe'),
    start_url: '/',
    display: 'standalone',
    background_color: '#1e1e1e',
    theme_color: '#2b2b2b',
    icons: [{ src: '/icone.png', sizes: '256x256', type: 'image/png', purpose: 'any' }]
  })
