import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { BrandName } from '../ui/Logo';

export interface BreadcrumbItem {
  label: string;
  to?: string;
  icon?: string;
  onClick?: (e: React.MouseEvent) => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar text-xs font-semibold">
      <Link
        to="/dashboard"
        className="flex items-center gap-1 text-secondary hover:text-primary-container transition-colors shrink-0"
      >
        <Icon name="corporate_fare" className="text-[16px]" />
        <BrandName className="text-xs" />
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            <Icon name="chevron_right" className="text-[14px] text-secondary shrink-0" />
            {isLast || !item.to ? (
              <div
                onClick={item.onClick}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-container text-primary-container shrink-0 truncate max-w-[200px] ${
                  item.onClick ? 'cursor-pointer hover:bg-surface-container-high' : ''
                }`}
              >
                {item.icon && <Icon name={item.icon} className="text-[15px] text-on-tertiary-container shrink-0" />}
                <span className="truncate">{item.label}</span>
              </div>
            ) : (
              <Link
                to={item.to}
                onClick={item.onClick}
                className="flex items-center gap-1 text-secondary hover:text-primary-container transition-colors shrink-0 truncate max-w-[150px]"
              >
                {item.icon && <Icon name={item.icon} className="text-[15px] shrink-0" />}
                <span className="truncate">{item.label}</span>
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
