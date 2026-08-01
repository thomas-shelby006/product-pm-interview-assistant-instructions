export async function sendWithRegistrationRecovery({ send, register, payload } = {}) {
  if (typeof send !== 'function') throw new TypeError('send is required');
  const first = await send(payload);
  if (first?.error !== 'sender_not_registered' || typeof register !== 'function') {
    return { response: first, recovered: false, attempts: 1 };
  }
  const registered = await register();
  if (!registered) return { response: first, recovered: false, attempts: 1 };
  return {
    response: await send(payload),
    recovered: true,
    attempts: 2
  };
}
