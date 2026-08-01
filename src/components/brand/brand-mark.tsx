import Image from 'next/image';

import { APP_INFO } from '@core/constants';
import { cn } from '@/lib/utils';

const MARK_SRC = '/brand/logo-mark.png';

interface BrandMarkProps {
  size?: number;
  className?: string;
  /** Light plate behind the mark for contrast on dark chrome. Default true. */
  plate?: boolean;
}

export function BrandMark({ size = 32, className, plate = true }: BrandMarkProps) {
  const image = (
    <Image
      src={MARK_SRC}
      alt={APP_INFO.name}
      width={size}
      height={size}
      className={cn('object-contain', !plate && className)}
    />
  );

  if (!plate) return image;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {image}
    </span>
  );
}
