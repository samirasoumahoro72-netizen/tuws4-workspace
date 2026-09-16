import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { appIcons } from '../icons/appIcons';

export interface IconProps {
  name?: string | IconDefinition;
  icon?: string | IconDefinition;
  className?: string;
  spin?: boolean;
  fixedWidth?: boolean;
  title?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}

export const Icon: React.FC<IconProps> = ({
  name,
  icon,
  className = '',
  spin = false,
  fixedWidth = true,
  title,
  style,
  onClick,
}) => {
  const target = name || icon;

  if (!target) {
    return null;
  }

  let resolvedIcon: IconDefinition;

  if (typeof target === 'object' && 'icon' in target) {
    resolvedIcon = target as IconDefinition;
  } else if (typeof target === 'string') {
    const key = target.trim().toLowerCase();
    resolvedIcon = appIcons[key] || appIcons[target] || appIcons['info'];
  } else {
    resolvedIcon = appIcons['info'];
  }

  const isSpinning = spin || target === 'progress_activity' || target === 'spinner' || target === 'sync';

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      style={style}
      title={title}
      onClick={onClick}
    >
      <FontAwesomeIcon
        icon={resolvedIcon}
        spin={isSpinning}
        fixedWidth={fixedWidth}
      />
    </span>
  );
};

export default Icon;
