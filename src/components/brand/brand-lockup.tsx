import Image from 'next/image';

import { APP_INFO } from '@core/constants';
import { cn } from '@/lib/utils';

const LOCKUP_SRC = '/brand/logo-lockup.png';

interface BrandLockupProps {
  className?: string;
  /** Intrinsic display width; height follows aspect ratio (~1408×768). */
  width?: number;
  priority?: boolean;
}

export function BrandLockup({
  className,
  width = 320,
  priority = false,
}: BrandLockupProps) {
  const height = Math.round((width * 768) / 1408);

  return (
    <Image
      src={LOCKUP_SRC}
      alt={APP_INFO.name}
      width={width}
      height={height}
      className={cn('h-auto w-full max-w-full object-contain object-left', className)}
      priority={priority}
    />
  );
}
