import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Icon } from '../ui/Icon';

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

interface EmojiCategory {
  name: string;
  icon: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'Populaires',
    icon: '⭐',
    emojis: ['👍', '❤️', '🔥', '👏', '😂', '🎉', '🚀', '✨', '💯', '🙏', '👀', '🤝', '🎯', '💡'],
  },
  {
    name: 'Sourires',
    icon: '😊',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉',
      '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', '😎',
      '🥳', '😏', '🤔', '🤫', '🤭', '🤐', '😴', '😌', '🤓', '🧐',
    ],
  },
  {
    name: 'Gestes',
    icon: '👋',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈',
      '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝',
      '👏', '🙌', '👐', '🤲', '🙏', '✍️', '💪', '👊', '🤛', '🤜',
    ],
  },
  {
    name: 'Agence & Projet',
    icon: '💼',
    emojis: [
      '💼', '📁', '📄', '📊', '📈', '📌', '📎', '✏️', '💻', '📱',
      '⚡', '🔔', '🚀', '⏳', '⏱️', '🎯', '✅', '❌', '⚠️', '💬',
      '💡', '🎨', '🔍', '🔒', '📦', '☕', '🛠️', '🔑', '🏆', '⭐',
    ],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
}) => {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Fermeture lors d'un clic en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Tous les emojis uniques pour la recherche
  const allEmojis = useMemo(() => {
    const set = new Set<string>();
    EMOJI_CATEGORIES.forEach((c) => c.emojis.forEach((e) => set.add(e)));
    return Array.from(set);
  }, []);

  const displayedEmojis = useMemo(() => {
    if (!search.trim()) {
      return EMOJI_CATEGORIES[activeCategory].emojis;
    }
    // Si recherche, on filtre sur tous les emojis
    return allEmojis;
  }, [search, activeCategory, allEmojis]);

  if (!isOpen) return null;

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-14 right-2 sm:right-12 z-50 w-72 sm:w-80 bg-surface-container-lowest rounded-2xl border border-surface-container shadow-xl p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150"
      style={{ maxHeight: '360px' }}
    >
      {/* En-tête avec barre de recherche et bouton fermer */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Icon
            name="search"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[16px]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un emoji..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-surface-container-low text-xs text-on-surface border border-surface-container/60 placeholder:text-secondary focus:outline-none focus:border-brand-orange"
            autoFocus
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-secondary hover:text-primary-container hover:bg-surface-container transition-colors"
        >
          <Icon name="close" className="text-[16px]" />
        </button>
      </div>

      {/* Onglets des catégories */}
      {!search.trim() && (
        <div className="flex items-center gap-1 border-b border-surface-container/60 pb-1.5 overflow-x-auto">
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCategory(idx)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap ${
                activeCategory === idx
                  ? 'bg-primary-container text-on-primary'
                  : 'text-secondary hover:text-primary-container hover:bg-surface-container-low'
              }`}
            >
              <span className="text-xs">{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Grille d'emojis */}
      <div className="grid grid-cols-7 gap-1 overflow-y-auto max-h-48 p-0.5">
        {displayedEmojis.map((emoji, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              onSelectEmoji(emoji);
            }}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-xl hover:bg-surface-container-high hover:scale-115 active:scale-95 transition-all"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Réactions rapides courantes au bas du picker */}
      <div className="pt-2 border-t border-surface-container/60 flex items-center justify-between px-1">
        <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">
          Réactions rapides
        </span>
        <div className="flex items-center gap-1">
          {['👍', '❤️', '🔥', '👏', '😂'].map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => onSelectEmoji(em)}
              className="text-base hover:scale-125 transition-transform"
            >
              {em}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
