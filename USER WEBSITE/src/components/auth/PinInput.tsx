// ============================================
// PinInput - 6-digit security PIN entry
// ============================================

import { useEffect, useRef } from 'react';
import { PIN_LENGTH } from '../../lib/crypto';

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
  id?: string;
  error?: boolean;
}

export function PinInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  label,
  id = 'pin-input',
  error = false,
}: PinInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (autoFocus && !disabled) {
      // Focus after paint so the element exists and is stable.
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, disabled]);

  // Fire onComplete exactly once per completed entry.
  useEffect(() => {
    if (value.length === PIN_LENGTH) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.(value);
      }
    } else {
      completedRef.current = false;
    }
  }, [value, onComplete]);

  const digits = Array.from({ length: PIN_LENGTH }, (_, i) => value[i] ?? '');

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="input-label mb-2 block">
          {label}
        </label>
      )}

      {/* Visual cells; the real input is transparent and overlaid. */}
      <div className="relative">
        <div className="flex items-center justify-center gap-2 sm:gap-3" aria-hidden="true">
          {digits.map((digit, index) => (
            <div
              key={index}
              className={`w-11 h-14 sm:w-12 sm:h-16 rounded-xl border-2 flex items-center justify-center text-xl font-bold font-mono transition-all ${
                error
                  ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30 text-rose-600'
                  : digit
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300'
                    : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/60 text-surface-300'
              }`}
            >
              {digit ? '•' : ''}
            </div>
          ))}
        </div>

        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={PIN_LENGTH}
          value={value}
          disabled={disabled}
          aria-label={label || 'Security PIN'}
          onChange={(e) => {
            // Digits only, regardless of what was pasted.
            const cleaned = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
            onChange(cleaned);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text"
        />
      </div>
    </div>
  );
}

export default PinInput;