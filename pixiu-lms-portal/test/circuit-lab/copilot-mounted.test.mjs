import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

test('mounted StrictMode copilot launches once, renders before completion and sends current pins and history', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://portal.example/simulation' })
  const { window } = dom
  Object.assign(globalThis, { window, document:window.document, DOMParser:window.DOMParser, Element:window.Element })
  window.HTMLElement.prototype.scrollIntoView = () => {}
  const src = fileURLToPath(new URL('../../src', import.meta.url))
  const bundle = await build({
    stdin:{contents:`
      export { createElement, StrictMode } from 'react';
      export { createRoot } from 'react-dom/client';
      export { CircuitCopilotChat } from './components/circuit-lab/circuit-copilot-chat.tsx';
    `,resolveDir:src},
    alias:{'@':src}, jsx:'automatic',bundle:true,platform:'browser',format:'esm',write:false,
    define:{'import.meta.env':'{}','process.env.NODE_ENV':'"development"'}
  })
  const { createElement:h, StrictMode, createRoot, CircuitCopilotChat } = await import(
    'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64'))
  const root = createRoot(document.getElementById('root'))
  const started = performance.now()
  const timeline = {}
  const stamp = name => { timeline[name] ??= Math.round(performance.now() - started) }
  const requests = []
  let finish = false
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname
    if (path.endsWith('/xen/chat')) {
      requests.push(JSON.parse(options.body))
      stamp("mock_backend_received")
      return Response.json({job_id:'fixture',status:'queued'},{status:202})
    }
    assert.ok(path.endsWith('/fixture/chunks'))
    if (finish) stamp('mock_completion_received')
    else stamp('mock_chunk_received')
    if (finish) return Response.json({status:'completed', response:{text:'Haan bhai, use a resistor.'}})
    return Response.json({status:'running', chunks:[{seq:1,delta:'Haan bhai'}]})
  }
  async function until(check) {
    const deadline = Date.now() + 5000
    while (!check()) {
      if (Date.now() > deadline) throw Error('Timed out. Visible text: ' + document.body.textContent.slice(-600))
      await new Promise(resolve => setTimeout(resolve, 15))
    }
  }
  const lesson = {id:'fixture',launchId:'launch-1',title:'Safe LED Blink',steps:[]}
  const circuit = {parts:[],wires:[]}
  const render = (open, wires = []) => root.render(h(StrictMode,null,h(CircuitCopilotChat,{
    isOpen:open, lessonContext:lesson, currentCircuit:{...circuit,wires},
    currentBlocklyXml:'<xml/>',userRole:'trainer'
  })))
  try {
    stamp("lesson_opened")
    render(true)
    await until(() => document.body.textContent.includes('Haan bhai'))
    stamp("partial_present_in_dom")
    assert.equal(requests.length,1)
    assert.equal(requests[0].idempotency_key,'launch-1')
    assert.equal(finish,false)
    finish = true
    await until(() => document.body.textContent.includes('use a resistor.'))
    stamp("final_present_in_dom")
    console.log(JSON.stringify({fixture: "jsdom + mock fetch", job_id:"fixture", launch_id:"launch-1", elapsed_ms:timeline}))
    render(false)
    await until(() => !document.querySelector('[aria-label="8square Circuit Copilot Panel"]'))
    const wire = {id:'wire',from:{partId:'uno',pinId:'d13'},to:{partId:'r',pinId:'a'},color:'red'}
    render(true,[wire])
    await until(() => document.querySelector('form'))
    const input = document.querySelector('[placeholder*="Ask about"]')
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
    setter.call(input, 'Which pin?')
    input.dispatchEvent(new window.Event('input',{bubbles:true}))
    await until(() => !document.querySelector('[aria-label="Send message"]').disabled)
    document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}))
    await until(() => requests.length === 2)
    assert.equal(requests[1].prompt,'Which pin?')
    assert.deepEqual(requests[1].context_envelope.circuit.wires,[{from:wire.from,to:wire.to}])
    assert.ok(requests[1].history.some(m => m.content.includes('use a resistor.')))
    assert.notEqual(requests[1].idempotency_key,requests[0].idempotency_key)
  } finally {
    root.unmount()
    globalThis.fetch = originalFetch
    dom.window.close()
  }
})
