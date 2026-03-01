import React from 'react';

import { mebooksLockupStackedDark } from '../assets';

interface SplashScreenProps {
  isVisible: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ isVisible }) => {
  return (
    <div
      className={`theme-shell fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
    >
      <div className="animate-pulse">
        <img src={mebooksLockupStackedDark} alt="MeBooks" className="w-64" />
      </div>
    </div>
  );
};

export default SplashScreen;
