// Serveur de Givre : sert l'application (dossier dist/) et gère la connexion
// OAuth 2.0 à Google Agenda (flux « authorization code » + PKCE, jeton de
// rafraîchissement chiffré renvoyé à l'iPhone ; rien n'est stocké sur disque).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');

// Chargement facultatif d'un fichier .env (sans dépendance).
for (const file of ['.env', '.env.local']) {
  const p = path.join(__dirname, '..', file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, APP_URL } = process.env;
const PORT = Number(process.env.PORT) || 8787;
const configured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && SESSION_SECRET && SESSION_SECRET.length >= 16);

const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

// ------------------------------------------------------------ Chiffrement
const key = crypto.createHash('sha256').update(String(SESSION_SECRET || 'non-configure')).digest();

export function seal(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}

export function unseal(token) {
  try {
    const buf = Buffer.from(String(token), 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ Connexions en cours
// loginId → { verifier, redirectUri, createdAt, result? }
const pending = new Map();
const TTL = 15 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pending) if (now - v.createdAt > TTL) pending.delete(k);
}, 60_000).unref();

function baseUrl(req) {
  if (APP_URL) return APP_URL.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

const page = (title, body) => `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0e14;color:#eef1f6;
font:16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center;padding:24px}
.c{max-width:360px}h1{font-weight:600;font-size:22px}p{color:#9aa3b5;line-height:1.5}
a{display:inline-block;margin-top:16px;background:#3d7bff;color:#fff;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:600}</style>
</head><body><div class="c">${body}</div></body></html>`;

// ------------------------------------------------------------ Application
export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

app.get('/api/config', (_req, res) => {
  res.json({ googleConfigured: configured });
});

// L'app génère elle-même un identifiant de connexion aléatoire puis ouvre cette
// adresse (ouverture synchrone au toucher : pas de blocage de fenêtre sur iOS).
app.get('/api/google/auth/begin', (req, res) => {
  if (!configured) return res.status(503).send(page('Non configuré', '<h1>Connexion Google non configurée</h1><p>Renseignez GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et SESSION_SECRET sur le serveur (voir README).</p>'));
  const loginId = String(req.query.id || '');
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(loginId)) return res.status(400).send(page('Erreur', '<h1>Requête invalide</h1>'));
  let entry = pending.get(loginId);
  if (!entry || entry.result) {
    entry = {
      verifier: crypto.randomBytes(48).toString('base64url'),
      redirectUri: `${baseUrl(req)}/api/google/auth/callback`,
      createdAt: Date.now(),
    };
    pending.set(loginId, entry);
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: entry.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: loginId,
    code_challenge: crypto.createHash('sha256').update(entry.verifier).digest('base64url'),
    code_challenge_method: 'S256',
  });
  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get('/api/google/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const entry = pending.get(String(state || ''));
  const back = `<a href="/?gcal=${encodeURIComponent(String(state || ''))}#reglages">Revenir à Givre</a>`;
  if (!entry) {
    return res.status(400).send(page('Lien expiré', '<h1>Lien expiré</h1><p>Relancez « Connecter Google Agenda » depuis les réglages.</p><a href="/#reglages">Revenir à Givre</a>'));
  }
  if (error || !code) {
    entry.result = { error: error === 'access_denied' ? 'Accès refusé.' : `Connexion annulée (${error || 'aucun code'}).` };
    return res.send(page('Connexion annulée', `<h1>Connexion annulée</h1><p>${entry.result.error}</p>${back}`));
  }
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: entry.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: entry.verifier,
      }),
    });
    const tok = await r.json();
    if (!r.ok) throw new Error(tok.error_description || tok.error || `HTTP ${r.status}`);
    if (!tok.refresh_token) throw new Error("Google n'a pas fourni de jeton de rafraîchissement.");
    if (!String(tok.scope || '').includes('calendar.events')) {
      throw new Error("L'accès à Google Agenda n'a pas été autorisé (case non cochée).");
    }
    let email = '';
    if (tok.id_token) {
      try {
        email = JSON.parse(Buffer.from(tok.id_token.split('.')[1], 'base64url').toString('utf8')).email || '';
      } catch { /* pas d'e-mail */ }
    }
    entry.result = { session: seal({ rt: tok.refresh_token, email, iat: Date.now() }), email };
    res.send(page('Compte connecté', `<h1>Google Agenda connecté ✓</h1><p>${email ? `Compte ${email}. ` : ''}Vous pouvez revenir dans l'application : la synchronisation démarre automatiquement.</p>${back}`));
  } catch (e) {
    entry.result = { error: String(e.message || e) };
    res.status(500).send(page('Erreur', `<h1>La connexion a échoué</h1><p>${entry.result.error}</p>${back}`));
  }
});

// L'application récupère le résultat (fonctionne même si la connexion Google
// s'est faite dans une autre fenêtre que l'app installée sur l'écran d'accueil).
app.post('/api/google/auth/claim', (req, res) => {
  const id = String(req.body?.loginId || '');
  const entry = pending.get(id);
  // Inconnue = la page Google n'est pas encore ouverte : on attend encore.
  if (!entry || !entry.result) return res.status(202).json({ pending: true });
  pending.delete(id);
  if (entry.result.error) return res.status(400).json({ error: entry.result.error });
  res.json({ session: entry.result.session, email: entry.result.email });
});

async function refresh(session) {
  const data = unseal(session);
  if (!data?.rt) return { status: 401, body: { error: 'Session invalide. Reconnectez Google Agenda.' } };
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: data.rt,
      grant_type: 'refresh_token',
    }),
  });
  const tok = await r.json().catch(() => ({}));
  if (!r.ok) {
    const revoked = tok.error === 'invalid_grant';
    return {
      status: revoked ? 401 : 502,
      body: { error: revoked ? "Google a révoqué l'accès (ou il a expiré). Reconnectez Google Agenda." : `Google : ${tok.error || r.status}` },
    };
  }
  return { status: 200, body: { access_token: tok.access_token, expires_in: tok.expires_in, email: data.email } };
}

app.post('/api/google/token', async (req, res) => {
  if (!configured) return res.status(503).json({ error: 'Connexion Google non configurée sur le serveur.' });
  try {
    const r = await refresh(req.get('X-Givre-Session'));
    res.status(r.status).json(r.body);
  } catch (e) {
    res.status(502).json({ error: `Impossible de joindre Google : ${e.message || e}` });
  }
});

app.post('/api/google/disconnect', async (req, res) => {
  const data = unseal(req.get('X-Givre-Session'));
  if (data?.rt) {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: data.rt }),
    }).catch(() => {});
  }
  res.json({ ok: true });
});

// ------------------------------------------------------------ Fichiers statiques
if (fs.existsSync(DIST)) {
  app.use(
    express.static(DIST, {
      setHeaders(res, file) {
        if (file.endsWith('sw.js') || file.endsWith('.html') || file.endsWith('.webmanifest')) res.setHeader('Cache-Control', 'no-cache');
        else if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`Givre : http://localhost:${PORT}  (Google ${configured ? 'configuré' : 'NON configuré — voir README'})`);
  });
}
