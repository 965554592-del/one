import { useState } from 'react';

interface LazyVideoProps {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  poster?: string;
  /** @deprecated Videos now use click-to-play; kept for API compatibility */
  preload?: 'none' | 'metadata' | 'auto';
  /** @deprecated Videos now use click-to-play; kept for API compatibility */
  lazy?: boolean;
  /** @deprecated Videos now use click-to-play; kept for API compatibility */
  rootMargin?: string;
}

const posterStyle = (poster?: string): React.CSSProperties =>
  poster
    ? { backgroundImage: `url(${poster})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: '#112240' };

/**
 * Click-to-play background video component.
 *
 * Shows poster image with a play button overlay by default.
 * Video is loaded and played only after the user clicks — saving bandwidth on
 * all devices, especially mobile.
 */
export default function LazyVideo({ src, className = '', style, poster }: LazyVideoProps) {
  const [playing, setPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <div className={className} style={{ ...style, ...posterStyle(poster) }} />;
  }

  if (!playing) {
    return (
      <div
        className={`${className} relative cursor-pointer group`}
        style={{ ...style, ...posterStyle(poster) }}
        onClick={() => setPlaying(true)}
        role="button"
        aria-label="Play video"
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30 group-hover:ring-white/70 group-hover:scale-110 transition-all duration-200">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 ml-0.5" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <video
      src={src}
      poster={poster}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      onError={() => setHasError(true)}
      className={className}
      style={style}
    />
  );
}
