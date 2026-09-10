import { createClient } from 'redis';

// Thin JSON-document layer over Redis, shared by every endpoint that needs
// real (not localStorage-only) storage: auth.ts, businesses.ts, services.ts.
// Each "collection" is just a key prefix; a document is a JSON string at
// `${prefix}:${id}`, with an optional secondary SET index for "list all" /
// "list by owner" queries (Redis has no query language, so any list access
// pattern needs its own index set maintained alongside the document).

async function withClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.quit();
  }
}

export async function getDoc<T>(key: string): Promise<T | null> {
  return withClient(async (client) => {
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  });
}

export async function setDoc<T>(key: string, value: T): Promise<void> {
  await withClient(client => client.set(key, JSON.stringify(value)));
}

export async function deleteDoc(key: string): Promise<void> {
  await withClient(client => client.del(key));
}

export async function getManyDocs<T>(keys: string[]): Promise<T[]> {
  if (keys.length === 0) return [];
  return withClient(async (client) => {
    const raws = await client.mGet(keys);
    return raws.filter(Boolean).map((r: string) => JSON.parse(r) as T);
  });
}

// --- Index sets (for "list all in a collection" / "list by owner") ---

export async function addToIndex(indexKey: string, id: string): Promise<void> {
  await withClient(client => client.sAdd(indexKey, id));
}

export async function removeFromIndex(indexKey: string, id: string): Promise<void> {
  await withClient(client => client.sRem(indexKey, id));
}

export async function getIndexIds(indexKey: string): Promise<string[]> {
  return withClient(client => client.sMembers(indexKey));
}

export { withClient };
