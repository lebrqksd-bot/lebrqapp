/**
 * Global Notification Context
 * 
 * Provides a global notification system accessible from anywhere in the app
 * 
 * Usage:
 * const { showSuccess, showError, showWarning, showInfo } = useNotification();
 * showSuccess('Booking confirmed!');
 * showError('Payment failed. Please try again.');
 */

import React, { createContext, ReactNode, useContext, useState } from 'react';
import Notification, { NotificationProps } from '../components/ui/Notification';
import Toast, { ToastProps } from '../components/ui/Toast';

interface NotificationContextType {
  showSuccess: (message: string, title?: string, options?: NotificationOptions) => void;
  showError: (message: string, title?: string, options?: NotificationOptions) => void;
  showWarning: (message: string, title?: string, options?: NotificationOptions) => void;
  showInfo: (message: string, title?: string, options?: NotificationOptions) => void;
  showNotification: (props: Omit<NotificationProps, 'visible' | 'onClose'>) => void;
  hideNotification: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
  showSuccessToast: (message: string, title?: string, duration?: number) => void;
  showErrorToast: (message: string, title?: string, duration?: number) => void;
  showWarningToast: (message: string, title?: string, duration?: number) => void;
  showInfoToast: (message: string, title?: string, duration?: number) => void;
  hideToast: () => void;
}

interface NotificationOptions {
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<NotificationProps | null>(null);
  const [toast, setToast] = useState<ToastProps | null>(null);

  const showNotification = (props: Omit<NotificationProps, 'visible' | 'onClose'>) => {
    setNotification({
      ...props,
      visible: true,
      onClose: () => setNotification(null),
    });
  };

  const hideNotification = () => {
    setNotification(null);
  };

  const showToastInternal = (props: Omit<ToastProps, 'visible' | 'onClose'>) => {
    setToast({
      ...props,
      visible: true,
      onClose: () => setToast(null),
    });
  };

  const hideToast = () => {
    setToast(null);
  };

  const showSuccess = (message: string, title?: string, options?: NotificationOptions) => {
    showNotification({
      type: 'success',
      message,
      title: title || 'Success',
      duration: options?.duration ?? 3000,
      action: options?.action,
    });
  };

  const showError = (message: string, title?: string, options?: NotificationOptions) => {
    showNotification({
      type: 'error',
      message,
      title: title || 'Error',
      duration: options?.duration ?? 0, // Errors don't auto-dismiss
      action: options?.action,
    });
  };

  const showWarning = (message: string, title?: string, options?: NotificationOptions) => {
    showNotification({
      type: 'warning',
      message,
      title: title || 'Warning',
      duration: options?.duration ?? 4000,
      action: options?.action,
    });
  };

  const showInfo = (message: string, title?: string, options?: NotificationOptions) => {
    showNotification({
      type: 'info',
      message,
      title: title || 'Info',
      duration: options?.duration ?? 3000,
      action: options?.action,
    });
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration: number = 3000) => {
    showToastInternal({
      type,
      message,
      duration,
    });
  };

  const showSuccessToast = (message: string, title?: string, duration: number = 3000) => {
    showToastInternal({
      type: 'success',
      message,
      title: title || 'Success',
      duration,
    });
  };

  const showErrorToast = (message: string, title?: string, duration: number = 3000) => {
    showToastInternal({
      type: 'error',
      message,
      title: title || 'Error',
      duration,
    });
  };

  const showWarningToast = (message: string, title?: string, duration: number = 3000) => {
    showToastInternal({
      type: 'warning',
      message,
      title: title || 'Warning',
      duration,
    });
  };

  const showInfoToast = (message: string, title?: string, duration: number = 3000) => {
    showToastInternal({
      type: 'info',
      message,
      title: title || 'Info',
      duration,
    });
  };

  return (
    <NotificationContext.Provider
      value={{
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showNotification,
        hideNotification,
        showToast,
        showSuccessToast,
        showErrorToast,
        showWarningToast,
        showInfoToast,
        hideToast,
      }}
    >
      {children}
      {notification && (
        <Notification
          {...notification}
          visible={notification.visible}
          onClose={notification.onClose}
        />
      )}
      {toast && (
        <Toast
          {...toast}
          visible={toast.visible}
          onClose={toast.onClose}
        />
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

