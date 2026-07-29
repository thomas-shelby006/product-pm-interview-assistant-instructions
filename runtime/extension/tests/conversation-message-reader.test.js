import test from 'node:test';
import assert from 'node:assert/strict';
import { createConversationMessageReader } from '../content/adapters/shared.js';

function element(role, text, attributes = {}) {
  return {
    textContent: text,
    getAttribute(name) {
      if (name === 'data-message-author-role') return role;
      return attributes[name] || '';
    },
    closest() { return null; }
  };
}

function documentWith(nodesRef) {
  return {
    querySelectorAll() { return nodesRef.current; }
  };
}

test('message reader collapses parallel DOM copies and keeps fallback identity across rerenders', () => {
  const nodes = { current: [
    element('user', 'How would you prioritize this launch?'),
    element('user', 'How would you prioritize this launch?'),
    element('user', 'How would you prioritize this launch?'),
    element('user', 'How would you prioritize this launch?'),
    element('assistant', 'I would begin with impact and confidence.')
  ] };
  const read = createConversationMessageReader(documentWith(nodes), { selector: '.message' });
  const first = read();
  assert.equal(first.length, 2);
  assert.deepEqual(first.map(message => message.role), ['user', 'assistant']);

  nodes.current = [
    element('user', 'How would you prioritize this launch?'),
    element('user', 'How would you prioritize this launch?'),
    element('assistant', 'I would begin with impact and confidence.')
  ];
  const second = read();
  assert.deepEqual(second.map(message => message.id), first.map(message => message.id));
});

test('message reader preserves identical user turns separated by an assistant turn', () => {
  const nodes = { current: [
    element('user', 'Could you repeat that?'),
    element('assistant', 'Here is the first answer.'),
    element('user', 'Could you repeat that?'),
    element('assistant', 'Here is the second answer.')
  ] };
  const read = createConversationMessageReader(documentWith(nodes), { selector: '.message' });
  const messages = read();
  assert.equal(messages.length, 4);
  assert.notEqual(messages[0].id, messages[2].id);
});


test('Enter fallback reports handled even when provider prevents the key event', async () => {
  const { submitWithEnter } = await import('../content/adapters/shared.js');
  let dispatched = false;
  const composer = {
    dispatchEvent() {
      dispatched = true;
      return false;
    }
  };
  assert.equal(submitWithEnter(composer), true);
  assert.equal(dispatched, true);
});


test('message reader keeps one fallback identity when the same anonymous turn text expands', () => {
  const user = element('user', '');
  user.textContent = 'PMIA_CLCG_20260729_144000. Reply exactly PMIA_CLCG_OK.';
  const assistant = element('assistant', 'Acknowledged.');
  const nodes = { current: [user, assistant] };
  const read = createConversationMessageReader(documentWith(nodes), { selector: '.message' });
  const first = read();

  user.textContent = 'PMIACLCG20260729144000. PMIA_CLCG_20260729_144000. Reply exactly PMIA_CLCG_OK.';
  const second = read();

  assert.equal(second[0].id, first[0].id);
});
