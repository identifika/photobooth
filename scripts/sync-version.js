const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function getVersion() {
  // 1. Explicit CLI argument (e.g. node scripts/sync-version.js v1.1.4)
  if (process.argv[2]) {
    return process.argv[2];
  }
  // 2. GITHUB_REF_NAME in GitHub Actions (e.g. v1.1.4)
  if (process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME;
  }
  // 3. Latest Git tag
  try {
    const tag = execSync('git describe --tags --abbrev=0', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (tag) return tag;
  } catch {
    // ignore
  }
  // 4. Fallback to package.json
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

const rawVersion = getVersion();
const cleanVersion = rawVersion.replace(/^v/, '').trim();

if (!cleanVersion || !/^\d+\.\d+\.\d+/.test(cleanVersion)) {
  console.error(`Invalid version: "${rawVersion}". Expected format like "1.1.4" or "v1.1.4".`);
  process.exit(1);
}

// Calculate numeric versionCode: major * 10000 + minor * 100 + patch
const [major, minor, patch] = cleanVersion.split('.').map(n => parseInt(n, 10) || 0);
const versionCode = major * 10000 + minor * 100 + patch;

console.log(`Syncing platform versions to ${cleanVersion} (code: ${versionCode})...`);

// 1. package.json
const pkgPath = path.join(ROOT, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = cleanVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✓ Updated package.json -> ${cleanVersion}`);
}

// 2. src-tauri/tauri.conf.json
const tauriConfPath = path.join(ROOT, 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = cleanVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`✓ Updated src-tauri/tauri.conf.json -> ${cleanVersion}`);
}

// 3. src-tauri/Cargo.toml
const cargoPath = path.join(ROOT, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoPath)) {
  let cargoContent = fs.readFileSync(cargoPath, 'utf8');
  cargoContent = cargoContent.replace(/^version\s*=\s*"[^"]+"/m, `version = "${cleanVersion}"`);
  fs.writeFileSync(cargoPath, cargoContent);
  console.log(`✓ Updated src-tauri/Cargo.toml -> ${cleanVersion}`);
}

// 4. android/app/build.gradle
const gradlePath = path.join(ROOT, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradleContent = fs.readFileSync(gradlePath, 'utf8');
  gradleContent = gradleContent
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${cleanVersion}"`);
  fs.writeFileSync(gradlePath, gradleContent);
  console.log(`✓ Updated android/app/build.gradle -> versionCode ${versionCode}, versionName "${cleanVersion}"`);
}

// 5. ios/App/App.xcodeproj/project.pbxproj
const pbxprojPath = path.join(ROOT, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
if (fs.existsSync(pbxprojPath)) {
  let pbxContent = fs.readFileSync(pbxprojPath, 'utf8');
  pbxContent = pbxContent
    .replace(/MARKETING_VERSION\s*=\s*[^;]+;/g, `MARKETING_VERSION = ${cleanVersion};`)
    .replace(/CURRENT_PROJECT_VERSION\s*=\s*[^;]+;/g, `CURRENT_PROJECT_VERSION = ${versionCode};`);
  fs.writeFileSync(pbxprojPath, pbxContent);
  console.log(`✓ Updated ios project.pbxproj -> MARKETING_VERSION = ${cleanVersion}, CURRENT_PROJECT_VERSION = ${versionCode}`);
}

console.log('✨ All platform versions successfully synced!');
