// Safe localStorage wrappers.
// In-app browsers (Facebook/Instagram) and private mode can throw when
// touching localStorage — these helpers make sure that never crashes the game.
export function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function lsSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage blocked — ignore */
  }
}
