import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { profileService } from '../../services/profileService';

export const ProfilePage: React.FC = () => {
  const { user, profile, isAdmin, updateUserProfile } = useAuth();
  const { showToast } = useToast();

  const isFemaleDefault =
    profile?.gender === 'female' ||
    (profile?.gender === undefined && (
      (profile?.full_name && /samira|sarah|julie|amina|inès|ines|marie|laura|claire|sophie|camille|emma|chloé|léa|noura/i.test(profile.full_name)) ||
      (user?.email && /samira/i.test(user.email))
    ));

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [jobTitle, setJobTitle] = useState(profile?.job_title || '');
  const [phone, setPhone] = useState(profile?.phone || '+33 6 12 34 56 78');
  const [gender, setGender] = useState<'female' | 'male'>(
    profile?.gender || (isFemaleDefault ? 'female' : 'male')
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setJobTitle(profile.job_title || '');
      setPhone(profile.phone || '+33 6 12 34 56 78');
      if (profile.gender) {
        setGender(profile.gender);
      }
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const targetId = profile?.id || user?.id;
      if (targetId) {
        const payload = {
          full_name: fullName.trim(),
          job_title: jobTitle.trim(),
          phone: phone.trim(),
          gender: gender,
        };

        if (updateUserProfile) {
          await updateUserProfile(payload);
        } else {
          await profileService.updateProfile(targetId, payload);
        }
      }
      showToast('Profil et civilité mis à jour avec succès', 'check_circle', 'success');
    } catch {
      showToast('Erreur lors de la mise à jour du profil', 'error', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary-container tracking-tight">
          Mon Profil
        </h1>
        <p className="text-sm text-secondary mt-0.5">
          Informations personnelles et fiche au sein de TUWSHIUAH Workspace.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-6 shadow-xs">
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          {/* Avatar Banner */}
          <div className="flex items-center gap-5 pb-6 border-b border-surface-container">
            <div className="relative">
              <img
                src={
                  profile?.avatar_url ||
                  (gender === 'female'
                    ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Directrice&top=bun,longButNotTooLong&facialHairProbability=0'
                    : 'https://api.dicebear.com/7.x/avataaars/svg?seed=Directeur&top=shortCurly,theCaesar')
                }
                alt={profile?.full_name || 'Profil'}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-surface-container shadow-md"
              />
              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white"></span>
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-primary-container">
                {profile?.full_name || user?.email}
              </h2>
              <span className="text-xs text-secondary font-medium">
                {profile?.job_title || (isAdmin ? 'Direction Générale' : 'Collaborateur')}
              </span>
              <span className="text-xs text-brand-orange font-bold mt-1 flex items-center gap-1.5">
                <Icon name={isAdmin ? 'crown' : 'briefcase'} className="text-[12px]" />
                <span>
                  {isAdmin
                    ? (gender === 'female' ? 'Directrice Générale (Admin)' : 'Directeur Général (Admin)')
                    : 'Collaborateur'}
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                Nom complet
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
              />
            </div>

            {/* Genre : Femme ou Homme */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                Genre
              </label>
              <div className="grid grid-cols-2 gap-2 h-[42px]">
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`h-full px-4 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all cursor-pointer ${
                    gender === 'female'
                      ? 'bg-brand-orange text-white border-brand-orange shadow-xs font-bold'
                      : 'bg-surface-container-low text-secondary border-surface-container hover:bg-surface-container hover:text-primary-container'
                  }`}
                >
                  <span>Femme</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`h-full px-4 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all cursor-pointer ${
                    gender === 'male'
                      ? 'bg-brand-orange text-white border-brand-orange shadow-xs font-bold'
                      : 'bg-surface-container-low text-secondary border-surface-container hover:bg-surface-container hover:text-primary-container'
                  }`}
                >
                  <span>Homme</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                Poste / Titre
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                Téléphone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
              />
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                Adresse Email (Workspace)
              </label>
              <input
                type="email"
                value={profile?.email || user?.email || ''}
                disabled
                className="px-3.5 py-2.5 rounded-xl bg-surface-container border border-surface-container text-sm text-secondary cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-container">
            <Button type="submit" variant="primary" icon="save" isLoading={saving} disabled={saving}>
              Mettre à jour le profil
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
