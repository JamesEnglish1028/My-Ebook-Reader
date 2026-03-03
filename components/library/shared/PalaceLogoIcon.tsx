import React from 'react';

interface PalaceLogoIconProps {
  className?: string;
}

const PalaceLogoIcon: React.FC<PalaceLogoIconProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 100 100"
    aria-hidden="true"
    className={className}
    fill="currentColor"
  >
    <polygon points="50,2.4 14.6,27.2 14.6,82.2 25.6,77.1 36.5,97.6 36.5,42.5 50,32.9 63.6,42.4 50,52 50,78 85.4,53.2 85.4,27.2" />
  </svg>
);

export default PalaceLogoIcon;
