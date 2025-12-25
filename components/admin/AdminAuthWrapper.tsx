import { ThemedText } from '@/components/themed-text';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

interface AdminAuthWrapperProps {
  children: React.ReactNode;
  loadingMessage?: string;
}

export default function AdminAuthWrapper({ children, loadingMessage = 'Checking authentication...' }: AdminAuthWrapperProps) {
  const { isLoading, isAuthenticated, token } = useAdminAuth();

  if (isLoading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#f7f9f8' 
      }}>
        <ActivityIndicator size="large" color="#2D5016" />
        <ThemedText style={{ 
          marginTop: 16, 
          color: '#666',
          fontSize: 16 
        }}>
          {loadingMessage}
        </ThemedText>
      </View>
    );
  }

  if (!isAuthenticated || !token) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#f7f9f8' 
      }}>
        <ThemedText style={{ 
          color: '#666',
          fontSize: 16,
          textAlign: 'center' 
        }}>
          Redirecting to login...{'\n'}
          Please wait.
        </ThemedText>
      </View>
    );
  }

  return <>{children}</>;
}