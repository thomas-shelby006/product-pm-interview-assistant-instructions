import test from 'node:test';
import assert from 'node:assert/strict';

const fatalModule = await import('../content/runtime-fatal.js').catch(() => null);

function createDocument() {
  const nodes = new Map();
  const parent = {
    appendChild(node) { nodes.set(node.id, node); node.parentNode = parent; }
  };
  return {
    body: parent,
    documentElement: parent,
    getElementById(id) { return nodes.get(id) || null; },
    createElement() {
      return {
        id: '', textContent: '', style: {}, attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        remove() { nodes.delete(this.id); }
      };
    }
  };
}

test('fatal runtime banner renders a safe actionable startup failure', () => {
  assert.ok(fatalModule, 'runtime fatal module must exist');
  const doc = createDocument();
  const node = fatalModule.renderRuntimeFatal(doc, {
    stage: 'start', version: '0.5.1',
    error: new ReferenceError('private transcript and bearer token')
  });
  assert.match(node.textContent, /PMIA 0\.5\.1/);
  assert.match(node.textContent, /RUNTIME START FAILED/);
  assert.match(node.textContent, /ReferenceError/);
  assert.match(node.textContent, /reload/i);
  assert.doesNotMatch(node.textContent, /private transcript|bearer token/i);
  assert.equal(node.attributes['aria-live'], 'assertive');
});
test('fatal runtime banner reuses the same node for later failures', () => {
  assert.ok(fatalModule, 'runtime fatal module must exist');
  const doc = createDocument();
  const first = fatalModule.renderRuntimeFatal(doc, {
    stage: 'load', version: '0.5.1', error: new TypeError('first')
  });
  const second = fatalModule.renderRuntimeFatal(doc, {
    stage: 'start', version: '0.5.1', error: new ReferenceError('second')
  });
  assert.equal(second, first);
  assert.match(second.textContent, /RUNTIME START FAILED/);
  assert.match(second.textContent, /ReferenceError/);
});