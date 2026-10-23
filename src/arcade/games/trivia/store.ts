import AsyncStorage from '@react-native-async-storage/async-storage';
import { PACK } from './pack';
import { covers, fromOpenTdb, pickRun, questionKey, type Question } from './questions';

// Where a trivia run's questions come from. The Open Trivia Database
// (opentdb.com, CC BY-SA 4.0, credited on the licenses screen) gives 50 at a
// time; the ones a run doesn't use are kept on the phone, so most runs need no
// network at all. It's fetched only when what's kept can't cover a whole run.
//
// One request per refill, with no session token: OpenTDB allows one request
// every 5 seconds per address (phones on the same party Wi-Fi share one), and
// a token would cost a second. Repeats are kept away on the phone instead, by
// remembering what's been asked (SEEN_MAX of them). If the request fails, is
// rate-limited or comes back short, the bundled pack (pack.ts) fills the
// gaps, so a run always has its ten.

const KEY = 'squigglepig.trivia';
const VERSION = 1;
const API = 'https://opentdb.com/api.php?amount=50&type=multiple&encode=url3986';
const TIMEOUT_MS = 6000;
const POOL_MAX = 80; // questions kept for later runs
const SEEN_MAX = 1500; // questions remembered as asked

type Saved = { pool: Question[]; seen: string[] };

async function load(): Promise<Saved> {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
    if (saved?.v === VERSION && Array.isArray(saved.pool) && Array.isArray(saved.seen)) return { pool: saved.pool, seen: saved.seen };
  } catch {}
  return { pool: [], seen: [] };
}

function save(s: Saved) {
  AsyncStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...s })).catch(() => {});
}

// One batch from OpenTDB, or nothing (offline, slow, rate-limited, down).
async function fetchBatch(): Promise<Question[]> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API, { signal: abort.signal });
    return res.ok ? fromOpenTdb(await res.json()) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// The ten questions for one run, easiest first (questions.ts PLAN).
export async function questionsForRun(): Promise<Question[]> {
  const saved = await load();
  const seen = new Set(saved.seen);
  let pool = saved.pool;
  if (!covers(pool)) {
    const held = new Set(pool.map(questionKey));
    const fresh = (await fetchBatch()).filter((q) => !seen.has(questionKey(q)) && !held.has(questionKey(q)));
    pool = [...pool, ...fresh].slice(-POOL_MAX);
  }
  const { run, rest } = pickRun(pool, PACK);
  const asked = run.filter((q) => !q.pack).map(questionKey);
  save({ pool: rest, seen: [...saved.seen, ...asked].slice(-SEEN_MAX) });
  return run;
}
