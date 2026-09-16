/**
 * Module centralisé de sécurité - Conforme aux recommandations OWASP Top 10
 * - A01: Broken Access Control (Contrôle des redirections et des autorisations)
 * - A03: Injections (Neutralisation XSS, assainissement des entrées et des chemins)
 * - A04: Insecure Design (Validation des fichiers et limitation des risques)
 * - A06: Vulnerable Components (Protection contre les contournements d'Open Redirect)
 * - A07: Identification & Authentication Failures (Politique stricte de mot de passe)
 * - A10: SSRF & Reverse Tabnabbing (Assainissement des URLs)
 */

// Taille maximale autorisée par fichier : 50 Mo (OWASP A04 / A08 - Déni de service et contrôle des ressources)
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

// Liste noire stricte d'extensions exécutables et potentiellement malveillantes
export const DANGEROUS_FILE_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bash', 'zsh', 'php', 'phtml', 'php3', 'php4', 'php5', 'phps',
  'vbs', 'vbe', 'scr', 'msi', 'jar', 'jsp', 'asp', 'aspx', 'com', 'hta', 'cpl', 'reg',
  'wsf', 'ps1', 'psm1', 'app', 'dmg', 'apk', 'iso', 'bin', 'dll', 'sys'
]);

/**
 * Assainit une chaîne de caractères contre les injections HTML/XSS basiques
 * (OWASP A03: Injection)
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Valide et assainit une URL pour éviter les protocoles dangereux
 * (javascript:, vbscript:, data: non contrôlé) (OWASP A03 / A10)
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();

  // Bloquer explicitement les protocoles de script
  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
    console.warn('[Security] Tentative d\'accès à une URL avec protocole interdit :', trimmed);
    return '#';
  }

  // Autoriser les URLs relatives sûres
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  // Valider les URLs absolues légitimes (http, https, mailto, tel)
  try {
    const parsed = new URL(trimmed);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      return parsed.href;
    }
  } catch {
    // Si l'analyse URL échoue et que ce n'est pas une URL relative valide
    return '#';
  }

  return '#';
}

/**
 * Assainit un nom de fichier pour empêcher les attaques par traversée de répertoire (Path Traversal)
 * et neutralise les caractères de contrôle / nuls (OWASP A03 / A04)
 */
export function sanitizeFileName(name: string): string {
  if (!name || typeof name !== 'string') return 'unnamed_file';
  
  // 1. Remplacer les séparateurs de dossiers et séquences de traversée
  let clean = name.replace(/\\/g, '/');
  clean = clean.split('/').pop() || 'unnamed_file';
  
  // 2. Supprimer les caractères nuls, les caractères de contrôle et les caractères réservés
  clean = clean.replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, '_');

  // 3. Empêcher les noms vides ou uniquement composés de points
  clean = clean.replace(/^\.+/, '');
  if (!clean.trim()) {
    clean = 'unnamed_file';
  }

  // 4. Limiter la longueur du nom de fichier à 255 caractères
  if (clean.length > 255) {
    const ext = getFileExtension(clean);
    const base = clean.slice(0, 240);
    clean = ext ? `${base}.${ext}` : base;
  }

  return clean;
}

/**
 * Extrait l'extension d'un fichier en minuscules
 */
export function getFileExtension(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') return '';
  const parts = fileName.split('.');
  if (parts.length <= 1) return '';
  return (parts.pop() || '').toLowerCase().trim();
}

/**
 * Vérifie si un fichier peut être téléversé en toute sécurité
 * Vérifie : la taille et l'extension interdite (OWASP A04 / A08)
 */
export function validateUploadFile(file: { name: string; size: number; type?: string }): {
  valid: boolean;
  error?: string;
} {
  if (!file) {
    return { valid: false, error: 'Aucun fichier fourni.' };
  }

  // Vérification de la taille
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false,
      error: `Le fichier dépasse la taille maximale autorisée de ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} Mo.`
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: 'Le fichier est vide (0 octet).'
    };
  }

  // Vérification de l'extension
  const extension = getFileExtension(file.name);
  if (extension && DANGEROUS_FILE_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: `Le type de fichier ".${extension}" est interdit pour des raisons de sécurité de la plateforme.`
    };
  }

  return { valid: true };
}

/**
 * Protège contre les redirections ouvertes (Open Redirect - OWASP A06 / CVE-2025-68470)
 * S'assure que la cible de redirection est strictement relative et ne peut pas contourner
 * le domaine avec des barres obliques inverses ou doubles.
 */
export function sanitizeRedirectPath(path: string | null | undefined, fallback = '/dashboard'): string {
  if (!path || typeof path !== 'string') {
    return fallback;
  }

  const trimmed = path.trim();

  // Rejeter si vide
  if (!trimmed) {
    return fallback;
  }

  // Rejeter si contient des barres obliques inverses (ex: \evil.com) ou commence par //
  if (trimmed.includes('\\') || trimmed.startsWith('//')) {
    console.warn('[Security] Tentative de redirection ouverte bloquée :', trimmed);
    return fallback;
  }

  // Rejeter tout protocole (http:, https:, javascript:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    console.warn('[Security] Redirection absolue bloquée :', trimmed);
    return fallback;
  }

  // Doit commencer par un slash unique
  if (!trimmed.startsWith('/')) {
    return `/${trimmed}`;
  }

  return trimmed;
}

/**
 * Valide la politique de robustesse des mots de passe (OWASP A07)
 * Critères :
 * - Au moins 8 caractères
 * - Au moins 1 majuscule
 * - Au moins 1 minuscule
 * - Au moins 1 chiffre
 * - Au moins 1 caractère spécial
 */
export function validatePasswordPolicy(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Le mot de passe ne peut pas être vide.'] };
  }

  if (password.length < 8) {
    errors.push('Au moins 8 caractères.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Au moins une lettre majuscule.');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Au moins une lettre minuscule.');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Au moins un chiffre.');
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    errors.push('Au moins un caractère spécial (!@#$%^&*...).');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
