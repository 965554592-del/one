import { useEffect, useRef, useState } from 'react';

interface LazyVideoProps {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  poster?: string;
  /** Preload strategy when video is in viewport. Default: 'metadata' */
  preload?: 'none' | 'metadata' | 'auto';
  /** Load video only when it enters viewport. Default: true */
  lazy?: boolean;
  /** Root margin for IntersectionObserver. Default: '200px' (start loading slightly before visible) */
  rootMargin?: string;
}

/**
 * Lazy-loaded background video component.
 *
 * Renders a single element (no wrapper div) to avoid positioning conflicts.
 * - Before visible: renders a placeholder <div> with poster as background
 * - After visible: renders a <video> element with native poster attribute
 *
 * Performance optimizations:
 * - Uses IntersectionObserver to defer video loading until near viewport
 * - Defaults to preload="metadata" instead of "auto"
 * - Uses native <video poster=""> for instant visual feedback
 * - Auto-plays with low CPU overhead (muted + playsinline)
 */
export default function LazyVideo({
  src,
  className = '',
  style,
  poster,
  preload = 'metadata',
  lazy = true,
  rootMargin = '200px',
}: LazyVideoProps) {
  const ref = useRef<HTMLDivElement | HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(!lazy);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!lazy) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy, rootMargin]);

  // Not yet in viewport: show placeholder with poster image
  if (!isVisible) {
    return (
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={className}
        style={{
          ...style,
          ...(poster
            ? { backgroundImage: `url(${poster})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { backgroundColor: '#112240' }),
        }}
      />
    );
  }

  // Decode error: silently fall back to poster image
  if (hasError) {
    return (
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={className}
        style={{
          ...style,
          ...(poster
            ? { backgroundImage: `url(${poster})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { backgroundColor: '#112240' }),
        }}
      />
    );
  }

  // In viewport: render video element directly (no wrapper)
  return (
    <video
      ref={ref as React.RefObject<HTMLVideoElement>}
      src={src}
      poster={poster}
      autoPlay
      loop
      muted
      playsInline
      preload={preload}
      onError={() => { console.warn('[LazyVideo] Decode error, falling back to poster:', src); setHasError(true); }}
      className={className}
      style={style}
    />
  );
}
