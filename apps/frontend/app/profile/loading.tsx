'use client';

import ProfileSkeleton from '@/components/profile/ProfileSkeleton';

/**
 * F-02: Suspense boundary — Profile skeleton.
 * Muestra un esqueleto fiel al layout real mientras se cargan los datos.
 */
export default function ProfileLoading() {
  return <ProfileSkeleton />;
}
