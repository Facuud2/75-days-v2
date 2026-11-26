'use client';

import DashboardLoading from '@/app/dashboard/loading';
import CalendarLoading from '@/app/calendar/loading';
import SettingsLoading from '@/app/settings/loading';
import NutritionSkeleton from '@/components/nutrition/NutritionSkeleton';
import FitnessSkeleton from '@/components/fitness/FitnessSkeleton';
import ProfileSkeleton from '@/components/profile/ProfileSkeleton';

function OnboardingBootSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <div className="space-y-2">
        <div className="pv2-skeleton h-4 w-24" />
        <div className="pv2-skeleton h-8 w-64" />
        <div className="pv2-skeleton h-4 w-80 max-w-full" />
      </div>
      <div className="space-y-3">
        <div className="pv2-skeleton h-20 w-full rounded-2xl" />
        <div className="pv2-skeleton h-20 w-full rounded-2xl" />
        <div className="pv2-skeleton h-20 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function AuthBootSkeleton() {
  return (
    <div
      data-boot-skeleton="auth"
      aria-busy="true"
      aria-label="Cargando"
      className="auth-viewport flex min-h-dvh items-center justify-center px-4 py-8"
    >
      <div className="w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="space-y-2">
          <div className="pv2-skeleton h-6 w-36" />
          <div className="pv2-skeleton h-4 w-56" />
        </div>
        <div className="space-y-3 pt-2">
          <div className="pv2-skeleton h-11 w-full rounded-xl" />
          <div className="pv2-skeleton h-11 w-full rounded-xl" />
        </div>
        <div className="pv2-skeleton h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}

function DefaultAppBootSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-4">
      <div className="pv2-skeleton h-8 w-48" />
      <div className="pv2-skeleton h-32 w-full rounded-2xl" />
      <div className="pv2-skeleton h-48 w-full rounded-2xl" />
    </div>
  );
}

export function RouteContentSkeleton({ pathname }: { pathname: string }) {
  if (pathname.startsWith('/dashboard')) {
    return <DashboardLoading />;
  }
  if (pathname.startsWith('/nutrition')) {
    return <NutritionSkeleton />;
  }
  if (pathname.startsWith('/fitness')) {
    return <FitnessSkeleton />;
  }
  if (pathname.startsWith('/profile')) {
    return <ProfileSkeleton />;
  }
  if (pathname.startsWith('/calendar')) {
    return <CalendarLoading />;
  }
  if (pathname.startsWith('/settings')) {
    return <SettingsLoading />;
  }
  if (pathname.startsWith('/onboarding')) {
    return <OnboardingBootSkeleton />;
  }
  return <DefaultAppBootSkeleton />;
}

export default function RouteBootSkeleton({ pathname }: { pathname: string }) {
  if (pathname === '/login' || pathname === '/register') {
    return <AuthBootSkeleton />;
  }

  return (
    <div
      data-boot-skeleton="app"
      aria-busy="true"
      aria-label="Cargando"
      className="app-shell min-h-dvh px-4 pt-6 md:p-6"
    >
      <div className="mx-auto w-full max-w-7xl">
        <RouteContentSkeleton pathname={pathname} />
      </div>
    </div>
  );
}
