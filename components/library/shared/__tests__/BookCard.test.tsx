import React from 'react';

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as utils from '../../../../services/utils';
import BookCard from '../BookCard';

describe('BookCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the proxied cover URL immediately for catalog books', () => {
    vi.spyOn(utils, 'proxiedUrl').mockReturnValue('https://proxy.example.org/cover.jpg');

    render(
      <BookCard
        book={{
          title: 'Proxy Book',
          author: 'Author',
          coverImage: 'https://library.biblioboard.com/assets/thumbnail_full.jpg',
          downloadUrl: 'https://catalog.example.org/books/1.epub',
          summary: null,
        } as any}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByAltText('Proxy Book')).toHaveAttribute('src', 'https://proxy.example.org/cover.jpg');
  });
});
