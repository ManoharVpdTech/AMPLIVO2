import { useState } from 'react';
import { getInitials } from '@/lib/utils';

interface AvatarProps {
  name: string;
  image?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-sm',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
};

export function Avatar({ name, image, size = 'sm', className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = sizeMap[size];

  if (image && !imgError) {
    return (
      <img
        src={image}
        alt={name || 'Avatar'}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-[#4C1D95] text-white flex items-center justify-center flex-shrink-0 font-bold select-none ${className}`}
    >
      <span>{getInitials(name)}</span>
    </div>
  );
}
