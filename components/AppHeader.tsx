import { RAZORPAY_MODE } from '@/constants/razorpay';
import { useAuth } from '@/contexts/AuthContext';
import { useFloatingWhatsApp } from '@/contexts/FloatingWhatsAppContext';
import { getRelativeTime } from '@/utils/timezone';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { ThemedText } from './themed-text';

export type AppHeaderProps = {
  onMenuPress?: () => void;
  onChatOpen?: () => void;
};

interface Notification {
  id: string;
  type: 'payment_success' | 'admin_booking';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface BookingData {
  id: number;
  booking_reference: string;
  status: string;
  payment_amount: number;
  payment_type: string;
  is_admin_booking?: boolean;
  created_at: string;
}

export default function AppHeader({ onMenuPress, onChatOpen }: AppHeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const { isFloatingVisible, toggleFloating } = useFloatingWhatsApp();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [demoBooking, setDemoBooking] = useState<BookingData | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationOpacity = useState(new Animated.Value(0))[0];
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isLarge = width >= 1024;
  const isAdminRoute = pathname?.startsWith('/admin') || pathname === 'admin';
  const botLottieRef = useRef<LottieView>(null);
  
  // Responsive bot animation size
  const botAnimationSize = isLarge ? 28 : 24;

  // Play animation when header bot icon is visible
  useEffect(() => {
    if (!isFloatingVisible && botLottieRef.current) {
      botLottieRef.current.play();
    }
  }, [isFloatingVisible]);

  useEffect(() => {
    // Check for demo booking on component mount
    const checkDemoBooking = async () => {
      try {
        const storedBooking = await AsyncStorage.getItem('demoBooking');
        if (storedBooking) {
          const bookingData = JSON.parse(storedBooking);
          setDemoBooking(bookingData);
          setShowNotification(true);
          const isTestMode = RAZORPAY_MODE === 'test' && !bookingData.is_admin_booking;
          
          // Add to notifications list
          const newNotification: Notification = {
            id: `booking_${Date.now()}`,
            type: bookingData.is_admin_booking ? 'admin_booking' : 'payment_success',
            title: bookingData.is_admin_booking ? 'Admin Booking Confirmed' : 'Payment Confirmed',
            message: bookingData.is_admin_booking 
              ? 'Admin booking confirmed! This event will be highlighted as "Featured by leBRQ".'
              : `${isTestMode ? '[TEST MODE] ' : ''}Booking confirmed! Payment: ₹${bookingData.payment_amount} (${bookingData.payment_type === 'advance' ? '50% Advance' : 'Full Payment'})`,
            timestamp: new Date().toISOString(),
            read: false
          };
          
          setNotifications(prev => [newNotification, ...prev]);
          
          // Animate notification in
          Animated.timing(notificationOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }
      } catch (error) {
        // Error checking demo booking
      }
    };

    // Check immediately
    checkDemoBooking();

    // For web platform, listen for storage changes
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'demoBooking' && e.newValue) {
          const bookingData = JSON.parse(e.newValue);
          setDemoBooking(bookingData);
          setShowNotification(true);
          const isTestMode = RAZORPAY_MODE === 'test' && !bookingData.is_admin_booking;
          
          // Add to notifications list
          const newNotification: Notification = {
            id: `booking_${Date.now()}`,
            type: bookingData.is_admin_booking ? 'admin_booking' : 'payment_success',
            title: bookingData.is_admin_booking ? 'Admin Booking Confirmed' : 'Payment Confirmed',
            message: bookingData.is_admin_booking 
              ? 'Admin booking confirmed! This event will be highlighted as "Featured by leBRQ".'
              : `${isTestMode ? '[TEST MODE] ' : ''}Booking confirmed! Payment: ₹${bookingData.payment_amount} (${bookingData.payment_type === 'advance' ? '50% Advance' : 'Full Payment'})`,
            timestamp: new Date().toISOString(),
            read: false
          };
          
          setNotifications(prev => [newNotification, ...prev]);
          
          // Animate notification in
          Animated.timing(notificationOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }
      };

      // Add event listener for storage changes
      window.addEventListener('storage', handleStorageChange);

      // Cleanup
      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, []);


  const clearNotification = async () => {
    // Animate notification out
    Animated.timing(notificationOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(async () => {
      setShowNotification(false);
      await AsyncStorage.removeItem('demoBooking');
      setDemoBooking(null);
    });
  };

  const toggleNotificationDropdown = () => {
    setShowNotificationDropdown(!showNotificationDropdown);
  };

  const markNotificationAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, read: true }
          : notif
      )
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setShowNotificationDropdown(false);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = async () => {
    // Close profile menu immediately
    setShowProfileMenu(false);
    // Redirect immediately without waiting
    router.replace('/');
    // Perform logout silently in background (don't await)
    logout().catch(() => {});
  };

  const handleProfilePress = () => {
    if (isAuthenticated) {
      setShowProfileMenu(true);
    }
  };

  const profileMenuItems = [
    { id: 'profile', title: 'My Profile', icon: 'person-outline' },
    { id: 'bookings', title: 'View Bookings', icon: 'calendar-outline' },
    { id: 'messages', title: 'Messages', icon: 'chatbubbles-outline' },
    { id: 'logout', title: 'Logout', icon: 'log-out-outline', destructive: true },
  ];

  const handleMenuAction = (itemId: string) => {
    setShowProfileMenu(false);
    
    switch (itemId) {
      case 'profile':
        // Navigate to profile page (login tab shows profile when authenticated)
        router.push('/(tabs)/login' as any);
        break;
      case 'bookings':
        // Navigate to bookings list
        router.push('/(tabs)/bookings' as any);
        break;
      case 'messages':
        router.push('/messages' as any);
        break;
      case 'logout':
        handleLogout();
        break;
    }
  };

  return (
    <View style={[
      styles.header,
      !isAdminRoute && isLarge && Platform.OS === 'web' && styles.headerLarge
    ]}>
      {/* Success Notification Bar */}
      {showNotification && demoBooking && (
        <Animated.View style={[
          styles.notificationBar, 
          { 
            opacity: notificationOpacity,
            backgroundColor: demoBooking.is_admin_booking ? '#8B5CF6' : '#059669'
          }
        ]}>
          <View style={[
            styles.notificationWrapper,
            !isAdminRoute && isLarge && Platform.OS === 'web' && styles.notificationWrapperLarge
          ]}>
            <View style={styles.notificationContent}>
              <Ionicons 
                name={demoBooking.is_admin_booking ? "star" : "checkmark-circle"} 
                size={20} 
                color="#FFFFFF" 
              />
              <ThemedText style={styles.notificationText}>
                {demoBooking.is_admin_booking 
                  ? 'Admin Booking Confirmed! This event will be highlighted as "Featured by leBRQ".'
                  : `${RAZORPAY_MODE === 'test' ? '[TEST MODE] ' : ''}Booking Confirmed! Payment: ₹${demoBooking.payment_amount} (${demoBooking.payment_type === 'advance' ? '50% Advance' : 'Full Payment'})`}
              </ThemedText>
              <TouchableOpacity onPress={clearNotification} style={styles.notificationClose}>
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      <View style={[
        styles.headerWrapper,
        !isAdminRoute && isLarge && Platform.OS === 'web' && styles.headerWrapperLarge
      ]}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            onPress={() => router.push('/' as any)}
            style={styles.logoButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Home"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Image 
              source={require('@/assets/images/lebrq-logo.png')} 
              style={styles.brandLogo} 
              contentFit="contain"
              cachePolicy="memory-disk"
              priority="high"
              transition={0}
            />
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
          {/* Bot Animation Icon - Show only when floating icon is hidden */}
          {!isFloatingVisible && (
            <TouchableOpacity
              style={styles.chatButton}
              onPress={() => {
                toggleFloating();
              }}
              accessibilityRole="button"
              accessibilityLabel="Show Chatbot"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <LottieView
                ref={botLottieRef}
                source={require('@/assets/animations/bot.json')}
                autoPlay={true}
                loop={true}
                style={{
                  width: botAnimationSize,
                  height: botAnimationSize,
                }}
              />
            </TouchableOpacity>
          )}

          {/* Notification Icon - Only show when authenticated */}
          {isAuthenticated && notifications.length > 0 && (
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={toggleNotificationDropdown}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="notifications-outline" size={24} color="#333" />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <ThemedText style={styles.badgeText}>{unreadCount}</ThemedText>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Profile Image or Menu Button */}
          {isAuthenticated ? (
            <TouchableOpacity
              onPress={handleProfilePress}
              style={styles.profileButton}
              accessibilityRole="button"
              accessibilityLabel="Profile menu"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.profileImage}>
                {(user as any)?.profile_image ? (
                  <Image 
                    source={{ uri: (user as any).profile_image }}
                    style={styles.profileImageFill}
                    contentFit="cover"
                  />
                ) : (
                  <ThemedText style={styles.profileInitial}>
                    {user?.first_name?.[0] || user?.username?.[0] || 'U'}
                  </ThemedText>
                )}
              </View>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/login' as any)}
                accessibilityRole="button"
                accessibilityLabel="Go to login"
                style={styles.loginButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="person-circle" size={20} color="#22C55E" />
                <ThemedText style={styles.loginText}>Login</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onMenuPress}
                accessibilityRole="button"
                accessibilityLabel="Open sidebar menu"
                style={styles.menuButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="menu" size={24} color="#333" />
              </TouchableOpacity>
            </>
          )}
        </View>
        </View>
      </View>

      {/* Notification Dropdown */}
      {showNotificationDropdown && (
        <View style={styles.notificationDropdown}>
          <View style={styles.notificationHeader}>
            <ThemedText style={styles.notificationTitle}>Notifications</ThemedText>
            {notifications.length > 0 && (
              <TouchableOpacity onPress={clearAllNotifications}>
                <ThemedText style={styles.clearAllText}>Clear All</ThemedText>
              </TouchableOpacity>
            )}
          </View>
          
          {notifications.length === 0 ? (
            <View style={styles.emptyNotifications}>
              <Ionicons name="notifications-off-outline" size={48} color="#9CA3AF" />
              <ThemedText style={styles.emptyText}>No notifications</ThemedText>
            </View>
          ) : (
            <View style={styles.notificationList}>
              {notifications.map((notification) => (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationItem,
                    !notification.read && styles.unreadNotification
                  ]}
                  onPress={() => markNotificationAsRead(notification.id)}
                >
                  <View style={styles.notificationItemContent}>
                    <View style={styles.notificationIcon}>
                      {notification.type === 'payment_success' && (
                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      )}
                      {notification.type === 'admin_booking' && (
                        <Ionicons name="star" size={20} color="#8B5CF6" />
                      )}
                    </View>
                    <View style={styles.notificationItemText}>
                      <ThemedText style={[
                        styles.notificationItemTitle,
                        notification.type === 'admin_booking' && { color: '#8B5CF6' }
                      ]}>
                        {notification.title}
                      </ThemedText>
                      <ThemedText style={styles.notificationItemMessage}>
                        {notification.message}
                      </ThemedText>
                      <ThemedText style={styles.notificationTime}>
                        {new Date(notification.timestamp).toLocaleTimeString()}
                      </ThemedText>
                    </View>
                    {!notification.read && (
                      <View style={styles.unreadDot} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Profile Menu Modal */}
      <Modal
        transparent
        visible={showProfileMenu}
        animationType="fade"
        onRequestClose={() => setShowProfileMenu(false)}
      >
        <Pressable 
          style={styles.menuOverlay} 
          onPress={() => setShowProfileMenu(false)}
        >
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <View style={styles.menuProfileInfo}>
                <View style={styles.menuProfileImage}>
                  {(user as any)?.profile_image ? (
                    <Image 
                      source={{ uri: (user as any).profile_image }}
                      style={styles.menuProfileImageFill}
                      contentFit="cover"
                    />
                  ) : (
                    <ThemedText style={styles.menuProfileInitial}>
                      {user?.first_name?.[0] || user?.username?.[0] || 'U'}
                    </ThemedText>
                  )}
                </View>
                    <View>
                      <ThemedText style={styles.menuProfileName}>
                        {user?.first_name && user?.last_name 
                          ? `${user.first_name} ${user.last_name}`
                          : user?.username || 'User'
                        }
                      </ThemedText>
                      <ThemedText style={styles.menuProfileEmail}>
                        {user?.username}
                      </ThemedText>
                      {user?.last_login_time && (
                        <ThemedText style={styles.menuProfileLastLogin}>
                          Last login: {getRelativeTime(user.last_login_time)}
                        </ThemedText>
                      )}
                    </View>
              </View>
            </View>
            
            <View style={styles.menuItems}>
              {profileMenuItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.menuItem}
                  onPress={() => handleMenuAction(item.id)}
                >
                  <Ionicons 
                    name={item.icon as any} 
                    size={20} 
                    color={item.destructive ? '#DC2626' : '#333'} 
                  />
                  <ThemedText style={[
                    styles.menuItemText,
                    item.destructive && styles.menuItemTextDestructive
                  ]}>
                    {item.title}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Animated Bottom Border Line */}
      {!isAdminRoute && isLarge && Platform.OS === 'web' ? (
        <View style={styles.animatedBorderLineContainer}>
          <Animated.View style={styles.animatedBorderLine} />
        </View>
      ) : (
        <Animated.View style={styles.animatedBorderLine} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E6E8EA',
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
    width: '100%',
    alignSelf: 'center',
  },
  headerLarge: {
    maxWidth: 1200,
  },
  headerWrapper: {
    width: '100%',
    alignSelf: 'center',
    paddingLeft: 0,
    paddingRight: 10,
    marginLeft: 0,
  },
  headerWrapperLarge: {
    maxWidth: 1200,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  logoButton: {
    paddingVertical: 4,
    paddingLeft: 0,
    paddingRight: 10,
    marginLeft: -4,
    borderRadius: 10,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' && {
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    }),
  },
  brandLogo: { 
    width: Platform.OS === 'web' ? 150 : 160, 
    height: Platform.OS === 'web' ? 65 : 50,
    overflow: 'hidden',
    // Ensure crisp rendering
    ...(Platform.OS === 'web' ? {
      imageRendering: 'crisp-edges' as any,
      WebkitImageRendering: 'crisp-edges' as any,
    } : {}),
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rackButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'transparent',
    flexDirection: 'column',
  },
  rackButtonText: {
    color: '#8B5CF6',
    fontWeight: '800',
    fontSize: 12,
    lineHeight: 12,
    marginTop: -2,
  },
  notificationButton: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  profileButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2B8761',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImageFill: {
    width: '100%',
    height: '100%',
  },
  profileInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuButton: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 8 
  },
  loginButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'transparent',
    flexDirection: 'column',
  },
  loginText: {
    color: '#2B8761', // brand primary green
    fontWeight: '800',
    fontSize: 12,
    lineHeight: 12,
    marginTop: -2,
  },
  chatButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    width: 40,
    height: 40,
    overflow: 'hidden',
  },
  headerDivider: { 
    height: 0, 
    backgroundColor: '#F2F4F5', 
    marginHorizontal: 0 
  },
  
  // Profile Menu Styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '60%',
  },
  menuHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuProfileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuProfileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2B8761',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  menuProfileImageFill: {
    width: '100%',
    height: '100%',
  },
  menuProfileInitial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  menuProfileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  menuProfileEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  menuProfileLastLogin: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  menuItems: {
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  menuItemText: {
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
  },
  menuItemTextDestructive: {
    color: '#DC2626',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fallbackCheck: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#2B8761',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  // Notification Bar Styles
  notificationBar: {
    backgroundColor: '#059669',
    borderBottomWidth: 1,
    borderBottomColor: '#047857',
  },
  notificationWrapper: {
    width: '100%',
    alignSelf: 'center',
    paddingLeft: 0,
    paddingRight: 10,
    paddingVertical: 12,
  },
  notificationWrapperLarge: {
    maxWidth: 1200,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationText: {
    flex: 1,
    marginLeft: 8,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationClose: {
    padding: 4,
    marginLeft: 8,
  },
  // Notification Dropdown Styles
  notificationDropdown: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 320,
    maxHeight: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  notificationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  clearAllText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyNotifications: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 8,
  },
  notificationList: {
    maxHeight: 300,
  },
  notificationItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  unreadNotification: {
    backgroundColor: '#F0F9FF',
  },
  notificationItemContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  notificationItemText: {
    flex: 1,
  },
  notificationItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 4,
  },
  notificationItemMessage: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginTop: 6,
    marginLeft: 8,
  },
  animatedBorderLineContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  animatedBorderLine: {
    height: 1,
    width: '100%',
    maxWidth: 1200,
    backgroundColor: '#E6E8EA',
  },
});

