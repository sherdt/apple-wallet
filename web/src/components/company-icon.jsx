import { Building2 } from 'lucide-react';
import { cn } from '../lib/utils.js';

// Shows the company icon fetched from its website, or a placeholder when there is none.
export function CompanyIcon({ company, className }) {
  const box = cn('flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted', className);
  if (!company.has_icon) {
    return (
      <div className={box}>
        <Building2 className="size-5 text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className={box}>
      <img src={`/admin/icons/${company.id}`} alt="" className="size-full object-contain" />
    </div>
  );
}
