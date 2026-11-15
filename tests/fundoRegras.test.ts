import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AJUSTE_PADRAO,
  arquivoDoProtocolo,
  camadaDeLuz,
  fundoAppAntigo,
  fundoDoServidor,
  fundoEfetivo,
  validarFundoServidor,
  fundoInstalacaoAntigo,
  LIMITE_IMAGEM,
  motivoRecusa,
  tamanhoReduzido,
  tipoDaImagem,
  tomDoVidro,
  validarAjuste,
  validarEscolha
} from '../src/shared/fundoRegras.ts'

const HASH = 'a'.repeat(64)
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50])

test('tipo pelos bytes, nunca pela extensão', () => {
  assert.equal(tipoDaImagem(PNG), 'png')
  assert.equal(tipoDaImagem(JPG), 'jpg')
  assert.equal(tipoDaImagem(WEBP), 'webp')
  assert.equal(tipoDaImagem(new TextEncoder().encode('<html>não sou imagem')), null)
  assert.equal(tipoDaImagem(new Uint8Array([0x47, 0x49, 0x46, 0x38])), null) // GIF não
})

test('arquivo que não é imagem e imagem acima de 25 MB são recusados', () => {
  assert.match(motivoRecusa(new TextEncoder().encode('MZ executável'), 100)!, /não é uma imagem/)
  assert.match(motivoRecusa(PNG, LIMITE_IMAGEM + 1)!, /até 25 MB/)
  assert.equal(motivoRecusa(PNG, LIMITE_IMAGEM), null)
})

test('protocolo: só nomes gerados pelo app, nada de .. ou outra pasta', () => {
  assert.equal(arquivoDoProtocolo(`hubsquare-fundo://img/${HASH}.png`), `${HASH}.png`)
  for (const ruim of [
    `hubsquare-fundo://img/../${HASH}.png`,
    'hubsquare-fundo://img/..%2F..%2Fsegredo.png',
    'hubsquare-fundo://img/%2e%2e/aparencia.json',
    'hubsquare-fundo://img/C:/Windows/win.ini',
    `hubsquare-fundo://outro/${HASH}.png`,
    `hubsquare-fundo://img/${HASH}.gif`,
    `hubsquare-fundo://img/${HASH}.png/../x`,
    `file:///C:/fundos/${HASH}.png`,
    'hubsquare-fundo://img/aparencia.json',
    'não é url'
  ])
    assert.equal(arquivoDoProtocolo(ruim), null, ruim)
})

test('imagens maiores que 2560px são reduzidas sem mudar a proporção', () => {
  assert.equal(tamanhoReduzido(1920, 1080), null)
  assert.deepEqual(tamanhoReduzido(5120, 2880), { largura: 2560, altura: 1440 })
  assert.deepEqual(tamanhoReduzido(1000, 4000), { largura: 640, altura: 2560 })
})

test('prioridade: instalação > app > bioma padrão', () => {
  const app = { tipo: 'bioma' as const, bioma: 'noite' as const }
  const inst = { tipo: 'imagem' as const, imagem: `${HASH}.png`, ajuste: AJUSTE_PADRAO }
  assert.deepEqual(fundoEfetivo(inst, app, 'dia'), inst)
  assert.deepEqual(fundoEfetivo(null, app, 'dia'), app)
  assert.deepEqual(fundoEfetivo(undefined, undefined, 'mar'), { tipo: 'bioma', bioma: 'mar' })
})

test('escolhas e ajustes validados (valores fora do limite ficam no limite)', () => {
  assert.equal(validarEscolha(null), null)
  assert.deepEqual(validarEscolha({ tipo: 'bioma', bioma: 'nether' }), {
    tipo: 'bioma',
    bioma: 'nether'
  })
  assert.throws(() => validarEscolha({ tipo: 'bioma', bioma: 'lua' }))
  assert.throws(() => validarEscolha({ tipo: 'imagem', imagem: '../x.png' }))
  assert.deepEqual(
    validarAjuste({
      enquadrar: 'inteira',
      focoX: 2,
      focoY: -1,
      desfoque: 99,
      luz: -100,
      particulas: 'x'
    }),
    { enquadrar: 'inteira', focoX: 1, focoY: 0, desfoque: 20, luz: -60, particulas: null }
  )
})

test('tom do vidro pela luz da imagem, e a camada de luz', () => {
  assert.equal(tomDoVidro(0.8), 'diaClaro')
  assert.equal(tomDoVidro(0.2), 'dia')
  assert.deepEqual(camadaDeLuz(-40), { cor: 'preto', opacidade: 0.4 })
  assert.deepEqual(camadaDeLuz(25), { cor: 'branco', opacidade: 0.25 })
  assert.equal(camadaDeLuz(0), null)
})

test('migração: o que já valia continua valendo', () => {
  assert.deepEqual(fundoAppAntigo({ bioma: 'mar', fundoEmTodoApp: false }).usarImagemAntiga, false)
  const m = fundoAppAntigo({
    bioma: 'mar',
    fundoEmTodoApp: true,
    escurecimento: 0.6,
    particulasSobreImagem: true
  })
  assert.equal(m.usarImagemAntiga, true)
  assert.equal(m.ajuste.luz, -60)
  assert.equal(m.ajuste.particulas, 'mar')
  assert.equal(
    fundoInstalacaoAntigo({ bannerBioma: 'dia', imagemPropria: 'existe', padraoAntigo: true }),
    'bioma'
  )
  assert.equal(fundoInstalacaoAntigo({ imagemPropria: 'existe', padraoAntigo: true }), 'imagem')
  assert.equal(fundoInstalacaoAntigo({ imagemPropria: 'sumiu', padraoAntigo: true }), 'sumiu')
  assert.equal(fundoInstalacaoAntigo({ imagemPropria: null, padraoAntigo: true }), 'padrao')
  assert.equal(fundoInstalacaoAntigo({ imagemPropria: null, padraoAntigo: false }), 'igual')
})

// Fase V10: fundo próprio de cada servidor do ServSquare.
test('servidor: fundo do servidor > fundo do app > bioma padrão', () => {
  const app = { tipo: 'bioma' as const, bioma: 'noite' as const }
  const imagem = { tipo: 'imagem' as const, imagem: 'a'.repeat(64) + '.png', ajuste: AJUSTE_PADRAO }
  // Sem escolha (igual ao app): vale o app; sem app, o bioma padrão.
  assert.deepEqual(fundoEfetivo(fundoDoServidor(null, undefined), app, 'dia'), app)
  assert.deepEqual(fundoEfetivo(fundoDoServidor(undefined, null), null, 'dia'), {
    tipo: 'bioma',
    bioma: 'dia'
  })
  // Escolha própria vence o app.
  assert.deepEqual(fundoEfetivo(fundoDoServidor(imagem, undefined), app, 'dia'), imagem)
})

test('servidor: "Igual à instalação" segue a regra da instalação', () => {
  const app = { tipo: 'bioma' as const, bioma: 'noite' as const }
  const mar = { tipo: 'bioma' as const, bioma: 'mar' as const }
  const igual = { tipo: 'instalacao' as const }
  assert.deepEqual(fundoDoServidor(igual, mar), mar) // a instalação tem fundo próprio
  // A instalação muda: o servidor acompanha.
  assert.deepEqual(fundoDoServidor(igual, { tipo: 'bioma', bioma: 'nether' }), {
    tipo: 'bioma',
    bioma: 'nether'
  })
  // Instalação "igual ao app" ou sem instalação: vale o app.
  assert.deepEqual(fundoEfetivo(fundoDoServidor(igual, null), app, 'dia'), app)
  assert.deepEqual(fundoEfetivo(fundoDoServidor(igual, undefined), app, 'dia'), app)
})

test('servidor: escolha guardada é validada', () => {
  assert.deepEqual(validarFundoServidor({ tipo: 'instalacao', lixo: 1 }), { tipo: 'instalacao' })
  assert.equal(validarFundoServidor(null), null)
  assert.deepEqual(validarFundoServidor({ tipo: 'bioma', bioma: 'mar' }), {
    tipo: 'bioma',
    bioma: 'mar'
  })
  assert.throws(() => validarFundoServidor({ tipo: 'bioma', bioma: 'lua' }))
})
