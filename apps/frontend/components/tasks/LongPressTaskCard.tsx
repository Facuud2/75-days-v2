'use client';

import React from 'react';
import { useLongPress } from '@/hooks/useLongPress';

export interface LongPressTaskCardProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  isElevated?: boolean;
  onLongPress: (rect: DOMRect) => void;
}

export default function LongPressTaskCard({
  children,
  className = '',
  disabled = false,
  isElevated = false,
  onLongPress,
}: LongPressTaskCardProps) {
  const { isPressing, handlers } = useLongPress({
    onLongPress,
    disabled,
  });

  return (
    <div
      {...handlers}
      className={`${className} select-none touch-pan-y [-webkit-touch-callout:none] transition-transform duration-150 ease-out ${
        isPressing ? 'scale-[0.98]' : ''
      } ${isElevated ? 'opacity-0 pointer-events-none' : ''}`}
    >
      {children}
    </div>
  );
}
