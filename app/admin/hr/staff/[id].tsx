import { ThemedText } from '@/components/themed-text';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function StaffDetailPage() {
    const { id } = useLocalSearchParams<{ id: string }>();
    
    useEffect(() => {
        // Redirect to edit form with the id
        router.replace(`/admin/hr/staff/new?id=${id}` as any);
    }, [id]);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#007AFF" />
            <ThemedText style={{ marginTop: 10 }}>Loading staff details...</ThemedText>
        </View>
    );
}

