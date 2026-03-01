import React from 'react';

import type { Collection } from '../types';

interface CollectionNavigationProps {
  collections: Collection[];
  onCollectionClick: (collection: Collection) => void;
}

export const CollectionNavigation: React.FC<CollectionNavigationProps> = ({
  collections,
  onCollectionClick,
}) => {
  if (collections.length === 0) return null;

  return (
    <div className="theme-surface theme-border theme-text-primary mb-6 rounded-lg border p-4">
      <h3 className="mb-3 text-lg font-semibold">Collections</h3>
      <div className="flex flex-wrap gap-2">
        {collections.map((collection, index) => (
          <button
            key={`${collection.title}-${index}`}
            onClick={() => onCollectionClick(collection)}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
          >
            <span>📂</span>
            {collection.title}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CollectionNavigation;
