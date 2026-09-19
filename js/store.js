// The only module that touches IndexedDB.
//
// One object store, `pages`, keyed by [day, prompt]:
//   { day: "yyyy-mm-dd", prompt: "good-1", strokes: [[[x,y,p],…],…],
//     width: 700, lines: 4, updatedAt: iso }
//
// The store only ever holds today. `purgeExcept(today)` runs before anything
// renders and deletes every record from any other day. There is no setting
// to keep more, on purpose: this is a page, not a diary.
//
// `localStorage` would have been simpler, but handwriting is points and a
// full evening at pencil rate can run to a few megabytes, past what iOS
// reliably keeps there.

const DB_NAME = 'small-potatoes';
const DB_VERSION = 1;
const PAGES = 'pages';

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PAGES)) {
        db.createObjectStore(PAGES, { keyPath: ['day', 'prompt'] });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

async function tx(mode, run) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(PAGES, mode);
    let result;
    // Resolve on complete rather than on the request callback, so a caller
    // never sees data from a transaction that later aborted.
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
    Promise.resolve(run(t.objectStore(PAGES))).then((r) => { result = r; }, reject);
  });
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- the rule, on its own so it can be tested ----------

export function isStale(record, today) {
  return record.day !== today;
}

// The keys to delete: everything that is not today.
export function staleKeys(records, today) {
  return records.filter((r) => isStale(r, today)).map((r) => [r.day, r.prompt]);
}

// ---------- pages ----------

export async function purgeExcept(today) {
  const all = await tx('readonly', (store) => request(store.getAll()));
  const keys = staleKeys(all, today);
  if (keys.length === 0) return 0;
  await tx('readwrite', (store) => Promise.all(keys.map((k) => request(store.delete(k)))));
  return keys.length;
}

export function getPage(day, prompt) {
  return tx('readonly', (store) => request(store.get([day, prompt])));
}

export function listDay(day) {
  return tx('readonly', async (store) => {
    const all = await request(store.getAll());
    return all.filter((r) => r.day === day);
  });
}

export function savePage(page) {
  const record = { ...page, updatedAt: new Date().toISOString() };
  return tx('readwrite', (store) => request(store.put(record)));
}

export function deletePage(day, prompt) {
  return tx('readwrite', (store) => request(store.delete([day, prompt])));
}
