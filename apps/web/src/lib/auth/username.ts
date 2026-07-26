export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const USERNAME_DEBOUNCE_MS = 400;

export function normalizeUsername(value: string): string { return value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20); }

export function debounceUsernameCheck<T>(callback: (username: string) => Promise<T>, delay = USERNAME_DEBOUNCE_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let listeners: Array<{ resolve: (value: T) => void; reject: (reason?: unknown) => void }> = [];
  return (username: string): Promise<T> => new Promise((resolve, reject) => {
    listeners.push({ resolve, reject });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const current = listeners; listeners = [];
      callback(username).then((value) => current.forEach((listener) => listener.resolve(value)), (reason) => current.forEach((listener) => listener.reject(reason)));
    }, delay);
  });
}
