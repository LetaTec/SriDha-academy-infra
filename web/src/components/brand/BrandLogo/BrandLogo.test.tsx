import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BRAND } from '@constants/home';

import { BrandLogo } from './BrandLogo';

describe('BrandLogo', () => {
  it('uses the full-colour horizontal logo in the header', () => {
    render(<BrandLogo variant="horizontal" />);

    expect(screen.getByRole('img', { name: BRAND.name })).toHaveAttribute(
      'src',
      expect.stringContaining('sridha-logo-horizontal'),
    );
  });

  it('keeps the full-colour horizontal logo even when an inverse tone is asked for', () => {
    render(<BrandLogo variant="horizontal" tone="inverse" />);

    expect(screen.getByRole('img', { name: BRAND.name })).toHaveAttribute(
      'src',
      expect.stringContaining('sridha-logo-horizontal'),
    );
  });
});
