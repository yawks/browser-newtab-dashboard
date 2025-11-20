import { AlertTriangle, X } from 'lucide-react';

interface DeleteSpaceModalProps {
  spaceName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteSpaceModal({ spaceName, onConfirm, onCancel }: DeleteSpaceModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-popover border border-border rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Delete Space</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to delete the space &quot;{spaceName}&quot;? 
                This action cannot be undone and all widgets in this space will be permanently deleted.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent transition-colors"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-1 rounded hover:bg-accent transition-colors flex-shrink-0"
              type="button"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

