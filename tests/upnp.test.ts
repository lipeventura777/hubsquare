import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acharControle, ipNaoPublico, lerLocation } from '../src/main/upnp.ts'

test('lê o LOCATION da resposta do roteador', () => {
  const resposta =
    'HTTP/1.1 200 OK\r\nCACHE-CONTROL: max-age=120\r\nLocation: http://192.168.0.1:5000/rootDesc.xml\r\nST: x\r\n\r\n'
  assert.equal(lerLocation(resposta), 'http://192.168.0.1:5000/rootDesc.xml')
  assert.equal(lerLocation('HTTP/1.1 200 OK\r\n\r\n'), null)
})

const XML = `<?xml version="1.0"?><root><device><serviceList>
<service><serviceType>urn:schemas-upnp-org:service:Layer3Forwarding:1</serviceType><controlURL>/ctl/L3F</controlURL></service>
</serviceList><deviceList><device><deviceList><device><serviceList>
<service>
  <serviceType>urn:schemas-upnp-org:service:WANIPConnection:1</serviceType>
  <controlURL>/ctl/IPConn</controlURL>
</service>
</serviceList></device></deviceList></device></deviceList></device></root>`

test('acha o controle do WANIPConnection a partir do endereço do XML', () => {
  assert.deepEqual(acharControle(XML, 'http://192.168.0.1:5000/rootDesc.xml'), {
    url: 'http://192.168.0.1:5000/ctl/IPConn',
    servico: 'urn:schemas-upnp-org:service:WANIPConnection:1'
  })
})

test('usa o URLBase quando o roteador informa', () => {
  const comBase = XML.replace('<root>', '<root><URLBase>http://10.0.0.1:49000/</URLBase>')
  assert.equal(acharControle(comBase, 'http://x/desc.xml')?.url, 'http://10.0.0.1:49000/ctl/IPConn')
})

test('sem serviço de portas devolve null', () => {
  assert.equal(acharControle('<root></root>', 'http://x/'), null)
})

test('reconhece IP privado e CGNAT', () => {
  for (const ip of ['10.1.2.3', '192.168.0.5', '172.20.0.1', '100.64.0.1', '100.127.255.255']) {
    assert.equal(ipNaoPublico(ip), true, ip)
  }
  for (const ip of ['8.8.8.8', '100.128.0.1', '172.32.0.1', '189.10.20.30']) {
    assert.equal(ipNaoPublico(ip), false, ip)
  }
})
