import { AlertDialog } from 'radix-ui';
import { Button } from './button.jsx';

// Controlled confirmation dialog. onConfirm may be async; the dialog stays open while it runs.
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, busy }) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-lg">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">{description}</AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={busy}>Cancel</Button>
            </AlertDialog.Cancel>
            <Button variant="destructive" disabled={busy} onClick={onConfirm}>
              {busy ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
