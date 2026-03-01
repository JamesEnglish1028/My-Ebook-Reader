import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as utils from '../../../../services/utils';
import BookCard from '../BookCard';

describe('BookCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with the original cover URL for catalog books', () => {
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

    expect(screen.getByAltText('Proxy Book')).toHaveAttribute(
      'src',
      'https://library.biblioboard.com/assets/thumbnail_full.jpg',
    );
  });

  it('falls back to the proxied cover URL after the original image fails', () => {
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

    const image = screen.getByAltText('Proxy Book');
    fireEvent.error(image);

    expect(image).toHaveAttribute('src', 'https://proxy.example.org/cover.jpg');
  });
});
