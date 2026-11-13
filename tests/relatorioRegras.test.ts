import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fimDoTexto,
  itensEscolhidos,
  leiaMe,
  limparObjeto,
  limparTexto,
  nomeDoRelatorio,
  REMOVIDO,
  sobrouSegredo,
  ultimaEntrada,
  USUARIO
} from '../src/main/relatorioRegras'

const L = {
  casas: ['C:\\Users\\Ana Souza'],
  segredos: ['segredo-do-playit-777', 'chave-cf-$2a$10$abcdef', 'K7M2P9QX4T8VW3RZ']
}

test('segredos deste PC somem onde quer que apareçam', () => {
  const t = limparTexto(
    'playit: segredo-do-playit-777\nkey=chave-cf-$2a$10$abcdef\nurl /convite/K7M2P9QX4T8VW3RZ/manifesto.json',
    L
  )
  for (const s of L.segredos) assert.ok(!t.includes(s), s)
  assert.ok(t.includes(REMOVIDO))
})

test('nome do usuário nos caminhos vira %USERPROFILE% (com \\, / e \\\\ do JSON)', () => {
  const t = limparTexto(
    'C:\\Users\\Ana Souza\\Documents\\x\nc:/users/ana souza/AppData\n{"p":"C:\\\\Users\\\\Ana Souza\\\\y"}\nD:\\Users\\Outro\\z',
    L
  )
  assert.ok(!/ana souza/i.test(t), t)
  assert.ok(!t.includes('Outro'), t)
  assert.equal(t.split(USUARIO).length - 1, 4)
  assert.ok(t.includes('C:\\Users\\Public') === false)
  assert.equal(limparTexto('C:\\Users\\Public\\Desktop', L), 'C:\\Users\\Public\\Desktop')
})

test('campos de segredo em texto, cookies, Bearer, JWT, accessToken e tokens de convite', () => {
  const t = limparTexto(
    [
      'rcon.password=abc123',
      '"token": "XYZ-pode-ser-qualquer"',
      'secret: hunter2',
      'Cookie: hs_sessao=abcdef123',
      'Authorization: Bearer abc.def.ghi',
      'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.assinatura',
      '--accessToken 0123456789abcdef --uuid 069a79f4',
      'código 10.0.0.5:8788#AB12-CD34-EF56-GH78'
    ].join('\n'),
    L
  )
  for (const s of [
    'abc123',
    'XYZ-pode',
    'hunter2',
    'abcdef123',
    'abc.def.ghi',
    'eyJhbGci',
    '0123456789abcdef',
    'AB12-CD34'
  ])
    assert.ok(!t.includes(s), `${s} sobrou em:\n${t}`)
  assert.ok(t.includes('--uuid 069a79f4'), 'o UUID do jogador não é segredo')
  assert.ok(t.includes('10.0.0.5:8788'), 'IP da casa fica')
  assert.ok(t.includes('Cookie: [removido]\n'), 'sem colchete sobrando')
})

test('o que não é segredo fica: hashes de mods, versões, ping e texto comum', () => {
  const texto =
    'sodium-0.6.jar sha1 0a1b2c3d4e5f60718293a4b5c6d7e8f901234567\nping: 34ms\nMinecraft 1.21.4\nChave do CurseForge salva.'
  assert.equal(limparTexto(texto, L), texto)
})

test('IP público mascarado; IPs da casa, do Radmin e do Tailscale ficam', () => {
  const t = limparTexto('público 187.45.10.20, casa 192.168.0.7, radmin 26.1.2.3, ts 100.64.0.9', L)
  assert.equal(t, 'público 187.45.•••.•••, casa 192.168.0.7, radmin 26.1.2.3, ts 100.64.0.9')
})

test('JSON: campos de segredo saem inteiros, o resto passa pela limpeza', () => {
  const o = limparObjeto(
    {
      nome: 'Mundo',
      pasta: 'C:\\Users\\Ana Souza\\Documents\\ServSquare\\servidores\\Mundo',
      pin: { salt: 'aa', hash: 'bb' },
      sessoes: [{ id: 'x' }],
      origem: { tipo: 'convite', token: 'K7M2P9QX4T8VW3RZ', enderecos: ['1.2.3.4:25565'] },
      ram: 4
    },
    L
  ) as Record<string, unknown>
  assert.deepEqual(o, {
    nome: 'Mundo',
    pasta: `${USUARIO}\\Documents\\ServSquare\\servidores\\Mundo`,
    pin: REMOVIDO,
    sessoes: REMOVIDO,
    origem: { tipo: 'convite', token: REMOVIDO, enderecos: ['1.2.•••.•••:25565'] },
    ram: 4
  })
})

test('fim do log, itens, nome do arquivo, LEIA-ME e conferência final', () => {
  assert.equal(fimDoTexto('abc', 10), 'abc')
  const fim = fimDoTexto('linha1\nlinha2\nlinha3\n', 10)
  assert.match(fim, /só o final/)
  assert.ok(fim.endsWith('linha3\n'))
  assert.deepEqual(itensEscolhidos(['mods', 'jogo']).includes('mods'), false)
  assert.equal(itensEscolhidos(undefined).length, 9)
  assert.equal(
    nomeDoRelatorio(new Date(2026, 10, 13, 9, 5)),
    'HubSquare-relatorio-2026-11-13_09-05.zip'
  )
  const leia = leiaMe({
    geradoEm: 'agora',
    versaoApp: '1.1.0',
    windows: '10',
    servidor: 'Mundo',
    instalacao: null,
    arquivos: ['erros.log'],
    ultimoErro: 'Erro X',
    diagnostico: null
  })
  assert.match(leia, /Servidor escolhido: Mundo/)
  assert.match(leia, /- erros\.log/)
  assert.equal(
    sobrouSegredo({ 'a.txt': 'ok', 'b.txt': 'x segredo-do-playit-777' }, L.segredos),
    'b.txt'
  )
  assert.equal(sobrouSegredo({ 'a.txt': 'ok' }, L.segredos), null)
  assert.equal(
    ultimaEntrada(
      '[2026-11-13T10:00:00.000Z] Erro A\n  at x\n[2026-11-13T11:00:00.000Z] Erro B\n  at y\n'
    ),
    '[2026-11-13T11:00:00.000Z] Erro B\n  at y'
  )
})
