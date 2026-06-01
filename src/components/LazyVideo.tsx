import { useEffect, useRef, useState } from 'react';

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

function PlayOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity duration-200">
      <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30 group-hover:ring-white/70 group-hover:scale-110 transition-all duration-200">
        <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 ml-0.5" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>
  );
}

/**
 * Click-to-play background video component.
 *
 * - With poster: shows poster image + play button overlay.
 * - Without poster: loads video first frame via preload="metadata" as thumbnail.
 * Video only starts downloading fully after the user clicks.
 */
export default function LazyVideo({ src, className = '', style, poster }: LazyVideoProps) {
  const [playing, setPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
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

  if (playing) {
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

  // Not yet playing — show thumbnail
  if (poster) {
    // Has poster image: use CSS background
    return (
      <div
        className={`${className} relative cursor-pointer group`}
        style={{
          ...style,
          backgroundImage: `url(${poster})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        onClick={() => setPlaying(true)}
        role="button"
        aria-label="Play video"
      >
        <PlayOverlay />
      </div>
    );
  }

  // No poster: use video preload="metadata" + force first frame (Safari fix)
  return <VideoThumbnail src={src} className={className} style={style} onPlay={() => setPlaying(true)} onError={() => setHasError(true)} />;
}

/** Renders a paused video showing its first frame as thumbnail (works on Safari too). */
function VideoThumbnail({ src, className, style, onPlay, onError }: {
  src: string; className: string; style?: React.CSSProperties;
  onPlay: () => void; onError: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const seek = () => { v.currentTime = 0.001; };
    v.addEventListener('loadedmetadata', seek);
    return () => v.removeEventListener('loadedmetadata', seek);
  }, [src]);

  return (
    <div
      className={`${className} relative cursor-pointer group overflow-hidden`}
      style={style}
      onClick={onPlay}
      role="button"
      aria-label="Play video"
    >
      <video
        ref={ref}
        src={src}
        muted
        playsInline
        preload="metadata"
        onError={onError}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <PlayOverlay />
    </div>
  );
}
