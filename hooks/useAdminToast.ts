/**
 * useAdminToast Hook
 * 
 * Convenient hook for admin pages to show success/error/warning toasts
 * Positioned at top-right, auto-dismisses after 3 seconds
 * 
 * Usage in admin components:
 * const { successToast, errorToast } = useAdminToast();
 * 
 * successToast('Item saved successfully');
 * errorToast('Failed to save item');
 */

import { useNotification } from '@/contexts/NotificationContext';

export function useAdminToast() {
  const { showSuccessToast, showErrorToast, showWarningToast, showInfoToast } = useNotification();

  return {
    successToast: (message: string, title?: string) => {
      showSuccessToast(message, title || 'Success', 3000);
    },
    errorToast: (message: string, title?: string) => {
      showErrorToast(message, title || 'Error', 3000);
    },
    warningToast: (message: string, title?: string) => {
      showWarningToast(message, title || 'Warning', 3000);
    },
    infoToast: (message: string, title?: string) => {
      showInfoToast(message, title || 'Info', 3000);
    },
  };
}
