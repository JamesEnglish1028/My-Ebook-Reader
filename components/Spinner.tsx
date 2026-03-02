import React from 'react';

const Spinner: React.FC<{ text?: string, size?: 'small' | 'medium' }> = ({ text, size = 'medium' }) => {
    const sizeClasses = size === 'small' ? 'h-5 w-5 border-2' : 'h-12 w-12 border-b-2';
    const textClasses = size === 'small' ? 'text-sm' : 'text-base';

    return (
        <div
            className="flex flex-col items-center justify-center space-y-2"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <div
                className={`theme-accent-text-emphasis animate-spin rounded-full border-current ${sizeClasses}`}
                aria-hidden="true"
            />
            {text && (
                <p className={`theme-accent-text-emphasis ${textClasses}`}>
                    {text}
                </p>
            )}
            {!text && <span className="sr-only">Loading...</span>}
        </div>
    );
};

export default Spinner;
