const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

// Chargement du driver SQLite (soit le module natif Node.js node:sqlite, soit better-sqlite3)
let db;
try {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(process.env.DATABASE_FILE || './licenses.db');
  console.log('[Database] Driver natif Node.js (node:sqlite) initialisé.');
} catch (e) {
  try {
    const Database = require('better-sqlite3');
    db = new Database(process.env.DATABASE_FILE || './licenses.db');
    console.log('[Database] Driver better-sqlite3 initialisé.');
  } catch (err) {
    console.error('Erreur critique : Impossible de charger un moteur SQLite.', err);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'HunterZ_Admin_Key_Default_2026';
const DATABASE_FILE = process.env.DATABASE_FILE || './licenses.db';

// Middleware parsing JSON et URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 1. Initialisation de la Base de Données
// ==========================================

// Création de la table des licences si elle n'existe pas
db.exec(`
  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'revoked', 'expired'
    hwid TEXT DEFAULT NULL,
    note TEXT DEFAULT NULL,
    duration_days INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    last_heartbeat DATETIME DEFAULT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_license_key ON licenses(license_key);
`);

// Requêtes préparées pour la rapidité et la protection contre les injections SQL
const stmtFindKey = db.prepare('SELECT * FROM licenses WHERE license_key = ?');
const stmtInsertKey = db.prepare(`
  INSERT INTO licenses (license_key, status, hwid, note, duration_days, expires_at)
  VALUES (?, 'active', ?, ?, ?, ?)
`);
const stmtUpdateHeartbeat = db.prepare(`
  UPDATE licenses 
  SET last_heartbeat = CURRENT_TIMESTAMP, hwid = COALESCE(hwid, ?)
  WHERE license_key = ?
`);
const stmtRevokeKey = db.prepare(`
  UPDATE licenses 
  SET status = 'revoked' 
  WHERE license_key = ?
`);
const stmtExpireKey = db.prepare(`
  UPDATE licenses 
  SET status = 'expired' 
  WHERE license_key = ?
`);
const stmtResetHwid = db.prepare(`
  UPDATE licenses 
  SET hwid = NULL 
  WHERE license_key = ?
`);

// ==========================================
// 2. Helpers & Fonctions Métier
// ==========================================

/**
 * Génère une clé sécurisée au format HZ-XXXX-XXXX
 * Utilise crypto.randomBytes pour éviter les collisions et la prédictibilité
 */
function generateLicenseKey() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Sans caractères ambigus (0/O, 1/I)
  const getRandomBlock = (length = 4) => {
    let result = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  };
  return `HZ-${getRandomBlock(4)}-${getRandomBlock(4)}`;
}

/**
 * Middleware d'authentification Admin
 */
function requireAdmin(req, res, next) {
  const providedSecret = req.headers['x-admin-secret'] || req.query.admin_secret;
  if (!providedSecret || providedSecret !== ADMIN_SECRET) {
    return res.status(401).json({
      success: false,
      error: 'Accès non autorisé : Clé secrète admin invalide ou manquante.'
    });
  }
  next();
}

/**
 * Analyse et vérifie l'état d'une licence en base
 */
function evaluateLicense(license, hwid = null) {
  if (!license) {
    return { valid: false, status: 'not_found', message: 'Clé de licence introuvable.' };
  }

  // 1. Vérification de la révocation manuelle
  if (license.status === 'revoked') {
    return { valid: false, status: 'revoked', message: 'Cette licence a été révoquée par un administrateur.' };
  }

  const now = new Date();
  const expiresAt = new Date(license.expires_at);

  // 2. Vérification de la date d'expiration
  if (now > expiresAt) {
    if (license.status !== 'expired') {
      stmtExpireKey.run(license.license_key);
    }
    return { valid: false, status: 'expired', message: 'Cette licence a expiré.' };
  }

  // 3. Vérification du verrouillage HWID (Hardware ID / Server ID) si activé
  if (hwid && license.hwid && license.hwid !== hwid) {
    return { valid: false, status: 'hwid_mismatch', message: 'Cette licence est déjà liée à un autre serveur ou joueur.' };
  }

  const remainingMs = expiresAt.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

  return {
    valid: true,
    status: 'active',
    expires_at: license.expires_at,
    days_left: daysLeft,
    hwid: license.hwid
  };
}

// ==========================================
// 3. Routes de l'API
// ==========================================

/**
 * TÂCHE 1 : GET /api/validate?key=HZ-XXXX-XXXX&hwid=...
 * Vérification initiale de la licence au lancement du jeu ou chargement du mod
 */
app.get('/api/validate', (req, res) => {
  const { key, hwid } = req.query;

  if (!key) {
    return res.status(400).json({ valid: false, error: 'Paramètre "key" requis.' });
  }

  try {
    const formattedKey = key.trim().toUpperCase();
    const license = stmtFindKey.get(formattedKey);
    const evaluation = evaluateLicense(license, hwid);

    if (!evaluation.valid) {
      return res.status(200).json(evaluation);
    }

    res.status(200).json({
      valid: true,
      status: 'active',
      expires_at: evaluation.expires_at,
      days_left: evaluation.days_left
    });
  } catch (err) {
    console.error('Erreur lors de la validation :', err);
    res.status(500).json({ valid: false, error: 'Erreur interne du serveur.' });
  }
});

/**
 * TÂCHE 1 : POST /api/generate
 * Création d'une clé unique avec durée de validité (ex: 30 jours)
 * Protégé par le header "X-Admin-Secret"
 */
app.post('/api/generate', requireAdmin, (req, res) => {
  const { durationDays = 30, note = '', hwid = null } = req.body;

  const parsedDuration = parseInt(durationDays, 10);
  if (isNaN(parsedDuration) || parsedDuration <= 0) {
    return res.status(400).json({
      success: false,
      error: 'La durée "durationDays" doit être un nombre entier positif.'
    });
  }

  try {
    let key;
    let isUnique = false;
    let attempts = 0;

    // Garantie d'unicité de la clé
    while (!isUnique && attempts < 10) {
      key = generateLicenseKey();
      const existing = stmtFindKey.get(key);
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ success: false, error: 'Impossible de générer une clé unique après 10 essais.' });
    }

    // Calcul de la date d'expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parsedDuration);
    const expiresAtISO = expiresAt.toISOString();

    stmtInsertKey.run(key, hwid || null, note || null, parsedDuration, expiresAtISO);

    res.status(201).json({
      success: true,
      data: {
        key,
        status: 'active',
        duration_days: parsedDuration,
        expires_at: expiresAtISO,
        note: note || null
      }
    });
  } catch (err) {
    console.error('Erreur lors de la génération :', err);
    res.status(500).json({ success: false, error: 'Erreur lors de la génération de la clé.' });
  }
});

/**
 * TÂCHE 2 : POST /api/heartbeat
 * Envoi périodique (toutes les 30s) par le client DayZ.
 * Si la clé a été révoquée en DB, le serveur renvoie immédiatement status: 'revoked'.
 */
app.post('/api/heartbeat', (req, res) => {
  const { key, hwid } = req.body;

  if (!key) {
    return res.status(400).json({ valid: false, error: 'Le champ "key" est requis.' });
  }

  try {
    const formattedKey = key.trim().toUpperCase();
    const license = stmtFindKey.get(formattedKey);
    const evaluation = evaluateLicense(license, hwid);

    // Si la licence est révoquée, expirée ou inexistante
    if (!evaluation.valid) {
      return res.status(200).json({
        valid: false,
        status: evaluation.status,
        message: evaluation.message
      });
    }

    // Mise à jour de la date du dernier heartbeat
    stmtUpdateHeartbeat.run(hwid || null, formattedKey);

    return res.status(200).json({
      valid: true,
      status: 'active',
      timestamp: Date.now(),
      days_left: evaluation.days_left
    });
  } catch (err) {
    console.error('Erreur lors du heartbeat :', err);
    res.status(500).json({ valid: false, error: 'Erreur interne du serveur.' });
  }
});

/**
 * Route d'administration : Révoquer une licence
 * POST /api/revoke
 */
app.post('/api/revoke', requireAdmin, (req, res) => {
  const { key } = req.body;

  if (!key) {
    return res.status(400).json({ success: false, error: 'Le champ "key" est requis.' });
  }

  try {
    const formattedKey = key.trim().toUpperCase();
    const license = stmtFindKey.get(formattedKey);

    if (!license) {
      return res.status(404).json({ success: false, error: 'Licence introuvable.' });
    }

    stmtRevokeKey.run(formattedKey);

    res.status(200).json({
      success: true,
      message: `La clé ${formattedKey} a été révoquée. Tout client connecté sera éjecté au prochain heartbeat.`
    });
  } catch (err) {
    console.error('Erreur lors de la révocation :', err);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur.' });
  }
});

/**
 * Route d'administration : Réinitialiser le HWID d'une clé (en cas de changement de PC)
 * POST /api/reset-hwid
 */
app.post('/api/reset-hwid', requireAdmin, (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ success: false, error: 'Le champ "key" est requis.' });

  try {
    const formattedKey = key.trim().toUpperCase();
    stmtResetHwid.run(formattedKey);
    res.status(200).json({ success: true, message: `HWID réinitialisé pour la clé ${formattedKey}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur lors du reset HWID.' });
  }
});

/**
 * Route d'administration : Lister toutes les licences
 * GET /api/admin/licenses
 */
app.get('/api/admin/licenses', requireAdmin, (req, res) => {
  try {
    const licenses = db.prepare('SELECT * FROM licenses ORDER BY id DESC').all();
    res.status(200).json({ success: true, count: licenses.length, licenses });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur de récupération.' });
  }
});

// ==========================================
// 4. Démarrage du Serveur & Graceful Shutdown
// ==========================================
const server = app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(` [HunterZ Backend] Serveur démarré`);
  console.log(` Port     : http://localhost:${PORT}`);
  console.log(` Database : ${DATABASE_FILE}`);
  console.log(`=============================================`);
});

process.on('SIGINT', () => {
  console.log('\nArrêt du serveur et fermeture de la base SQLite...');
  db.close();
  server.close(() => {
    console.log('Serveur arrêté avec succès.');
    process.exit(0);
  });
});
