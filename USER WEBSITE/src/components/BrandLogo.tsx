// ============================================
// BrandLogo - the app logo image used across
// loading screens, auth screens and the sidebar.
//
// Prefers the transparent, resized version that
// scripts/make-logo.mjs generates into public/logo.png
// (auto-runs on npm run dev / npm run build). Falls
// back to the original bundled PNG if that file does
// not exist yet.
// ============================================

import { useState } from 'react';
import { appLogo } from '../branding';

const PROCESSED_LOGO = '/logo.png';

export default function BrandLogo({
  className = '',
  alt = 'TUITION PANEL',
}: {
  className?: string;
  alt?: string;
}) {
  const [src, setSrc] = useState(PROCESSED_LOGO);

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onError={() => {
        // public/logo.png missing (script not run yet) -> bundled original.
        if (src !== appLogo) setSrc(appLogo);
      }}
      className={`object-contain ${className}`}
    />
  );
}
