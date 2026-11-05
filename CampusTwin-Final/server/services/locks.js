// In-process keyed mutex. Serialises "check then write" sections so two requests in the same
// server process cannot double-book a room. For multi-instance deployments, also use a MongoDB
// transaction or a unique-slot collection (documented in docs/ARCHITECTURE.md).
const queues = new Map();

async function acquire(key) {
  const prev = queues.get(key) || Promise.resolve();
  let release;
  const gate = new Promise((r) => (release = r));
  const tail = prev.then(() => gate);
  queues.set(key, tail);
  await prev;
  return () => { release(); if (queues.get(key) === tail) queues.delete(key); };
}

async function withLocks(keys, fn) {
  const releases = [];
  try {
    for (const k of [...new Set(keys)].sort()) releases.push(await acquire(k)); // sorted order avoids deadlock
    return await fn();
  } finally {
    releases.reverse().forEach((r) => r());
  }
}
module.exports = { withLocks, _size: () => queues.size };
