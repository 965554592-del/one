import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
  /** Optional override of the trigger button classes (text size, padding, border). */
  triggerClassName?: string;
  /** Optional override of the popup item classes. */
  itemClassName?: string;
  disabled?: boolean;
}

/**
 * Custom dropdown whose popup width matches the trigger button.
 * Native <select> sizes its open list to the longest option, which can overflow on mobile —
 * use this instead for narrow containers.
 */
export default function YMMSelect({
  value,
  onChange,
  placeholder,
  options,
  triggerClassName = 'bg-[#112240] border border-[#FFB300]/20 text-white text-sm px-3 py-2 rounded-md hover:border-[#FFB300]/40',
  itemClassName = 'text-sm px-3 py-2',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-1 rounded-md focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${triggerClassName}`}
      >
        <span className="truncate text-left">{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-60 overflow-y-auto bg-[#0A192F] border border-[#FFB300]/30 rounded-md shadow-xl">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full text-left text-[#8892B0] hover:bg-[#FFB300]/10 truncate ${itemClassName}`}
          >
            {placeholder}
          </button>
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left truncate hover:bg-[#FFB300]/10 ${value === opt ? 'text-[#FFB300]' : 'text-white'} ${itemClassName}`}
              title={opt}
            >
              {opt}
            </button>
          ))}
          {options.length === 0 && (
            <div className={`text-[#8892B0] ${itemClassName}`}>—</div>
          )}
        </div>
      )}
    </div>
  );
}
