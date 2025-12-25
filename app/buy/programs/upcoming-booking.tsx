import React from 'react';
import { Text, View } from 'react-native';

export default function UpcomingBookingScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>Upcoming Booking</Text>
      <Text style={{ color: '#6b7280', marginTop: 8 }}>This is a placeholder screen for upcoming bookings.</Text>
    </View>
  );
}
