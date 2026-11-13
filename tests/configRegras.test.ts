import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aplicarMudancas, formatoDe, lerCampos, type Formato } from '../src/main/configRegras'

const achar = (texto: string, f: Formato, chave: string): ReturnType<typeof lerCampos>[number] => {
  const c = lerCampos(texto, f).find((x) => x.chave === chave)
  assert.ok(c, `campo ${chave} não encontrado`)
  return c
}

// Só o valor muda: o resto do arquivo (comentários incluídos) fica igual.
function soMudou(antes: string, depois: string, de: string, para: string): void {
  assert.equal(depois, antes.replace(de, para))
}

test('formato pelo nome do arquivo', () => {
  assert.equal(formatoDe('config/create-common.toml'), 'toml')
  assert.equal(formatoDe('plugins/Essentials/config.YML'), 'yml')
  assert.equal(formatoDe('a.yaml'), 'yml')
  assert.equal(formatoDe('sodium-options.json'), 'json')
  assert.equal(formatoDe('x.json5'), 'json5')
  assert.equal(formatoDe('x.cfg'), null)
})

const TOML = `# Configuração do Create
[worldgen]
\t#Liga a geração de minérios
\t#Padrão: true
\tdisableWorldGen = false # fim de linha

[kinetics]
\t# Velocidade máxima
\t#Range: 0 ~ 256
\tmaxRotationSpeed = 256
\tfanSpeed = 1.5
\tname = "Engrenagem"
\tlit = 'C:\\pasta'
\tmobs = ["minecraft:zombie", "minecraft:skeleton"]
\tlonga = [
\t\t"a", # comentário dentro
\t\t"b"
\t]
\tdata = 1979-05-27T07:32:00Z
`

test('toml: campos, tipos e comentários como descrição', () => {
  const c = achar(TOML, 'toml', 'worldgen.disableWorldGen')
  assert.equal(c.tipo, 'bool')
  assert.equal(c.valor, false)
  assert.equal(c.descricao, 'Liga a geração de minérios\nPadrão: true')
  assert.equal(achar(TOML, 'toml', 'kinetics.maxRotationSpeed').tipo, 'numero')
  assert.equal(achar(TOML, 'toml', 'kinetics.name').valor, 'Engrenagem')
  assert.equal(achar(TOML, 'toml', 'kinetics.lit').valor, 'C:\\pasta')
  assert.deepEqual(achar(TOML, 'toml', 'kinetics.mobs').valor, [
    'minecraft:zombie',
    'minecraft:skeleton'
  ])
  assert.equal(achar(TOML, 'toml', 'kinetics.longa').tipo, 'leitura') // comentário dentro
  assert.equal(achar(TOML, 'toml', 'kinetics.data').tipo, 'leitura')
})

test('toml: salvar sem mudar é idêntico; mudar troca só o valor', () => {
  assert.equal(aplicarMudancas(TOML, 'toml', {}), TOML)
  const b = achar(TOML, 'toml', 'worldgen.disableWorldGen')
  soMudou(
    TOML,
    aplicarMudancas(TOML, 'toml', { [b.id]: true }),
    'disableWorldGen = false # fim',
    'disableWorldGen = true # fim'
  )
  const f = achar(TOML, 'toml', 'kinetics.fanSpeed')
  soMudou(TOML, aplicarMudancas(TOML, 'toml', { [f.id]: '2' }), 'fanSpeed = 1.5', 'fanSpeed = 2.0')
  const m = achar(TOML, 'toml', 'kinetics.mobs')
  soMudou(
    TOML,
    aplicarMudancas(TOML, 'toml', { [m.id]: ['minecraft:creeper'] }),
    '["minecraft:zombie", "minecraft:skeleton"]',
    '["minecraft:creeper"]'
  )
  const n = achar(TOML, 'toml', 'kinetics.name')
  soMudou(
    TOML,
    aplicarMudancas(TOML, 'toml', { [n.id]: 'Diz "oi"' }),
    '"Engrenagem"',
    '"Diz \\"oi\\""'
  )
  assert.throws(() => aplicarMudancas(TOML, 'toml', { [f.id]: 'abc' }), /número/)
  const l = achar(TOML, 'toml', 'kinetics.longa')
  assert.throws(() => aplicarMudancas(TOML, 'toml', { [l.id]: ['x'] }), /Editar como texto/)
})

const YAML = `# Config do plugin
settings:
  # Liga o modo debug
  debug: false
  max-homes: 3
  ratio: 0.5
  prefix: '&6[Casa] '
  welcome: "Olá, {player}!"
  world: world_nether # comentário
  # Mundos bloqueados
  blocked-worlds:
    - world_the_end
    - 'arena'
  aliases: [home, casa]
  motd: |
    linha 1
    linha 2
messages:
  no-permission: Sem permissão.
`

test('yaml: caminhos, tipos, listas e blocos', () => {
  assert.equal(achar(YAML, 'yml', 'settings.debug').tipo, 'bool')
  assert.equal(achar(YAML, 'yml', 'settings.debug').descricao, 'Liga o modo debug')
  assert.equal(achar(YAML, 'yml', 'settings.max-homes').tipo, 'numero')
  assert.equal(achar(YAML, 'yml', 'settings.prefix').valor, '&6[Casa] ')
  assert.equal(achar(YAML, 'yml', 'settings.welcome').valor, 'Olá, {player}!')
  assert.equal(achar(YAML, 'yml', 'settings.world').valor, 'world_nether')
  assert.deepEqual(achar(YAML, 'yml', 'settings.blocked-worlds').valor, ['world_the_end', 'arena'])
  assert.equal(achar(YAML, 'yml', 'settings.blocked-worlds').descricao, 'Mundos bloqueados')
  assert.deepEqual(achar(YAML, 'yml', 'settings.aliases').valor, ['home', 'casa'])
  assert.equal(achar(YAML, 'yml', 'settings.motd').tipo, 'leitura')
  assert.equal(achar(YAML, 'yml', 'messages.no-permission').valor, 'Sem permissão.')
})

test('yaml: salvar preserva tudo e respeita as aspas', () => {
  assert.equal(aplicarMudancas(YAML, 'yml', {}), YAML)
  const d = achar(YAML, 'yml', 'settings.debug')
  soMudou(YAML, aplicarMudancas(YAML, 'yml', { [d.id]: true }), 'debug: false', 'debug: true')
  const w = achar(YAML, 'yml', 'settings.world')
  soMudou(
    YAML,
    aplicarMudancas(YAML, 'yml', { [w.id]: 'meu mundo: 2' }),
    'world: world_nether # comentário',
    'world: "meu mundo: 2" # comentário'
  )
  const p = achar(YAML, 'yml', 'settings.prefix')
  soMudou(YAML, aplicarMudancas(YAML, 'yml', { [p.id]: "it's" }), "'&6[Casa] '", "'it''s'")
  const b = achar(YAML, 'yml', 'settings.blocked-worlds')
  soMudou(
    YAML,
    aplicarMudancas(YAML, 'yml', { [b.id]: ['a', 'b', 'c'] }),
    "    - world_the_end\n    - 'arena'",
    "    - 'a'\n    - 'b'\n    - 'c'"
  )
})

const JSON5 = `{
  // Qualidade dos gráficos
  quality: {
    /* Distância de renderização */
    render_distance: 12,
    fancy: true,
    'name': 'baixa',
  },
  "list": ["a", "b"],
  objs: [{ id: 1 }, { id: 2 }],
}
`

test('json5: comentários, chaves sem aspas e listas', () => {
  const r = achar(JSON5, 'json5', 'quality.render_distance')
  assert.equal(r.tipo, 'numero')
  assert.equal(r.descricao, 'Distância de renderização')
  assert.equal(achar(JSON5, 'json5', 'quality.name').valor, 'baixa')
  assert.deepEqual(achar(JSON5, 'json5', 'list').valor, ['a', 'b'])
  assert.equal(achar(JSON5, 'json5', 'objs[1].id').valor, '2')
  assert.equal(aplicarMudancas(JSON5, 'json5', {}), JSON5)
  const f = achar(JSON5, 'json5', 'quality.fancy')
  soMudou(JSON5, aplicarMudancas(JSON5, 'json5', { [f.id]: false }), 'fancy: true', 'fancy: false')
  const n = achar(JSON5, 'json5', 'quality.name')
  soMudou(JSON5, aplicarMudancas(JSON5, 'json5', { [n.id]: 'alta' }), "'baixa'", "'alta'")
})

test('json: arquivo comum e arquivo quebrado', () => {
  const J = '{\n  "a": {"b": 1, "c": "x"},\n  "d": [1, 2]\n}\n'
  const c = achar(J, 'json', 'a.c')
  assert.equal(aplicarMudancas(J, 'json', { [c.id]: 'y' }), J.replace('"x"', '"y"'))
  const d = achar(J, 'json', 'd')
  assert.equal(aplicarMudancas(J, 'json', { [d.id]: ['3'] }), J.replace('[1, 2]', '[3]'))
  assert.deepEqual(lerCampos('{ "a": ', 'json'), [])
})

const PROPS = `# Config
# do mod
enabled=true
max-players = 20
motd=Ol\\u00e1 mundo
continua=a \\
  b
`

test('properties: tipos, escapes e linha que continua', () => {
  assert.equal(achar(PROPS, 'properties', 'enabled').descricao, 'Config\ndo mod')
  assert.equal(achar(PROPS, 'properties', 'max-players').tipo, 'numero')
  assert.equal(achar(PROPS, 'properties', 'motd').valor, 'Olá mundo')
  assert.equal(achar(PROPS, 'properties', 'continua').tipo, 'leitura')
  assert.equal(aplicarMudancas(PROPS, 'properties', {}), PROPS)
  const m = achar(PROPS, 'properties', 'max-players')
  soMudou(PROPS, aplicarMudancas(PROPS, 'properties', { [m.id]: '30' }), '= 20', '= 30')
  const t = achar(PROPS, 'properties', 'motd')
  soMudou(
    PROPS,
    aplicarMudancas(PROPS, 'properties', { [t.id]: 'Até já' }),
    'Ol\\u00e1 mundo',
    'At\\u00e9 j\\u00e1'
  )
})

test('CRLF: o Windows guarda \\r\\n e isso também fica igual', () => {
  const T = '# a\r\nx = 1\r\ny = "b"\r\n'
  const x = achar(T, 'toml', 'x')
  assert.equal(aplicarMudancas(T, 'toml', { [x.id]: '5' }), '# a\r\nx = 5\r\ny = "b"\r\n')
  const Y = 'a:\r\n  b: 1\r\n  l:\r\n    - x\r\n    - y\r\n'
  const l = achar(Y, 'yml', 'a.l')
  assert.equal(aplicarMudancas(Y, 'yml', { [l.id]: ['z'] }), 'a:\r\n  b: 1\r\n  l:\r\n    - z\r\n')
})
