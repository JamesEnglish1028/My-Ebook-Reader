import React from 'react';

interface SplashScreenProps {
  isVisible: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ isVisible }) => {
  return (
    <div
      className={`theme-shell fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
    >
      <div className="animate-pulse text-center">
        <div className="theme-accent-text-emphasis text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
          MyEbooks
        </div>
        <div className="theme-text-secondary mt-2 text-xs font-semibold uppercase tracking-[0.35em] sm:text-sm">
          Browser Reader
        </div>
        <div className="theme-accent-surface mx-auto mt-4 h-1 w-24 rounded-full border" aria-hidden="true" />
      </div>
    </div>
  );
};

export default SplashScreen;
