import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-300"
          >
            {label}
          </label>
        )}

        <input
          id={inputId}
          ref={ref}
          className={cn(
            'w-full h-10 px-3 rounded-lg bg-slate-800 border text-slate-100 text-sm',
            'placeholder:text-slate-500 transition-all duration-150 outline-none',
            'focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500',
            error ? 'border-red-500/70' : 'border-slate-600',
            className,
          )}
          {...props}
        />

        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
