import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const alertVariants = cva('rounded-lg border px-4 py-3 text-sm', {
  variants: {
    variant: {
      default: 'border-border bg-muted text-foreground',
      success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      destructive: 'border-red-200 bg-red-50 text-red-900',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Alert({ className, variant, role = 'status', ...props }) {
  return <div role={role} className={cn(alertVariants({ variant }), className)} {...props} />;
}
