import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { profileService } from '../../services/profileService';
import { Profile, UserRole } from '../../types/database';
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

export const generateAvatarByGender = (name: string, gender: 'female' | 'male') => {
  const seed = encodeURIComponent(name?.trim() || (gender === 'female' ? 'femme' : 'homme'));
  if (gender === 'female') {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&top=bob,bun,curly,curvy,dreads,longButNotTooLong,miaWallace,straight02,straight01,straightAndStrand&facialHairProbability=0`;
  }
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&top=shortCurly,shortFlat,shortRound,shortWaved,sides,theCaesar,theCaesarAndSidePart`;
};

interface MemberFormData {
  full_name: string;
  job_title: string;
  email: string;
  password?: string;
  phone: string;
  role: UserRole;
  gender: 'female' | 'male';
  avatar_url: string;
}

const initialFormData: MemberFormData = {
  full_name: '',
  job_title: '',
  email: '',
  password: '',
  phone: '+33 6 ',
  role: 'employee',
  gender: 'female',
  avatar_url: generateAvatarByGender('', 'female'),
};

export const TeamPage: React.FC = () => {
  const { user, profile: currentProfile, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);
  const [editingMember, setEditingMember] = useState<Profile | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<MemberFormData>(initialFormData);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Veuillez sélectionner un fichier image valide (JPG, PNG, WebP)', 'warning', 'warning');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("L'image ne doit pas dépasser 5 Mo", 'warning', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setFormData((prev) => ({ ...prev, avatar_url: result }));
        showToast('Photo de profil sélectionnée', 'check_circle', 'success');
      }
    };
    reader.onerror = () => {
      showToast("Erreur lors de la lecture de l'image", 'error', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setFormData((prev) => ({
      ...prev,
      avatar_url: generateAvatarByGender(prev.full_name, prev.gender),
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenderChange = (newGender: 'female' | 'male') => {
    setFormData((prev) => {
      const isCustomUpload = prev.avatar_url?.startsWith('data:image');
      if (isCustomUpload) {
        return { ...prev, gender: newGender };
      }

      return {
        ...prev,
        gender: newGender,
        avatar_url: generateAvatarByGender(prev.full_name, newGender),
      };
    });
  };

  // Charger les profils
  const fetchMembers = async () => {
    try {
      const data = await profileService.getAllProfiles();
      setMembers(data);
    } catch (err) {
      showToast('Impossible de charger la liste des membres', 'error', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // Filtrer les collaborateurs
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.full_name?.toLowerCase().includes(query) ||
        m.job_title?.toLowerCase().includes(query) ||
        m.email?.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  // Ouvrir la modale d'ajout (Admin uniquement)
  const handleOpenAddModal = () => {
    if (!isAdmin) {
      showToast('Seul l’administrateur a le droit d’ajouter un collaborateur', 'warning', 'warning');
      return;
    }
    setEditingMember(null);
    setFormData(initialFormData);
    setIsFormModalOpen(true);
  };

  // Ouvrir la modale d'édition (Admin uniquement)
  const handleOpenEditModal = (member: Profile) => {
    if (!isAdmin) {
      showToast('Seul l’administrateur a le droit de modifier un collaborateur', 'warning', 'warning');
      return;
    }
    setEditingMember(member);

    const isFemale =
      member.gender === 'female' ||
      member.avatar_url?.includes('facialHairProbability=0') ||
      (member.full_name && /sarah|julie|amina|inès|ines|marie|laura|claire|sophie|camille|emma|chloé|léa|noura/i.test(member.full_name));

    const gender: 'female' | 'male' = member.gender || (isFemale ? 'female' : 'male');
    const avatar = member.avatar_url || generateAvatarByGender(member.full_name || '', gender);

    setFormData({
      full_name: member.full_name || '',
      job_title: member.job_title || '',
      email: member.email || '',
      phone: member.phone || '',
      role: member.role || 'employee',
      gender: gender,
      avatar_url: avatar,
    });
    setIsFormModalOpen(true);
  };

  // Ouvrir la modale de suppression (Admin uniquement)
  const handleOpenDeleteModal = (member: Profile) => {
    if (!isAdmin) {
      showToast('Seul l’administrateur a le droit de supprimer un collaborateur', 'warning', 'warning');
      return;
    }
    setMemberToDelete(member);
    setIsDeleteModalOpen(true);
  };

  // Ouvrir la modale de consultation de profil (Lecture seule)
  const handleOpenViewModal = (member: Profile) => {
    setViewingProfile(member);
    setIsViewModalOpen(true);
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let generated = 'TUWS-';
    for (let i = 0; i < 8; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password: generated }));
    setShowPassword(true);
    showToast('Mot de passe sécurisé généré avec succès ! Transmettez-le au collaborateur.', 'check_circle', 'info');
  };

  // Soumission du formulaire (Ajout ou Modification - Admin uniquement)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Action non autorisée', 'error', 'error');
      return;
    }
    if (!formData.full_name.trim() || !formData.email.trim() || !formData.job_title.trim()) {
      showToast('Veuillez remplir tous les champs obligatoires', 'warning', 'warning');
      return;
    }

    if (!editingMember && (!formData.password || formData.password.trim().length < 6)) {
      showToast('Le mot de passe initial du collaborateur doit comporter au moins 6 caractères', 'warning', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      if (editingMember) {
        // Modification
        const updated = await profileService.updateMember(editingMember.id, {
          full_name: formData.full_name,
          job_title: formData.job_title,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
          gender: formData.gender,
          avatar_url: formData.avatar_url || undefined,
        });

        if (updated) {
          setMembers((prev) => prev.map((m) => (m.id === editingMember.id ? updated : m)));
          showToast(`Collaborateur ${updated.full_name} modifié avec succès`, 'check_circle', 'success');
        }
      } else {
        // Ajout avec compte Supabase Auth
        const created = await profileService.addMember({
          full_name: formData.full_name,
          job_title: formData.job_title,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          role: formData.role,
          gender: formData.gender,
          avatar_url: formData.avatar_url || undefined,
        });

        setMembers((prev) => [...prev, created]);
        showToast(`Compte de ${created.full_name} créé avec succès ! Identifiants prêts.`, 'person_add', 'success');
      }

      setIsFormModalOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de l’enregistrement', 'error', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmer la suppression (Admin uniquement)
  const handleConfirmDelete = async () => {
    if (!isAdmin || !memberToDelete) return;

    // Protection : empêcher l'administrateur connecté de se supprimer lui-même
    if (memberToDelete.id === user?.id || memberToDelete.id === currentProfile?.id) {
      showToast('Vous ne pouvez pas supprimer votre propre compte administrateur', 'warning', 'warning');
      setIsDeleteModalOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      await profileService.deleteMember(memberToDelete.id);
      setMembers((prev) => prev.filter((m) => m.id !== memberToDelete.id));
      showToast(`Collaborateur ${memberToDelete.full_name} supprimé du workspace`, 'delete', 'info');
      setIsDeleteModalOpen(false);
      setMemberToDelete(null);
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la suppression', 'error', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2.5">
            <h1 className="font-headline text-2xl font-bold text-primary-container tracking-tight">
              Équipe TUWSHIUAH
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-primary-container text-xs font-bold">
              {members.length}
            </span>
          </div>
          <p className="text-sm text-secondary mt-0.5">
            Annuaire des talents et collaborateurs de l'agence d'IA et numérique.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Tous connectés
          </div>

          {/* Action réservée à l'Administrateur uniquement */}
          {isAdmin && (
            <Button
              variant="orange"
              icon="person_add"
              onClick={handleOpenAddModal}
              className="shadow-sm hover:shadow"
            >
              Ajouter un collaborateur
            </Button>
          )}
        </div>
      </div>

      {/* Barre de recherche rapide */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-3.5 flex items-center text-secondary">
          <Icon name="search" className="text-[18px]" />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher par nom, poste ou e-mail..."
          className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-lowest border border-surface-container text-sm text-on-surface focus:outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 transition-all placeholder:text-secondary/70 shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-3 flex items-center text-secondary hover:text-on-surface"
          >
            <Icon name="close" className="text-[16px]" />
          </button>
        )}
      </div>

      {/* État de chargement */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-secondary">
          <Icon name="spinner" spin className="text-3xl text-brand-orange" />
          <span className="text-sm font-medium">Chargement de l'annuaire collaborateur...</span>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="py-16 bg-surface-container-lowest rounded-2xl border border-surface-container flex flex-col items-center justify-center text-center p-6">
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-secondary mb-3">
            <Icon name="group_off" className="text-2xl" />
          </div>
          <h3 className="font-headline text-base font-bold text-primary-container">
            Aucun collaborateur trouvé
          </h3>
          <p className="text-xs text-secondary mt-1 max-w-sm">
            {searchQuery
              ? `Aucun profil ne correspond à votre recherche "${searchQuery}".`
              : "Aucun membre n'est actuellement inscrit dans l'annuaire."}
          </p>
        </div>
      ) : (
        /* Grille des Collaborateurs */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMembers.map((profile) => {
            const isSelf = profile.id === user?.id || profile.id === currentProfile?.id;
            const isProfileAdmin = profile.role?.toLowerCase() === 'admin';

            return (
              <div
                key={profile.id}
                className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 group"
              >
                {/* Header Profil */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={
                          profile.avatar_url ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.full_name)}`
                        }
                        alt={profile.full_name}
                        className="w-14 h-14 rounded-2xl object-cover shadow-xs ring-1 ring-surface-container"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-surface-container-lowest" />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-headline text-base font-bold text-primary-container truncate">
                          {profile.full_name}
                        </h3>
                        {isProfileAdmin ? (
                          <Badge variant="orange" size="sm">
                            <Icon name="crown" className="text-[11px] mr-1" /> Direction
                          </Badge>
                        ) : (
                          <span className="text-[10px] font-semibold text-secondary px-2 py-0.5 rounded-full bg-surface-container">
                            Collaborateur
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[10px] font-bold text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded-full">
                            Vous
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-secondary font-medium mt-0.5 truncate">
                        {profile.job_title || 'Collaborateur Agence'}
                      </span>
                    </div>
                  </div>

                  {/* Boutons d'administration (Modifier / Supprimer) - Strictement réservés à l'Admin */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(profile)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-brand-orange hover:bg-surface-container transition-colors"
                        title="Modifier ce collaborateur"
                      >
                        <Icon name="edit" className="text-[16px]" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDeleteModal(profile)}
                        disabled={isSelf}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          isSelf
                            ? 'text-surface-container cursor-not-allowed'
                            : 'text-secondary hover:text-error hover:bg-error-container/20'
                        }`}
                        title={isSelf ? 'Vous ne pouvez pas supprimer votre propre compte' : 'Supprimer ce collaborateur'}
                      >
                        <Icon name="delete" className="text-[16px]" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Coordonnées */}
                <div className="flex flex-col gap-1.5 text-xs text-secondary bg-surface-container-low/50 p-3 rounded-xl border border-surface-container/40">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon name="mail" className="text-[15px] text-primary-container shrink-0" />
                    <span className="truncate font-mono text-[11px]">{profile.email}</span>
                  </div>
                  {profile.phone && (
                    <div className="flex items-center gap-2.5">
                      <Icon name="call" className="text-[15px] text-primary-container shrink-0" />
                      <span className="font-mono text-[11px]">{profile.phone}</span>
                    </div>
                  )}
                </div>

                {/* Actions de contact ou de gestion selon le rôle */}
                <div className="flex items-center gap-2 pt-1 border-t border-surface-container/60">
                  {isAdmin ? (
                    <>
                      {!isSelf && (
                        <Link
                          to={`/messages?contact=${profile.id}`}
                          className="flex-1 h-8 rounded-lg bg-surface-container text-primary-container text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container-high transition-colors"
                        >
                          <Icon name="chat_bubble" className="text-[15px]" />
                          Contacter
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(profile)}
                        className={`${isSelf ? 'w-full' : 'flex-1'} h-8 rounded-lg bg-primary-container text-on-primary text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-colors`}
                      >
                        <Icon name="edit" className="text-[15px]" />
                        Modifier la fiche
                      </button>
                    </>
                  ) : (
                    /* Pour les collaborateurs : contact direct et consultation du profil */
                    <>
                      {!isSelf && (
                        <Link
                          to={`/messages?contact=${profile.id}`}
                          className="flex-1 h-8 rounded-lg bg-surface-container text-primary-container text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container-high transition-colors"
                        >
                          <Icon name="chat_bubble" className="text-[15px]" />
                          Contacter
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenViewModal(profile)}
                        className={`${isSelf ? 'w-full' : 'flex-1'} h-8 rounded-lg bg-primary-container text-on-primary text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-colors`}
                      >
                        <Icon name="visibility" className="text-[15px]" />
                        Voir le profil
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modales d'Administration - Strictement réservées à l'Administrateur */}
      {isAdmin && (
        <>
          <Modal
            isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingMember ? 'Modifier le Collaborateur' : 'Nouveau Collaborateur'}
        subtitle={
          editingMember
            ? `Mise à jour des informations de ${editingMember.full_name}`
            : "Inscrire un nouveau membre d'équipe dans TUWSHIUAH Workspace"
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitForm} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nom complet */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-primary-container">
                Nom complet <span className="text-brand-orange">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => {
                  const newName = e.target.value;
                  setFormData((prev) => {
                    const isCustomUpload = prev.avatar_url?.startsWith('data:image');
                    return {
                      ...prev,
                      full_name: newName,
                      avatar_url: isCustomUpload ? prev.avatar_url : generateAvatarByGender(newName, prev.gender),
                    };
                  });
                }}
                placeholder="Ex: Sophie Martin"
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container text-xs text-on-surface focus:outline-none focus:border-brand-orange focus:bg-white transition-all"
              />
            </div>

            {/* Poste / Titre */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-primary-container">
                Poste / Titre <span className="text-brand-orange">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.job_title}
                onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                placeholder="Ex: Data Engineer & MLOps"
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container text-xs text-on-surface focus:outline-none focus:border-brand-orange focus:bg-white transition-all"
              />
            </div>

            {/* Email professionnel */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-primary-container">
                Adresse e-mail professionnelle <span className="text-brand-orange">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="nom@tuwshiuah.com"
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container text-xs text-on-surface focus:outline-none focus:border-brand-orange focus:bg-white transition-all"
              />
            </div>

            {/* Téléphone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-primary-container">
                Numéro de téléphone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+33 6 12 34 56 78"
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container text-xs text-on-surface focus:outline-none focus:border-brand-orange focus:bg-white transition-all"
              />
            </div>

            {/* Mot de passe de connexion initial (Création de compte par l'Admin) */}
            {!editingMember && (
              <div className="flex flex-col gap-1.5 sm:col-span-2 p-3.5 rounded-xl bg-surface-container-low/60 border border-surface-container">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-primary-container flex items-center gap-1.5">
                    <Icon name="lock" className="text-brand-orange text-[15px]" />
                    Mot de passe de connexion initial <span className="text-brand-orange">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] text-brand-orange font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Icon name="auto_awesome" className="text-[14px]" />
                    Générer un mot de passe
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingMember}
                    minLength={6}
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimum 6 caractères (ex: TUWS-2026!)"
                    className="w-full h-10 pl-3 pr-10 rounded-xl bg-white border border-surface-container text-xs text-on-surface focus:outline-none focus:border-brand-orange transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary-container cursor-pointer"
                    title={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="text-[16px]" />
                  </button>
                </div>
                <p className="text-[11px] text-secondary leading-tight mt-0.5">
                  🔐 Ce mot de passe permettra à l'employé de se connecter immédiatement à son espace personnel.
                </p>
              </div>
            )}
          </div>

          {/* Rôle sur la plateforme */}
          <div className="flex flex-col gap-2 pt-1 border-t border-surface-container">
            <label className="text-xs font-bold text-primary-container">
              Rôle et permissions d'accès <span className="text-brand-orange">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  formData.role === 'employee'
                    ? 'border-brand-orange bg-brand-orange/5'
                    : 'border-surface-container hover:bg-surface-container-low'
                }`}
              >
                <input
                  type="radio"
                  name="member_role"
                  value="employee"
                  checked={formData.role === 'employee'}
                  onChange={() => setFormData({ ...formData, role: 'employee' })}
                  className="mt-0.5 accent-brand-orange"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-primary-container">Collaborateur</span>
                  <span className="text-[10px] text-secondary">
                    Consultation, travail d'équipe et soumission de livrables.
                  </span>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  formData.role === 'admin'
                    ? 'border-brand-orange bg-brand-orange/5'
                    : 'border-surface-container hover:bg-surface-container-low'
                }`}
              >
                <input
                  type="radio"
                  name="member_role"
                  value="admin"
                  checked={formData.role === 'admin'}
                  onChange={() => setFormData({ ...formData, role: 'admin' })}
                  className="mt-0.5 accent-brand-orange"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-brand-orange flex items-center gap-1">
                    <Icon name="crown" className="text-[12px]" /> Direction (Admin)
                  </span>
                  <span className="text-[10px] text-secondary">
                    Contrôle total, arbitrage, gestion d'équipe et validation.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Genre */}
          <div className="flex flex-col gap-2 pt-2 border-t border-surface-container">
            <label className="text-xs font-bold text-primary-container">
              Genre
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                  formData.gender === 'female'
                    ? 'border-brand-orange bg-brand-orange/5 ring-1 ring-brand-orange/30 shadow-xs'
                    : 'border-surface-container hover:bg-surface-container-low'
                }`}
              >
                <input
                  type="radio"
                  name="member_gender"
                  value="female"
                  checked={formData.gender === 'female'}
                  onChange={() => handleGenderChange('female')}
                  className="accent-brand-orange"
                />
                <span className="text-xs font-bold text-primary-container">Femme</span>
              </label>

              <label
                className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                  formData.gender === 'male'
                    ? 'border-brand-orange bg-brand-orange/5 ring-1 ring-brand-orange/30 shadow-xs'
                    : 'border-surface-container hover:bg-surface-container-low'
                }`}
              >
                <input
                  type="radio"
                  name="member_gender"
                  value="male"
                  checked={formData.gender === 'male'}
                  onChange={() => handleGenderChange('male')}
                  className="accent-brand-orange"
                />
                <span className="text-xs font-bold text-primary-container">Homme</span>
              </label>
            </div>
          </div>

          {/* Photo de profil (Aperçu et upload optionnel) */}
          <div className="flex flex-col gap-2 pt-2 border-t border-surface-container">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-primary-container">
                Photo du collaborateur
              </label>
              {formData.avatar_url && formData.avatar_url.startsWith('data:image') && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-[11px] font-semibold text-error hover:underline flex items-center gap-1"
                >
                  <Icon name="refresh" className="text-[13px]" />
                  Revenir à l'avatar automatique
                </button>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/webp, image/gif"
              className="hidden"
            />

            <div className="flex items-center gap-4 p-3 rounded-2xl bg-surface-container-low/70 border border-surface-container">
              {/* Aperçu de l'avatar */}
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center overflow-hidden ring-2 ring-surface-container shadow-xs">
                  <img
                    src={formData.avatar_url || generateAvatarByGender(formData.full_name, formData.gender)}
                    alt="Photo collaborateur"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand-orange text-on-primary flex items-center justify-center shadow-xs hover:opacity-90 transition-opacity"
                  title="Importer une photo depuis vos fichiers"
                >
                  <Icon name="add" className="text-[12px]" />
                </button>
              </div>

              {/* Bouton d'ajout et indications */}
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon="add"
                    onClick={() => fileInputRef.current?.click()}
                    className="shadow-xs"
                  >
                    {formData.avatar_url?.startsWith('data:image') ? 'Changer la photo' : 'Importer une photo depuis l\'ordinateur'}
                  </Button>
                  {formData.avatar_url?.startsWith('data:image') && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Icon name="check_circle" className="text-[12px]" /> Photo personnalisée active
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-secondary leading-snug">
                  Vous pouvez téléverser une photo personnalisée depuis votre ordinateur si vous le souhaitez.
                </span>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFormModalOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="orange"
              size="sm"
              isLoading={submitting}
              disabled={submitting}
              icon={editingMember ? 'save' : 'person_add'}
            >
              {editingMember ? 'Mettre à jour' : 'Ajouter le collaborateur'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modale de Confirmation de Suppression */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Retirer ce collaborateur ?"
        maxWidth="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-error-container/20 border border-error/20 text-error">
            <Icon name="warning" className="text-xl shrink-0 mt-0.5" />
            <div className="flex flex-col text-xs leading-relaxed">
              <span className="font-bold">Action irréversible</span>
              <p className="text-on-surface-variant mt-0.5">
                Êtes-vous sûr de vouloir retirer définitivement{' '}
                <strong className="text-on-surface font-bold">
                  {memberToDelete?.full_name}
                </strong>{' '}
                de l'équipe TUWSHIUAH Workspace ?
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              icon="delete"
              isLoading={submitting}
              disabled={submitting}
              onClick={handleConfirmDelete}
            >
              Supprimer définitivement
            </Button>
          </div>
        </div>
      </Modal>
        </>
      )}

      {/* Modale de Consultation de Profil (Lecture seule - accessible à tous) */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Fiche Collaborateur"
        subtitle="Consultation du profil en mode lecture seule"
        maxWidth="md"
      >
        {viewingProfile && (() => {
          const isViewingSelf = viewingProfile.id === user?.id || viewingProfile.id === currentProfile?.id;
          return (
            <div className="flex flex-col gap-5">
              {/* Header Profil */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-surface-container-low border border-surface-container/60">
                <div className="relative shrink-0">
                  <img
                    src={
                      viewingProfile.avatar_url ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(viewingProfile.full_name)}`
                    }
                    alt={viewingProfile.full_name}
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-surface-container-lowest shadow-sm"
                  />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-surface-container-low" />
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-headline text-lg font-bold text-primary-container truncate">
                      {viewingProfile.full_name}
                    </h3>
                    {viewingProfile.role?.toLowerCase() === 'admin' ? (
                      <Badge variant="orange" size="sm">
                        <Icon name="crown" className="text-[11px] mr-1" /> Direction
                      </Badge>
                    ) : (
                      <span className="text-[10px] font-semibold text-secondary px-2 py-0.5 rounded-full bg-surface-container">
                        Collaborateur
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-secondary font-medium mt-0.5">
                    {viewingProfile.job_title || 'Collaborateur Agence'}
                  </p>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Membre actif de l'agence
                  </span>

                  {/* Bouton d'action direct "Contacter" dans le profil */}
                  {!isViewingSelf && (
                    <Link
                      to={`/messages?contact=${viewingProfile.id}`}
                      onClick={() => setIsViewModalOpen(false)}
                      className="inline-flex items-center gap-1.5 h-8 px-3.5 mt-2.5 rounded-xl bg-primary-container text-on-primary text-xs font-bold hover:opacity-90 transition-all self-start shadow-xs"
                    >
                      <Icon name="chat_bubble" className="text-[14px]" />
                      <span>Contacter</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Coordonnées & Informations */}
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-bold text-secondary uppercase tracking-wider">
                  Coordonnées professionnelles
                </h4>
                <div className="flex flex-col gap-2.5 bg-surface-container-lowest p-4 rounded-xl border border-surface-container">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 text-secondary">
                      <Icon name="mail" className="text-[18px] text-primary-container shrink-0" />
                      <span>Adresse e-mail :</span>
                    </div>
                    <span className="font-mono font-medium text-primary-container truncate">
                      {viewingProfile.email}
                    </span>
                  </div>

                  {viewingProfile.phone && (
                    <div className="flex items-center justify-between gap-3 text-xs pt-2 border-t border-surface-container/60">
                      <div className="flex items-center gap-2.5 text-secondary">
                        <Icon name="call" className="text-[18px] text-primary-container shrink-0" />
                        <span>Téléphone pro :</span>
                      </div>
                      <span className="font-mono font-medium text-primary-container">
                        {viewingProfile.phone}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions du bas de la modale */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-container mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setIsViewModalOpen(false)}
                >
                  Fermer
                </Button>
                {!isViewingSelf && (
                  <Link
                    to={`/messages?contact=${viewingProfile.id}`}
                    onClick={() => setIsViewModalOpen(false)}
                    className="h-10 px-4 text-sm rounded-xl gap-2 font-semibold inline-flex items-center justify-center bg-primary-container text-on-primary hover:opacity-95 shadow-sm transition-all"
                  >
                    <Icon name="chat_bubble" className="text-[16px]" />
                    <span>Contacter</span>
                  </Link>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default TeamPage;
