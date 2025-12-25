import React, { createContext, ReactNode, useCallback, useState } from 'react';

interface FloatingWhatsAppContextType {
  isFloatingVisible: boolean;
  setFloatingVisible: (visible: boolean) => void;
  toggleFloating: () => void;
}

export const FloatingWhatsAppContext = createContext<FloatingWhatsAppContextType | undefined>(undefined);

export function FloatingWhatsAppProvider({ children }: { children: ReactNode }) {
  const [isFloatingVisible, setIsFloatingVisible] = useState(true);

  const toggleFloating = useCallback(() => {
    setIsFloatingVisible(prev => !prev);
  }, []);

  return (
    <FloatingWhatsAppContext.Provider value={{ isFloatingVisible, setFloatingVisible: setIsFloatingVisible, toggleFloating }}>
      {children}
    </FloatingWhatsAppContext.Provider>
  );
}

export function useFloatingWhatsApp() {
  const context = React.useContext(FloatingWhatsAppContext);
  if (!context) {
    throw new Error('useFloatingWhatsApp must be used within FloatingWhatsAppProvider');
  }
  return context;
}
