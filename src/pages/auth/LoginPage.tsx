import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useToast } from '../../hooks/useToast';
import { authService } from '../../services/authService';
import { sanitizeRedirectPath, validatePasswordPolicy } from '../../lib/security';

export const LoginPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'login' | 'forgot_password' | 'update_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);

  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  // Protection OWASP A06 : Assainissement strict de la redirection
  const destination = sanitizeRedirectPath((location.state as any)?.from?.pathname);

  // Détection du mode de réinitialisation depuis l'URL ou le hash Supabase Auth
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hash = window.location.hash;
    if (searchParams.get('mode') === 'update-password' || hash.includes('type=recovery')) {
      setViewMode('update_password');
    }
  }, [location]);

  // Si l'utilisateur est déjà connecté et pas en train de réinitialiser son mot de passe
  useEffect(() => {
    if (isAuthenticated && viewMode !== 'update_password') {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate, viewMode]);

  // Soumission Connexion avec protection anti-force brute (OWASP A07)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const now = Date.now();
    if (lockoutUntil > now) {
      const waitSeconds = Math.ceil((lockoutUntil - now) / 1000);
      const msg = `Trop de tentatives infructueuses. Veuillez patienter encore ${waitSeconds}s par mesure de sécurité.`;
      setErrorMessage(msg);
      showToast(msg, 'lock_clock', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const result = await signIn(email, password);
      if (result?.error) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);

        if (nextAttempts >= 5) {
          setLockoutUntil(Date.now() + 30000); // Verrouillage 30s après 5 échecs
          setFailedAttempts(0);
          const lockoutMsg = "Trop de tentatives infructueuses (5). Connexion temporairement suspendue pendant 30 secondes.";
          setErrorMessage(lockoutMsg);
          showToast(lockoutMsg, 'lock_clock', 'error');
        } else {
          setErrorMessage(result.error);
          showToast(result.error, 'error', 'error');
        }
      } else {
        setFailedAttempts(0);
        setLockoutUntil(0);
        showToast('Connexion réussie à TUWSHIUAH Workspace', 'verified');
        navigate(destination, { replace: true });
      }
    } catch (err: any) {
      const msg = err?.message || 'Erreur inattendue lors de la connexion.';
      setErrorMessage(msg);
      showToast(msg, 'error', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Soumission Demande Mot de passe oublié
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      const res = await authService.resetPassword(email);
      if (res.error) {
        setErrorMessage(res.error);
        showToast(res.error, 'error', 'error');
      } else {
        setSuccessMessage(
          "Un lien de réinitialisation a été envoyé à votre adresse e-mail. Veuillez consulter vos messages pour définir un nouveau mot de passe."
        );
        showToast('Lien de réinitialisation envoyé', 'verified');
      }
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors de l’envoi de la demande.';
      setErrorMessage(msg);
      showToast(msg, 'error', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Soumission Nouveau Mot de passe
  const handleUpdatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    const policy = validatePasswordPolicy(newPassword);
    if (!policy.valid) {
      setErrorMessage(`Politique de sécurité : ${policy.errors.join(' ')}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await authService.updatePassword(newPassword);
      if (res.error) {
        setErrorMessage(res.error);
        showToast(res.error, 'error', 'error');
      } else {
        showToast('Mot de passe mis à jour avec succès', 'verified');
        setSuccessMessage('Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.');
        setTimeout(() => {
          setViewMode('login');
          setPassword('');
          setNewPassword('');
          setConfirmPassword('');
        }, 1500);
      }
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors de la mise à jour.';
      setErrorMessage(msg);
      showToast(msg, 'error', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-orange/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-8 border border-surface-container shadow-xl relative z-10 flex flex-col gap-6">
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <Logo className="h-10 w-auto" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-primary text-[11px] font-bold tracking-wide mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
            <span>
              {viewMode === 'forgot_password'
                ? "Récupération d'Accès"
                : viewMode === 'update_password'
                ? 'Nouveau Mot de Passe'
                : 'Workspace Privé Sécurisé'}
            </span>
          </div>
          <p className="text-xs text-secondary italic mt-1 font-medium">
            {viewMode === 'forgot_password'
              ? 'Réinitialisez votre mot de passe en toute sécurité'
              : viewMode === 'update_password'
              ? 'Définissez votre nouveau mot de passe sécurisé'
              : '« Collaborer. Partager. Avancer. »'}
          </p>
        </div>

        {/* Message d'erreur */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-error-container/30 border border-error/30 text-error flex items-start gap-2.5 text-xs animate-in fade-in">
            <Icon name="error" className="text-[18px] shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Message de succès */}
        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2.5 text-xs animate-in fade-in">
            <Icon name="check_circle" className="text-[18px] text-emerald-600 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* VUE 1 : CONNEXION STANDARD */}
        {viewMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-primary-container">
                Adresse e-mail professionnelle
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-secondary">
                  <Icon name="mail" className="text-[18px]" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-container-low border border-surface-container text-on-surface text-sm focus:outline-none focus:border-brand-orange focus:bg-white transition-all font-medium disabled:opacity-60"
                  placeholder="nom@tuwshiuah.com"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-primary-container">
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('forgot_password');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-[11px] text-brand-orange font-semibold hover:underline cursor-pointer"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-secondary">
                  <Icon name="lock" className="text-[18px]" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-container-low border border-surface-container text-on-surface text-sm focus:outline-none focus:border-brand-orange focus:bg-white transition-all font-medium disabled:opacity-60"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-secondary hover:text-primary-container transition-colors cursor-pointer"
                  title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="text-[18px]" />
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="orange"
              size="lg"
              isLoading={submitting}
              disabled={submitting}
              icon="login"
              className="w-full mt-2"
            >
              Se connecter au Workspace
            </Button>
          </form>
        )}

        {/* VUE 2 : MOT DE PASSE OUBLIÉ */}
        {viewMode === 'forgot_password' && (
          <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-primary-container">
                Adresse e-mail de votre compte
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-secondary">
                  <Icon name="mail" className="text-[18px]" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-container-low border border-surface-container text-on-surface text-sm focus:outline-none focus:border-brand-orange focus:bg-white transition-all font-medium disabled:opacity-60"
                  placeholder="nom@tuwshiuah.com"
                />
              </div>
              <span className="text-[11px] text-secondary">
                Vous recevrez un e-mail avec un lien sécurisé pour définir un nouveau mot de passe.
              </span>
            </div>

            <Button
              type="submit"
              variant="orange"
              size="lg"
              isLoading={submitting}
              disabled={submitting}
              icon="send"
              className="w-full mt-1"
            >
              Envoyer le lien de réinitialisation
            </Button>

            <button
              type="button"
              onClick={() => {
                setViewMode('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="text-xs text-secondary hover:text-primary-container font-semibold text-center mt-2 cursor-pointer flex items-center justify-center gap-1 transition-colors"
            >
              <Icon name="arrow_back" className="text-sm" />
              <span>Retour à la connexion</span>
            </button>
          </form>
        )}

        {/* VUE 3 : NOUVEAU MOT DE PASSE */}
        {viewMode === 'update_password' && (
          <form onSubmit={handleUpdatePasswordSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-primary-container">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-secondary">
                  <Icon name="lock" className="text-[18px]" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={submitting}
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-container-low border border-surface-container text-on-surface text-sm focus:outline-none focus:border-brand-orange focus:bg-white transition-all font-medium disabled:opacity-60"
                  placeholder="Minimum 6 caractères"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-secondary hover:text-primary-container transition-colors cursor-pointer"
                  title={showPassword ? 'Masquer' : 'Afficher'}
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="text-[18px]" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-primary-container">
                Confirmer le nouveau mot de passe
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-secondary">
                  <Icon name="lock_reset" className="text-[18px]" />
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={submitting}
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-container-low border border-surface-container text-on-surface text-sm focus:outline-none focus:border-brand-orange focus:bg-white transition-all font-medium disabled:opacity-60"
                  placeholder="Répétez le mot de passe"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-secondary hover:text-primary-container transition-colors cursor-pointer"
                  title={showConfirmPassword ? 'Masquer' : 'Afficher'}
                >
                  <Icon name={showConfirmPassword ? 'visibility_off' : 'visibility'} className="text-[18px]" />
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="orange"
              size="lg"
              isLoading={submitting}
              disabled={submitting}
              icon="check_circle"
              className="w-full mt-1"
            >
              Mettre à jour mon mot de passe
            </Button>
          </form>
        )}

        {/* Note de sécurité entreprise */}
        <div className="p-3 rounded-xl bg-surface-container-low/60 border border-surface-container/60 text-center">
          <p className="text-[11px] text-secondary leading-relaxed">
            🔒 <strong className="text-primary-container">Espace d'entreprise privé :</strong> Les comptes collaborateurs sont créés et gérés exclusivement par la Direction.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
