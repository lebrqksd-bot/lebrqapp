# 🔔 Notifications API Guide

Complete guide for integrating in-app notifications in your frontend.

---

## 📡 API Endpoints

Base URL: `https://taxtower.in:8002/api
`

All endpoints require **authentication** (Bearer token in Authorization header).

---

### 1️⃣ Get User Notifications

**GET** `/notifications`

Get all notifications for the logged-in user.

**Query Parameters:**
- `limit` (optional): Number of notifications (default: 20)
- `offset` (optional): Pagination offset (default: 0)
- `unread_only` (optional): Only unread notifications (default: false)

**Example Request:**
```javascript
const response = await fetch(https://taxtower.in:8002/api'
notifications?limit=10&unread_only=true', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
const notifications = await response.json();
```

**Response:**
```json
[
  {
    "id": 123,
    "title": "Booking Approved! 🎉",
    "message": "Your booking BK-ABC123 has been approved.",
    "booking_id": 456,
    "is_read": false,
    "created_at": "2024-01-15T10:30:00"
  },
  {
    "id": 124,
    "title": "Booking Update",
    "message": "Your booking BK-DEF456 was not approved.",
    "booking_id": 789,
    "is_read": true,
    "created_at": "2024-01-14T09:15:00"
  }
]
```

---

### 2️⃣ Get Unread Count

**GET** `/notifications/count`

Get the count of unread notifications (for badge display).

**Example Request:**
```javascript
const response = await fetch(https://taxtower.in:8002/api'
notifications/count', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
const { unread_count } = await response.json();
```

**Response:**
```json
{
  "unread_count": 5
}
```

---

### 3️⃣ Mark Notifications as Read

**POST** `/notifications/mark-as-read`

Mark specific notifications as read.

**Request Body:**
```json
{
  "notification_ids": [123, 124, 125]
}
```

**Example Request:**
```javascript
await fetch(https://taxtower.in:8002/api'
notifications/mark-as-read', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    notification_ids: [123, 124]
  })
});
```

**Response:**
```json
{
  "message": "Marked 2 notification(s) as read"
}
```

---

### 4️⃣ Mark All as Read

**POST** `/notifications/mark-all-as-read`

Mark all user's notifications as read.

**Example Request:**
```javascript
await fetch(https://taxtower.in:8002/api'
notifications/mark-all-as-read', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
```

**Response:**
```json
{
  "message": "All notifications marked as read"
}
```

---

### 5️⃣ Get Single Notification

**GET** `/notifications/{notification_id}`

Get details of a specific notification.

**Example Request:**
```javascript
const response = await fetch(https://taxtower.in:8002/api'
notifications/123', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
const notification = await response.json();
```

**Response:**
```json
{
  "id": 123,
  "title": "Booking Approved! 🎉",
  "message": "Your booking BK-ABC123 has been approved.",
  "booking_id": 456,
  "is_read": false,
  "created_at": "2024-01-15T10:30:00"
}
```

---

### 6️⃣ Delete Notification

**DELETE** `/notifications/{notification_id}`

Delete a specific notification.

**Example Request:**
```javascript
await fetch(https://taxtower.in:8002/api'
notifications/123', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
```

**Response:**
```json
{
  "message": "Notification deleted successfully"
}
```

---

### 7️⃣ Clear All Notifications

**DELETE** `/notifications/clear-all`

Delete all notifications for the user.

**Example Request:**
```javascript
await fetch(https://taxtower.in:8002/api'
notifications/clear-all', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
```

**Response:**
```json
{
  "message": "All notifications cleared"
}
```

---

## 🎨 Frontend Integration Example

### React Native / Expo Component

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Badge } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_BASE =https://taxtower.in:8002/api
';

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
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Get user token from your auth context/storage
  const userToken = 'YOUR_USER_TOKEN';

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE}/notifications`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`${API_BASE}/notifications/count`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      const { unread_count } = await response.json();
      setUnreadCount(unread_count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: number) => {
    try {
      await fetch(`${API_BASE}/notifications/mark-as-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notification_ids: [notificationId] })
      });
      
      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: number) => {
    try {
      await fetch(`${API_BASE}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9f8' }}>
      {/* Header with Unread Badge */}
      <View style={{ padding: 16, backgroundColor: '#2D5016' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View style={{ backgroundColor: '#ef4444', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                {unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => markAsRead(item.id)}
            style={{
              padding: 16,
              backgroundColor: item.is_read ? '#fff' : '#f0fdf4',
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb',
              flexDirection: 'row',
              alignItems: 'flex-start'
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', fontSize: 15, marginBottom: 4 }}>
                {item.title}
              </Text>
              <Text style={{ color: '#6b7280', fontSize: 14 }}>
                {item.message}
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
            
            <TouchableOpacity onPress={() => deleteNotification(item.id)}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="notifications-off-outline" size={64} color="#d1d5db" />
            <Text style={{ color: '#9ca3af', marginTop: 16 }}>
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

### Notification Bell Icon with Badge

```typescript
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View, Text } from 'react-native';

function NotificationBellIcon() {
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Fetch unread count (call this periodically)
  const fetchUnreadCount = async () => {
    const response = await fetch(https://taxtower.in:8002/api'
notifications/count', {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    const { unread_count } = await response.json();
    setUnreadCount(unread_count);
  };
  
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);
  
  return (
    <TouchableOpacity onPress={() => router.push('/notifications')}>
      <View>
        <Ionicons name="notifications-outline" size={24} color="#2D5016" />
        {unreadCount > 0 && (
          <View style={{
            position: 'absolute',
            top: -4,
            right: -8,
            backgroundColor: '#ef4444',
            borderRadius: 10,
            minWidth: 20,
            height: 20,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4
          }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
```

---

## 🔄 Real-time Updates

For real-time notifications, you have two options:

### Option 1: Polling (Recommended for now)
```javascript
// Check for new notifications every 30 seconds
setInterval(async () => {
  const { unread_count } = await fetch('/notifications/count').then(r => r.json());
  setUnreadCount(unread_count);
}, 30000);
```

### Option 2: WebSockets (Advanced)
Implement WebSocket connection for instant push notifications (requires additional backend setup).

---

## ✅ Testing the API

### 1. Get your user token:
```bash
# Login as a user
curl -X POSThttps://taxtower.in:8002/api
auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"password123"}'
```

### 2. Get notifications:
```bash
curl -X GET "https://taxtower.in:8002/api
notifications" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Get unread count:
```bash
curl -X GET "https://taxtower.in:8002/api
notifications/count" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🎯 Summary

**✅ You now have:**
1. Professional email templates for booking notifications
2. Complete REST API for managing notifications
3. In-app notification system with unread badges
4. Examples for frontend integration

**📱 Features:**
- Unread count for badge display
- Mark as read functionality
- Delete individual/all notifications
- Pagination support
- Filter by unread only

**🚀 Next Steps:**
1. Integrate notification bell icon in your app header
2. Create a notifications screen using the API
3. Add polling to check for new notifications
4. Show notification badge with unread count

---

Need help with implementation? Check the examples above or reach out! 🎉

