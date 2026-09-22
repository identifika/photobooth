const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, '.static_backup');

// Folders in app/ that contain server-side API routes or server-only dynamic routes
// not included in client-side static bundles for Capacitor/Tauri.
const DIRS_TO_EXCLUDE = ['api', 'e', 'events'];

const movedDirs = [];

try {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  for (const dir of DIRS_TO_EXCLUDE) {
    const src = path.join(ROOT, 'app', dir);
    const dest = path.join(BACKUP_DIR, dir);
    if (fs.existsSync(src)) {
      fs.renameSync(src, dest);
      movedDirs.push({ src, dest });
    }
  }

  const isTauri = process.env.TAURI_ENV === '1';
  const envVar = isTauri ? 'TAURI_ENV=1' : 'STATIC_EXPORT=1';

  // Clear any stale dev cache/types from .next to avoid validator errors
  const nextDir = path.join(ROOT, '.next');
  if (fs.existsSync(nextDir)) {
    try {
      fs.rmSync(nextDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  console.log(`Building static export with ${envVar}...`);
  execSync(`npx cross-env ${envVar} next build`, {
    cwd: ROOT,
    stdio: 'inherit',
  });
} finally {
  for (const { src, dest } of movedDirs.reverse()) {
    if (fs.existsSync(dest)) {
      fs.renameSync(dest, src);
    }
  }
  if (fs.existsSync(BACKUP_DIR)) {
    try {
      fs.rmdirSync(BACKUP_DIR);
    } catch {
      // ignore
    }
  }
}
