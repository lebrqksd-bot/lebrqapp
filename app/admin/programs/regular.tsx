import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type RegularProgram = {
	id: number;
	booking_reference: string;
	space_id: number;
	event_type: string | null;
	booking_type: string;
	status: string;
	start_datetime: string;
	end_datetime: string;
	user_name?: string;
};

export default function AdminRegularPrograms() {
	const [isChecking, setIsChecking] = useState(true);
	const [loading, setLoading] = useState(false);
	const [programs, setPrograms] = useState<RegularProgram[]>([]);

	useEffect(() => {
		const checkAuth = async () => {
			try {
				const token = await AsyncStorage.getItem('admin_token');
				const userStr = await AsyncStorage.getItem('admin_user');
				if (!token || !userStr) {
					await AsyncStorage.removeItem('admin_token');
					await AsyncStorage.removeItem('admin_user');
					router.replace('/admin/login');
					return;
				}
				const user = JSON.parse(userStr);
				if (!user.role || user.role !== 'admin') {
					await AsyncStorage.removeItem('admin_token');
					await AsyncStorage.removeItem('admin_user');
					router.replace('/admin/login');
					return;
				}
				setIsChecking(false);
			} catch {
				await AsyncStorage.removeItem('admin_token');
				await AsyncStorage.removeItem('admin_user');
				router.replace('/admin/login');
			}
		};
		checkAuth();
	}, []);

	useEffect(() => {
		if (isChecking) return;
		const load = async () => {
			try {
				setLoading(true);
				// Show ongoing/upcoming daily/regular programs by default
				const res = await fetch(`${API_BASE}/bookings/regular-programs?include_past=false`);
				if (res.ok) {
					const data = await res.json();
					setPrograms(data || []);
				}
			} finally {
				setLoading(false);
			}
		};
		load();
	}, [isChecking]);

	if (isChecking) {
		return (
			<View style={{ flex: 1, backgroundColor: '#f7f9f8', justifyContent: 'center', alignItems: 'center' }}>
				<ActivityIndicator size="large" color="#2D5016" />
				<ThemedText style={{ marginTop: 16 }}>Checking authentication...</ThemedText>
			</View>
		);
	}

	return (
		<View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
			<AdminHeader title="Regular Programs" />
			<View style={styles.wrap}>
				<AdminSidebar />
				<ScrollView contentContainerStyle={styles.body}>
					<ThemedText style={styles.pageTitle}>Regular Programs</ThemedText>
					{loading ? (
						<View style={{ padding: 40, alignItems: 'center' }}>
							<ActivityIndicator size="large" color="#2D5016" />
							<ThemedText style={{ marginTop: 16, color: '#667085' }}>Loading programs...</ThemedText>
						</View>
					) : programs.length === 0 ? (
						<View style={styles.card}>
							<ThemedText style={{ color: '#667085' }}>No regular programs found.</ThemedText>
						</View>
					) : (
						<View style={styles.card}>
							{programs.map((p) => (
								<View key={p.id} style={styles.row}>
									<View style={{ flex: 1 }}>
										<ThemedText style={styles.title}>{p.event_type || 'Program'}</ThemedText>
										<ThemedText style={styles.meta}>
											{new Date(p.start_datetime).toLocaleString()} ➜ {new Date(p.end_datetime).toLocaleString()}
										</ThemedText>
										<ThemedText style={styles.meta}>Type: {p.booking_type} · Status: {p.status}</ThemedText>
									</View>
								</View>
							))}
						</View>
					)}
				</ScrollView>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { flex: 1, flexDirection: 'row' },
	body: { padding: 16, flex: 1 },
	pageTitle: { fontSize: 20, fontWeight: '700', color: '#2D5016', marginBottom: 12 },
	card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E6E8EA', borderRadius: 12, overflow: 'hidden' },
	row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#edf1ee' },
	title: { fontWeight: '600', color: '#2D5016' },
	meta: { color: '#667085', marginTop: 2 },
});

