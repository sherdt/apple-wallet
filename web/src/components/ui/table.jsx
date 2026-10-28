import { cn } from '../../lib/utils.js';

export function Table({ className, ...props }) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export const TableHeader = (props) => <thead className="[&_tr]:border-b" {...props} />;
export const TableBody = (props) => <tbody className="[&_tr:last-child]:border-0" {...props} />;
export const TableRow = ({ className, ...props }) => (
  <tr className={cn('border-b transition-colors hover:bg-muted/50', className)} {...props} />
);
export const TableHead = ({ className, ...props }) => (
  <th className={cn('h-10 px-4 text-left align-middle font-medium text-muted-foreground', className)} {...props} />
);
export const TableCell = ({ className, ...props }) => (
  <td className={cn('p-4 align-middle', className)} {...props} />
);
