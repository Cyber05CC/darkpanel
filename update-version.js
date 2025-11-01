// CommonJS versiya (import emas, require ishlatilgan)
const fs = require('fs');
const { execSync } = require('child_process');

const manifestPath = './manifest.xml';
const versionJsonPath = './public/version.json'; // joylashuvini moslashtir

// 1. Manifest versiyasini o‘qiymiz
const manifestData = fs.readFileSync(manifestPath, 'utf-8');
const match = manifestData.match(/ExtensionBundleVersion="([\d.]+)"/);

if (!match) {
    console.error('❌ manifest.xml dan versiya topilmadi!');
    process.exit(1);
}

const currentVersion = match[1];
const [major, minor = 0] = currentVersion.split('.').map(Number);
const newVersion = `${major}.${minor + 1}`;

// 2. manifest.xml yangilaymiz
const newManifest = manifestData.replace(
    /ExtensionBundleVersion="([\d.]+)"/,
    `ExtensionBundleVersion="${newVersion}"`
);
fs.writeFileSync(manifestPath, newManifest, 'utf-8');
console.log(`🟣 manifest.xml yangilandi → v${newVersion}`);

// 3. version.json yangilaymiz
const versionJson = { version: newVersion };
fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2));
console.log(`🟢 version.json yangilandi → v${newVersion}`);

// 4. Git commit + push
execSync(`git add ${manifestPath} ${versionJsonPath}`);
execSync(`git commit -m "🔼 Auto update: v${newVersion}"`);
execSync(`git push`);
console.log('🚀 O‘zgarishlar GitHub/Vercel’ga push qilindi!');
