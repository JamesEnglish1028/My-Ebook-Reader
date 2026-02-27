import React, { useCallback, useEffect, useRef } from 'react';

export interface KeyboardNavigationOptions {
  /**
   * Enable arrow key navigation
   */
  enableArrowKeys?: boolean;
  /**
   * Enable Enter/Space key activation
   */
  enableActivation?: boolean;
  /**
   * Enable Escape key to close/cancel
   */
  enableEscape?: boolean;
  /**
   * Callback when arrow keys are pressed
   */
  onArrowKey?: (direction: 'up' | 'down' | 'left' | 'right', event: KeyboardEvent) => void;
  /**
   * Callback when Enter or Space is pressed
   */
  onActivate?: (event: KeyboardEvent) => void;
  /**
   * Callback when Escape is pressed
   */
  onEscape?: (event: KeyboardEvent) => void;
  /**
   * Prevent default behavior for handled keys
   */
  preventDefault?: boolean;
  /**
   * Stop event propagation for handled keys
   */
  stopPropagation?: boolean;
}

/**
 * Hook for managing keyboard navigation in components
 * Provides consistent keyboard interaction patterns across the app
 *
 * @example
 * ```tsx
 * const handleArrowKey = (direction: 'up' | 'down' | 'left' | 'right') => {
 *   // Handle navigation
 * };
 *
 * useKeyboardNavigation({
 *   enableArrowKeys: true,
 *   enableActivation: true,
 *   onArrowKey: handleArrowKey,
 *   onActivate: () => openBook(),
 *   preventDefault: true
 * });
 * ```
 */
export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
  const {
    enableArrowKeys = false,
    enableActivation = false,
    enableEscape = false,
    onArrowKey,
    onActivate,
    onEscape,
    preventDefault = true,
    stopPropagation = false,
  } = options;

  // Store callbacks in refs to avoid recreating the event listener
  const onArrowKeyRef = useRef(onArrowKey);
  const onActivateRef = useRef(onActivate);
  const onEscapeRef = useRef(onEscape);

  // Update refs when callbacks change
  useEffect(() => {
    onArrowKeyRef.current = onArrowKey;
    onActivateRef.current = onActivate;
    onEscapeRef.current = onEscape;
  }, [onArrowKey, onActivate, onEscape]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Arrow keys
    if (enableArrowKeys && onArrowKeyRef.current) {
      let direction: 'up' | 'down' | 'left' | 'right' | null = null;

      switch (event.key) {
        case 'ArrowUp':
          direction = 'up';
          break;
        case 'ArrowDown':
          direction = 'down';
          break;
        case 'ArrowLeft':
          direction = 'left';
          break;
        case 'ArrowRight':
          direction = 'right';
          break;
      }

      if (direction) {
        if (preventDefault) event.preventDefault();
        if (stopPropagation) event.stopPropagation();
        onArrowKeyRef.current(direction, event);
        return;
      }
    }

    // Enter and Space for activation
    if (enableActivation && onActivateRef.current && (event.key === 'Enter' || event.key === ' ')) {
      if (preventDefault) event.preventDefault();
      if (stopPropagation) event.stopPropagation();
      onActivateRef.current(event);
      return;
    }

    // Escape key
    if (enableEscape && onEscapeRef.current && event.key === 'Escape') {
      if (preventDefault) event.preventDefault();
      if (stopPropagation) event.stopPropagation();
      onEscapeRef.current(event);
      return;
    }
  }, [enableArrowKeys, enableActivation, enableEscape, preventDefault, stopPropagation]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * Hook for managing grid-based keyboard navigation
 * Handles 2D navigation with arrow keys in a grid layout
 *
 * @example
 * ```tsx
 * const { focusedIndex, setFocusedIndex } = useGridNavigation({
 *   itemCount: books.length,
 *   columns: 4,
 *   onActivate: (index) => openBook(books[index])
 * });
 * ```
 */
export interface GridNavigationOptions {
  /**
   * Total number of items in the grid
   */
  itemCount: number;
  /**
   * Number of columns in the grid
   */
  columns: number;
  /**
   * Initial focused index
   */
  initialIndex?: number;
  /**
   * Callback when an item is activated (Enter/Space)
   */
  onActivate?: (index: number) => void;
  /**
   * Whether to wrap around edges (default: false)
   */
  wrap?: boolean;
}

export function useGridNavigation(options: GridNavigationOptions) {
  const { itemCount, columns, initialIndex = 0, onActivate, wrap = false } = options;
  const [focusedIndex, setFocusedIndex] = React.useState(initialIndex);

  const handleArrowKey = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    setFocusedIndex((currentIndex) => {
      let newIndex = currentIndex;

      switch (direction) {
        case 'left':
          newIndex = currentIndex - 1;
          if (newIndex < 0) {
            newIndex = wrap ? itemCount - 1 : 0;
          }
          break;
        case 'right':
          newIndex = currentIndex + 1;
          if (newIndex >= itemCount) {
            newIndex = wrap ? 0 : itemCount - 1;
          }
          break;
        case 'up':
          newIndex = currentIndex - columns;
          if (newIndex < 0) {
            newIndex = wrap ? Math.max(0, itemCount - columns + (currentIndex % columns)) : currentIndex;
          }
          break;
        case 'down':
          newIndex = currentIndex + columns;
          if (newIndex >= itemCount) {
            newIndex = wrap ? (currentIndex % columns) : currentIndex;
          }
          break;
      }

      return Math.max(0, Math.min(itemCount - 1, newIndex));
    });
  }, [itemCount, columns, wrap]);

  const handleActivate = useCallback(() => {
    if (onActivate) {
      onActivate(focusedIndex);
    }
  }, [focusedIndex, onActivate]);

  useKeyboardNavigation({
    enableArrowKeys: true,
    enableActivation: true,
    onArrowKey: handleArrowKey,
    onActivate: handleActivate,
    preventDefault: true,
  });

  return {
    focusedIndex,
    setFocusedIndex,
  };
}
