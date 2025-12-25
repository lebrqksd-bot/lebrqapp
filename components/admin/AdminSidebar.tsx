import { ThemedText } from '@/components/themed-text';
import { useBadges } from '@/contexts/BadgeContext';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

function Item({ label, icon, to, badge }: { label: string; icon: keyof typeof Ionicons.glyphMap; to: string; badge?: number }){
  const pathname = usePathname();
  const active = pathname === to;
  return (
    <TouchableOpacity onPress={()=> router.push(to as any)}>
      <View style={[styles.item, active && styles.itemActive]}>
        <Ionicons name={icon} size={16} color={active? '#2D5016':'#667085'} />
        <ThemedText style={[styles.itemLabel, active && { color: '#2D5016', fontWeight: '900' }]}>{label}</ThemedText>
        {badge !== undefined && badge > 0 && (
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>{badge > 99 ? '99+' : badge}</ThemedText>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}


type MenuItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  to: string;
  badge?: number;
  section?: string;
};

export default function AdminSidebar(){
  const { logout } = useAdminAuth();
  const { badgeCounts } = useBadges(); // Use shared badge context
  const [searchQuery, setSearchQuery] = useState('');
  
  const handleLogout = () => {
    logout();
  };

  // Define all menu items with their sections
  const allMenuItems: MenuItem[] = useMemo(() => [
    { label: "Home", icon: "home", to: "/admin" },
    { label: "All Bookings", icon: "list", to: "/admin/bookings", badge: badgeCounts.new_bookings },
    { label: "Clients", icon: "people-circle", to: "/admin/clients", badge: badgeCounts.new_clients },
    { label: "Client Messages", icon: "chatbubbles", to: "/admin/client-messages" },
    { label: "WhatsApp Chatbot", icon: "logo-whatsapp", to: "/admin/whatsapp" },
    { label: "Accounts", icon: "cash", to: "/admin/accounts" },
    { label: "Payments", icon: "card", to: "/admin/payments" },
    { label: "Refunds", icon: "arrow-undo", to: "/admin/refunds" },
    { label: "Invoice Management", icon: "document-text", to: "/admin/invoices" },
    { label: "Offers", icon: "gift", to: "/admin/offers" },
    { label: "Coupons", icon: "ticket", to: "/admin/coupons" },
    { label: "Contests", icon: "trophy", to: "/admin/contests" },
    { label: "Catalog", icon: "pricetags", to: "/admin/items" },
    { label: "Ordered Items", icon: "clipboard", to: "/admin/vendor-items" },
    { label: "Vendor / Broker", icon: "people", to: "/admin/vendors" },
    { label: "Vendor / Broker Settlement", icon: "receipt", to: "/admin/vendor-settlements" },
    { label: "Stage Decorations", icon: "color-palette", to: "/admin/stages" },
    { label: "Stage Banners", icon: "flag", to: "/admin/banners" },
    { label: "Spaces", icon: "business", to: "/admin/spaces" },
    { label: "Programs", icon: "calendar", to: "/admin/programs" },
    { label: "Transportation", icon: "car", to: "/admin/transportation" },
    { label: "Racks", icon: "cube", to: "/admin/racks" },
    { label: "Gallery", icon: "images", to: "/admin/gallery" },
    { label: "HR Dashboard", icon: "stats-chart", to: "/admin/hr/dashboard", section: "HR & Payroll" },
    { label: "Staff Management", icon: "people", to: "/admin/hr/staff", section: "HR & Payroll" },
    { label: "Attendance", icon: "time", to: "/admin/hr/attendance", section: "HR & Payroll" },
    { label: "Office Locations", icon: "location", to: "/admin/hr/office", section: "HR & Payroll" },
    { label: "Leave Management", icon: "calendar", to: "/admin/hr/leave", section: "HR & Payroll" },
    { label: "Payroll", icon: "wallet", to: "/admin/hr/payroll", section: "HR & Payroll" },
    { label: "About Us", icon: "information-circle", to: "/admin/content-pages/about", section: "Content Pages" },
    { label: "FAQ", icon: "help-circle", to: "/admin/content-pages/faq", section: "Content Pages" },
    { label: "Privacy Policy", icon: "shield-checkmark", to: "/admin/content-pages/privacy-policy", section: "Content Pages" },
    { label: "Terms of Service", icon: "document-text", to: "/admin/content-pages/terms-of-service", section: "Content Pages" },
    { label: "Refund Policy", icon: "card", to: "/admin/content-pages/refund-policy", section: "Content Pages" },
  ], [badgeCounts]);

  // Filter menu items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return allMenuItems;
    }
    const query = searchQuery.toLowerCase().trim();
    return allMenuItems.filter(item => 
      item.label.toLowerCase().includes(query) ||
      (item.section && item.section.toLowerCase().includes(query))
    );
  }, [searchQuery, allMenuItems]);

  // Group filtered items by section
  const groupedItems = useMemo(() => {
    const groups: { [key: string]: MenuItem[] } = {};
    const mainItems: MenuItem[] = [];

    filteredItems.forEach(item => {
      if (item.section) {
        if (!groups[item.section]) {
          groups[item.section] = [];
        }
        groups[item.section].push(item);
      } else {
        mainItems.push(item);
      }
    });

    return { mainItems, groups };
  }, [filteredItems]);

  return (
    <ScrollView style={styles.sidebar} showsVerticalScrollIndicator={false}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search menu..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          numberOfLines={1}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Main Menu Items */}
      {groupedItems.mainItems.length > 0 && (
        <>
          {groupedItems.mainItems.map((item) => (
            <Item key={item.to} label={item.label} icon={item.icon} to={item.to} badge={item.badge} />
          ))}
        </>
      )}

      {/* HR & Payroll Section */}
      {groupedItems.groups["HR & Payroll"] && groupedItems.groups["HR & Payroll"].length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>HR & Payroll</ThemedText>
          </View>
          {groupedItems.groups["HR & Payroll"].map((item) => (
            <Item key={item.to} label={item.label} icon={item.icon} to={item.to} badge={item.badge} />
          ))}
        </>
      )}

      {/* Content Pages Section */}
      {groupedItems.groups["Content Pages"] && groupedItems.groups["Content Pages"].length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Content Pages</ThemedText>
          </View>
          {groupedItems.groups["Content Pages"].map((item) => (
            <Item key={item.to} label={item.label} icon={item.icon} to={item.to} badge={item.badge} />
          ))}
        </>
      )}

      {/* No Results Message */}
      {filteredItems.length === 0 && (
        <View style={styles.noResultsContainer}>
          <Ionicons name="search-outline" size={32} color="#CCC" />
          <ThemedText style={styles.noResultsText}>No results found</ThemedText>
        </View>
      )}

      {/* Logout Button */}
      <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
        <View style={styles.item}>
          <Ionicons name="log-out" size={16} color="#dc2626" />
          <ThemedText style={[styles.itemLabel, { color: '#dc2626' }]}>Logout</ThemedText>
        </View>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  sidebar: {
    width: 220,
    maxWidth: 220,
    height: '100%',
    backgroundColor: '#ffffff',
    borderRightColor: '#E6E8EA',
    borderRightWidth: 1,
    paddingTop: 16,
    paddingLeft: 0,
    paddingRight: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginHorizontal: 8,
    marginBottom: 12,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 36,
    overflow: 'hidden',
  },
  searchIcon: {
    marginRight: 8,
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    padding: 0,
    margin: 0,
    minWidth: 0,
  },
  clearButton: {
    marginLeft: 6,
    padding: 2,
    flexShrink: 0,
  },
  noResultsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    marginTop: 12,
    fontSize: 13,
    color: '#999',
  },
  logo: { fontWeight: '900', color: '#2D5016', marginBottom: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, position: 'relative' },
  itemActive: { backgroundColor: '#f4f8f4' },
  itemLabel: { color: '#667085', fontWeight: '600', flex: 1 },
  badge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: { 
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#E6E8EA',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logoutBtn: { marginTop: 'auto', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E6E8EA' },
});