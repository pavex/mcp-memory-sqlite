import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class SqliteNativeBinding {
  static resolve() {
    const candidates = [
      join(__dirname, 'better_sqlite3.node'),         // dist/  (bundle: __dirname = dist/)
      join(__dirname, '..', 'better_sqlite3.node'),   // src/   (dev:   __dirname = src/Datastore/)
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    return undefined;
  }

  static options() {
    const nativeBinding = SqliteNativeBinding.resolve();
    if (nativeBinding && existsSync(nativeBinding)) {
      return { nativeBinding };
    }
    return {}; // Fallback to standard better-sqlite3 loading
  }
}
