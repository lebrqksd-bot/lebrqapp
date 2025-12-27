import AddonsSection from '@/components/AddonsSection';
import AudioRecorder from '@/components/AudioRecorder';
import AuthModal from '@/components/AuthModal';
import OfferPopup from '@/components/OfferPopup';
import TimeSlotSelector from '@/components/TimeSlotSelector';
import { TransportationLocation } from '@/components/TransportationSection';
import ItemMediaViewer from '@/components/item/ItemMediaViewer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { ItemsAPI } from '@/lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, FlatList, Modal, Platform, Pressable, Image as RNImage, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
// Helper: send naive local time (no timezone) to avoid shifts server-side
const formatDateForAPI = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

type AddOnSubItem = { id: string; label: string; price: number; image: string };
type AddOn = { 
  id: string; 
  label: string; 
  type: 'simple' | 'detailed';
  price?: number; // For simple add-ons
  image?: string; // For add-on images
  subItems?: AddOnSubItem[]; // For detailed add-ons
  description?: string; // Item description
  item_status?: string; // Item status (available, out_of_stock, maintenance)
  preparation_time_minutes?: number; // Preparation time in minutes
  media?: Array<{
    id: number;
    media_type: 'image' | 'video';
    file_url: string;
    file_path: string;
    is_primary: boolean;
    display_order: number;
    title?: string | null;
    description?: string | null;
  }>; // Media items
};
type StageOption = { id: string; label: string; image?: any; price: number };
type BannerSize = { id: string; label: string; width: number; height: number; price: number; image_url?: string; image?: string };
type EventType = { id: string; label: string; icon: string; addOns: AddOn[] };
type EventCategory = { 
  id: string; 
  label: string; 
  icon: string; 
  category: string;
  subcategories: EventType[];
};

type HallFeature = { 
  id?: string; 
  icon?: string; 
  label: string; 
  image?: number | string | { uri: string }; 
  paid?: boolean;
  pricing_type?: 'hour' | 'item';
  base_price?: number;
  additional_hour_price?: number;
  item_price?: number;
  details?: string;
  addon_trigger?: 'cake' | 'snack' | 'team' | null;
};

// API Types
type SpaceData = {
  id: number;
  name: string;
  description: string;
  capacity: number;
  price_per_hour: number;
  image_url: string;
  features: HallFeature[] | { hall_features?: HallFeature[]; top_banners?: string[] };
  event_types: EventCategory[];
  stage_options: StageOption[];
  banner_sizes: BannerSize[];
};

import { CONFIG } from '@/constants/config';

// Default fallback data (will be replaced by API data)
const DEFAULT_HALL_FEATURES: HallFeature[] = [
  { id: 'mic', label: 'Microphone System', image: { uri: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&q=60&auto=format&fit=crop' }, icon: 'checkbox-outline', paid: false },
  { id: 'sound', label: '200 watt Premium Sound Systems', image: { uri: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=60&auto=format&fit=crop' }, icon: 'checkbox-outline', paid: false },
  { id: 'ac', label: 'Air Conditioning With Cooler', image: { uri: 'https://plus.unsplash.com/premium_photo-1661315526732-271aa84f480d?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: false },
  { id: 'seating', label: '150 Seating Capacity', image: { uri: 'https://images.unsplash.com/photo-1588459998451-4d243a241f55?q=80&w=1421&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: false },
  { id: 'bar', label: 'Bar Counter-Full Food & Beverage.', image: { uri: 'https://images.unsplash.com/photo-1510626176961-4b57d4fbad03?w=400&q=60&auto=format&fit=crop' }, icon: 'checkbox-outline', paid: true, pricing_type: 'hour', addon_trigger: 'snack' },
  { id: 'projector', label: 'HD Projector & Screen', image: { uri: 'https://images.unsplash.com/photo-1701318134632-7cda18e7c487?q=80&w=435&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: false },
  { id: 'stage', label: 'Professional Stage', image: { uri: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=60&auto=format&fit=crop' }, icon: 'checkbox-outline', paid: false },
  { id: 'lighting', label: 'Professional Lighting', image: { uri: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&q=60&auto=format&fit=crop' }, icon: 'checkbox-outline', paid: false },
  { id: 'parking', label: 'Ample Parking', image: { uri: 'https://images.unsplash.com/photo-1506883968894-6e7738ccfc05?q=80&w=580&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: false },
  { id: 'feature-1763352637725', label: 'Photo point', image: { uri: 'https://plus.unsplash.com/premium_photo-1658506703722-8f37d559adc7?q=80&w=861&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: true, pricing_type: 'item', item_price: 170.0, details: "What's Included\n- A4-Sized Aluminium Frame\n- Premium Photo Print" },
  { id: 'feature-1763352714092', label: 'Dining hall seating & tables', image: { uri: 'https://images.unsplash.com/photo-1747535797922-0e36c1b4e795?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: false },
  { id: 'feature-1763352734749', label: 'Podium with mic', image: { uri: 'https://images.unsplash.com/photo-1587691602199-fab9823b93af?q=80&w=435&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: false },
  { id: 'feature-1763352786669', label: 'Bubble Maker With Light & Music', image: { uri: 'https://images.unsplash.com/photo-1618085238478-b0d7a59884a7?q=80&w=874&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: true, pricing_type: 'item', item_price: 100.0, details: 'Pricing varies according to the number of shots.\nPlease select the desired shot count using the checkbox after clicking the option.' },
  { id: 'feature-1763352830310', label: 'Library With Book Collections', image: { uri: 'https://plus.unsplash.com/premium_photo-1663047671914-1b0a9ed1f4?q=80&w=871&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: false },
  { id: 'feature-1763352879774', label: 'Carrom Board Game Table', image: { uri: 'https://media.istockphoto.com/id/1398245714/photo/smiling-saudi-couples-playing-carrom-at-home.jpg?s=1024x1024&w=is&k=20&c=BrKsHiKRhUBTooE5hPId0NEqkCuP6hjIVgQW5wlpChw=' }, icon: 'checkbox-outline', paid: true, pricing_type: 'hour', base_price: 100.0, details: 'Classic indoor game table, perfect for events and family entertainment.\nPrice calculated per hour' },
  { id: 'feature-1763352943630', label: 'RGB Lights & Paper Blaster', image: { uri: 'https://images.unsplash.com/photo-1640893719203-4aa0a3373b07?q=80&w=1018&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: true, pricing_type: 'item', item_price: 70.0, details: 'Transform your celebrations with dynamic RGB lighting effects paired with an exciting paper blaster experience. The RGB lights add vibrant color patterns that elevate the mood, while the paper blaster showers the stage or dance floor with festive paper bursts - perfect for grand entries, special moments, and high-energy performances.\n\nPricing varies according to the number of shots.\nPlease select the desired shot count using the checkbox after clicking the option.' },
  { id: 'feature-1763352980862', label: 'Smoker Machine with 13 Colour & 8 Led Lights', image: { uri: 'https://images.unsplash.com/photo-1594078819060-24feceff00f7?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: true, pricing_type: 'item', item_price: 200.0, details: 'Create a dramatic atmosphere with our advanced smoker machine featuring 13 vibrant colour options and 8 powerful LED lights. It adds depth, glow, and visual magic to the stage, making every entry, performance, and highlight moment look cinematic and unforgettable.\n\nPricing varies according to the number of shots.\nPlease select the desired shot count using the checkbox after clicking the option.' },
  { id: 'feature-1763353032734', label: 'Fire Safety Cylinders (DCP/CO2)', image: { uri: 'https://images.unsplash.com/photo-1668889570338-4f20225eb9d3?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: false },
  { id: 'feature-1763353110287', label: 'Games - Chess, Ludo, Snakes & Ladders, UNO Puzzles', image: { uri: 'https://plus.unsplash.com/premium_photo-1759763252768-d6e8282f201d?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: true, pricing_type: 'hour', base_price: 100.0, details: 'Pricing varies according to the number of hours.\nPlease select the desired number of hours using the checkbox after clicking the option.' },
  { id: 'feature-1763353132349', label: 'Singers - With & Without Instruments', image: { uri: 'https://images.unsplash.com/photo-1565145368739-29e5a81be478?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: true, pricing_type: 'hour', addon_trigger: 'team' },
  { id: 'feature-1763353161964', label: 'Dancers With All Types', image: { uri: 'https://images.unsplash.com/photo-1760542939973-50000a5d173d?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }, icon: 'checkbox-outline', paid: true, pricing_type: 'hour', addon_trigger: 'team' },
  { id: 'feature-1763353187438', label: 'MC & Anchor (Host)', image: { uri: 'https://media.istockphoto.com/id/2151925618/photo/group-business-meeting.jpg?s=1024x1024&w=is&k=20&c=awDgtrWmCH4Y0-z86rqOiaV6jzpo1rV0PPxRbNUGbdU=' }, icon: 'checkbox-outline', paid: true, pricing_type: 'hour', addon_trigger: 'team' },
  { id: 'feature-1763353215430', label: 'Photographer, Videographer & Reels Creator', image: { uri: 'https://images.unsplash.com/photo-1711473726143-b26145e55772?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MzAyfHxwaG90b2dyYXBoZXJ8ZW58MHx8MHx8fDA%3D' }, icon: 'checkbox-outline', paid: true, pricing_type: 'hour', base_price: 1.0, addon_trigger: 'team' },
];

const DEFAULT_EVENT_TYPES: EventType[] = [
  // Social & Life Events
 {
  id: 'birthday-party',
  label: 'Birthday Party',
  icon: 'gift-outline',
  addOns: [], // Items fetched dynamically from API based on main_category and subcategory
},
{
  id: 'engagement-ring-ceremony',
  label: 'Engagement / Ring Ceremony',
  icon: 'diamond-outline',
  addOns: [
    {
      id: 'ring-ceremony-decor',
      label: 'Ring Ceremony Decorations',
      type: 'detailed',
      image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      subItems: [
        { id: 'mandap', label: 'Mandap Setup', price: 3000, image: 'https://images.unsplash.com/photo-1603898037225-47487e2bbc4c' },
        { id: 'flower-rings', label: 'Flower Rings', price: 500, image: 'https://images.unsplash.com/photo-1496171367470-9ed9a91ea931' },
        { id: 'stage-backdrop', label: 'Stage Backdrop', price: 1500, image: 'https://images.unsplash.com/photo-1578926375605-eaf7559b1458' }
      ]
    },
    {
      id: 'photography',
      label: 'Photography',
      type: 'detailed',
      image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f',
      subItems: [
        { id: 'basic-photo', label: 'Basic Photography', price: 2000, image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba' },
        { id: 'premium-photo', label: 'Premium Photography', price: 5000, image: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8' },
        { id: 'videography', label: 'Videography', price: 3000, image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8' }
      ]
    }
  ]
},
{
  id: 'wedding-functions',
  label: 'Wedding Functions',
  icon: 'heart-outline',
  addOns: [
    {
      id: 'wedding-decorations',
      label: 'Wedding Decorations',
      type: 'detailed',
      image: 'https://images.unsplash.com/photo-1528892952291-009c663ce843',
      subItems: [
        { id: 'flowers', label: 'Flower Arrangements', price: 2000, image: 'https://images.unsplash.com/photo-1509223197845-458d87318791' },
        { id: 'lights', label: 'Fairy Lights', price: 500, image: 'https://images.unsplash.com/photo-1516455590571-18256e5bb9ff' },
        { id: 'backdrop', label: 'Wedding Backdrop', price: 1500, image: 'https://images.unsplash.com/photo-1555255707-c1445ae12f4f' }
      ]
    },
    {
      id: 'wedding-cake',
      label: 'Wedding Cake',
      type: 'detailed',
      image: 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af',
      subItems: [
        { id: 'cake-1-tier', label: '1-Tier Cake', price: 3000, image: 'https://images.unsplash.com/photo-1603023549430-09042c4e67e9' },
        { id: 'cake-2-tier', label: '2-Tier Cake', price: 5000, image: 'https://images.unsplash.com/photo-1587932484640-7e337d93b68e' },
        { id: 'cake-3-tier', label: '3-Tier Cake', price: 8000, image: 'https://images.unsplash.com/photo-1599785209790-35cdbd22fc35' }
      ]
    }
  ]
},



  {
    id: 'diwali-celebration',
    label: 'Festive Gathering â€“ Diwali',
    icon: 'flame-outline',
    addOns: [
      { id: 'diwali-decor', label: 'Diwali Decorations', type: 'detailed', image: 'diwali-decor.jpg', subItems: [
        { id: 'diyas', label: 'Diyas', price: 200, image: 'diyas.jpg' },
        { id: 'rangoli', label: 'Rangoli', price: 300, image: 'rangoli.jpg' },
        { id: 'lights', label: 'Festive Lights', price: 500, image: 'lights.jpg' }
      ]},
      { id: 'diwali-sweets', label: 'Diwali Sweets', type: 'simple', price: 400 },
    ],
  },
  {
    id: 'eid-celebration',
    label: 'Festive Gathering â€“ Eid',
    icon: 'moon-outline',
    addOns: [
      { id: 'eid-decor', label: 'Eid Decorations', type: 'simple', price: 300 },
      { id: 'eid-food', label: 'Eid Food', type: 'detailed', image: 'eid-food.jpg', subItems: [
        { id: 'biryani', label: 'Biryani', price: 400, image: 'biryani.jpg' },
        { id: 'sweets', label: 'Eid Sweets', price: 300, image: 'eid-sweets.jpg' }
      ]}
    ],
  },
  {
    id: 'christmas-celebration',
    label: 'Christmas Celebration',
    icon: 'snow-outline',
    addOns: [
      { id: 'christmas-decor', label: 'Christmas Decorations', type: 'detailed', image: 'christmas-decor.jpg', subItems: [
        { id: 'christmas-tree', label: 'Christmas Tree', price: 800, image: 'christmas-tree.jpg' },
        { id: 'ornaments', label: 'Ornaments', price: 200, image: 'ornaments.jpg' },
        { id: 'lights', label: 'Christmas Lights', price: 400, image: 'christmas-lights.jpg' }
      ]},
      { id: 'christmas-cake', label: 'Christmas Cake', type: 'simple', price: 500 },
    ],
  },
  {
    id: 'onam-celebration',
    label: 'Onam Celebration',
    icon: 'flower-outline',
    addOns: [
      { id: 'onam-decor', label: 'Onam Decorations', type: 'detailed', image: 'onam-decor.jpg', subItems: [
        { id: 'pookalam', label: 'Pookalam', price: 300, image: 'pookalam.jpg' },
        { id: 'onam-costumes', label: 'Onam Costumes', price: 500, image: 'onam-costumes.jpg' }
      ]},
      { id: 'onam-food', label: 'Onam Sadya', type: 'simple', price: 600 },
    ],
  },
  {
    id: 'new-year-celebration',
    label: 'New Year Celebration',
    icon: 'sparkles-outline',
    addOns: [
      { id: 'new-year-decor', label: 'New Year Decorations', type: 'detailed', image: 'new-year-decor.jpg', subItems: [
        { id: 'party-hats', label: 'Party Hats', price: 100, image: 'party-hats.jpg' },
        { id: 'confetti', label: 'Confetti', price: 150, image: 'confetti.jpg' },
        { id: 'balloons', label: 'New Year Balloons', price: 200, image: 'new-year-balloons.jpg' }
      ]},
      { id: 'new-year-food', label: 'New Year Food', type: 'simple', price: 500 },
    ],
  },

  // Corporate & Business Events
  {
    id: 'board-meeting',
    label: 'Board Meeting',
    icon: 'business-outline',
    addOns: [
      { id: 'projector', label: 'Projector Setup', type: 'simple', price: 500 },
      { id: 'sound-system', label: 'Sound System', type: 'simple', price: 800 },
      { id: 'catering', label: 'Catering', type: 'detailed', image: 'catering.jpg', subItems: [
        { id: 'breakfast', label: 'Breakfast', price: 200, image: 'breakfast.jpg' },
        { id: 'lunch', label: 'Lunch', price: 400, image: 'lunch.jpg' },
        { id: 'dinner', label: 'Dinner', price: 500, image: 'dinner.jpg' }
      ]}
    ],
  },
  {
    id: 'business-meeting',
    label: 'Business Meeting',
    icon: 'briefcase-outline',
    addOns: [
      { id: 'meeting-room-setup', label: 'Meeting Room Setup', type: 'simple', price: 300 },
      { id: 'coffee-break', label: 'Coffee Break', type: 'detailed', image: 'coffee-break.jpg', subItems: [
        { id: 'coffee-regular', label: 'Regular Coffee', price: 50, image: 'coffee-regular.jpg' },
        { id: 'coffee-premium', label: 'Premium Coffee', price: 80, image: 'coffee-premium.jpg' },
        { id: 'tea', label: 'Tea', price: 40, image: 'tea.jpg' },
        { id: 'snacks', label: 'Light Snacks', price: 100, image: 'snacks.jpg' }
      ]}
    ],
  },
  {
    id: 'conference',
    label: 'Conference',
    icon: 'people-outline',
    addOns: [
      { id: 'microphone', label: 'Microphone Setup', type: 'simple', price: 300 },
      { id: 'recording', label: 'Recording Service', type: 'simple', price: 1000 },
      { id: 'materials', label: 'Conference Materials', type: 'simple', price: 200 }
    ],
  },
  {
    id: 'seminar',
    label: 'Seminar',
    icon: 'school-outline',
    addOns: [
      { id: 'projector-edu', label: 'Educational Projector', type: 'simple', price: 400 },
      { id: 'materials-edu', label: 'Educational Materials', type: 'simple', price: 150 },
      { id: 'certificates', label: 'Certificates', type: 'simple', price: 100 }
    ],
  },
  {
    id: 'workshop',
    label: 'Workshop',
    icon: 'construct-outline',
    addOns: [
      { id: 'workshop-materials', label: 'Workshop Materials', type: 'detailed', image: 'workshop-materials.jpg', subItems: [
        { id: 'stationery', label: 'Stationery', price: 100, image: 'stationery.jpg' },
        { id: 'tools', label: 'Tools', price: 200, image: 'tools.jpg' }
      ]},
      { id: 'workshop-food', label: 'Workshop Food', type: 'simple', price: 300 },
    ],
  },
  {
    id: 'training',
    label: 'Training',
    icon: 'book-outline',
    addOns: [
      { id: 'training-materials', label: 'Training Materials', type: 'simple', price: 150 },
      { id: 'training-certificates', label: 'Training Certificates', type: 'simple', price: 100 },
      { id: 'training-food', label: 'Training Food', type: 'simple', price: 250 },
    ],
  },
  {
    id: 'product-launch',
    label: 'Product Launch',
    icon: 'rocket-outline',
    addOns: [
      { id: 'launch-decor', label: 'Launch Decorations', type: 'detailed', image: 'launch-decor.jpg', subItems: [
        { id: 'banner', label: 'Launch Banner', price: 300, image: 'banner.jpg' },
        { id: 'backdrop', label: 'Product Backdrop', price: 500, image: 'backdrop.jpg' }
      ]},
      { id: 'launch-photography', label: 'Launch Photography', type: 'simple', price: 2000 },
    ],
  },
  {
    id: 'club-meeting',
    label: 'Club Meeting',
    icon: 'people-circle-outline',
    addOns: [
      { id: 'meeting-setup', label: 'Meeting Setup', type: 'simple', price: 200 },
      { id: 'club-food', label: 'Club Food', type: 'simple', price: 300 },
    ],
  },

  // Educational & Academic
  {
    id: 'academic-seminar',
    label: 'Academic Seminar',
    icon: 'library-outline',
    addOns: [
      { id: 'academic-materials', label: 'Academic Materials', type: 'simple', price: 150 },
      { id: 'academic-food', label: 'Academic Food', type: 'simple', price: 200 },
    ],
  },
  {
    id: 'orientation',
    label: 'Orientation',
    icon: 'compass-outline',
    addOns: [
      { id: 'orientation-kit', label: 'Orientation Kit', type: 'simple', price: 100 },
      { id: 'orientation-food', label: 'Orientation Food', type: 'simple', price: 150 },
    ],
  },
  {
    id: 'induction-program',
    label: 'Induction Program',
    icon: 'enter-outline',
    addOns: [
      { id: 'induction-materials', label: 'Induction Materials', type: 'simple', price: 120 },
      { id: 'induction-food', label: 'Induction Food', type: 'simple', price: 180 },
    ],
  },
  {
    id: 'convocation',
    label: 'Convocation',
    icon: 'trophy-outline',
    addOns: [
      { id: 'convocation-decor', label: 'Convocation Decorations', type: 'simple', price: 500 },
      { id: 'convocation-photography', label: 'Convocation Photography', type: 'simple', price: 1500 },
    ],
  },
  {
    id: 'graduation-felicitation',
    label: 'Graduation Felicitation',
    icon: 'school-outline',
    addOns: [
      { id: 'graduation-decor', label: 'Graduation Decorations', type: 'simple', price: 400 },
      { id: 'graduation-cake', label: 'Graduation Cake', type: 'simple', price: 300 },
    ],
  },
  {
    id: 'debate',
    label: 'Debate',
    icon: 'chatbubbles-outline',
    addOns: [
      { id: 'debate-setup', label: 'Debate Setup', type: 'simple', price: 200 },
      { id: 'debate-materials', label: 'Debate Materials', type: 'simple', price: 100 },
    ],
  },
  {
    id: 'alumni-meet',
    label: 'Alumni Meet',
    icon: 'people-outline',
    addOns: [
      { id: 'alumni-decor', label: 'Alumni Decorations', type: 'simple', price: 300 },
      { id: 'alumni-food', label: 'Alumni Food', type: 'simple', price: 400 },
    ],
  },

  // Health, Wellness & Sports
  {
    id: 'medical-camp',
    label: 'Medical Camp (Screening)',
    icon: 'medical-outline',
    addOns: [
      { id: 'medical-equipment', label: 'Medical Equipment', type: 'simple', price: 500 },
      { id: 'medical-supplies', label: 'Medical Supplies', type: 'simple', price: 200 },
    ],
  },
  {
    id: 'blood-donation',
    label: 'Blood Donation Drive',
    icon: 'heart-outline',
    addOns: [
      { id: 'donation-setup', label: 'Donation Setup', type: 'simple', price: 300 },
      { id: 'donation-materials', label: 'Donation Materials', type: 'simple', price: 150 },
    ],
  },
  {
    id: 'yoga',
    label: 'Yoga',
    icon: 'leaf-outline',
    addOns: [
      { id: 'yoga-mats', label: 'Yoga Mats', type: 'simple', price: 200 },
      { id: 'yoga-props', label: 'Yoga Props', type: 'simple', price: 100 },
    ],
  },
  {
    id: 'zumba',
    label: 'Zumba',
    icon: 'musical-notes-outline',
    addOns: [
      { id: 'zumba-equipment', label: 'Zumba Equipment', type: 'simple', price: 300 },
      { id: 'zumba-music', label: 'Zumba Music Setup', type: 'simple', price: 200 },
    ],
  },
  {
    id: 'fitness-workshop',
    label: 'Fitness Workshop',
    icon: 'fitness-outline',
    addOns: [
      { id: 'fitness-equipment', label: 'Fitness Equipment', type: 'simple', price: 400 },
      { id: 'fitness-materials', label: 'Fitness Materials', type: 'simple', price: 150 },
    ],
  },
  {
    id: 'esports',
    label: 'E-Sports',
    icon: 'game-controller-outline',
    addOns: [
      { id: 'gaming-setup', label: 'Gaming Setup', type: 'detailed', image: 'gaming-setup.jpg', subItems: [
        { id: 'gaming-pcs', label: 'Gaming PCs', price: 1000, image: 'gaming-pcs.jpg' },
        { id: 'gaming-consoles', label: 'Gaming Consoles', price: 800, image: 'gaming-consoles.jpg' },
        { id: 'gaming-chairs', label: 'Gaming Chairs', price: 500, image: 'gaming-chairs.jpg' }
      ]},
      { id: 'esports-tournament', label: 'E-Sports Tournament', type: 'simple', price: 2000 },
    ],
  },
  {
    id: 'team-jersey-launch',
    label: 'Team Jersey Launch',
    icon: 'shirt-outline',
    addOns: [
      { id: 'jersey-display', label: 'Jersey Display', type: 'simple', price: 300 },
      { id: 'launch-photography', label: 'Launch Photography', type: 'simple', price: 1000 },
    ],
  },
  {
    id: 'fans-meet-greet',
    label: 'Fans Meet & Greet',
    icon: 'star-outline',
    addOns: [
      { id: 'meet-greet-setup', label: 'Meet & Greet Setup', type: 'simple', price: 400 },
      { id: 'autograph-materials', label: 'Autograph Materials', type: 'simple', price: 100 },
    ],
  },
  {
    id: 'trophy-tour',
    label: 'Trophy Tour / Felicitation',
    icon: 'trophy-outline',
    addOns: [
      { id: 'trophy-display', label: 'Trophy Display', type: 'simple', price: 200 },
      { id: 'felicitation-decor', label: 'Felicitation Decorations', type: 'simple', price: 300 },
    ],
  },
  {
    id: 'sports-team-felicitations',
    label: 'Felicitations for Sports Team',
    icon: 'medal-outline',
    addOns: [
      { id: 'felicitation-setup', label: 'Felicitation Setup', type: 'simple', price: 400 },
      { id: 'team-photography', label: 'Team Photography', type: 'simple', price: 1200 },
    ],
  }
];

const DEFAULT_STAGE_OPTIONS: StageOption[] = [
  { id: 'stage-default', label: 'Default Stage', image: require('@/assets/images/decoration_default.png'), price: 0 },
  { id: 'stage-floral', label: 'Floral Theme', image: require('@/assets/images/decoration3.png'), price: 900 },
  { id: 'stage-premium', label: 'Premium', image: require('@/assets/images/decoration3.png'), price: 1000 },
  { id: 'stage-legacy', label: 'Classic', image: require('@/assets/images/decoration1.jpg'), price: 700 },
];

// No static banner sizes; manage via Admin and fetch dynamically

// Hall base pricing (editable)
const HALL_HOURLY_RATE = 1000; // INR per hour

export default function GrantHallPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isAuthenticated, user, login } = useAuth();
  const MINUTE_INTERVAL = 30;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  
  // Check if in edit mode
  const isEditMode = params?.editMode === 'true';
  const bookingId = params?.bookingId as string | undefined;
  const [existingBooking, setExistingBooking] = useState<any | null>(null);
  const [editBookingLoading, setEditBookingLoading] = useState(isEditMode);
  
  // State for API data
  const [spaceData, setSpaceData] = useState<SpaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authFirst, setAuthFirst] = useState('');
  const [authLast, setAuthLast] = useState('');
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundData, setRefundData] = useState<{ bookingId: number; refundAmount: number; newTotal: number; originalPaid: number } | null>(null);
  const [authMobile, setAuthMobile] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirm, setAuthConfirm] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Fetch space data from API
  useEffect(() => {
    const fetchSpaceData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${CONFIG.API_BASE_URL}/venues/spaces/1`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSpaceData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching space data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch space data');
  // Use default data as fallback (except dynamic-only fields like stage/banner)
        setSpaceData({
          id: 1,
          name: 'Grant Hall',
          description: 'Customize your event with add-ons and decorations',
          capacity: 500,
          price_per_hour: 1000,
          image_url: '/assets/images/function.jpg',
          features: DEFAULT_HALL_FEATURES,
          event_types: [{
            id: 'social-life',
            label: 'ðŸŽ‰ Social & Life Events',
            icon: 'gift-outline',
            category: 'social',
            subcategories: DEFAULT_EVENT_TYPES
          }],
          // No static stage/banner fallback; keep empty to reflect API failure
          stage_options: [],
          banner_sizes: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSpaceData();
  }, []);

  // Load existing booking data if in edit mode
  useEffect(() => {
    if (!isEditMode || !bookingId) {
      setEditBookingLoading(false);
      return;
    }

    let cancelled = false;

    const loadBookingData = async () => {
      try {
        setEditBookingLoading(true);
        const token = await AsyncStorage.getItem('auth.token');
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${CONFIG.API_BASE_URL}/bookings/${bookingId}`, { headers });
        if (!response.ok) throw new Error('Failed to load booking');
        const booking = await response.json();
        
        if (!cancelled) {
          setExistingBooking(booking);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading booking:', err);
          Alert.alert('Error', 'Failed to load booking details');
        }
      } finally {
        if (!cancelled) {
          setEditBookingLoading(false);
        }
      }
    };

    loadBookingData();
    
    return () => { 
      cancelled = true; 
    };
  }, [isEditMode, bookingId]);


  // Use API data or fallback to defaults
  // Ensure hallFeatures is always an array and normalize paid field
  const hallFeatures: HallFeature[] = useMemo(() => {
    if (!spaceData?.features) return DEFAULT_HALL_FEATURES;
    
    // Helper to map feature object to HallFeature type
    const mapFeature = (f: any): HallFeature => ({
      id: f.id || f.label?.toLowerCase().replace(/\s+/g, '-'),
      label: f.label,
      image: typeof f.image === 'string' ? { uri: f.image } : f.image,
      icon: f.icon,
      paid: f.paid || false,
      pricing_type: f.pricing_type,
      base_price: f.base_price,
      additional_hour_price: f.additional_hour_price,
      item_price: f.item_price,
      details: f.details,
      addon_trigger: f.addon_trigger,
    });
    
    // Handle dict format with hall_features key
    if (typeof spaceData.features === 'object' && !Array.isArray(spaceData.features)) {
      if (Array.isArray(spaceData.features.hall_features)) {
        return spaceData.features.hall_features.map(mapFeature);
      }
    }
    
    // Handle array format directly
    if (Array.isArray(spaceData.features)) {
      return spaceData.features.map(mapFeature);
    }
    
    return DEFAULT_HALL_FEATURES;
  }, [spaceData]);

  // Extract top banners: force static banner image from assets as requested
  const topBanners = useMemo(() => {
    return ['/assets/images/function.jpg'];
  }, []);
  
  // Always use the 5 main categories - don't depend on API data
  // MEMOIZED to prevent recreation on every render and infinite loops
  const eventTypes: EventCategory[] = useMemo(() => [
    {
      id: 'social-life',
      label: '🎉 Social & Life Events',
      icon: 'gift-outline',
      category: 'social',
      subcategories: [
        DEFAULT_EVENT_TYPES[0],  // Birthday Party
        DEFAULT_EVENT_TYPES[1],  // Engagement / Ring Ceremony
        DEFAULT_EVENT_TYPES[2],  // Wedding Functions
        DEFAULT_EVENT_TYPES[3],  // Bridal Shower
        DEFAULT_EVENT_TYPES[4],  // Groom-to-be Party (Bachelor's)
        DEFAULT_EVENT_TYPES[5],  // Baby Shower
        DEFAULT_EVENT_TYPES[6],  // Gender Reveal
        DEFAULT_EVENT_TYPES[7],  // Naming Ceremony
        DEFAULT_EVENT_TYPES[8],  // Housewarming Party
        DEFAULT_EVENT_TYPES[9],  // Anniversary Party
        DEFAULT_EVENT_TYPES[10], // Family Reunion
        DEFAULT_EVENT_TYPES[11], // Retirement Party
        DEFAULT_EVENT_TYPES[12], // Farewell
        DEFAULT_EVENT_TYPES[13], // Memorial Celebration of Life
        DEFAULT_EVENT_TYPES[14], // Social Welfare Programs
      ].filter(Boolean)
    },
    {
      id: 'cultural-religious',
      label: '🕉️ Cultural & Religious Programs',
      icon: 'library-outline',
      category: 'cultural',
      subcategories: [
        DEFAULT_EVENT_TYPES[15], // Prayer Meeting
        DEFAULT_EVENT_TYPES[16], // Festive Gathering â€" Diwali
        DEFAULT_EVENT_TYPES[17], // Festive Gathering â€" Eid
        DEFAULT_EVENT_TYPES[18], // Christmas Celebration
        DEFAULT_EVENT_TYPES[19], // Onam Celebration
        DEFAULT_EVENT_TYPES[20], // New Year Celebration
      ].filter(Boolean)
    },
    {
      id: 'corporate-business',
      label: '💼 Corporate & Business Events',
      icon: 'business-outline',
      category: 'business',
      subcategories: [
        DEFAULT_EVENT_TYPES[21], // Board Meeting
        DEFAULT_EVENT_TYPES[22], // Business Meeting
        DEFAULT_EVENT_TYPES[23], // Conference
        DEFAULT_EVENT_TYPES[24], // Seminar
        DEFAULT_EVENT_TYPES[25], // Workshop
        DEFAULT_EVENT_TYPES[26], // Training
        DEFAULT_EVENT_TYPES[27], // Product Launch
        DEFAULT_EVENT_TYPES[28], // Club Meeting
      ].filter(Boolean)
    },
    {
      id: 'educational-academic',
      label: '📚 Educational & Academic',
      icon: 'school-outline',
      category: 'educational',
      subcategories: [
        DEFAULT_EVENT_TYPES[29], // Academic Seminar
        DEFAULT_EVENT_TYPES[30], // Orientation
        DEFAULT_EVENT_TYPES[31], // Induction Program
        DEFAULT_EVENT_TYPES[32], // Convocation
        DEFAULT_EVENT_TYPES[33], // Graduation Felicitation
        DEFAULT_EVENT_TYPES[34], // Debate
        DEFAULT_EVENT_TYPES[35], // Alumni Meet
      ].filter(Boolean)
    },
    {
      id: 'health-wellness-sports',
      label: '💪 Health, Wellness & Sports',
      icon: 'fitness-outline',
      category: 'health',
      subcategories: [
        DEFAULT_EVENT_TYPES[36], // Medical Camp (Screening)
        DEFAULT_EVENT_TYPES[37], // Blood Donation Drive
        DEFAULT_EVENT_TYPES[38], // Yoga
        DEFAULT_EVENT_TYPES[39], // Zumba
        DEFAULT_EVENT_TYPES[40], // Fitness Workshop
        DEFAULT_EVENT_TYPES[41], // E-Sports
        DEFAULT_EVENT_TYPES[42], // Team Jersey Launch
        DEFAULT_EVENT_TYPES[43], // Fans Meet & Greet
        DEFAULT_EVENT_TYPES[44], // Trophy Tour / Felicitation
        DEFAULT_EVENT_TYPES[45], // Felicitations for Sports Team
      ].filter(Boolean)
    }
  ], []);
  
  // Use ONLY dynamic stage options from API; no static fallback
  const stageOptions = spaceData?.stage_options || [];
  const bannerSizes = spaceData?.banner_sizes || [];
  const hallHourlyRate = spaceData?.price_per_hour || 1000;
  const hallDescription = spaceData?.description || 'Customize your event with add-ons and decorations';
  const hallImageUrl = spaceData?.image_url || '/assets/images/function.jpg';

  // Responsive flag for large screens (reuse existing screenWidth)
  const isLargeScreen = screenWidth >= 1024;

  // Resolve dynamic stage option images; no static fallbacks
  const stageOptionsWithImages = useMemo(() => {
    const API_ORIGIN = CONFIG.API_BASE_URL.replace(/\/?api\/?$/, '');
    return (stageOptions || []).map(opt => {
      const img = (opt as any).image as any;
      let resolved: any = undefined;
      if (typeof img === 'number') {
        resolved = img; // already a require()
      } else if (typeof img === 'string') {
        if (img.startsWith('/static')) {
          resolved = { uri: `${API_ORIGIN}${img}` };
        } else if (/^https?:\/\//i.test(img)) {
          resolved = { uri: img };
        }
      } else if (img && typeof img === 'object' && typeof (img as any).uri === 'string') {
        const u = (img as any).uri as string;
        resolved = u.startsWith('/static') ? { uri: `${API_ORIGIN}${u}` } : { uri: u };
      }
      return { ...opt, image: resolved } as StageOption;
    });
  }, [stageOptions]);

  // If current selection isn't in the dynamic list, select the first available
  useEffect(() => {
    if (!stageOptions?.length) return;
    if (!stageOptions.find(s => s.id === selectedStage)) {
      setSelectedStage(stageOptions[0].id);
    }
  }, [stageOptions]);

  const [selectedEventCategory, setSelectedEventCategory] = useState<EventCategory | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);
  const [showMainCategoryDropdown, setShowMainCategoryDropdown] = useState(false);
  const selectBoxRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const timeSlotSelectorRef = useRef<View>(null);
  const [dateTimeValidationError, setDateTimeValidationError] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });
  const [activeEvent, setActiveEvent] = useState(() => {
    if (eventTypes && eventTypes.length > 0) {
      // If the first category has subcategories, use the first subcategory ID
      if (eventTypes[0].subcategories && eventTypes[0].subcategories.length > 0) {
        return eventTypes[0].subcategories[0].id;
      }
      // Otherwise use the category ID
      return eventTypes[0].id;
    }
    return 'birthday-party'; // Use a more specific default
  });

  // Update activeEvent when eventTypes changes
  useEffect(() => {
    // No default selection - user must choose a category
  }, [eventTypes]);
  
  // State for dynamically fetched items for each subcategory
  const [fetchedItemsBySubcategory, setFetchedItemsBySubcategory] = useState<Record<string, AddOn[]>>({});
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
  
  // Fetch items for a subcategory from API
  const fetchItemsForSubcategory = async (mainCategoryId: string, subcategoryId: string, silent = false) => {
    const cacheKey = `${mainCategoryId}-${subcategoryId}`;
    
    // If already loading, don't start another request
    if (loadingItems[cacheKey]) {
      return;
    }
    
    if (!silent) {
      setLoadingItems(prev => ({ ...prev, [cacheKey]: true }));
    }
    
    try {
      const response = await ItemsAPI.list({
        main_category: mainCategoryId,
        subcategory: subcategoryId,
        space_id: 1, // Grant Hall space ID
      });
      
      // Convert API items to AddOn format with all fields like cake items
      const addOns: AddOn[] = response.items.map((item) => ({
        id: `item-${item.id}`,
        label: item.name,
        type: 'simple' as const,
        price: item.price,
        image: item.image_url || undefined,
        description: item.description || undefined,
        item_status: item.item_status || undefined,
        preparation_time_minutes: item.preparation_time_minutes || undefined,
        // Media will be loaded by ItemMediaViewer component
      }));
      
      setFetchedItemsBySubcategory(prev => ({
        ...prev,
        [cacheKey]: addOns,
      }));
      
      return addOns;
    } catch (error) {
      console.error(`Error fetching items for ${mainCategoryId}/${subcategoryId}:`, error);
      // On error, set empty array so we don't keep trying
      setFetchedItemsBySubcategory(prev => ({
        ...prev,
        [cacheKey]: [],
      }));
      return [];
    } finally {
      if (!silent) {
        setLoadingItems(prev => {
          const next = { ...prev };
          delete next[cacheKey];
          return next;
        });
      }
    }
  };
  
  // Fetch items when subcategory is selected
  useEffect(() => {
    if (selectedEventCategory && selectedEventType) {
      fetchItemsForSubcategory(selectedEventCategory.id, selectedEventType.id);
    }
  }, [selectedEventCategory?.id, selectedEventType?.id]);
  
  // Detailed add-on modal state
  const [addOnModalVisible, setAddOnModalVisible] = useState(false);
  const [selectedAddOn, setSelectedAddOn] = useState<AddOn | null>(null);
  const [selectedSubItems, setSelectedSubItems] = useState<Record<string, { subItem: AddOnSubItem; quantity: number }>>({});
  // Store selected items per subcategory: subcategoryId -> { itemId -> boolean }
  const [selectedAddOnsBySubcategory, setSelectedAddOnsBySubcategory] = useState<Record<string, Record<string, boolean>>>({});
  // Store quantities per subcategory: subcategoryId -> { itemId -> quantity }
  const [quantitiesBySubcategory, setQuantitiesBySubcategory] = useState<Record<string, Record<string, number>>>({});
  
  // Modal for displaying items (similar to AddonsSection)
  const [itemsModalVisible, setItemsModalVisible] = useState(false);
  const [imagePopup, setImagePopup] = useState<{ visible: boolean; image: string; title: string }>({
    visible: false,
    image: '',
    title: ''
  });
  const [itemsWithMedia, setItemsWithMedia] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  
  // Helper to resolve image sources (supports /assets and /static paths)
  const resolveImageSource = (img?: string): any => {
    if (!img) return null;
    if (img.startsWith('http')) return { uri: img };
    const API_ORIGIN = CONFIG.API_BASE_URL.replace(/\/?api\/?$/, '');
    // Frontend bundled assets (served by the app origin)
    if (img.startsWith('/assets/')) {
      return { uri: `${CONFIG.APP_BASE_URL}${img}` };
    }
    if (img.startsWith('/static')) return { uri: `${API_ORIGIN}${img}` };
    // Relative backend-managed paths
    return { uri: `${API_ORIGIN}/static/${img}` };
  };
  
  const placeholderImg = require('@/assets/images/partial-react-logo.png');
  
  // Helper: Calculate time until event and check if item can be prepared in time
  const canItemBeDelivered = (prepTimeMinutes: number): { canDeliver: boolean; timeUntilEvent: number; timeNeeded: number } => {
    const eventDateTime = dateObj && timeObj ? (() => {
      const combined = new Date(dateObj);
      combined.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
      return combined;
    })() : undefined;
    
    if (!eventDateTime || prepTimeMinutes <= 0) {
      return { canDeliver: true, timeUntilEvent: 0, timeNeeded: prepTimeMinutes };
    }
    
    const now = new Date();
    const timeUntilEventMs = eventDateTime.getTime() - now.getTime();
    const timeUntilEventMinutes = Math.floor(timeUntilEventMs / (1000 * 60));
    
    return {
      canDeliver: timeUntilEventMinutes >= prepTimeMinutes,
      timeUntilEvent: timeUntilEventMinutes,
      timeNeeded: prepTimeMinutes,
    };
  };
  
  // Get current subcategory ID for item operations
  const getCurrentSubcategoryId = (): string | null => {
    if (!selectedEventCategory || !selectedEventType) return null;
    return `${selectedEventCategory.id}-${selectedEventType.id}`;
  };

  // Quantity management for items (per subcategory)
  const incItemQty = (itemId: string) => {
    const subcategoryId = getCurrentSubcategoryId();
    if (!subcategoryId) return;
    
    setQuantitiesBySubcategory((prev) => {
      const subcategoryQuantities = prev[subcategoryId] || {};
      return {
        ...prev,
        [subcategoryId]: {
          ...subcategoryQuantities,
          [itemId]: (subcategoryQuantities[itemId] || 0) + 1,
        },
      };
    });
    setSelectedAddOnsBySubcategory((prev) => {
      const subcategorySelected = prev[subcategoryId] || {};
      return {
        ...prev,
        [subcategoryId]: {
          ...subcategorySelected,
          [itemId]: true,
        },
      };
    });
  };
  
  const decItemQty = (itemId: string) => {
    const subcategoryId = getCurrentSubcategoryId();
    if (!subcategoryId) return;
    
    setQuantitiesBySubcategory((prev) => {
      const subcategoryQuantities = prev[subcategoryId] || {};
      const newQty = Math.max(0, (subcategoryQuantities[itemId] || 1) - 1);
      if (newQty === 0) {
        const next = { ...subcategoryQuantities };
        delete next[itemId];
        setSelectedAddOnsBySubcategory((prevSelected) => {
          const subcategorySelected = prevSelected[subcategoryId] || {};
          const nextSelected = { ...subcategorySelected };
          delete nextSelected[itemId];
          return {
            ...prevSelected,
            [subcategoryId]: nextSelected,
          };
        });
        return {
          ...prev,
          [subcategoryId]: next,
        };
      }
      return {
        ...prev,
        [subcategoryId]: {
          ...subcategoryQuantities,
          [itemId]: newQty,
        },
      };
    });
  };
  
  const updateItemQty = (itemId: string, value: string) => {
    const subcategoryId = getCurrentSubcategoryId();
    if (!subcategoryId) return;
    
    const numValue = parseInt(value) || 0;
    if (numValue <= 0) {
      setQuantitiesBySubcategory((prev) => {
        const subcategoryQuantities = prev[subcategoryId] || {};
        const next = { ...subcategoryQuantities };
        delete next[itemId];
        return {
          ...prev,
          [subcategoryId]: next,
        };
      });
      setSelectedAddOnsBySubcategory((prev) => {
        const subcategorySelected = prev[subcategoryId] || {};
        const next = { ...subcategorySelected };
        delete next[itemId];
        return {
          ...prev,
          [subcategoryId]: next,
        };
      });
    } else {
      setQuantitiesBySubcategory((prev) => {
        const subcategoryQuantities = prev[subcategoryId] || {};
        return {
          ...prev,
          [subcategoryId]: {
            ...subcategoryQuantities,
            [itemId]: numValue,
          },
        };
      });
      setSelectedAddOnsBySubcategory((prev) => {
        const subcategorySelected = prev[subcategoryId] || {};
        return {
          ...prev,
          [subcategoryId]: {
            ...subcategorySelected,
            [itemId]: true,
          },
        };
      });
    }
  };
  const [selectedStage, setSelectedStage] = useState<string>('stage-default');
  const [selectedPaidFeatures, setSelectedPaidFeatures] = useState<Set<string>>(new Set());
  const [expandedPaidFeatures, setExpandedPaidFeatures] = useState<Set<string>>(new Set());
  const [paidFeatureQuantities, setPaidFeatureQuantities] = useState<Record<string, number>>({});
  const [showAllPaidFeatures, setShowAllPaidFeatures] = useState(false);
  const [bannerSize, setBannerSize] = useState<string>('');
  const [bannerImages, setBannerImages] = useState<Record<string, string>>({});
  
  // Helper to create full URL for banner images
  const getFullImageUrl = (url: string | undefined) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${CONFIG.API_BASE_URL}${url}`;
  };

  const bannerDisplayData = useMemo(() => {
    return (spaceData?.banner_sizes || []).map(b => ({
      ...b,
      image_url: getFullImageUrl(b.image_url)
    }));
  }, [spaceData]);

  const [dateObj, setDateObj] = useState<Date | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [timeObj, setTimeObj] = useState<Date | null>(null);
  const [showTime, setShowTime] = useState(false);
  const [hours, setHours] = useState<number>(2);
  const [guests, setGuests] = useState<number>(50);
  const [bookingType, setBookingType] = useState<string>('one_day');
  // Transportation state
  // Keep an internal `transportEstimate` state to avoid undefined references in restore/effects.
  // Locations are managed by `TransportationSection` when enabled.
  const [transportLocations, setTransportLocations] = useState<TransportationLocation[]>([]);
  const [transportEstimate, setTransportEstimate] = useState<number>(0);
  
  // Audio recording state (temporary storage)
  const [tempAudioData, setTempAudioData] = useState<{
    audioUri: string;
    duration: number;
    blob?: Blob;
  } | null>(null);
  const hiddenInputRef = useRef<TextInput>(null);
  // Applied add-ons total from AddonsSection
  const [addonsGrandTotal, setAddonsGrandTotal] = useState<number>(0);
  const [addonsDetails, setAddonsDetails] = useState<Array<{ id: string; name: string; category: string; qty: number; unitPrice: number; amount: number; hours_used?: number }>>([]);
  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [triggerAddonModal, setTriggerAddonModal] = useState<'cake' | 'snack' | 'team' | null>(null);
  // Track original booking hours (before clamping) for edit mode messaging
  const [originalBookingHours, setOriginalBookingHours] = useState<number | null>(null);
  // Track initial desired duration (min of original and 6h) to help auto-select after availability loads
  const [initialDesiredDuration, setInitialDesiredDuration] = useState<number | undefined>(undefined);
  // Track original start/end for display
  const [originalStart, setOriginalStart] = useState<Date | null>(null);
  const [originalEnd, setOriginalEnd] = useState<Date | null>(null);
  // Payment amounts
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  // Offer discount
  const [offerDiscount, setOfferDiscount] = useState<number>(0);
  const [appliedOffer, setAppliedOffer] = useState<any | null>(null);
  // Discount animation
  const [showDiscountAnimation, setShowDiscountAnimation] = useState(false);
  const [discountAnimPosition, setDiscountAnimPosition] = useState({ x: 0, y: 0 });
  const [discountAnimAmount, setDiscountAnimAmount] = useState(0);
  const discountAnimX = useRef(new Animated.Value(0)).current;
  const discountAnimY = useRef(new Animated.Value(0)).current;
  const discountAnimOpacity = useRef(new Animated.Value(1)).current;
  const discountAnimScale = useRef(new Animated.Value(1)).current;
  const totalBarRef = useRef<View>(null);

  // Clamp hours based on pricing overrides or default to 6
  useEffect(() => {
    if (hours == null) return;
    if (hours < 1) {
      setHours(1);
      return;
    }
    
    // Determine max hours from pricing overrides
    let maxHours = 6; // Default to 6 hours
    if ((spaceData as any)?.pricing_overrides) {
      const overrides = (spaceData as any).pricing_overrides;
      // Check both duration and hour schemas
      const overrideHours: number[] = [];
      if (overrides.duration) {
        Object.keys(overrides.duration).forEach(key => {
          if (key.endsWith('h')) {
            const h = parseInt(key.slice(0, -1), 10);
            if (!isNaN(h) && h > 0) overrideHours.push(h);
          }
        });
      }
      if (overrides.hour) {
        Object.keys(overrides.hour).forEach(key => {
          const h = parseInt(key, 10);
          if (!isNaN(h) && h > 0) overrideHours.push(h);
        });
      }
      if (overrideHours.length > 0) {
        maxHours = Math.max(...overrideHours, 6);
      }
    }
    
    // Only clamp if hours exceeds max from pricing overrides
    if (hours > maxHours) {
      setHours(maxHours);
    }
  }, [hours, spaceData]);

  // Pre-fill form with existing booking data when in edit mode
  useEffect(() => {
    if (!existingBooking || !isEditMode) return;

    try {
      // Pre-fill basic fields
      if (existingBooking.start_datetime) {
        setDateObj(new Date(existingBooking.start_datetime));
        setTimeObj(new Date(existingBooking.start_datetime));
      }
      
      // Calculate hours from start and end datetime
      if (existingBooking.start_datetime && existingBooking.end_datetime) {
        const start = new Date(existingBooking.start_datetime);
        const end = new Date(existingBooking.end_datetime);
        const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        if (diffHours > 0) {
          const rounded = Math.round(diffHours);
          setOriginalBookingHours(rounded);
          
          // Determine max hours from pricing overrides
          let maxHours = 6; // Default to 6 hours
          if ((spaceData as any)?.pricing_overrides) {
            const overrides = (spaceData as any).pricing_overrides;
            const overrideHours: number[] = [];
            if (overrides.duration) {
              Object.keys(overrides.duration).forEach(key => {
                if (key.endsWith('h')) {
                  const h = parseInt(key.slice(0, -1), 10);
                  if (!isNaN(h) && h > 0) overrideHours.push(h);
                }
              });
            }
            if (overrides.hour) {
              Object.keys(overrides.hour).forEach(key => {
                const h = parseInt(key, 10);
                if (!isNaN(h) && h > 0) overrideHours.push(h);
              });
            }
            if (overrideHours.length > 0) {
              maxHours = Math.max(...overrideHours, 6);
            }
          }
          
          // Clamp to max from pricing overrides or original booking hours, whichever is smaller
          const clamped = Math.min(Math.max(1, rounded), maxHours);
          setHours(clamped);
          setInitialDesiredDuration(clamped);
          setOriginalStart(start);
          setOriginalEnd(end);
          if (rounded !== clamped) {
          }
        }
      }

      // Pre-fill items/add-ons if available
      const bookingItems = existingBooking.items || existingBooking.booking_items || [];
      if (bookingItems && bookingItems.length > 0) {
        // 1) Map stage/banner/transport from item_name as fallbacks when explicit fields missing
        try {
          for (const it of bookingItems) {
            const name: string = String(it.item_name || '').toLowerCase();
            // Stage: e.g., "Stage: Premium"
            if (name.startsWith('stage')) {
              const label = name.split(':')[1]?.trim();
              const match = stageOptionsWithImages.find(s => s.label.toLowerCase().includes(label || ''));
              if (match) setSelectedStage(match.id);
            }
            // Banner: e.g., "Banner: Medium 4*8" – try exact label match or substring
            if (name.startsWith('banner')) {
              const rest = name.split(':')[1]?.trim();
              // Try exact label match on bannerSizes
              const byExact = (spaceData?.banner_sizes || []).find((b: any) => String(b.label || '').toLowerCase() === (rest || ''));
              if (byExact) setBannerSize(String(byExact.id));
              else {
                const bySub = (spaceData?.banner_sizes || []).find((b: any) => String(b.label || '').toLowerCase().includes(rest || ''));
                if (bySub) setBannerSize(String(bySub.id));
              }
            }
            // Paid Features: Match by item name to paid features
            const paidFeature = hallFeatures.find(f => 
              f.paid === true && 
              (f.label.toLowerCase() === name || 
               name.includes(f.label.toLowerCase()) ||
               f.label.toLowerCase().includes(name))
            );
            if (paidFeature) {
              setSelectedPaidFeatures(prev => new Set([...prev, paidFeature.id || paidFeature.label]));
            }
            
            // Transport presence: toggle transport modal state values (basic prefill)
            if (name.includes('transport')) {
              // Transport locations are now handled in TransportationSection component
              // No need to prefill here
            }
          }
        } catch (e) {
        }

        // 2) Legacy simple add-ons (checkbox + qty) for active event types
        const newSelectedAddOns: Record<string, boolean> = {};
        const newQuantities: Record<string, number> = {};
        const newSubItems: Record<string, { subItem: AddOnSubItem; quantity: number }> = {};
        
        bookingItems.forEach((item: any) => {
          const idKey = String(item.item_id);
          newSelectedAddOns[idKey] = true;
          if (item.quantity) {
            newQuantities[idKey] = item.quantity;
          }
          
          // Try to match with detailed addon subitems
          for (const category of eventTypes) {
            for (const subcategory of category.subcategories) {
              for (const addon of subcategory.addOns) {
                if (addon.type === 'detailed' && addon.subItems) {
                  for (const subItem of addon.subItems) {
                    if (subItem.id === idKey || subItem.label.toLowerCase().includes(item.item_name?.toLowerCase() || '')) {
                      newSubItems[subItem.id] = {
                        subItem: subItem,
                        quantity: item.quantity || 1,
                      };
                      newSelectedAddOns[addon.id] = true;
                      break;
                    }
                  }
                }
              }
            }
          }
        });
        
        // Store in subcategory-specific storage
        if (selectedEventCategory && selectedEventType) {
          const cacheKey = `${selectedEventCategory.id}-${selectedEventType.id}`;
          setSelectedAddOnsBySubcategory(prev => ({
            ...prev,
            [cacheKey]: newSelectedAddOns,
          }));
          setQuantitiesBySubcategory(prev => ({
            ...prev,
            [cacheKey]: { ...(prev[cacheKey] || {}), ...newQuantities },
          }));
        }
        setSelectedSubItems(prev => ({ ...prev, ...newSubItems }));
      }
      
      // Prefill paid amount - will be set again later with more comprehensive check
      
      // Prefill guests
      if (existingBooking.attendees) {
        setGuests(existingBooking.attendees);
      }
      
      // Prefill event type if available
      if (existingBooking.event_type && eventTypes.length > 0) {
        for (const category of eventTypes) {
          for (const subcategory of category.subcategories) {
            if (subcategory.id === existingBooking.event_type || 
                subcategory.label.toLowerCase().includes(existingBooking.event_type.toLowerCase())) {
              setSelectedEventCategory(category);
              setSelectedEventType(subcategory);
              setActiveEvent(subcategory.id);
              break;
            }
          }
        }
      }

      // Prefill stage selection if present (explicit fields)
      try {
        const stageId = (existingBooking.selected_stage && (existingBooking.selected_stage.id || existingBooking.selected_stage.stage_id)) || existingBooking.stage_id || null;
        if (stageId) {
          setSelectedStage(String(stageId));
        } else if (existingBooking.selected_stage && existingBooking.selected_stage.label && stageOptions?.length) {
          const match = stageOptions.find(s => s.label === existingBooking.selected_stage.label);
          if (match) setSelectedStage(match.id);
        }
      } catch {}

      // Prefill banner selection and image if present (explicit fields)
      try {
        const bId = (existingBooking.selected_banner && (existingBooking.selected_banner.id || existingBooking.selected_banner.banner_id)) || existingBooking.banner_id || existingBooking.banner_size_id || '';
        if (bId) setBannerSize(String(bId));
        const imgUrl = existingBooking.banner_image_url || existingBooking.banner_url || existingBooking.uploaded_banner_url || (existingBooking.selected_banner && existingBooking.selected_banner.image_url) || null;
        if (imgUrl && bId) {
          setBannerImages(prev => ({ ...prev, [String(bId)]: imgUrl }));
        }
      } catch {}

      // Prefill payment amounts (advance/full)
      const num = (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };
      setAdvanceAmount(num((existingBooking as any).advance_amount || (existingBooking as any).advance_payment || (existingBooking as any).advance || 0));
      // Always set paid amount - check multiple possible fields
      const paidAmtValue = num(
        existingBooking.paid_amount || 
        existingBooking.amount_paid || 
        existingBooking.total_paid || 
        (existingBooking as any).paid_amount || 
        (existingBooking as any).amount_paid || 
        (existingBooking as any).total_paid || 
        0
      );
      setPaidAmount(paidAmtValue);

      // Prefill booking type
      if ((existingBooking as any).booking_type) {
        setBookingType(String((existingBooking as any).booking_type));
      }

      // Prefill event type (map booking.event_type label to one of our subcategory IDs)
      try {
        const label = String(existingBooking.event_type || '').toLowerCase();
        if (label) {
          let matchedId: string | null = null;
          let matchedCat: EventCategory | null = null;
          let matchedSub: EventType | null = null;
          for (const cat of eventTypes) {
            if (cat.subcategories && cat.subcategories.length) {
              for (const sub of cat.subcategories) {
                if (sub.label.toLowerCase() === label) { matchedId = sub.id; matchedCat = cat; matchedSub = sub; break; }
                // tolerate variants like "birthday party" mapping to id that contains birthday
                if (!matchedId && label.includes('birthday') && sub.label.toLowerCase().includes('birthday')) { matchedId = sub.id; matchedCat = cat; matchedSub = sub; }
              }
            }
            if (matchedId) break;
          }
          if (matchedId) {
            setActiveEvent(matchedId);
            if (matchedCat) setSelectedEventCategory(matchedCat);
            if (matchedSub) setSelectedEventType(matchedSub);
          }
        }
      } catch {}
      
    } catch (err) {
      console.error('Error pre-filling booking data:', err);
    }
  }, [existingBooking, eventTypes, hallFeatures]);

  // Build optional AddonsSection prefill items from booking items
  const addonsPrefill = useMemo(() => {
    const picks: Array<{ category: 'cake' | 'snack' | 'team'; id?: string; name?: string; qty?: number; unitPrice?: number }> = [];
    const items = (existingBooking?.items || existingBooking?.booking_items || []) as any[];
    const detectCategory = (nm: string): 'cake' | 'snack' | 'team' | null => {
      const n = nm.toLowerCase();
      if (/(\bcake\b)/.test(n)) return 'cake';
      if (/(team|perform|orchestra|band|ganamela|dj)/.test(n)) return 'team';
      if (/(food|snack|beverage|lunch|dinner|breakfast|menu|catering|biryani|juice)/.test(n)) return 'snack';
      return null;
    };
    for (const it of items) {
      const cat = detectCategory(String(it.item_name || ''));
      if (!cat) continue;
      picks.push({ category: cat, id: String(it.item_id), name: String(it.item_name || ''), qty: Number(it.quantity || 1), unitPrice: Number(it.unit_price || 0) });
    }
    return picks;
  }, [existingBooking]);

  const addOnsForActive = useMemo(() => {
    // If we have a selected category and subcategory, fetch items from API
    if (selectedEventCategory && selectedEventType) {
      const cacheKey = `${selectedEventCategory.id}-${selectedEventType.id}`;
      const fetchedAddOns = fetchedItemsBySubcategory[cacheKey];
      
      // Return fetched items if available, otherwise return empty array (items are loading)
      if (fetchedAddOns) {
        return fetchedAddOns;
      }
      
      // If loading, return empty array (will update when fetch completes)
      return [];
    }
    
    // Fallback: if no category/subcategory selected, return empty
    return [];
  }, [selectedEventCategory, selectedEventType, fetchedItemsBySubcategory]);

  // Calculate total for detailed add-ons
  const detailedAddOnsTotal = useMemo(() => {
    return Object.values(selectedSubItems).reduce((sum, { subItem, quantity }) => {
      return sum + (subItem.price * quantity);
    }, 0);
  }, [selectedSubItems]);

  const addOnsTotal = useMemo(() => {
    const cacheKey = selectedEventCategory && selectedEventType ? `${selectedEventCategory.id}-${selectedEventType.id}` : '';
    const currentQuantities = cacheKey ? (quantitiesBySubcategory[cacheKey] || {}) : {};
    const currentSelected = cacheKey ? (selectedAddOnsBySubcategory[cacheKey] || {}) : {};
    const simpleTotal = addOnsForActive.reduce((sum: number, a: AddOn) => {
      if (a.type === 'simple' && currentSelected[a.id] && a.price) {
        return sum + (a.price * Math.max(1, (currentQuantities[a.id] || 1)));
      }
      return sum;
    }, 0);
    return simpleTotal + detailedAddOnsTotal;
  }, [addOnsForActive, quantitiesBySubcategory, selectedAddOnsBySubcategory, detailedAddOnsTotal, selectedEventCategory, selectedEventType]);

  // Functions for detailed add-on modal
  const openAddOnModal = (addOn: AddOn) => {
    setSelectedAddOn(addOn);
    setAddOnModalVisible(true);
  };

  const closeAddOnModal = () => {
    setAddOnModalVisible(false);
    setSelectedAddOn(null);
  };

  const addSubItem = (subItem: AddOnSubItem) => {
    setSelectedSubItems(prev => ({
      ...prev,
      [subItem.id]: {
        subItem,
        quantity: (prev[subItem.id]?.quantity || 0) + 1
      }
    }));
  };

  const removeSubItem = (subItemId: string) => {
    setSelectedSubItems(prev => {
      const newItems = { ...prev };
      if (newItems[subItemId]) {
        newItems[subItemId].quantity -= 1;
        if (newItems[subItemId].quantity <= 0) {
          delete newItems[subItemId];
        }
      }
      return newItems;
    });
  };

  const updateSubItemQuantity = (subItemId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedSubItems(prev => {
        const newItems = { ...prev };
        delete newItems[subItemId];
        return newItems;
      });
    } else {
      setSelectedSubItems(prev => ({
        ...prev,
        [subItemId]: {
          ...prev[subItemId],
          quantity
        }
      }));
    }
  };
  const stagePrice = useMemo(() => {
    const stage = stageOptions.find(s => s.id === selectedStage);
    return stage ? stage.price : (stageOptions[0]?.price || 0);
  }, [selectedStage, stageOptions]);
  const bannerPrice = useMemo(() => bannerSizes.find(b => b.id === bannerSize)?.price || 0, [bannerSize, bannerSizes]);
  
  // Calculate hall price with duration override support
  const hallSubtotal = useMemo(() => {
    if (!hours) return 0;
    
    // Check for pricing overrides for this specific duration
    const pricingOverrides = (spaceData as any)?.pricing_overrides;
    if (pricingOverrides) {
      // New schema: duration map like {'1h': price}
      if (pricingOverrides.duration) {
        const durationKey = `${hours}h`;
        const overridePrice = pricingOverrides.duration[durationKey];
        if (overridePrice !== undefined && overridePrice !== null) {
          return Math.max(0, Math.round(overridePrice));
        }
      }
      // Alternate schema: hour map like {1: price}
      if (pricingOverrides.hour) {
        const overridePrice2 = pricingOverrides.hour[hours];
        if (overridePrice2 !== undefined && overridePrice2 !== null) {
          return Math.max(0, Math.round(overridePrice2));
        }
      }
    }
    
    // Fallback to standard hourly rate calculation
    return Math.max(0, Math.round(hours * hallHourlyRate));
  }, [hours, hallHourlyRate, spaceData]);
  
  /**
   * Search for location using Google Places API (through backend proxy)
   */
  // Transport location search, vehicle selection, and cost calculation are now handled in TransportationSection component

  // Price rules: discount by event type, weekend surcharge
  const isWeekend = useMemo(() => {
    if (!dateObj) return false;
    const d = dateObj.getDay();
    return d === 0 || d === 6;
  }, [dateObj]);
  // Calculate paid features total
  const paidFeaturesTotal = useMemo(() => {
    return Array.from(selectedPaidFeatures).reduce((sum, featureId) => {
      const feature = hallFeatures.find(f => (f.id || f.label) === featureId && f.paid === true);
      if (!feature) return sum;
      
      const pricingType = feature.pricing_type || (feature.item_price ? 'item' : 'hour');
      
      if (pricingType === 'item') {
        // Item-based: price × quantity
        const itemPrice = feature.item_price || 0;
        const quantity = paidFeatureQuantities[featureId] || 1;
        return sum + (itemPrice * quantity);
      } else {
        // Hour-based: base_price + (hours - 1) * additional_hour_price
        const basePrice = feature.base_price || 0;
        const additionalHourPrice = feature.additional_hour_price || 0;
        const featureTotal = basePrice + (hours > 1 ? (hours - 1) * additionalHourPrice : 0);
        return sum + featureTotal;
      }
    }, 0);
  }, [selectedPaidFeatures, hallFeatures, hours, paidFeatureQuantities]);
  
  // Calculate total transport cost from all locations
  // Transport is currently disabled; keep this at 0 to avoid runtime errors.
  const totalTransportCost = 0;
  
  // Ensure transportEstimat6e is always in sync with actual transport locations
  useEffect(() => {
    if (totalTransportCost !== transportEstimate) {
      setTransportEstimate(totalTransportCost);
    }
  }, [totalTransportCost, transportEstimate]);
  
  // Transport temporarily disabled; exclude transportEstimate from base
  const base = hallSubtotal + addOnsTotal + stagePrice + bannerPrice + addonsGrandTotal + paidFeaturesTotal;
  const eventDiscountPct = activeEvent === 'birthday' ? 0.05 : activeEvent === 'babyshower' ? 0.03 : 0;
  const weekendSurchargePct = isWeekend ? 0.05 : 0;
  const discounted = Math.max(0, Math.round(base * (1 - eventDiscountPct)));
  const totalBeforeOffer = Math.max(0, Math.round(discounted * (1 + weekendSurchargePct)));
  // Apply offer discount
  const total = Math.max(0, totalBeforeOffer - offerDiscount);

  // Animated total value
  const totalAnim = useRef(new Animated.Value(total)).current;
  const [displayTotal, setDisplayTotal] = useState(total);
  useEffect(() => {
    const from = displayTotal;
    const to = total;
    const animVal = new Animated.Value(0);
    const duration = 300;
    const interp = animVal.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
    const id = animVal.addListener(({ value }) => setDisplayTotal(Math.round(from + (to - from) * value)));
    Animated.timing(animVal, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
      animVal.removeListener(id);
      setDisplayTotal(to);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);
  
  // Reset offer discount when duration changes
  useEffect(() => {
    if (hours === 0) {
      setOfferDiscount(0);
      setAppliedOffer(null);
    }
  }, [hours]);

  // Animate discount from popup to footer
  const animateDiscountToFooter = (discountAmount: number, startPosition: { x: number; y: number }) => {
    if (!totalBarRef.current) return;

    setDiscountAnimAmount(discountAmount);
    setDiscountAnimPosition(startPosition);
    setShowDiscountAnimation(true);

    // Get footer position
    totalBarRef.current.measure((fx, fy, width, height, px, py) => {
      const endX = px + width - 100; // Position near the total value
      const endY = py + height / 2;

      // Reset animation values
      discountAnimX.setValue(startPosition.x);
      discountAnimY.setValue(startPosition.y);
      discountAnimOpacity.setValue(1);
      discountAnimScale.setValue(1);

      // Animate to footer
      Animated.parallel([
        Animated.timing(discountAnimX, {
          toValue: endX,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(discountAnimY, {
          toValue: endY,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(discountAnimScale, {
            toValue: 1.2,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(discountAnimScale, {
            toValue: 0.8,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(discountAnimScale, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(600),
          Animated.timing(discountAnimOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setShowDiscountAnimation(false);
      });
    });
  };
  
  // Location search and distance calculation are now handled in TransportationSection component

  // Helper function to construct full image URL
  const getImageUrl = (imageUrl?: string | null): string | null => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    // Frontend-bundled assets (served by the web app origin)
    if (imageUrl.startsWith('/assets/')) {
      return `${CONFIG.APP_BASE_URL}${imageUrl}`;
    }
    // Prefer static origin for uploaded assets
    if (imageUrl.startsWith('/static/')) {
      return `${CONFIG.STATIC_BASE_URL}${imageUrl}`;
    }
    // Handle root-relative program-images paths (e.g., "/program-images/..")
    if (imageUrl.startsWith('/program-images/')) {
      return `${CONFIG.STATIC_BASE_URL}/static${imageUrl}`;
    }
    // Common relative paths returned by backend (e.g., "program-images/..", "gallery/...", "item-media/...")
    if (
      imageUrl.startsWith('program-images/') ||
      imageUrl.startsWith('gallery/') ||
      imageUrl.startsWith('item-media/')
    ) {
      return `${CONFIG.STATIC_BASE_URL}/static/${imageUrl}`;
    }
    // Any other root-relative path – treat as static asset by default
    if (imageUrl.startsWith('/')) {
      return `${CONFIG.STATIC_BASE_URL}${imageUrl}`;
    }
    // Bare relative – assume it's under static
    return `${CONFIG.STATIC_BASE_URL}/static/${imageUrl}`;
  };

  const pickBanner = async () => {
    if (!bannerSize) {
      Alert.alert('Banner Size', 'Please select a banner size first.');
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission', 'We need access to your photos to upload a banner.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setBannerImages(prev => ({
          ...prev,
          [bannerSize]: res.assets[0].uri
        }));
      }
    } catch (e) {
      Alert.alert('Banner', 'Unable to select image');
    }
  };

  // Removed availability status; user can freely select date and time

  // Persist selection
  useEffect(() => {
    const persist = async () => {
      try {
        const payload = {
          activeEvent,
          selectedAddOnsBySubcategory,
          quantitiesBySubcategory,
          selectedStage,
          bannerSize,
          bannerImages,
          date: dateObj ? dateObj.toISOString() : null,
          time: timeObj ? timeObj.toISOString() : null,
          hours,
          guests,
          transport: {
            locations: transportLocations,
            estimate: transportEstimate ?? 0,
          },
        };
        await AsyncStorage.setItem('grantHallSelection', JSON.stringify(payload));
      } catch {}
    };
    persist();
  }, [activeEvent, selectedAddOnsBySubcategory, quantitiesBySubcategory, selectedStage, bannerSize, bannerImages, dateObj, timeObj, hours, guests, transportLocations, transportEstimate]);


  // Restore selection on mount
  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem('grantHallSelection');
        if (s) {
          const obj = JSON.parse(s);
          setActiveEvent(obj.activeEvent || eventTypes[0]?.id || 'birthday');
          setSelectedAddOnsBySubcategory(obj.selectedAddOnsBySubcategory || {});
          setQuantitiesBySubcategory(obj.quantitiesBySubcategory || {});
          setSelectedStage(obj.selectedStage || 'stage-default');
          // Ensure banner size remains valid after removing 8x4 option
          const restoredBanner: string | undefined = obj.bannerSize;
          const validBanners = ['banner-s', 'banner-m'];
          setBannerSize(restoredBanner && validBanners.includes(restoredBanner) ? restoredBanner : '');
          setBannerImages(obj.bannerImages || {});
          if (obj.date) setDateObj(new Date(obj.date));
          if (obj.time) setTimeObj(new Date(obj.time));
          if (obj.hours) setHours(obj.hours);
          if (obj.guests) setGuests(obj.guests);
          if (obj.transport) {
            if (obj.transport.locations) setTransportLocations(obj.transport.locations);
            if (obj.transport.estimate) setTransportEstimate(obj.transport.estimate);
          }
        }
      } catch {}
    })();
  }, []);

  // Helpers: round time to 30-min steps and apply a 30-min minimum delay for same-day selections
  const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const roundToInterval = (d: Date, stepMin: number) => {
    const m = d.getMinutes();
    const rounded = Math.round(m / stepMin) * stepMin;
    const copy = new Date(d);
    if (rounded === 60) {
      copy.setHours(copy.getHours() + 1, 0, 0, 0);
    } else {
      copy.setMinutes(rounded, 0, 0);
    }
    return copy;
  };
  const enforceMinDelay = (d: Date) => {
    const now = new Date();
    const min = new Date(now.getTime() + MINUTE_INTERVAL * 60000);
    if (dateObj && !isSameDay(dateObj, now)) return d; // future date, no min check
    return d < min ? roundToInterval(min, MINUTE_INTERVAL) : d;
  };

  // Show loading state
  if (loading || editBookingLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <ThemedText style={styles.loadingText}>
            {editBookingLoading ? 'Loading booking details...' : 'Loading Grant Hall data...'}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Show error state
  if (error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <ThemedText style={styles.errorTitle}>Error Loading Data</ThemedText>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={() => window.location.reload()}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
  <ScrollView ref={scrollViewRef} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
        {/* Title */}
        <View style={{ padding: 16 }}>
          <View style={styles.titleRow}>
            <ThemedText style={styles.title}>Grant Hall Booking</ThemedText>
            <View style={styles.rateBadge}>
              <Ionicons name="cash-outline" size={14} color="#065F46" />
              <ThemedText style={styles.rateBadgeText}>INR {hallHourlyRate.toFixed(0)}/hour</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.subtitle}>{hallDescription}</ThemedText>
          
          {/* Top Banner Images - Carousel/Slider */}
          {topBanners.length > 0 && (
            <View style={[styles.topBannerContainer, { maxWidth: screenWidth - 32 }]}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.topBannerScroll}
                pagingEnabled
              >
                {topBanners.map((bannerUrl, index) => {
                  const fullUrl = getImageUrl(bannerUrl);
                  if (!fullUrl) return null;
                  return (
                    <View key={index} style={[styles.topBannerItem, { 
                      width: Math.min(screenWidth - 32, 600),
                      maxWidth: '100%'
                    }]}>
                      <RNImage
                        source={{ uri: fullUrl }}
                        style={styles.topBannerImage}
                        resizeMode="cover"
                        onError={(e) => {
                          console.error('Image load error:', e.nativeEvent.error);
                        }}
                        onLoad={() => {
                        }}
                      />
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
          
          {/* Hall image below subtitle (fallback if no top banners) */}
          {topBanners.length === 0 && (
            <View style={styles.hallImageCard}>
              <RNImage
                source={hallImageUrl.startsWith('/') ? require('@/assets/images/function.jpg') : { uri: hallImageUrl }}
                style={styles.hallImage}
                resizeMode="cover"
              />
            </View>
          )}
        </View>

        {/* Specialties */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Hall Specialties</ThemedText>
          
          {/* Free Features */}
          {hallFeatures.filter(f => f.paid !== true).length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <View style={styles.featureGrid}>
                {hallFeatures.filter(f => f.paid !== true).map((f) => (
                  <View key={f.id || f.label} style={styles.featureItem}>
                    {f.image ? (
                      <View style={styles.featureImgWrap}>
                        <ExpoImage 
                          source={typeof f.image === 'string' ? { uri: f.image } : f.image} 
                          style={styles.featureImg} 
                          contentFit="cover" 
                        />
                      </View>
                    ) : (
                      <Ionicons name={(f.icon || 'checkbox-outline') as any} size={18} color="#10B981" />
                    )}
                    <ThemedText style={{ fontWeight: '400', color: '#111827' }}>{f.label}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Paid Features */}
          {hallFeatures.filter(f => f.paid === true).length > 0 && (() => {
            const paidFeatures = hallFeatures.filter(f => f.paid === true);
            const displayedFeatures = showAllPaidFeatures ? paidFeatures : paidFeatures.slice(0, 4);
            const hasMoreFeatures = paidFeatures.length > 4;
            
            return (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Ionicons name="cash-outline" size={18} color="#F59E0B" />
                  <ThemedText style={{ fontSize: 16, fontWeight: '700', color: '#F59E0B' }}>Paid Features</ThemedText>
                </View>
                <View style={{ 
                  flexDirection: 'row', 
                  flexWrap: 'wrap', 
                  gap: 12,
                } as any}>
                  {displayedFeatures.map((f) => {
                  const featureId = f.id || f.label;
                  const hasPricing = f.base_price || f.additional_hour_price || f.item_price;
                  const hasAddonTrigger = f.addon_trigger && !hasPricing; // Only show button if no pricing
                  const isSelected = selectedPaidFeatures.has(featureId);
                  const pricingType = f.pricing_type || (f.item_price ? 'item' : 'hour');
                  const hasDetails = f.base_price || f.additional_hour_price || f.item_price || f.details;
                  const isExpanded = expandedPaidFeatures.has(featureId);
                  const quantity = paidFeatureQuantities[featureId] || 1;
                  
                  return (
                    <View 
                      key={featureId} 
                      style={{ 
                        flex: 1,
                        minWidth: Platform.OS === 'web' ? 280 : '48%',
                        maxWidth: Platform.OS === 'web' ? 400 : '48%',
                        flexDirection: 'column', 
                        padding: 14, 
                        backgroundColor: hasAddonTrigger ? '#F9FAFB' : (isSelected ? '#FEF3C7' : '#F9FAFB'), 
                        borderRadius: 10, 
                        borderWidth: 2, 
                        borderColor: hasAddonTrigger ? '#E5E7EB' : (isSelected ? '#FCD34D' : '#E5E7EB'),
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                      }}
                    >
                      {/* Header - Show checkbox only if pricing exists, otherwise show button */}
                      {hasPricing ? (
                        <>
                          <TouchableOpacity
                            onPress={() => {
                            setSelectedPaidFeatures(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(featureId)) {
                                newSet.delete(featureId);
                                // Reset quantity when deselected
                                setPaidFeatureQuantities(prev => {
                                  const newQty = { ...prev };
                                  delete newQty[featureId];
                                  return newQty;
                                });
                              } else {
                                newSet.add(featureId);
                                // Set default quantity for item-based features
                                if (pricingType === 'item') {
                                  setPaidFeatureQuantities(prev => ({ ...prev, [featureId]: 1 }));
                                }
                              }
                              return newSet;
                            });
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
                          activeOpacity={0.7}
                        >
                          <View style={{ 
                            width: 24, 
                            height: 24, 
                            borderWidth: 2, 
                            borderColor: isSelected ? '#F59E0B' : '#D1D5DB', 
                            borderRadius: 6, 
                            backgroundColor: isSelected ? '#F59E0B' : '#fff', 
                            justifyContent: 'center', 
                            alignItems: 'center',
                            marginRight: 12,
                          }}>
                            {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                          </View>
                      {f.image ? (
                            <View style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: '#E5E7EB', marginRight: 12 }}>
                          <ExpoImage 
                            source={typeof f.image === 'string' ? { uri: f.image } : f.image} 
                                style={{ width: '100%', height: '100%' }} 
                            contentFit="cover" 
                          />
                        </View>
                      ) : (
                            <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#FFF9E6', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 2, borderColor: '#FCD34D' }}>
                              <Ionicons name={(f.icon || 'cash-outline') as any} size={22} color="#F59E0B" />
                            </View>
                          )}
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <ThemedText style={{ fontWeight: '700', color: '#111827', fontSize: 15, flex: 1 }}>{f.label}</ThemedText>
                            {hasDetails && (
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  setExpandedPaidFeatures(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(featureId)) {
                                      newSet.delete(featureId);
                                    } else {
                                      newSet.add(featureId);
                                    }
                                    return newSet;
                                  });
                                }}
                                style={{ marginLeft: 8 }}
                                activeOpacity={0.7}
                              >
                                <ThemedText style={{ fontSize: 12, color: '#2563EB', fontWeight: '500', textDecorationLine: 'underline' }}>
                                  {isExpanded ? 'Hide Details' : 'View Details'}
                                </ThemedText>
                              </TouchableOpacity>
                            )}
                          </View>
                        </TouchableOpacity>
                        
                        {/* Quantity Selector for Item-Based Features */}
                        {isSelected && pricingType === 'item' && (
                          <View style={{ marginBottom: 10, padding: 10, backgroundColor: '#FFF9E6', borderRadius: 8, borderWidth: 1, borderColor: '#FCD34D' }}>
                            <ThemedText style={{ fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 6 }}>Quantity:</ThemedText>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                              <TouchableOpacity
                                onPress={() => {
                                  if (quantity > 1) {
                                    setPaidFeatureQuantities(prev => ({ ...prev, [featureId]: quantity - 1 }));
                                  }
                                }}
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 8,
                                  backgroundColor: quantity > 1 ? '#EF4444' : '#D1D5DB',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}
                                disabled={quantity <= 1}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="remove" size={20} color="#fff" />
                              </TouchableOpacity>
                              <View style={{ flex: 1, alignItems: 'center' }}>
                                <ThemedText style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>{quantity}</ThemedText>
                                <ThemedText style={{ fontSize: 11, color: '#6B7280' }}>
                                  × ₹{f.item_price?.toFixed(2) || 0} = ₹{((f.item_price || 0) * quantity).toFixed(2)}
                                </ThemedText>
                              </View>
                              <TouchableOpacity
                                onPress={() => {
                                  setPaidFeatureQuantities(prev => ({ ...prev, [featureId]: quantity + 1 }));
                                }}
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 8,
                                  backgroundColor: '#10B981',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="add" size={20} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                        </>
                      ) : (
                        /* No pricing - Show button directly on card */
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                          {f.image ? (
                            <View style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: '#E5E7EB', marginRight: 12 }}>
                              <ExpoImage 
                                source={typeof f.image === 'string' ? { uri: f.image } : f.image} 
                                style={{ width: '100%', height: '100%' }} 
                                contentFit="cover" 
                              />
                            </View>
                          ) : (
                            <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#FFF9E6', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 2, borderColor: '#FCD34D' }}>
                              <Ionicons name={(f.icon || 'cash-outline') as any} size={22} color="#F59E0B" />
                            </View>
                          )}
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <ThemedText style={{ fontWeight: '700', color: '#111827', fontSize: 15, flex: 1 }}>{f.label}</ThemedText>
                            {hasAddonTrigger && (
                              <TouchableOpacity
                                onPress={() => {
                                  setTriggerAddonModal(f.addon_trigger!);
                                  setTimeout(() => setTriggerAddonModal(null), 100);
                                }}
                                style={{ marginLeft: 8 }}
                                activeOpacity={0.7}
                              >
                                <ThemedText style={{ fontSize: 12, color: '#10B981', fontWeight: '500', textDecorationLine: 'underline', textTransform: 'capitalize' }}>
                                  Add {f.addon_trigger}
                                </ThemedText>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}
                      
                      {/* Expanded Details - Only show if hasPricing and expanded */}
                      {hasPricing && isExpanded && hasDetails && (
                        <View style={{ marginBottom: 12, padding: 12, backgroundColor: '#FFF9E6', borderRadius: 8, borderWidth: 1, borderColor: '#FCD34D' }}>
                          {/* Pricing Information - Only show if pricing exists */}
                          {(f.base_price || f.additional_hour_price || f.item_price) && (
                            <>
                              <View style={{ marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#FCD34D' }}>
                                <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 4 }}>Pricing Type:</ThemedText>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Ionicons 
                                    name={pricingType === 'hour' ? 'time-outline' : 'cube-outline'} 
                                    size={16} 
                                    color="#F59E0B" 
                                  />
                                  <ThemedText style={{ fontSize: 14, color: '#111827', fontWeight: '700' }}>
                                    {pricingType === 'hour' ? 'Hour-Based Pricing' : 'Item-Based Pricing'}
                                  </ThemedText>
                                </View>
                              </View>
                              
                              {pricingType === 'hour' ? (
                                <>
                                  {f.base_price && (
                                    <View style={{ marginBottom: 10 }}>
                                      <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 4 }}>Base Price:</ThemedText>
                                      <ThemedText style={{ fontSize: 16, color: '#111827', fontWeight: '800' }}>₹{f.base_price.toFixed(2)}</ThemedText>
                                    </View>
                                  )}
                                  {f.additional_hour_price && (
                                    <View style={{ marginBottom: 10 }}>
                                      <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 4 }}>Additional Hour:</ThemedText>
                                      <ThemedText style={{ fontSize: 16, color: '#111827', fontWeight: '800' }}>₹{f.additional_hour_price.toFixed(2)}</ThemedText>
                                    </View>
                                  )}
                                </>
                              ) : (
                                <>
                                  {f.item_price && (
                                    <View style={{ marginBottom: 10 }}>
                                      <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 4 }}>Price Per Item:</ThemedText>
                                      <ThemedText style={{ fontSize: 16, color: '#111827', fontWeight: '800' }}>₹{f.item_price.toFixed(2)}</ThemedText>
                                    </View>
                                  )}
                                </>
                              )}
                            </>
                          )}
                          
                          {f.details && (
                            <View style={{ marginTop: (f.base_price || f.additional_hour_price || f.item_price) ? 10 : 0, paddingTop: (f.base_price || f.additional_hour_price || f.item_price) ? 10 : 0, borderTopWidth: (f.base_price || f.additional_hour_price || f.item_price) ? 1 : 0, borderTopColor: '#FCD34D' }}>
                              <ThemedText style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 4 }}>Details:</ThemedText>
                              <ThemedText style={{ fontSize: 13, color: '#111827', lineHeight: 18 }}>{f.details}</ThemedText>
                            </View>
                          )}

                        </View>
                      )}
                    </View>
                  );
                  })}
                </View>
                
                {/* View More / View Less Button */}
                {hasMoreFeatures && (
                  <TouchableOpacity
                    onPress={() => setShowAllPaidFeatures(!showAllPaidFeatures)}
                    style={{
                      marginTop: 16,
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      backgroundColor: '#FEF3C7',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#FCD34D',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={{ fontSize: 14, fontWeight: '700', color: '#F59E0B' }}>
                      {showAllPaidFeatures ? 'View Less' : `View More (${paidFeatures.length - 4} more)`}
                    </ThemedText>
                    <Ionicons 
                      name={showAllPaidFeatures ? "chevron-up" : "chevron-down"} 
                      size={18} 
                      color="#F59E0B" 
                    />
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}
        </View>
        

        {/* Date & Time selection with time slot API */}
        {isEditMode && originalBookingHours != null ? (
          <View style={{
            marginHorizontal: 16,
            marginTop: 8,
            backgroundColor: '#F0F9FF',
            borderColor: '#BAE6FD',
            borderWidth: 1,
            padding: 10,
            borderRadius: 8
          }}>
            <ThemedText style={{ color: '#0C4A6E', fontSize: 12 }}>
              Original: {originalStart ? originalStart.toDateString() : ''}, {originalStart ? originalStart.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}) : ''}
              {originalEnd ? ` – ${originalEnd.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}` : ''}
              {`  (${originalBookingHours}h)`}
            </ThemedText>
            {originalBookingHours > 6 && (
              <ThemedText style={{ color: '#0C4A6E', fontSize: 12, marginTop: 4 }}>
                This editor supports up to 6 hours per booking. We set duration to {hours}h based on available consecutive slots. You can change date/time or duration below.
              </ThemedText>
            )}
          </View>
        ) : null}
        <View ref={timeSlotSelectorRef} style={{ paddingHorizontal: 16 }}>
          {dateTimeValidationError && (
            <View style={{
              backgroundColor: '#FEF2F2',
              borderColor: '#FCA5A5',
              borderWidth: 1,
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="alert-circle" size={20} color="#DC2626" />
                <ThemedText style={{ color: '#DC2626', fontSize: 14, fontWeight: '600' }}>
                  {dateTimeValidationError}
                </ThemedText>
              </View>
            </View>
          )}
          <TimeSlotSelector
            spaceId={1} // Grant Hall space ID
            selectedDate={dateObj}
            selectedTime={timeObj}
            duration={hours}
            onDateChange={(date) => {
              setDateObj(date);
              if (dateTimeValidationError) setDateTimeValidationError(null);
            }}
            onTimeChange={(time) => {
              setTimeObj(time);
              if (dateTimeValidationError) setDateTimeValidationError(null);
            }}
            onDurationChange={(duration) => {
              setHours(duration);
              if (dateTimeValidationError) setDateTimeValidationError(null);
            }}
            compact={true}
            hourlyRate={hallHourlyRate}
            durationOverrides={(spaceData as any)?.pricing_overrides?.duration ?? (spaceData as any)?.pricing_overrides?.hour}
            excludeBookingId={isEditMode && existingBooking ? existingBooking.id : undefined}
            suppressFetch={isEditMode && editBookingLoading}
            initialDesiredDuration={initialDesiredDuration}
          />
        </View>

        {/* Optional Add-ons Summary by Category */}
        {addonsDetails && addonsDetails.filter(it => it.qty > 0).length > 0 && (
          <View style={[styles.card, { marginTop: 8 }]}> 
            <ThemedText style={[styles.cardTitle, { fontSize: 14 }]}>Selected Optional Add-ons</ThemedText>
            {(() => {
              // Filter out items with qty 0 and group by category
              const validItems = addonsDetails.filter(it => it.qty > 0);
              const byCat: Record<string, number> = {};
              validItems.forEach(it => { byCat[it.category] = (byCat[it.category] || 0) + (it.qty || 1); });
              
              // Also show individual items for better visibility
              return (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {Object.entries(byCat).map(([cat, count]) => (
                      <View key={cat} style={{ backgroundColor: '#ECFEFF', borderColor: '#A5F3FC', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
                        <ThemedText style={{ color: '#155E75', fontSize: 12 }}>{cat}: {count}</ThemedText>
                      </View>
                    ))}
                  </View>
                  {/* Individual items list */}
                  {validItems.length > 0 && (
                    <View style={{ marginTop: 8, gap: 6 }}>
                      {validItems.map((it) => (
                        <View key={`${it.category}-${it.id}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, backgroundColor: '#F9FAFB', borderRadius: 6 }}>
                          <ThemedText style={{ fontSize: 13, color: '#111827', flex: 1 }}>{it.name}</ThemedText>
                          <ThemedText style={{ fontSize: 12, color: '#6B7280', marginRight: 8 }}>Qty: {it.qty}</ThemedText>
                          <ThemedText style={{ fontSize: 13, fontWeight: '600', color: '#059669' }}>₹{it.amount}</ThemedText>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
        )}

        {/* Payment Summary (Edit mode) */}
        {isEditMode && (
          <View style={[styles.card, { marginTop: 8 }]}> 
            <ThemedText style={[styles.cardTitle, { fontSize: 16 }]}>Payment Summary</ThemedText>
            {(() => {
              const paid = Math.max(paidAmount, advanceAmount);
              const delta = Math.round((displayTotal || 0) - paid);
              const isRefund = delta < 0;
              return (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ color: '#374151' }}>New Total</ThemedText>
                    <ThemedText style={{ color: '#111827', fontWeight: '700' }}>INR {Math.max(0, Math.round(displayTotal || 0)).toFixed(0)}</ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ color: '#374151' }}>{paidAmount ? 'Paid' : advanceAmount ? 'Advance Paid' : 'Paid'}</ThemedText>
                    <ThemedText style={{ color: '#059669', fontWeight: '700' }}>INR {Math.max(0, Math.round(paid)).toFixed(0)}</ThemedText>
                  </View>
                  <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText style={{ color: isRefund ? '#1F2937' : '#1F2937' }}>{isRefund ? 'Refund' : 'To Pay'}</ThemedText>
                    <ThemedText style={{ color: isRefund ? '#DC2626' : '#059669', fontWeight: '800' }}>
                      INR {Math.abs(delta).toFixed(0)}
                    </ThemedText>
                  </View>
                </View>
              );
            })()}
          </View>
        )}

        {/* Guests selector */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Guest Count</ThemedText>
            <View style={styles.counterBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="people-outline" size={16} color="#065F46" />
                <ThemedText style={styles.counterLabel}>Guests</ThemedText>
              </View>
              <View style={styles.counterRow}>
                <TouchableOpacity onPress={() => setGuests((g) => Math.max(1, g - 5))}>
                  <Ionicons name="remove-circle-outline" size={24} color="#9CA3AF" />
                </TouchableOpacity>
                <ThemedText style={styles.counterValue}>{guests}</ThemedText>
                <TouchableOpacity onPress={() => setGuests((g) => Math.min(500, g + 5))}>
                  <Ionicons name="add-circle" size={24} color="#10B981" />
                </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Event Type Categories */}
        <View style={[styles.card, styles.eventCard]}>
          
          {/* Main Categories Section */}
          <View style={{ marginBottom: 16 }}>
            <ThemedText style={[styles.cardTitle, { fontSize: 16, marginBottom: 12, color: '#374151' }]}>
              Select Main Event Category
            </ThemedText>
            
            {/* Main Category Select Box */}
            <View style={styles.mainSelectBoxContainer}>
              <TouchableOpacity
                ref={selectBoxRef as any}
                style={styles.mainSelectBox}
                onPress={() => {
                  if (showMainCategoryDropdown) {
                    setShowMainCategoryDropdown(false);
                    return;
                  }
                  // Measure trigger position on screen and open dropdown in a modal overlay
                  selectBoxRef.current?.measureInWindow((x, y, width, height) => {
                    setDropdownPos({ x, y: y + height + 4, width, height });
                    setShowMainCategoryDropdown(true);
                  });
                }}
              >
                <ThemedText style={[styles.mainSelectBoxText, !selectedEventCategory && styles.mainSelectBoxPlaceholder]}>
                  {selectedEventCategory ? selectedEventCategory.label : 'Choose a category...'}
                </ThemedText>
                <Ionicons 
                  name={showMainCategoryDropdown ? 'chevron-up' : 'chevron-down'} 
                  size={16} 
                  color="#6B7280" 
                />
              </TouchableOpacity>
              
              {/* Dropdown rendered in Modal to avoid clipping/stacking issues */}
              {showMainCategoryDropdown && (
                <Modal transparent animationType="fade" visible onRequestClose={() => setShowMainCategoryDropdown(false)}>
                  <TouchableOpacity
                    activeOpacity={1}
                    style={styles.dropdownBackdrop}
                    onPress={() => setShowMainCategoryDropdown(false)}
                  >
                    <View style={{ position: 'absolute', top: dropdownPos.y, left: dropdownPos.x, width: dropdownPos.width }}>
                      <View style={styles.mainDropdown}>
                        <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
                          {eventTypes && eventTypes.length > 0 ? eventTypes.map((category) => (
                            <TouchableOpacity
                              key={category.id}
                              style={[
                                styles.mainDropdownItem,
                                selectedEventCategory?.id === category.id && styles.mainDropdownItemSelected
                              ]}
                              onPress={() => {
                                setSelectedEventCategory(category);
                                setShowMainCategoryDropdown(false);
                                setSelectedEventType(null);
                                // Always set activeEvent to category ID to allow proceeding with main category
                                setActiveEvent(category.id);
                              }}
                            >
                              <View style={styles.mainDropdownItemContent}>
                                <Ionicons name={category.icon as any} size={16} color="#059669" />
                                <ThemedText style={styles.mainDropdownItemText}>
                                  {category.label}
                                </ThemedText>
                              </View>
                            </TouchableOpacity>
                          )) : (
                            <View style={styles.mainDropdownItem}>
                              <ThemedText style={styles.mainDropdownItemText}>No categories available</ThemedText>
                            </View>
                          )}
                        </ScrollView>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Modal>
              )}
            </View>
          </View>


          {/* Subcategories */}
          {selectedEventCategory && selectedEventCategory.subcategories && selectedEventCategory.subcategories.length > 0 && (
            <View style={styles.subcategorySection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
                {selectedEventCategory.subcategories.map((subcategory) => (
                  <TouchableOpacity
                    key={subcategory.id}
                    style={[
                      styles.tabBtn,
                      selectedEventType?.id === subcategory.id ? styles.tabActive : styles.tabInactive,
                    ]}
                    onPress={async () => {
                      setSelectedEventType(subcategory);
                      setActiveEvent(subcategory.id);
                      // Fetch items if not already loaded
                      if (selectedEventCategory) {
                        const cacheKey = `${selectedEventCategory.id}-${subcategory.id}`;
                        // Check if items are already cached
                        const cachedItems = fetchedItemsBySubcategory[cacheKey];
                        if (cachedItems && cachedItems.length > 0) {
                          // Items already loaded, open modal immediately
                          setItemsModalVisible(true);
                        } else {
                          // Fetch items and use the return value
                          const items = await fetchItemsForSubcategory(selectedEventCategory.id, subcategory.id);
                          // Open modal if items were fetched
                          if (items && items.length > 0) {
                            setItemsModalVisible(true);
                          }
                          // If no items, the message will be shown in the UI below
                        }
                      }
                    }}
                  >
                    <View style={[styles.tabIconWrap, selectedEventType?.id === subcategory.id ? styles.tabIconActive : styles.tabIconInactive]}>
                      <Ionicons name={subcategory.icon as any} size={16} color={selectedEventType?.id === subcategory.id ? '#065F46' : '#065F46'} />
                    </View>
                    <ThemedText
                      numberOfLines={2}
                      style={[styles.tabLabel, styles.tabLabelWrap, selectedEventType?.id === subcategory.id ? styles.tabLabelActive : styles.tabLabelInactive]}
                    >
                      {subcategory.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Add-ons for selected event type */}
          {selectedEventType && (
            <View style={{ marginTop: 12 }}>
              <ThemedText style={[styles.cardTitle, { fontSize: 16, marginBottom: 8 }]}>
                Add-ons for {selectedEventType.label}
              </ThemedText>
              {(() => {
                const cacheKey = selectedEventCategory && selectedEventType ? `${selectedEventCategory.id}-${selectedEventType.id}` : '';
                const isLoading = loadingItems[cacheKey];
                const hasItems = addOnsForActive.length > 0;
                // Get quantities for current subcategory only
                const currentQuantities = cacheKey ? (quantitiesBySubcategory[cacheKey] || {}) : {};
                const selectedCount = Object.values(currentQuantities).reduce((sum, qty) => sum + (qty || 0), 0);
                const totalPrice = addOnsForActive.reduce((sum, item) => {
                  const qty = currentQuantities[item.id] || 0;
                  return sum + ((item.price || 0) * qty);
                }, 0);
                
                // Show loading state
                if (isLoading) {
                  return (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#059669" />
                      <ThemedText style={{ color: '#6B7280', marginTop: 8, fontStyle: 'italic' }}>
                        Loading items...
                      </ThemedText>
                    </View>
                  );
                }
                
                // Show summary of selected items
                if (selectedCount > 0) {
                  return (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      backgroundColor: '#F0FDF4',
                      borderRadius: 8,
                      marginTop: 8,
                      borderWidth: 1,
                      borderColor: '#34D399',
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Ionicons name="checkmark-circle" size={20} color="#059669" />
                        <View>
                          <ThemedText style={{ fontSize: 14, fontWeight: '600', color: '#059669' }}>
                            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
                          </ThemedText>
                          <ThemedText style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                            Total: ₹{totalPrice.toFixed(0)}
                          </ThemedText>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          if (selectedEventCategory && selectedEventType) {
                            const cacheKey = `${selectedEventCategory.id}-${selectedEventType.id}`;
                            const items = fetchedItemsBySubcategory[cacheKey];
                            if (items && items.length > 0) {
                              setItemsModalVisible(true);
                            }
                          }
                        }}
                      >
                        <ThemedText style={{ fontSize: 14, fontWeight: '600', color: '#059669' }}>
                          Edit
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  );
                }
                
                // Show message if no items available
                if (!hasItems) {
                  return (
                    <View style={{
                      padding: 16,
                      backgroundColor: '#FEF3C7',
                      borderRadius: 8,
                      marginTop: 8,
                      borderLeftWidth: 4,
                      borderLeftColor: '#F59E0B',
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="information-circle" size={20} color="#92400E" />
                        <ThemedText style={{ color: '#92400E', fontWeight: '600', fontSize: 14 }}>
                          No items available for this subcategory.
                        </ThemedText>
                      </View>
                    </View>
                  );
                }
                
                // If items available but none selected, don't show anything (modal will open on click)
                return null;
              })()}
            </View>
          )}
        </View>

        {/* Optional Add-ons: Cakes, Snacks, Performing Team (after Event Type) */}
        {(() => {
          // Combine date and time to create eventDateTime for prep time validation
          const eventDateTime = dateObj && timeObj ? (() => {
            const combined = new Date(dateObj);
            combined.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
            return combined;
          })() : undefined;
          
          return (
            <AddonsSection 
              spaceId={1}
              prefetch
              prefillItems={addonsPrefill}
              triggerModal={triggerAddonModal}
              eventDateTime={eventDateTime}
              onApplyTotal={(t) => setAddonsGrandTotal(t)} 
              onApplyDetails={(items) => setAddonsDetails(items)} 
            />
          );
        })()}

        {/* Transportation Section (temporarily disabled) */}
        {/**
        <TransportationSection
          locations={transportLocations}
          onChange={(locations) => {
            setTransportLocations(locations);
          }}
          onTotalChange={(total) => {
            setTransportEstimate(total);
          }}
        />
        **/}

        {/* Voice Instructions Section */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="mic" size={24} color="#FF6F00" />
            <ThemedText style={styles.cardTitle}>Voice Instructions (optional)</ThemedText>
          </View>
          <ThemedText style={{ fontSize: 14, color: '#6B7280', marginBottom: 12 }}>
            Have specific requirements? Record a voice note and our team will review it before your event.
          </ThemedText>
          <AudioRecorder 
            bookingId={-1}
            visible={true}
            tempMode={true}
            onRecordingSaved={(audioData) => {
              setTempAudioData(audioData);
            }} 
          />
          {tempAudioData && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 12, backgroundColor: '#D1FAE5', borderRadius: 8, gap: 8 }}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <ThemedText style={{ fontSize: 13, color: '#065F46', flex: 1 }}>
                Voice instructions saved ({Math.floor(tempAudioData.duration / 60)}:{(tempAudioData.duration % 60).toString().padStart(2, '0')})
              </ThemedText>
            </View>
          )}
          <ThemedText style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8, fontStyle: 'italic' }}>
            Note: Voice notes will be linked to your booking after payment confirmation.
          </ThemedText>
        </View>

        {/* Stage decorations */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Stage Decorations</ThemedText>
          <View style={styles.stageGrid}>
            {stageOptionsWithImages.map((s) => {
              const active = s.id === selectedStage;
              return (
                <TouchableOpacity key={s.id} style={[styles.stageItem, active && styles.stageActive]} onPress={() => setSelectedStage(s.id)}>
                  <View style={styles.stageImgWrap}>
                    {s.image ? (
                      <RNImage source={s.image as any} style={styles.stageImg} resizeMode="cover" />
                    ) : (
                      <View style={[styles.stageImg, { backgroundColor: '#eef2f7' }]} />
                    )}
                    {active && (
                      <View style={styles.stageSelectedBadge}>
                        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                      </View>
                    )}
                  </View>
                  <ThemedText style={[styles.stageLabel, active && styles.stageLabelActive]}>{s.label}</ThemedText>
                  <View style={styles.stagePriceContainer}>
                    <ThemedText style={styles.stagePrice}>INR {s.price.toFixed(0)}</ThemedText>
                    {active && (
                      <View style={styles.selectedBadge}>
                        <ThemedText style={styles.selectedBadgeText}>Selected</ThemedText>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Banner options */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Stage Banner</ThemedText>
          <ThemedText style={{ color: '#6b7280' }}>Add a personalized backdrop for your stage.</ThemedText>
          
          <View style={styles.tabsRow}>
            {bannerSizes.map((b) => {
              const active = bannerSize === b.id;
              return (
                <TouchableOpacity key={b.id} style={[styles.tabBtn, active ? styles.tabActive : styles.tabInactive]} onPress={() => setBannerSize(bannerSize === b.id ? '' : b.id)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    {active && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
                    <ThemedText style={[styles.tabLabel, active ? styles.tabLabelActive : styles.tabLabelInactive]}>{b.label} - INR {b.price.toFixed(0)}</ThemedText>
                    {active && (
                      <View style={styles.tabSelectedBadge}>
                        <ThemedText style={styles.tabSelectedBadgeText}>Selected</ThemedText>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          
          {bannerSize ? (
            <View style={{ marginTop: 10 }}>
              {/* Reference image for selected banner size */}
              <View style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
                <ThemedText style={{ fontSize: 12, color: '#6b7280', padding: 8, backgroundColor: '#f9fafb' }}>
                  Reference image for {bannerSizes.find(b => b.id === bannerSize)?.label || 'selected'} size
                </ThemedText>
                {(() => {
                  const selectedBanner = bannerSizes.find(b => b.id === bannerSize);
                  // Try image_url first, then fallback to image field
                  const imageUrl = getImageUrl(selectedBanner?.image_url || selectedBanner?.image);
                  return imageUrl ? (
                    <RNImage
                      source={{ uri: imageUrl }}
                      style={[{ width: '100%', height: 160 }, isLargeScreen && { width: '60%', height: 180, alignSelf: 'center' }]}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={{ width: '100%', height: 160, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }}>
                      <ThemedText style={{ color: '#9ca3af' }}>No reference image available</ThemedText>
                    </View>
                  );
                })()}
              </View>
              
              {/* Preview: Stage with Banner Overlay - Only show when banner is uploaded */}
              {bannerImages[bannerSize] && (
                <View style={styles.bannerPreviewContainer}>
                  <ThemedText style={{ fontSize: 12, color: '#6b7280', padding: 8, backgroundColor: '#f9fafb', marginBottom: 8, borderRadius: 8 }}>
                    Preview: Banner on {selectedStage ? stageOptionsWithImages.find(s => s.id === selectedStage)?.label || 'Selected Stage' : 'Stage'}
                  </ThemedText>
                  <View style={[styles.stageBannerPreview, isLargeScreen && { width: '70%', alignSelf: 'center' }]}>
                    {(() => {
                      const selectedStageOption = stageOptionsWithImages.find(s => s.id === selectedStage);
                      const stageImage = selectedStageOption?.image;
                      const uploadedBanner = bannerImages[bannerSize];
                      
                      return (
                        <View style={[styles.stageBannerComposite, isLargeScreen && { height: 360 }]}>
                          {/* Stage decoration as background */}
                          {stageImage ? (
                            <RNImage 
                              source={stageImage as any} 
                              style={styles.stageBannerBackground} 
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[styles.stageBannerBackground, { backgroundColor: '#eef2f7' }]} />
                          )}
                          
                          {/* Uploaded banner overlaid in center */}
                          {uploadedBanner && (
                            <View style={styles.bannerOverlayContainer}>
                              <RNImage 
                                source={{ uri: uploadedBanner }} 
                                style={[styles.bannerOverlay, isLargeScreen && { width: '60%', height: '35%', maxWidth: 360, maxHeight: 120 }]} 
                                resizeMode="contain"
                              />
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                </View>
              )}
              <TouchableOpacity style={styles.uploadBtn} onPress={pickBanner}>
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <ThemedText style={styles.uploadText}>
                  {bannerImages[bannerSize] ? 'Change' : 'Upload'} Banner Image ({bannerSizes.find(b => b.id === bannerSize)?.label})
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>


      {/* Sticky total */}
      <View ref={totalBarRef} style={styles.totalBar}>
        <ThemedText style={styles.totalLabel}>Total</ThemedText>
        <Animated.View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {offerDiscount > 0 && (
            <Animated.Text
              style={[
                styles.originalTotalValue,
                {
                  opacity: discountAnimOpacity,
                },
              ]}
            >
              INR {totalBeforeOffer.toFixed(0)}
            </Animated.Text>
          )}
        <ThemedText style={styles.totalValue}>INR {displayTotal.toFixed(0)}</ThemedText>
        </Animated.View>
        <TouchableOpacity
          accessibilityLabel="Show price breakdown"
          onPress={() => setBreakdownVisible(true)}
          style={styles.totalToggle}
        >
          <Ionicons name="chevron-up" size={18} color="#059669" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.totalGo}
          onPress={async () => {
            
            // Clear previous validation error
            setDateTimeValidationError(null);
            
            // Helper function to scroll to time slot selector
            const scrollToTimeSlotSelector = () => {
              setTimeout(() => {
                if (timeSlotSelectorRef.current && scrollViewRef.current) {
                  timeSlotSelectorRef.current.measure((fx, fy, width, height, px, py) => {
                    // Scroll to the element position with some offset from top
                    const scrollY = Math.max(0, py - 100);
                    scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
                  });
                }
              }, 150);
            };
            
            // Validate inputs with specific messages FIRST
            if (!dateObj) {
              const errorMsg = 'Please select a date to proceed with your booking.';
              setDateTimeValidationError(errorMsg);
              scrollToTimeSlotSelector();
              return;
            }
            
            if (!timeObj) {
              const errorMsg = 'Please select a time to proceed with your booking.';
              setDateTimeValidationError(errorMsg);
              scrollToTimeSlotSelector();
              return;
            }
            
            if (!hours || hours < 1) {
              const errorMsg = 'Please select a valid duration for your booking.';
              setDateTimeValidationError(errorMsg);
              scrollToTimeSlotSelector();
              return;
            }
            
            // Prepare booking data for payment page
            const startDateTime = new Date(dateObj);
            startDateTime.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
            
            // Calculate end time - properly handles crossing midnight
            const endDateTime = new Date(startDateTime);
            endDateTime.setTime(startDateTime.getTime() + (hours * 60 * 60 * 1000)); // Add hours in milliseconds to handle midnight crossing
            
            // Get the event type label for display
            const getEventTypeLabel = () => {
              if (selectedEventType?.label) {
                return selectedEventType.label;
              }
              
              // If main category is selected but no subcategory, use main category label
              if (selectedEventCategory && !selectedEventType) {
                return selectedEventCategory.label;
              }
              
              for (const category of eventTypes) {
                if (category.subcategories) {
                  const subcategory = category.subcategories.find(sub => sub.id === activeEvent);
                  if (subcategory) {
                    return subcategory.label;
                  }
                }
                if (category.id === activeEvent) {
                  return category.label;
                }
              }
              return activeEvent || selectedEventCategory?.label || 'Event';
            };

            const eventTypeLabel = getEventTypeLabel();
            
            let bannerImageUrl: string | null = null;
            const currentBannerUri = bannerSize ? bannerImages[bannerSize] : null;
            if (currentBannerUri && currentBannerUri.trim()) {
              try {
                const formData = new FormData();
                const response = await fetch(currentBannerUri);
                if (!response.ok) {
                  throw new Error(`Failed to fetch banner image: ${response.status}`);
                }
                const blob = await response.blob();
                formData.append('file', blob, 'banner.jpg');
                
                const uploadRes = await fetch(`${CONFIG.API_BASE_URL}/uploads/poster`, {
                  method: 'POST',
                  body: formData,
                });
                
                if (uploadRes.ok) {
                  const uploadData = await uploadRes.json();
                  bannerImageUrl = uploadData.url;
                } else {
                  const errorText = await uploadRes.text();
                  // Don't block booking if banner upload fails
                }
              } catch (err: any) {
                // Don't block booking if banner upload fails - continue without banner
              }
            }
            
            // Merge event-type add-ons and vendor catalog add-ons (AddonsSection)
            const vendorAddonEntries = addonsDetails.map(d => ({
              id: d.id,
              label: d.name,
              quantity: Math.max(1, d.qty || 1),
              price: d.unitPrice || 0,
              total: d.amount || ((d.unitPrice || 0) * Math.max(1, d.qty || 1)),
              hours_used: d.hours_used,
              _source: 'vendor'
            }));
            // Get all selected items from all subcategories
            const allEventAddonEntries: Array<{ id: string; label: string; quantity: number; price: number; total: number; _source: string }> = [];
            Object.entries(quantitiesBySubcategory).forEach(([subcategoryId, quantities]) => {
              const selected = selectedAddOnsBySubcategory[subcategoryId] || {};
              Object.entries(quantities).forEach(([itemId, qty]) => {
                if (selected[itemId]) {
                  // Find the item from all fetched items
                  const allFetchedItems = Object.values(fetchedItemsBySubcategory).flat();
                  const item = allFetchedItems.find(i => i.id === itemId);
                  if (item) {
                    allEventAddonEntries.push({
                      id: itemId,
                      label: item.label,
                      quantity: Math.max(1, qty || 1),
                      price: item.price || 0,
                      total: (item.price || 0) * Math.max(1, qty || 1),
                      _source: 'event'
                    });
                  }
                }
              });
            });
            const eventAddonEntries = allEventAddonEntries;
            // Deduplicate by id, summing quantities if same id appears in both sources
            const mergedMap: Record<string, { id: string; label: string; quantity: number; price: number; total: number; hours_used?: number }> = {};
            [...eventAddonEntries, ...vendorAddonEntries].forEach(entry => {
              if (!mergedMap[entry.id]) {
                mergedMap[entry.id] = { 
                  id: entry.id, 
                  label: entry.label, 
                  quantity: entry.quantity, 
                  price: entry.price, 
                  total: entry.total,
                  hours_used: (entry as any).hours_used
                };
              } else {
                const existing = mergedMap[entry.id];
                existing.quantity += entry.quantity;
                existing.total = existing.price * existing.quantity;
                // Keep hours_used from vendor entry if available (hour-based pricing items)
                if ((entry as any).hours_used && !existing.hours_used) {
                  existing.hours_used = (entry as any).hours_used;
                }
              }
            });
            // Add paid features as booking items
            const paidFeatureEntries = Array.from(selectedPaidFeatures).map(featureId => {
              const feature = hallFeatures.find(f => (f.id || f.label) === featureId && f.paid === true);
              if (!feature) return null;
              
              const pricingType = feature.pricing_type || (feature.item_price ? 'item' : 'hour');
              
              let featureTotal = 0;
              let quantity = 1;
              
              if (pricingType === 'item') {
                // Item-based: price × quantity
                quantity = paidFeatureQuantities[featureId] || 1;
                const itemPrice = feature.item_price || 0;
                featureTotal = itemPrice * quantity;
              } else {
                // Hour-based: base_price + (hours - 1) * additional_hour_price
                const basePrice = feature.base_price || 0;
                const additionalHourPrice = feature.additional_hour_price || 0;
                featureTotal = basePrice + (hours > 1 ? (hours - 1) * additionalHourPrice : 0);
              }
              
              return {
                id: `paid-feature-${featureId}`,
                label: feature.label,
                quantity: quantity,
                price: pricingType === 'item' ? (feature.item_price || 0) : featureTotal,
                total: featureTotal,
                _source: 'paid_feature',
                hours_used: pricingType === 'hour' ? hours : undefined, // Store hours used only for hour-based features
              };
            }).filter(Boolean) as Array<{ id: string; label: string; quantity: number; price: number; total: number; _source: string; hours_used?: number }>;
            
            const mergedSelectedAddons = [...Object.values(mergedMap), ...paidFeatureEntries];

            const bookingData = {
              space_id: 1,
              event_type: eventTypeLabel,
              start_datetime: formatDateForAPI(startDateTime),
              end_datetime: formatDateForAPI(endDateTime),
              duration_hours: hours,
              base_amount: hallSubtotal,
              addons_amount: addOnsTotal + addonsGrandTotal + paidFeaturesTotal,
              stage_amount: stagePrice,
              banner_amount: bannerPrice,
              total_amount: total,
              original_amount: totalBeforeOffer, // Store original amount before offer discount for payment page
              special_requests: `Guests: ${guests}, Event: ${getEventTypeLabel()}`,
              booking_type: bookingType || 'one_day',
              guests: guests,
              banner_image_url: bannerImageUrl,
              hall_name: 'Grant Hall',
              selected_addons: mergedSelectedAddons,
              selected_stage: stageOptionsWithImages.find(s => s.id === selectedStage) || stageOptionsWithImages[0],
              selected_banner: bannerSize ? bannerSizes.find(b => b.id === bannerSize) : { id: 'banner-none', label: 'Not Required', price: 0 },
              transport_estimate: transportEstimate ?? 0,
              transport_locations: transportLocations.length > 0 ? transportLocations.map(loc => ({
                location: loc.location,
                location_data: loc.locationData,
                guest_count: loc.guestCount,
                contact_name: loc.contactName,
                contact_phone: loc.contactPhone,
                selected_vehicle: loc.selectedVehicle,
                vehicle_cost: loc.vehicleCost,
                guests: loc.guests || [], // Include guest details (name and phone)
              })) : undefined,
              temp_audio: tempAudioData, // Include temporary audio data
              applied_offer: appliedOffer ? {
                id: appliedOffer.id,
                type: appliedOffer.type,
                title: appliedOffer.title,
                description: appliedOffer.description,
                discount_type: appliedOffer.discount_type,
                discount_value: appliedOffer.discount_value,
                code: appliedOffer.code,
              } : undefined,
              offer_discount_amount: offerDiscount,
            };

            // Validation before proceeding
            const validationErrors: string[] = [];
            
            if (!dateObj) {
              validationErrors.push('• Please select a date');
            }
            
            if (!timeObj) {
              validationErrors.push('• Please select a time');
            }
            
            if (!hours || hours <= 0) {
              validationErrors.push('• Please select a valid duration');
            }
            
            if (!guests || guests <= 0) {
              validationErrors.push('• Please enter number of guests');
            }
            
            // Check if either a main category or subcategory is selected
            // Allow proceeding with just main category OR with subcategory
            if (!selectedEventCategory && (!activeEvent || activeEvent === 'default')) {
              validationErrors.push('• Please select an event category');
            }
            // If main category is selected, that's sufficient (subcategory is optional)
            // activeEvent should be set to category ID when main category is selected
            
            if (validationErrors.length > 0) {
              Alert.alert(
                'Required Information Missing',
                'Please complete the following:\n\n' + validationErrors.join('\n'),
                [{ text: 'OK', style: 'default' }]
              );
              return;
            }

            // If in edit mode, update the booking instead of creating new one
            if (isEditMode && bookingId && existingBooking) {
              try {
                const token = await AsyncStorage.getItem('auth.token');
                const headers: any = { 'Content-Type': 'application/json' };
                if (token) {
                  headers['Authorization'] = `Bearer ${token}`;
                }

                // Prepare items array for update
                // Use item_id from existing booking items if available, otherwise try to match
                const itemsArray: Array<{ item_id: number; quantity: number }> = [];
                
                mergedSelectedAddons.forEach(addon => {
                  if (addon.quantity <= 0) return;
                  
                  // First, try to find in existing booking items
                  const existingItem = existingBooking.items?.find((item: any) => 
                    item.item_id === Number(addon.id) || 
                    item.item_name?.toLowerCase() === addon.label?.toLowerCase()
                  );
                  
                  if (existingItem) {
                    itemsArray.push({
                      item_id: existingItem.item_id,
                      quantity: addon.quantity,
                    });
                  } else {
                    // Try to parse item_id from addon.id
                    const itemId = Number(addon.id);
                    if (itemId > 0) {
                      itemsArray.push({
                        item_id: itemId,
                        quantity: addon.quantity,
                      });
                    }
                  }
                });

                const updatePayload = {
                  start_datetime: formatDateForAPI(startDateTime),
                  end_datetime: formatDateForAPI(endDateTime),
                  attendees: guests,
                  items: itemsArray,
                  event_type: eventTypeLabel,
                  customer_note: `Guests: ${guests}, Event: ${getEventTypeLabel()}`,
                };

                const updateResponse = await fetch(`${CONFIG.API_BASE_URL}/bookings/${bookingId}`, {
                  method: 'PATCH',
                  headers,
                  body: JSON.stringify(updatePayload),
                });

                if (!updateResponse.ok) {
                  const errorText = await updateResponse.text();
                  throw new Error(errorText || 'Failed to update booking');
                }

                const updateResult = await updateResponse.json();

                // Check if payment is required
                if (updateResult.requires_payment && updateResult.balance_amount > 0) {
                  // Navigate to payment page for balance - force payment
                  router.push({
                    pathname: '/payment-main',
                    params: {
                      booking_id: String(updateResult.booking_id),
                      balance_amount: String(updateResult.balance_amount),
                      edit_mode: 'true',
                    },
                  } as any);
                } else if (updateResult.requires_refund && updateResult.refund_amount > 0) {
                  // Show refund modal
                  setRefundData({
                    bookingId: updateResult.booking_id,
                    refundAmount: updateResult.refund_amount,
                    newTotal: updateResult.new_total,
                    originalPaid: updateResult.original_paid,
                  });
                  setShowRefundModal(true);
                } else {
                  Alert.alert('Success', 'Booking updated successfully!', [
                    { text: 'OK', onPress: () => router.back() },
                  ]);
                }
                return;
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to update booking');
                return;
              }
            }
            
            // Function to store booking data (without navigating)
            const storeBookingData = async () => {
              try {
                // Validate booking data before storing
                if (!bookingData || !bookingData.start_datetime || !bookingData.end_datetime) {
                  throw new Error('Invalid booking data');
                }

                const bookingDataString = JSON.stringify(bookingData);
                
                if (typeof window !== 'undefined' && window.localStorage) {
                  window.localStorage.setItem('pendingBooking', bookingDataString);
                  
                  // Store audio blob separately if exists
                  if (tempAudioData?.blob) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      try {
                        window.localStorage.setItem('pendingAudioBlob', reader.result as string);
                      } catch (err) {
                      }
                    };
                    reader.onerror = () => {
                    };
                    reader.readAsDataURL(tempAudioData.blob);
                  }
                }
                // Also try AsyncStorage for native
                try {
                  await AsyncStorage.setItem('pendingBooking', bookingDataString);
                } catch (err) {
                }
              } catch (err: any) {
                console.error('Error storing booking data:', err);
                throw new Error(`Failed to save booking data: ${err.message}`);
              }
            };

            // Function to navigate to payment (after data is stored)
            const navigateToPayment = () => {
              router.push('/payment-main');
            };

            try {
              // Store booking data first (for both authenticated and unauthenticated)
              await storeBookingData();

              // If not authenticated, show auth modal (data already stored)
              if (!isAuthenticated) {
                setShowAuthModal(true);
                return;
              }

              // Already authenticated: navigate to payment
              navigateToPayment();
            } catch (error: any) {
              console.error('Error in proceed handler:', error);
              Alert.alert('Error', error.message || 'An error occurred while processing your booking. Please try again.');
            }
          }}
        >
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Auth Modal: login/register inline without navigating away */}

      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={async () => {
          setShowAuthModal(false);
          // pendingBooking was stored before opening the modal; proceed to payment
          router.push('/payment-main');
        }}
      />

      {/* Price Breakdown Sheet */}
      <Modal visible={breakdownVisible} animationType="slide" transparent onRequestClose={() => setBreakdownVisible(false)}>
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setBreakdownVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <ThemedText style={styles.sheetTitle}>Price Breakdown</ThemedText>
              <TouchableOpacity onPress={() => setBreakdownVisible(false)}>
                <Ionicons name="close" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: 72 }}>
              {/* Hours */}
              <BreakdownRow label={`Hall ${hours} hrs x INR ${HALL_HOURLY_RATE}`} amount={hallSubtotal} />

              {/* Event Add-ons (per Event Type) */}
              {(() => {
                // Get all selected items from all subcategories for breakdown
                const breakdownItems: Array<{ id: string; label: string; quantity: number; price: number }> = [];
                Object.entries(quantitiesBySubcategory).forEach(([subcategoryId, quantities]) => {
                  const selected = selectedAddOnsBySubcategory[subcategoryId] || {};
                  Object.entries(quantities).forEach(([itemId, qty]) => {
                    if (selected[itemId]) {
                      const allFetchedItems = Object.values(fetchedItemsBySubcategory).flat();
                      const item = allFetchedItems.find(i => i.id === itemId);
                      if (item) {
                        breakdownItems.push({
                          id: itemId,
                          label: item.label,
                          quantity: Math.max(1, qty || 1),
                          price: item.price || 0,
                        });
                      }
                    }
                  });
                });
                return breakdownItems.map((a) => {
                  const amount = a.price * a.quantity;
                  return (
                    <BreakdownRow key={`addon-${a.id}`} label={`${a.label} x ${a.quantity}`} amount={amount} indent />
                  );
                });
              })()}

              {/* Stage */}
              {stagePrice > 0 ? (
                <BreakdownRow label={`Stage: ${stageOptions.find(s=>s.id===selectedStage)?.label || stageOptions[0]?.label || ''}`} amount={stagePrice} />
              ) : null}

              {/* Banner */}
              <BreakdownRow 
                label={`Banner: ${bannerSize ? bannerSizes.find(b=>b.id===bannerSize)?.label || '' : 'Not Required'}`} 
                amount={bannerPrice} 
              />

              {/* Optional Add-ons (from modal) */}
              {addonsDetails.map((it) => (
                <BreakdownRow key={`opt-${it.category}-${it.id}`} label={`${it.name}${it.qty>1?` x ${it.qty}`:''}`} amount={it.amount} indent />
              ))}

              {/* Transport estimate */}
              {(transportEstimate ?? 0) > 0 ? (
                <BreakdownRow label={`Transport Estimate`} amount={transportEstimate ?? 0} />
              ) : null}

              {/* Paid Features */}
              {Array.from(selectedPaidFeatures).map(featureId => {
                const feature = hallFeatures.find(f => (f.id || f.label) === featureId && f.paid === true);
                if (!feature) return null;
                
                const pricingType = feature.pricing_type || (feature.item_price ? 'item' : 'hour');
                const quantity = paidFeatureQuantities[featureId] || 1;
                
                let featureTotal = 0;
                let label = feature.label;
                
                if (pricingType === 'item') {
                  // Item-based: price × quantity
                  const itemPrice = feature.item_price || 0;
                  featureTotal = itemPrice * quantity;
                  label += ` (${quantity} × ₹${itemPrice.toFixed(2)})`;
                } else {
                  // Hour-based: base_price + (hours - 1) * additional_hour_price
                  const basePrice = feature.base_price || 0;
                  const additionalHourPrice = feature.additional_hour_price || 0;
                  featureTotal = basePrice + (hours > 1 ? (hours - 1) * additionalHourPrice : 0);
                  if (hours > 1 && additionalHourPrice > 0) {
                    label += ` (${hours}h: ₹${basePrice} + ${hours - 1}×₹${additionalHourPrice})`;
                  }
                }
                
                return (
                  <BreakdownRow key={`paid-feature-${featureId}`} label={label} amount={featureTotal} indent />
                );
              })}

              {/* Discount and surcharge */}
              {eventDiscountPct > 0 ? (
                <BreakdownRow label={`Event Discount (${Math.round(eventDiscountPct*100)}%)`} amount={-Math.round(base * eventDiscountPct)} highlightNeg />
              ) : null}
              {weekendSurchargePct > 0 ? (
                <BreakdownRow label={`Weekend Surcharge (${Math.round(weekendSurchargePct*100)}%)`} amount={Math.round((base * (1 - eventDiscountPct)) * weekendSurchargePct)} highlightPos />
              ) : null}
              {offerDiscount > 0 && appliedOffer ? (
                <BreakdownRow 
                  label={`Offer: ${appliedOffer.title}${appliedOffer.discount_type === 'percentage' ? ` (${appliedOffer.discount_value}% OFF)` : ` (₹${appliedOffer.discount_value} OFF)`}`} 
                  amount={-offerDiscount} 
                  highlightNeg 
                />
              ) : null}

              {/* Final Total */}
              <View style={{ height: 1, backgroundColor: '#e5e7eb', marginVertical: 8 }} />
              <BreakdownRow label={`Total`} amount={total} bold />
            </View>

            <View style={styles.summaryBar}>
              <ThemedText style={styles.summaryItems}>Total</ThemedText>
              <ThemedText style={styles.summaryTotal}>INR {total.toFixed(0)}</ThemedText>
              <TouchableOpacity style={styles.summaryGo} onPress={() => setBreakdownVisible(false)}>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Detailed Add-on Selection Modal */}
      <Modal visible={addOnModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <ThemedText style={styles.sheetTitle}>
                {selectedAddOn?.label || 'Select Options'}
              </ThemedText>
              <TouchableOpacity onPress={closeAddOnModal} style={styles.closeButton}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ maxHeight: 400, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
              {selectedAddOn?.subItems?.map((subItem) => {
                const selectedItem = selectedSubItems[subItem.id];
                const quantity = selectedItem?.quantity || 0;
                
                return (
                  <View key={subItem.id} style={[styles.addOnRow, { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <RNImage source={{ uri: subItem.image }} style={styles.subItemImage} />
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.addOnLabel}>{subItem.label}</ThemedText>
                        <ThemedText style={[styles.addOnPrice, { fontSize: 14, marginTop: 2 }]}>
                          INR {subItem.price.toFixed(0)}
                        </ThemedText>
                      </View>
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {quantity > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity onPress={() => removeSubItem(subItem.id)}>
                            <Ionicons name="remove-circle-outline" size={24} color="#ef4444" />
                          </TouchableOpacity>
                          <ThemedText style={{ fontWeight: '600', minWidth: 20, textAlign: 'center', color: '#000000' }}>
                            {quantity}
                          </ThemedText>
                          <TouchableOpacity onPress={() => addSubItem(subItem)}>
                            <Ionicons name="add-circle" size={24} color="#10B981" />
                          </TouchableOpacity>
                        </View>
                      )}
                      
                      {quantity === 0 && (
                        <TouchableOpacity 
                          style={[styles.addButton, styles.addButtonInactive]}
                          onPress={() => addSubItem(subItem)}
                        >
                          <Ionicons name="add" size={16} color="#059669" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            
            {/* Selected Items Summary */}
            {Object.keys(selectedSubItems).length > 0 && (
              <View style={styles.summaryBar}>
                <ThemedText style={styles.summaryItems}>
                  {Object.keys(selectedSubItems).length} items selected
                </ThemedText>
                <ThemedText style={styles.summaryTotal}>
                  INR {Object.values(selectedSubItems)
                    .reduce((sum, item) => sum + (item.subItem.price * item.quantity), 0)
                    .toFixed(0)}
                </ThemedText>
                <TouchableOpacity style={styles.summaryGo} onPress={closeAddOnModal}>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Refund Modal */}
      <Modal visible={showRefundModal} animationType="slide" transparent onRequestClose={() => setShowRefundModal(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheet, { maxWidth: 500, width: '90%' }]}>
            <View style={styles.sheetHandle} />
            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <ThemedText style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>Refund Information</ThemedText>
                <TouchableOpacity onPress={() => setShowRefundModal(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={{ backgroundColor: '#F0FDF4', padding: 16, borderRadius: 12, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#10B981' }}>
                <ThemedText style={{ fontSize: 16, fontWeight: '700', color: '#065F46', marginBottom: 12 }}>
                  Booking Updated Successfully
                </ThemedText>
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ color: '#374151' }}>New Total:</ThemedText>
                    <ThemedText style={{ color: '#111827', fontWeight: '700' }}>₹{refundData?.newTotal.toFixed(2) || '0.00'}</ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ color: '#374151' }}>Amount Paid:</ThemedText>
                    <ThemedText style={{ color: '#111827', fontWeight: '700' }}>₹{refundData?.originalPaid.toFixed(2) || '0.00'}</ThemedText>
                  </View>
                  <View style={{ height: 1, backgroundColor: '#D1D5DB', marginVertical: 8 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ color: '#DC2626', fontWeight: '700', fontSize: 16 }}>Refund Amount:</ThemedText>
                    <ThemedText style={{ color: '#DC2626', fontWeight: '800', fontSize: 18 }}>₹{refundData?.refundAmount.toFixed(2) || '0.00'}</ThemedText>
                  </View>
                </View>
              </View>

              <View style={{ backgroundColor: '#FEF3C7', padding: 16, borderRadius: 12, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#F59E0B' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Ionicons name="information-circle" size={20} color="#92400E" />
                  <ThemedText style={{ color: '#92400E', fontWeight: '700', fontSize: 14 }}>Refund Processing</ThemedText>
                </View>
                <ThemedText style={{ color: '#78350F', fontSize: 13, lineHeight: 20 }}>
                  Your refund of ₹{refundData?.refundAmount.toFixed(2) || '0.00'} will be processed within 3 working days and credited back to your original payment method.
                </ThemedText>
              </View>

              <TouchableOpacity
                style={{ backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 10, alignItems: 'center' }}
                onPress={async () => {
                  if (!refundData) return;
                  
                  try {
                    const token = await AsyncStorage.getItem('auth.token');
                    const headers: any = { 'Content-Type': 'application/json' };
                    if (token) {
                      headers['Authorization'] = `Bearer ${token}`;
                    }

                    // Save refund record
                    const refundResponse = await fetch(`${CONFIG.API_BASE_URL}/bookings/${refundData.bookingId}/refund`, {
                      method: 'POST',
                      headers,
                      body: JSON.stringify({
                        refund_amount: refundData.refundAmount,
                        reason: 'Booking edited - price decreased',
                      }),
                    });

                    if (refundResponse.ok) {
                      setShowRefundModal(false);
                      setRefundData(null);
                      Alert.alert('Success', 'Refund request has been recorded. You will receive the refund within 3 working days.', [
                        { text: 'OK', onPress: () => router.back() },
                      ]);
                    } else {
                      throw new Error('Failed to record refund');
                    }
                  } catch (error: any) {
                    Alert.alert('Error', error.message || 'Failed to record refund request');
                  }
                }}
              >
                <ThemedText style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Confirm & Close</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Items Modal - Similar to AddonsSection */}
      <Modal visible={itemsModalVisible} animationType="slide" transparent onRequestClose={() => setItemsModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setItemsModalVisible(false)} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '94%' }}>
            <View style={{ alignSelf: 'center', width: 50, height: 5, borderRadius: 3, backgroundColor: '#E5E7EB', marginTop: 8 }} />
            <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <ThemedText style={{ fontWeight: '600', color: '#111827', fontSize: 18 }}>
                  {selectedEventType?.label || 'Items'}
                </ThemedText>
                <ThemedText style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                  Select items for your event
                </ThemedText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  style={{ borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
                  onPress={() => {
                    if (selectedEventCategory && selectedEventType) {
                      const cacheKey = `${selectedEventCategory.id}-${selectedEventType.id}`;
                      setFetchedItemsBySubcategory(prev => {
                        const next = { ...prev };
                        delete next[cacheKey];
                        return next;
                      });
                      fetchItemsForSubcategory(selectedEventCategory.id, selectedEventType.id);
                    }
                  }}
                >
                  <ThemedText style={{ color: '#111827', fontWeight: '600' }}>Refresh</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setItemsModalVisible(false)}>
                  <ThemedText style={{ color: '#ef4444', fontWeight: '600' }}>Skip</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{
              marginHorizontal: 16,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: Platform.OS === 'ios' ? 10 : 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#FFFFFF',
            }}>
              <Ionicons name="search" size={16} color="#9CA3AF" />
              <TextInput
                placeholder="Search for items"
                placeholderTextColor="#9CA3AF"
                value={query}
                onChangeText={setQuery}
                style={{ flex: 1, fontSize: 15, color: '#111827' }}
              />
            </View>

          {(() => {
            const cacheKey = selectedEventCategory && selectedEventType ? `${selectedEventCategory.id}-${selectedEventType.id}` : '';
            const isLoading = loadingItems[cacheKey];
            
            if (isLoading) {
              return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#059669" />
                  <ThemedText style={{ marginTop: 16, color: '#6B7280' }}>Loading items...</ThemedText>
                </View>
              ) as React.ReactElement;
            }
            
            if (addOnsForActive.length === 0) {
              return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
                  <Ionicons name="cube-outline" size={64} color="#D1D5DB" />
                  <ThemedText style={{ marginTop: 16, fontSize: 16, color: '#6B7280', textAlign: 'center' }}>
                    No items available for this subcategory.
                  </ThemedText>
                </View>
              ) as React.ReactElement;
            }
            
            // Filter items by search query
            const filteredItems = query.trim() 
              ? addOnsForActive.filter(item => 
                  item.label.toLowerCase().includes(query.trim().toLowerCase()) ||
                  item.description?.toLowerCase().includes(query.trim().toLowerCase())
                )
              : addOnsForActive;

            return (
              <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  if (selectedEventCategory && selectedEventType) {
                    const cacheKey = `${selectedEventCategory.id}-${selectedEventType.id}`;
                    setFetchedItemsBySubcategory(prev => {
                      const next = { ...prev };
                      delete next[cacheKey];
                      return next;
                    });
                    await fetchItemsForSubcategory(selectedEventCategory.id, selectedEventType.id, true);
                  }
                  setRefreshing(false);
                }}
                renderItem={({ item }) => {
              const cacheKey = selectedEventCategory && selectedEventType ? `${selectedEventCategory.id}-${selectedEventType.id}` : '';
              const currentQuantities = cacheKey ? (quantitiesBySubcategory[cacheKey] || {}) : {};
              const count = currentQuantities[item.id] || 0;
              const itemId = parseInt(item.id.replace('item-', ''));
              const prepTime = item.preparation_time_minutes || 0;
              const eventDateTime = dateObj && timeObj ? (() => {
                const combined = new Date(dateObj);
                combined.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
                return combined;
              })() : undefined;
              
              // Calculate delivery check (same logic as AddonsSection)
              const deliveryCheck = canItemBeDelivered(prepTime);
              
              // Status checks (same logic as AddonsSection)
              const isUnavailable = item.item_status ? item.item_status !== 'available' : false;
              const cannotDeliver = prepTime > 0 && !deliveryCheck.canDeliver;
              const isDisabled = isUnavailable || cannotDeliver;
              const needsDateTime = prepTime > 0 && !eventDateTime;

              return (
                <View style={{ marginTop: 16, flexDirection: 'row', gap: 12 }}>
                  <View>
                    <TouchableOpacity onPress={() => {
                      if (item.image) {
                        setImagePopup({
                          visible: true,
                          image: item.image,
                          title: item.label
                        });
                      }
                    }}>
                      <RNImage source={resolveImageSource(item.image) || placeholderImg} style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: '#E5E7EB' }} resizeMode="cover" />
                    </TouchableOpacity>
                    <ItemMediaViewer
                      itemId={itemId}
                      media={item.media}
                      showThumbnails={false}
                      onMediaLoad={(media) => {
                        if (media && media.length > 0) {
                          setItemsWithMedia(prev => new Set(prev).add(item.id));
                        }
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
                      {item.label}
                    </ThemedText>
                    {item.description && (
                      <ThemedText style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>
                        {item.description}
                      </ThemedText>
                    )}
                    <ThemedText style={{ fontSize: 18, fontWeight: '700', color: '#059669', marginBottom: 8 }}>
                      ₹{item.price?.toFixed(0) || 0}
                    </ThemedText>

                    {/* Item Status Badge */}
                    {item.item_status && item.item_status !== 'available' && (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: item.item_status === 'out_of_stock' ? '#FEE2E2' : '#FEF3C7',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        alignSelf: 'flex-start',
                        marginBottom: 4,
                      }}>
                        <Ionicons
                          name={item.item_status === 'out_of_stock' ? 'close-circle' : 'construct'}
                          size={12}
                          color={item.item_status === 'out_of_stock' ? '#DC2626' : '#D97706'}
                        />
                        <ThemedText style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: item.item_status === 'out_of_stock' ? '#DC2626' : '#D97706',
                        }}>
                          {item.item_status === 'out_of_stock' ? 'Out of Stock' : 'Currently Not Available'}
                        </ThemedText>
                      </View>
                    )}

                    {/* Preparation Time Badge - Same logic as AddonsSection */}
                    {(() => {
                      // Only show warning badge if prep time is required, date/time is selected, AND insufficient time
                      if (prepTime <= 0 || !eventDateTime) {
                        return null;
                      }
                      
                      // Only show warning badge if not enough time
                      if (!deliveryCheck.canDeliver) {
                        return (
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: '#FEE2E2',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                            alignSelf: 'flex-start',
                            marginBottom: 4,
                          }}>
                            <Ionicons name="alert-circle" size={12} color="#DC2626" />
                            <ThemedText style={{ fontSize: 11, fontWeight: '600', color: '#DC2626' }}>
                              Needs {Math.ceil(prepTime / 60)}h prep
                            </ThemedText>
                          </View>
                        );
                      }
                      
                      // Don't show badge if prep time is sufficient (same as AddonsSection for cakes)
                      return null;
                    })()}
                  </View>
                  {(() => {
                    // Same logic as AddonsSection for cake items
                    if (count === 0) {
                      // Check if date/time is needed for items with prep time
                      const prepTimeForCheck = item.preparation_time_minutes || 0;
                      const needsDateTime = prepTimeForCheck > 0 && !eventDateTime;
                      
                      return (
                        <TouchableOpacity
                          style={{
                            backgroundColor: (isDisabled || needsDateTime) ? '#E5E7EB' : '#059669',
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 8,
                            alignSelf: 'flex-start',
                            opacity: (isDisabled || needsDateTime) ? 0.6 : 1,
                          }}
                          onPress={() => {
                            if (needsDateTime) {
                              Alert.alert(
                                'Date & Time Required',
                                'Please select date and time first to check if this item can be prepared in time.',
                                [{ text: 'OK' }]
                              );
                              return;
                            }
                            if (!isDisabled) incItemQty(item.id);
                          }}
                          disabled={isDisabled || needsDateTime}
                        >
                          <ThemedText style={{
                            color: (isDisabled || needsDateTime) ? '#9CA3AF' : '#FFFFFF',
                            fontWeight: '600',
                            fontSize: 14,
                          }}>
                            {needsDateTime ? 'Select Date & Time' :
                             isUnavailable ? (item.item_status === 'out_of_stock' ? 'Out of Stock' : 'Currently Not Available') :
                             cannotDeliver ? 'Not Enough Time' : 'Add'}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    }
                    
                    // Quantity controls (same as AddonsSection)
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity onPress={() => decItemQty(item.id)}>
                          <Ionicons name="remove-circle" size={22} color="#ef4444" />
                        </TouchableOpacity>
                        <TextInput
                          style={{
                            width: 50,
                            textAlign: 'center',
                            fontSize: 16,
                            fontWeight: '600',
                            color: '#111827',
                          }}
                          value={count.toString()}
                          onChangeText={(value) => {
                            const numValue = parseInt(value) || 0;
                            // Don't allow setting quantity if item is disabled (same as AddonsSection)
                            if (!isUnavailable && !cannotDeliver) {
                              updateItemQty(item.id, value);
                            }
                          }}
                          keyboardType="numeric"
                          selectTextOnFocus
                          editable={!isDisabled}
                        />
                        <TouchableOpacity onPress={() => incItemQty(item.id)} disabled={isDisabled}>
                          <Ionicons name="add-circle" size={22} color={isDisabled ? "#9CA3AF" : "#10B981"} />
                        </TouchableOpacity>
                      </View>
                    );
                  })()}
                </View>
              );
            }}
          />
            );
          })()}

            {/* Bottom summary bar - Same as AddonsSection */}
            <View style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#FFFFFF',
              borderTopWidth: 1,
              borderTopColor: '#E5E7EB',
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <View>
                <ThemedText style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                  {(() => {
                    const cacheKey = selectedEventCategory && selectedEventType ? `${selectedEventCategory.id}-${selectedEventType.id}` : '';
                    const currentQuantities = cacheKey ? (quantitiesBySubcategory[cacheKey] || {}) : {};
                    return Object.values(currentQuantities).reduce((sum, qty) => sum + (qty || 0), 0);
                  })()} items
                </ThemedText>
                <ThemedText style={{ fontSize: 16, fontWeight: '700', color: '#059669', marginTop: 2 }}>
                  Total Cost  INR {(() => {
                    const cacheKey = selectedEventCategory && selectedEventType ? `${selectedEventCategory.id}-${selectedEventType.id}` : '';
                    const currentQuantities = cacheKey ? (quantitiesBySubcategory[cacheKey] || {}) : {};
                    return addOnsForActive.reduce((sum, item) => {
                      const qty = currentQuantities[item.id] || 0;
                      return sum + ((item.price || 0) * qty);
                    }, 0).toFixed(0);
                  })()}
                </ThemedText>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: '#059669',
                  borderRadius: 999,
                  width: 48,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setItemsModalVisible(false)}
              >
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Popup Modal */}
      <Modal visible={imagePopup.visible} animationType="fade" transparent onRequestClose={() => setImagePopup({ visible: false, image: '', title: '' })}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <Pressable style={{ flex: 1, width: '100%' }} onPress={() => setImagePopup({ visible: false, image: '', title: '' })} />
          <View style={{ position: 'absolute', width: '90%', maxWidth: 600 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <ThemedText style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF' }}>{imagePopup.title}</ThemedText>
              <TouchableOpacity onPress={() => setImagePopup({ visible: false, image: '', title: '' })}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' }}>
              <RNImage
                source={resolveImageSource(imagePopup.image) || placeholderImg}
                style={{ width: '100%', height: 400 }}
                resizeMode="cover"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Offer Popup - Only for Grant Hall after date, time, and duration are selected */}
      <OfferPopup
        purchaseAmount={totalBeforeOffer}
        spaceId={1}
        durationSelected={hours > 0 && dateObj !== null && timeObj !== null}
        onOfferApplied={(offer, discountAmount) => {
          setOfferDiscount(discountAmount);
          setAppliedOffer(offer);
        }}
        onDiscountAnimation={(discountAmount, startPosition) => {
          // Trigger animation of discount moving to footer
          animateDiscountToFooter(discountAmount, startPosition);
        }}
      />

      {/* Discount Animation - Moving from popup to footer */}
      {showDiscountAnimation && (
        <Animated.View
          style={[
            styles.discountAnimation,
            {
              position: 'absolute',
              left: discountAnimPosition.x,
              top: discountAnimPosition.y,
              transform: [
                { translateX: discountAnimX },
                { translateY: discountAnimY },
                { scale: discountAnimScale },
              ],
              opacity: discountAnimOpacity,
            },
          ]}
          style={{ pointerEvents: 'none' }}
        >
          <View style={styles.discountAnimationBadge}>
            <Ionicons name="arrow-down" size={16} color="#10B981" />
            <ThemedText style={styles.discountAnimationText}>
              -₹{discountAnimAmount.toFixed(0)}
            </ThemedText>
          </View>
        </Animated.View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '800', color: '#111827' },
  subtitle: { color: '#6b7280', marginTop: 4, fontSize: 12, lineHeight: 16 },
  card: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontWeight: '700', color: '#111827', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  textInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 15, color: '#111827', backgroundColor: '#FFFFFF' },
  vehicleCard: { width: 200, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  vehicleCardSelected: { 
    borderColor: '#10B981', 
    borderWidth: 2, 
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }
      : { shadowColor: '#10B981', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 } as any),
  },
  vehicleImage: { width: '100%', height: 100 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  featureItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  featureImgWrap: { 
    width: 36, 
    height: 36, 
    borderRadius: 10, 
    overflow: 'hidden', 
    backgroundColor: '#F3F4F6', 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 4px rgba(0, 0, 0, 0.06)' }
      : { shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 } as any),
  },
  featureImg: { width: '100%', height: '100%' },
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabsScrollContent: { paddingVertical: 4, paddingHorizontal: 2, gap: 8 },
  tabBtn: { paddingVertical: Platform.OS === 'web' ? 10 : 6, paddingHorizontal: Platform.OS === 'web' ? 12 : 8, borderRadius: 10, borderWidth: 1, minWidth: Platform.OS === 'web' ? 140 : 120, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabActive: { backgroundColor: '#fff', borderWidth: 3, borderColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5 },
  tabInactive: { backgroundColor: '#fff', borderColor: '#e5e7eb' },
  tabSelectedBadge: { backgroundColor: '#10B981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 'auto' },
  tabSelectedBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  tabIconWrap: { width: Platform.OS === 'web' ? 34 : 28, height: Platform.OS === 'web' ? 34 : 28, borderRadius: Platform.OS === 'web' ? 17 : 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6, backgroundColor: '#E6F4EA', borderWidth: 1, borderColor: '#C7EBDD' },
  tabIconActive: { backgroundColor: '#E6F4EA', borderColor: '#34D399' },
  tabIconInactive: { backgroundColor: '#F8FAF9', borderColor: '#e5e7eb' },
  tabLabel: { fontWeight: '700', textAlign: 'center' },
  tabLabelWrap: { lineHeight: 16, paddingHorizontal: 2 },
  tabLabelActive: { color: '#065F46' },
  tabLabelInactive: { color: '#6b7280' },
  eventCard: { padding: Platform.OS === 'web' ? 12 : 8 },
  addOnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  addOnLabel: { color: '#111827', fontWeight: '700', flex: 1 },
  addOnPrice: { color: '#111827', fontWeight: '700' },
  chooserBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  chooserText: { color: '#065F46', fontWeight: '700' },
  stageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stageItem: { width: '48%', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 8, paddingBottom: 8, backgroundColor: '#fff', position: 'relative' },
  stageActive: { borderWidth: 3, borderColor: '#10B981', backgroundColor: '#fff', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  stageImgWrap: { width: '100%', height: 110, borderRadius: 10, overflow: 'hidden', backgroundColor: '#f3f4f6', marginBottom: 6, position: 'relative' },
  stageImg: { width: '100%', height: '100%' },
  stageSelectedBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: '#fff', borderRadius: 12, padding: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  stageLabel: { marginTop: 6, marginHorizontal: 8, fontWeight: '400', color: '#111827' },
  stageLabelActive: { fontWeight: '700', color: '#10B981' },
  stagePriceContainer: { marginHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  stagePrice: { color: '#059669', fontWeight: '600' },
  selectedBadge: { backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginLeft: 8 },
  selectedBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  bannerPreview: { height: 150, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 6 },
  bannerImg: { width: '100%', height: '100%' },
  bannerPreviewContainer: { marginTop: 6, marginBottom: 12 },
  stageBannerPreview: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f3f4f6' },
  stageBannerComposite: { width: '100%', height: 250, position: 'relative', overflow: 'hidden' },
  stageBannerBackground: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  bannerOverlayContainer: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 20 },
  bannerOverlay: { width: '85%', height: '35%', maxWidth: 400, maxHeight: 100, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  bannerPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  uploadBtn: { marginTop: 10, height: 42, borderRadius: 8, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  uploadText: { color: '#fff', fontWeight: '700' },
  totalBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  totalLabel: { color: '#111827', marginRight: 'auto' },
  totalValue: { color: '#059669', fontWeight: '600' },
  originalTotalValue: { color: '#9CA3AF', fontSize: 14, fontWeight: '400', textDecorationLine: 'line-through', marginRight: 8 },
  totalGo: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  totalToggle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D1FAE5', backgroundColor: '#ECFDF5' },
  discountAnimation: {
    zIndex: 999999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountAnimationBadge: {
    backgroundColor: '#10B981',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  discountAnimationText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  hallImageCard: { marginTop: 10, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  topBannerContainer: {
    marginTop: 16,
    marginBottom: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#E6E8EA',
    alignSelf: 'center',
    minHeight: 200,
    maxHeight: 300,
  },
  topBannerScroll: {
    alignItems: 'center',
  },
  topBannerItem: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    maxHeight: 300,
    padding: 8,
  },
  topBannerImage: {
    width: '100%',
    height: '100%',
    minHeight: 200,
    maxWidth: '100%',
    maxHeight: 300,
  },
  hallImage: { width: '100%', height: 160 },
  rateBadge: { marginTop: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', borderColor: '#34D399', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 },
  rateBadgeText: { color: '#065F46', fontWeight: '600' },
  counterBox: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10 },
  counterLabel: { color: '#065F46', fontWeight: '600' },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterValue: { fontWeight: '600', color: '#111827' },
  rateLine: { color: '#111827', fontWeight: '600' },
  rateSubLine: { color: '#065F46', fontWeight: '700', marginTop: 2 },
  subtotalRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  subtotalLabel: { color: '#111827', fontWeight: '600' },
  subtotalValue: { color: '#059669', fontWeight: '600' },
  // Transportation styles
  transportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  transportTitle: { fontWeight: '600', color: '#111827' },
  transportAddCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  // Bottom sheet-like modal styles (reused from booking)
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' },
  transportSheet: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 16, 
    borderTopRightRadius: 16, 
    maxHeight: '95%',
    minHeight: '60%',
    flex: 1
  },
  sheetHandle: { alignSelf: 'center', width: 50, height: 5, borderRadius: 3, backgroundColor: '#E5E7EB', marginTop: 8 },
  sheetHeader: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontWeight: '600', color: '#111827' },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center'
  },
  inputWrap: { marginTop: 10 },
  summaryBar: { position: 'absolute',   left: 0, right: 0, bottom: 0, height: 56, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryItems: { color: '#000000', fontWeight: '700' },
  summaryTotal: { color: '#059669', fontWeight: '600', marginLeft: 'auto' },
  summaryGo: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  inputLabel: { color: '#111827', fontWeight: '700', marginBottom: 6 },
  input: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, backgroundColor: '#fff', color: '#111827' },
  locationSearchContainer: { position: 'relative' },
  selectBoxContainer: { position: 'relative' },
  selectBox: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer'
  },
  selectBoxText: {
    flex: 1,
    fontSize: 16,
    color: '#111827'
  },
  selectBoxTextSelected: {
    color: '#111827'
  },
  selectBoxTextPlaceholder: {
    color: '#9CA3AF'
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    zIndex: -1
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 250,
    zIndex: 9999,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }
      : { elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 } as any),
  },
  suggestionsContainerBelow: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    maxHeight: 250,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 } as any),
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12
  },
  suggestionContent: {
    flex: 1,
    flexDirection: 'column',
    gap: 2
  },
  suggestionText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500'
  },
  suggestionType: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400'
  },
  suggestionsDropdown: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  suggestionMain: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  suggestionSecondary: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  locationInfo: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#34D399'
  },
  distanceText: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '600'
  },
  priceDistribution: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  priceDistributionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  priceRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
    marginTop: 8,
    paddingTop: 8
  },
  priceLabel: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1
  },
  priceLabelTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1
  },
  priceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669'
  },
  priceValueTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669'
  },
  // Loading and error states
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, color: '#6b7280', fontSize: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 16, marginBottom: 8 },
  errorText: { color: '#6b7280', textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  // Add button styles
  addButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  addButtonActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  addButtonInactive: { backgroundColor: '#fff', borderColor: '#10B981' },
  // Image styles
  addOnImage: { width: 40, height: 40, borderRadius: 8 },
  subItemImage: { width: 50, height: 50, borderRadius: 8 },
  // Auth modal styles
  authOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  authCard: { width: '92%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 },
  authHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  authTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  authTabs: { flexDirection: 'row', gap: 8, marginTop: 4 },
  authTabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  authTabActive: { backgroundColor: '#111111', borderColor: '#111111' },
  authTabInactive: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  authTabText: { color: '#111827', fontWeight: '700' },
  authTabTextActive: { color: '#FFFFFF', fontWeight: '800' },
  authInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111827' },
  authPrimaryBtn: { backgroundColor: '#111111', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  authPrimaryText: { color: '#FFFFFF', fontWeight: '800' },
  authErrorBox: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8 },
  // Subcategory section
  subcategorySection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  // Main select box styles (event category)
  mainSelectBoxContainer: {
    position: 'relative',
    zIndex: 99999,
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'transparent',
  },
  mainSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  mainSelectBoxText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#374151',
    flex: 1,
  },
  mainSelectBoxPlaceholder: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '400',
  },
  mainDropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 999999,
    width: '100%',
  },
  mainDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  mainDropdownItemSelected: {
    backgroundColor: '#F0FDF4',
  },
  mainDropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mainDropdownItemText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#374151',
    flex: 1,
  },
});

// Inline component for breakdown rows
function BreakdownRow({ label, amount, indent, bold, highlightNeg, highlightPos }: { label: string; amount: number; indent?: boolean; bold?: boolean; highlightNeg?: boolean; highlightPos?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, paddingLeft: indent ? 12 : 0 }}>
      <ThemedText style={{ color: '#111827', fontWeight: bold ? '700' : '600' }}>{label}</ThemedText>
      <ThemedText style={{ color: highlightNeg ? '#ef4444' : highlightPos ? '#059669' : '#111827', fontWeight: bold ? '700' : '600' }}>
        INR {amount.toFixed(0)}
      </ThemedText>
    </View>
  );
}






