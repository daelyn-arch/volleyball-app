import type { MatchState } from '@/types/match';

const PROJECT_ID = 'volleyball-scorekeeper-app';
const API_KEY = 'AIzaSyCUQ-GceUE86HhTGWc0-LSPKkmLP5E_yGQ';

// ── Firestore REST value converter ──────────────────────────

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

function toFirestoreValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val)
      ? { integerValue: String(val) }
      : { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreDoc(obj: Record<string, unknown>): { fields: Record<string, FirestoreValue> } {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

// ── Sync ────────────────────────────────────────────────────

/**
 * Writes a completed MatchState to Firestore via the REST API.
 * No Firebase SDK needed — just fetch().
 * Returns true on success, false on failure. Never throws.
 */
export async function syncMatch(state: MatchState): Promise<boolean> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/databases/(default)/documents/matches/${state.id}?key=${API_KEY}`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toFirestoreDoc(state as unknown as Record<string, unknown>)),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[syncMatch] Firestore REST error:', res.status, body);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[syncMatch] Network error:', err);
    return false;
  }
}
