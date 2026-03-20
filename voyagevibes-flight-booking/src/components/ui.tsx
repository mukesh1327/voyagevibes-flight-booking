import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/formatters';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';
type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_16px_32px_rgba(37,99,235,0.28)] hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500',
  secondary:
    'border border-slate-200 bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-400/30 dark:hover:text-blue-200',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-4 py-2.5 text-sm',
  md: 'px-5 py-3 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

export function Button({
  children,
  className,
  size = 'md',
  variant = 'primary',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold transition duration-300 disabled:cursor-not-allowed disabled:opacity-60',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[28px] border border-white/70 bg-white/85 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/75 dark:shadow-[0_18px_45px_rgba(2,6,23,0.35)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('skeleton shimmer-effect rounded-2xl', className)} />;
}

export function SectionEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-xs font-semibold uppercase tracking-[0.24em] text-blue-700 dark:text-blue-200', className)}>
      {children}
    </p>
  );
}

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
    danger: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200',
    info: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200',
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  };

  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize', tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card className="glass-panel p-10 text-center">
      <div className="mx-auto max-w-lg">
        <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </Card>
  );
}

export function Stepper({
  className,
  currentStep,
  steps,
}: {
  className?: string;
  currentStep: number;
  steps: string[];
}) {
  return (
    <Card className={cn('glass-panel overflow-hidden px-4 py-4 sm:px-6', className)}>
      <div className="flex flex-wrap gap-3">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = index < currentStep;
          return (
            <div key={step} className="flex min-w-[140px] flex-1 items-center gap-3">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition duration-300',
                  isActive && 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white',
                  isComplete && 'bg-emerald-500 text-white',
                  !isActive && !isComplete && 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                )}
              >
                {index + 1}
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    'truncate text-sm font-medium',
                    isActive || isComplete ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-300'
                  )}
                >
                  {step}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
