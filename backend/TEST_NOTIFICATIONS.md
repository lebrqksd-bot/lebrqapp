# 🧪 Test Notifications System

Quick guide to test the notification system right now.

---

## ✅ What's Been Implemented

### 1. **Professional Email Template** ✉️
- Beautiful, branded email design
- Gradient header with LeBrq branding
- Structured booking details table
- Call-to-action button
- Mobile-responsive design

### 2. **In-App Notifications** 📱
- Notifications saved to database when booking is approved/rejected
- Unread count tracking
- Mark as read functionality
- Delete notifications

### 3. **Complete REST API** 🚀
- `GET /api/notifications` - Get all notifications
- `GET /api/notifications/count` - Get unread count
- `POST /api/notifications/mark-as-read` - Mark as read
- `POST /api/notifications/mark-all-as-read` - Mark all as read
- `DELETE /api/notifications/{id}` - Delete notification
- `DELETE /api/notifications/clear-all` - Clear all

---

## 🧪 Test Email Notifications

### Step 1: Login as Admin
```bash
curl -X POSThttps://taxtower.in:8002/api
auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin@lebrq.com\",\"password\":\"admin123\"}"
```

Save the token from the response.

### Step 2: Approve a Booking
```bash
curl -X POST "https://taxtower.in:8002/api
admin/bookings/1/approve" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"note\":\"Approved! Looking forward to your event.\"}"
```

**Expected Result:**
- ✅ Booking status changed to "approved"
- ✅ Email sent to user (check their inbox)
- ✅ In-app notification created

---

## 🧪 Test In-App Notifications API

### Step 1: Login as User
```bash
curl -X POSThttps://taxtower.in:8002/api
auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"user@example.com\",\"password\":\"password123\"}"
```

### Step 2: Get Notifications
```bash
curl -X GET "https://taxtower.in:8002/api
notifications" \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

**Expected Response:**
```json
[
  {
    "id": 1,
    "title": "Booking Approved! 🎉",
    "message": "Your booking BK-ABC123 for Grant Hall has been approved.",
    "booking_id": 1,
    "is_read": false,
    "created_at": "2024-01-15T10:30:00"
  }
]
```

### Step 3: Get Unread Count
```bash
curl -X GET "https://taxtower.in:8002/api
notifications/count" \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

**Expected Response:**
```json
{
  "unread_count": 1
}
```

### Step 4: Mark as Read
```bash
curl -X POST "https://taxtower.in:8002/api
notifications/mark-as-read" \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"notification_ids\":[1]}"
```

### Step 5: Verify Unread Count Changed
```bash
curl -X GET "https://taxtower.in:8002/api
notifications/count" \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

**Expected Response:**
```json
{
  "unread_count": 0
}
```

---

## 🎨 Frontend Integration

### Add Notification Bell to Header

```typescript
// components/NotificationBell.tsx
import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { API_BASE } from '../constants/config';

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  
  const fetchUnreadCount = async () => {
    try {
      // Get token from your auth context/AsyncStorage
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      
      const response = await fetch(`${API_BASE}/notifications/count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const { unread_count } = await response.json();
      setUnreadCount(unread_count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };
  
  useEffect(() => {
    fetchUnreadCount();
    
    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <TouchableOpacity 
      onPress={() => router.push('/notifications')}
      style={{ padding: 8, position: 'relative' }}
    >
      <Ionicons name="notifications-outline" size={24} color="#2D5016" />
      {unreadCount > 0 && (
        <View style={{
          position: 'absolute',
          top: 4,
          right: 4,
          backgroundColor: '#ef4444',
          borderRadius: 10,
          minWidth: 18,
          height: 18,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4
        }}>
          <Text style={{ 
            color: '#fff', 
            fontSize: 10, 
            fontWeight: '700' 
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
```

### Create Notifications Screen

```typescript
// app/notifications.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Notification = {
  id: number;
  title: string;
  message: string;
  booking_id: number | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      
      const response = await fetch(`${API_BASE}/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await fetch(`${API_BASE}/notifications/mark-as-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notification_ids: [id] })
      });
      
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await fetch(`${API_BASE}/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      <View style={{ 
        padding: 16, 
        backgroundColor: '#2D5016',
        paddingTop: 50 // Add padding for status bar
      }}>
        <Text style={{ 
          color: '#fff', 
          fontSize: 24, 
          fontWeight: '700' 
        }}>
          Notifications
        </Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => markAsRead(item.id)}
            style={{
              padding: 16,
              backgroundColor: item.is_read ? '#fff' : '#f0fdf4',
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb'
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ 
                    fontWeight: '600', 
                    fontSize: 15,
                    flex: 1
                  }}>
                    {item.title}
                  </Text>
                  {!item.is_read && (
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#10b981',
                      marginLeft: 8
                    }} />
                  )}
                </View>
                <Text style={{ 
                  color: '#6b7280', 
                  fontSize: 14,
                  marginBottom: 4 
                }}>
                  {item.message}
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
              
              <TouchableOpacity onPress={() => deleteNotification(item.id)}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ 
            padding: 60, 
            alignItems: 'center' 
          }}>
            <Ionicons 
              name="notifications-off-outline" 
              size={64} 
              color="#d1d5db" 
            />
            <Text style={{ 
              color: '#9ca3af', 
              marginTop: 16,
              fontSize: 16 
            }}>
              No notifications yet
            </Text>
          </View>
        }
      />
    </View>
  );
}
```

---

## 📧 Email Preview

When you approve a booking, users will receive a beautiful email like this:

- **✅ Professional header** with LeBrq branding and gradient
- **✅ Green success badge** saying "BOOKING APPROVED"
- **✅ Detailed booking information** in a structured table
- **✅ Total amount** prominently displayed
- **✅ Next steps callout** with yellow highlight
- **✅ Call-to-action button** to view bookings
- **✅ Professional footer** with company info

---

## 🎯 Summary

**✅ Backend:**
- Professional email templates implemented
- In-app notification system created
- Complete REST API for notifications
- Auto-save notifications when booking approved/rejected

**✅ API Endpoints Available:**
- `/api/notifications` - Get all
- `/api/notifications/count` - Unread count
- `/api/notifications/mark-as-read` - Mark as read
- `/api/notifications/{id}` - Get/Delete single
- `/api/notifications/clear-all` - Clear all

**🔜 Next Steps:**
1. Add `NotificationBell` component to your app header
2. Create the notifications screen
3. Test by approving a booking in admin panel
4. Check user's email and in-app notifications

**📚 Documentation:**
- `NOTIFICATIONS_API_GUIDE.md` - Complete API reference
- `QUICK_START_NOTIFICATIONS.md` - Email setup guide
- `TEST_NOTIFICATIONS.md` - This file

---

Ready to test! 🚀

