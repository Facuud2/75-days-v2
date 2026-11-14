'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ProfileSectionProps {
  id: string;
  index: string;
  title: string;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function ProfileSection({
  id,
  index,
  title,
  summary,
  defaultOpen = false,
  children,
}: ProfileSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const generatedId = useId();
  const panelId = `${id}-panel-${generatedId.replace(/:/g, '')}`;
  const headingId = `${id}-heading`;
  const visible = open || isDesktop;

  return (
    <section id={id} className="pv2-section pv2-anchor" aria-labelledby={headingId}>
      <h2 id={headingId} className="pv2-sr-only">
        {title}
      </h2>

      <button
        type="button"
        className="pv2-trigger lg:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="pv2-num w-7 shrink-0 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {index}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {title}
          </span>
          {summary ? (
            <span
              className="mt-0.5 block truncate text-sm"
              style={{ color: 'var(--text-muted)' }}
              title={typeof summary === 'string' ? summary : undefined}
            >
              {summary}
            </span>
          ) : null}
        </span>

        <ChevronDown className="pv2-chevron" size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>

      <div className="hidden items-baseline gap-3 px-6 pb-1 pt-5 lg:flex">
        <span className="pv2-num w-7 shrink-0 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {index}
        </span>
        <span className="text-base font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {title}
        </span>
        {summary ? (
          <span className="ml-auto text-sm" style={{ color: 'var(--text-muted)' }}>
            {summary}
          </span>
        ) : null}
      </div>

      <div
        id={panelId}
        className={`pv2-panel ${open ? 'is-open' : ''}`}
        aria-hidden={!visible ? true : undefined}
        inert={!visible ? true : undefined}
      >
        <div className="pv2-panel-inner">{children}</div>
      </div>
    </section>
  );
}
