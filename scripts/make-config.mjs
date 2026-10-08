// Génère js/config.js à partir des variables d'environnement (ou du fichier .env).
// Usage : npm run config
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const env = { ...process.env };
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const url = (env.SUPABASE_URL || '').trim();
const key = (env.SUPABASE_ANON_KEY || '').trim();
if (!url || !key) {
  console.error('✗ SUPABASE_URL et SUPABASE_ANON_KEY sont requis (fichier .env ou variables d’environnement).');
  process.exit(1);
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) console.warn('⚠ SUPABASE_URL ne ressemble pas à https://xxxx.supabase.co — vérifiez la valeur.');
if (/service_role/.test(Buffer.from(key.split('.')[1] || '', 'base64').toString())) {
  console.error('✗ Cette clé est la clé « service_role » : elle ne doit jamais aller dans le navigateur. Utilisez la clé « anon public ».');
  process.exit(1);
}
writeFileSync('js/config.js', `// Fichier généré par « npm run config » — ne pas versionner.\nwindow.QG_CONFIG = ${JSON.stringify({ SUPABASE_URL: url.replace(/\/$/, ''), SUPABASE_ANON_KEY: key }, null, 2)};\n`);
console.log('✓ js/config.js généré.');
