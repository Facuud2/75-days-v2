'use client';

import DashboardLoading from '@/app/dashboard/loading';
import ProfileSkeleton from '@/components/profile/ProfileSkeleton';

function CalendarBootSkeleton() {
  return (
    <div className="calendar-page" aria-busy="true">
      <div className="calendar-skeleton mb-4 min-h-[80px]" />
      <div className="calendar-skeleton mb-4 min-h-[400px]" />
      <div className="calendar-skeleton min-h-[300px]" />
    </div>
  );
}

function SettingsBootSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 space-y-2">
        <div className="pv2-skeleton h-8 w-44" />
        <div className="pv2-skeleton h-4 w-64" />
      </div>
      <div className="space-y-4">
        <div className="pv2-skeleton h-20 w-full rounded-2xl" />
        <div className="pv2-skeleton h-36 w-full rounded-2xl" />
        <div className="pv2-skeleton h-28 w-full rounded-2xl" />
      </div>
    </div>
  );
}

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

export default function RouteBootSkeleton({ pathname }: { pathname: string }) {
  if (pathname === '/login' || pathname === '/register') {
    return <AuthBootSkeleton />;
  }

  let content: React.ReactNode;
  if (pathname.startsWith('/dashboard')) {
    content = <DashboardLoading />;
  } else if (pathname.startsWith('/profile')) {
    content = <ProfileSkeleton />;
  } else if (pathname.startsWith('/calendar')) {
    content = <CalendarBootSkeleton />;
  } else if (pathname.startsWith('/settings')) {
    content = <SettingsBootSkeleton />;
  } else if (pathname.startsWith('/onboarding')) {
    content = <OnboardingBootSkeleton />;
  } else {
    content = <DefaultAppBootSkeleton />;
  }

  return (
    <div
      data-boot-skeleton="app"
      aria-busy="true"
      aria-label="Cargando"
      className="app-shell min-h-dvh px-4 pt-6 md:p-6"
    >
      <div className="mx-auto w-full max-w-7xl">{content}</div>
    </div>
  );
}
