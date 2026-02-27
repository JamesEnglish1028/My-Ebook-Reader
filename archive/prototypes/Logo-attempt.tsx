import React from 'react';

export interface LogoProps {
  className?: string;
  full?: boolean;
}

// Minimal stable logo to avoid build errors. Replace with the designed SVG later.
export const Logo: React.FC<LogoProps> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    className={className}
    aria-hidden="true"
  >
    <rect width="24" height="24" rx="4" fill="currentColor" />
    <text x="12" y="16" fontSize="10" textAnchor="middle" fill="#fff">
      MB
    </text>
  </svg>
);

export default Logo;