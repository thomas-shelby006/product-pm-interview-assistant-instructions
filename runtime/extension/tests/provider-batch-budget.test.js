import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveProviderBatchBudget } from '../shared/provider-batch-budget.js';

test('provider budget applies provider defaults and observed safe caps', () => {
  const chatgpt = deriveProviderBatchBudget({ provider: 'chatgpt', recentSuccessfulChars: 9000 });
  const claude = deriveProviderBatchBudget({ provider: 'claude', recentSuccessfulChars: 16000 });
  assert.ok(chatgpt.maxChars <= 12000);
  assert.ok(claude.maxChars >= chatgpt.maxChars);
});

test('provider budget preserves a safe floor and at least one member', () => {
  const budget = deriveProviderBatchBudget({ provider: 'unknown', capabilityComplete: false, recentFailureChars: 100 });
  assert.ok(budget.maxChars >= 2048);
  assert.ok(budget.maxMembers >= 1);
});