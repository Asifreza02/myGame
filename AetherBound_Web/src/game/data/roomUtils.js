// Room Code Generation & Utilities for AetherBound

const ROOM_THEMES = [
  'AETH',
  'HUNT',
  'VOID',
  'RUNE',
  'FANG',
  'SLAY',
  'MYTH',
  'DAWN',
  'NOVA',
  'ECHO',
  'VALE',
  'CORE',
  'WARP',
  'PYRE',
  'FROST',
];

/**
 * Generate a unique, memorable cyber-fantasy room code like "HUNT-4821" or "AETH-7193".
 * Ensures the code is not in the provided existingRooms list if given.
 */
export function generateUniqueRoomCode(existingRooms = []) {
  const existingSet = new Set(
    (existingRooms || []).map((r) => (typeof r === 'string' ? r : r?.id || '').toLowerCase())
  );

  for (let attempt = 0; attempt < 50; attempt++) {
    const prefix = ROOM_THEMES[Math.floor(Math.random() * ROOM_THEMES.length)];
    const num = Math.floor(1000 + Math.random() * 9000); // 4-digit number
    const code = `${prefix}-${num}`;
    if (!existingSet.has(code.toLowerCase())) {
      return code;
    }
  }

  // Fallback with random hex suffix
  return `HUNT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/**
 * Normalizes user input for room codes (preserves dashes, removes illegal characters, limits length).
 */
export function sanitizeRoomCode(raw) {
  if (!raw) return '';
  return String(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 20);
}

/**
 * Validates a room code format.
 */
export function isValidRoomCode(code) {
  if (!code) return false;
  const clean = sanitizeRoomCode(code);
  return clean.length >= 3 && clean.length <= 24;
}

/**
 * Get the HTTP URL of the game server for REST endpoints.
 */
export function getServerHttpUrl() {
  if (typeof window === 'undefined') return 'http://localhost:3001';
  const pageProtocol = window.location.protocol;
  const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const configured = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  if (configured) {
    return configured.replace(/^ws(s?):/, 'http$1:');
  }
  return isLocalDevelopment
    ? `${pageProtocol}//${window.location.hostname}:3001`
    : `${pageProtocol}//${window.location.host}`;
}

/**
 * Fetches the active rooms list from the game server.
 */
export async function fetchActiveRooms() {
  try {
    const baseUrl = getServerHttpUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${baseUrl}/api/rooms`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.rooms) ? data.rooms : [];
  } catch (err) {
    // Game server might not be running yet or unreachable
    return [];
  }
}

/**
 * Checks the status of a specific room code on the game server.
 */
export async function checkRoomStatus(roomCode) {
  if (!roomCode) return { exists: false, isFull: false };
  try {
    const baseUrl = getServerHttpUrl();
    const clean = sanitizeRoomCode(roomCode).toLowerCase();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${baseUrl}/api/rooms/${encodeURIComponent(clean)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return { exists: false, isFull: false };
    return await res.json();
  } catch (err) {
    return { exists: false, isFull: false, offline: true };
  }
}

/**
 * Copies text to clipboard with fallback.
 */
export async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // Fallback for older browsers or permission denials
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    return false;
  }
}
