'use client';

import { ErrorToast } from './ErrorToast';
import type { Toast } from './useErrorToast';

export interface ErrorToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ErrorToastContainer({ toasts, onRemove }: ErrorToastContainerProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="flex flex-col items-center gap-2 pt-4">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ErrorToast
              id={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={onRemove}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
