import ItemMediaViewer from '@/components/item/ItemMediaViewer';
import PerformanceTeamProfileCard from '@/components/item/PerformanceTeamProfileCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CONFIG } from '@/constants/config';
import { ItemsAPI } from '@/lib/api';
import { Events } from '@/lib/events';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, Image as RNImage, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

type AddonCard = {
  key: 'cake' | 'snack' | 'team';
  title: string;
  subtitle?: string;
  image: { uri: string } | number;
};

type CakeItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  item_status?: string;
  preparation_time_minutes?: number;
  base_hours_included?: number;
  rate_per_extra_hour?: number;
  media?: Array<{
    id: number;
    media_type: 'image' | 'video';
    file_url: string;
    file_path: string;
    is_primary: boolean;
    display_order: number;
    title?: string | null;
    description?: string | null;
  }>;
};

type SnackItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'beverages' | 'desserts' | 'snacks' | 'fish-seafood' | 'mutton-beef';
  type: 'veg' | 'non-veg';
  item_status?: string;
  preparation_time_minutes?: number;
  base_hours_included?: number;
  rate_per_extra_hour?: number;
  media?: Array<{
    id: number;
    media_type: 'image' | 'video';
    file_url: string;
    file_path: string;
    is_primary: boolean;
    display_order: number;
    title?: string | null;
    description?: string | null;
  }>;
};

type TeamItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string | number;
  video_url?: string;
  profile_image_url?: string;
  profile_info?: string;
  performance_team_profile?: any;
  item_status?: string;
  preparation_time_minutes?: number;
  base_hours_included?: number;
  rate_per_extra_hour?: number;
  media?: Array<{
    id: number;
    media_type: 'image' | 'video';
    file_url: string;
    file_path: string;
    is_primary: boolean;
    display_order: number;
    title?: string | null;
    description?: string | null;
  }>;
};

type AddonPick = {
  id: string;
  name: string;
  category: 'cake' | 'snack' | 'team';
  qty: number;
  unitPrice: number;
  amount: number;
  hours_used?: number; // For hour-based pricing items
};

type Props = {
  embedded?: boolean; // when true, renders without the outer card wrapper (use inside an existing card)
  title?: string; // optional override for section title
  onApplyTotal?: (total: number) => void; // callback when user proceeds/close modal to apply current selections grand total
  onApplyDetails?: (items: AddonPick[]) => void; // callback providing detailed items and amounts
  variant?: 'event' | 'program'; // program: equipment/apparel instead of food
  spaceId?: number; // used to filter catalog items to a given space (e.g., Grant Hall=1)
  prefetch?: boolean; // when true, fetch items on mount for faster first-open UX
  prefillItems?: Array<{ category: 'cake' | 'snack' | 'team'; id?: string; name?: string; qty?: number; unitPrice?: number }>; // edit-mode hydrate
  eventDateTime?: Date; // event start date/time for preparation time validation
  triggerModal?: 'cake' | 'snack' | 'team' | null; // external trigger to open a specific modal
  excludeItemNames?: string[]; // exclude items by name (e.g., for live shows: ['transportation', 'audio', 'stage decoration', 'stage banner'])
  hideSheetSummaryBar?: boolean; // hide bottom summary/apply bar inside modal (useful when parent shows a global summary)
  excludeCategories?: Array<'cake' | 'snack' | 'team'>; // hide entire categories from the add-ons list (e.g., ['team'])
};

export default function AddonsSection({ embedded = false, title, onApplyTotal, onApplyDetails, variant = 'event', spaceId, prefetch = false, prefillItems, eventDateTime, triggerModal, excludeItemNames = [], hideSheetSummaryBar = false, excludeCategories = [] }: Props) {
  const API_ORIGIN = CONFIG.API_BASE_URL.replace(/\/?api\/?$/, '');

  // Safely resolve image sources for expo-image (supports number require or { uri: string } or string URL)
  const resolveImageSource = (img?: unknown): any => {
    if (!img) return null;
    if (typeof img === 'number') return img;
    if (typeof img === 'string') {
      const u = img as string;
      if (u.startsWith('/static')) return { uri: `${API_ORIGIN}${u}` };
      return { uri: u };
    }
    if (typeof img === 'object') {
      try {
        const anyImg: any = img;
        if (typeof anyImg.uri === 'string') {
          const u = anyImg.uri as string;
          if (u.startsWith('/static')) return { uri: `${API_ORIGIN}${u}` };
          return { uri: u };
        }
        if (typeof anyImg.url === 'string') return { uri: anyImg.url };
      } catch {}
    }
    return null;
  };

  const placeholderImg = require('@/assets/images/partial-react-logo.png');
  const programMode = variant === 'program';
  
  // Helper: Calculate time until event and check if item can be prepared in time
  // Use useCallback to ensure it updates when eventDateTime changes
  const canItemBeDelivered = useCallback((prepTimeMinutes: number): { canDeliver: boolean; timeUntilEvent: number; timeNeeded: number } => {
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
  }, [eventDateTime]);
  
  const addons: AddonCard[] = useMemo(() => {
    if (programMode) {
      return [
        {
          key: 'snack',
          title: 'Equipment & Apparel',
          subtitle: 'Optional add-ons',
          image: { uri: 'https://images.unsplash.com/photo-1588286840104-8957b019727f?w=800&q=60&auto=format&fit=crop' },
        },
      ].filter(a => !excludeCategories.includes(a.key));
    }
    return [
      {
        key: 'cake',
        title: 'Cake',
        subtitle: 'AJFAN KASARAGOD',
        image: { uri: 'https://images.unsplash.com/photo-1616690710400-a16d146927c5?w=800&q=60&auto=format&fit=crop' },
      },
      {
        key: 'snack',
        title: 'Food & Beverages',
        subtitle: 'LeBrq Food Vendors kasaragod,Kerala',
        image: { uri: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=60&auto=format&fit=crop' },
      },
      {
        key: 'team',
        title: 'Performing Team',
        image: require('@/assets/images/ganamela.jpg'),
      },
    ].filter(a => !excludeCategories.includes(a.key));
  }, [programMode, excludeCategories]);

  // Which sheet is open
  const [activeSheet, setActiveSheet] = useState<null | 'cake' | 'snack' | 'team'>(null);

  // Cakes
  const [cakes, setCakes] = useState<CakeItem[]>([]);
  const [cakeQty, setCakeQty] = useState<Record<string, number>>({});
  const [cakeHours, setCakeHours] = useState<Record<string, number>>({}); // Hours used for hour-based pricing

  // Snacks
  const [snacks, setSnacks] = useState<SnackItem[]>([]);
  const [snackQty, setSnackQty] = useState<Record<string, number>>({});
  const [snackHours, setSnackHours] = useState<Record<string, number>>({}); // Hours used for hour-based pricing

  // Teams
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [teamSelected, setTeamSelected] = useState<Record<string, boolean>>({});
  const [teamHours, setTeamHours] = useState<Record<string, number>>({}); // Hours used for hour-based pricing
  const [didPrefill, setDidPrefill] = useState(false);

  // UI state shared per-sheet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [itemsWithMedia, setItemsWithMedia] = useState<Set<string>>(new Set());
  
  // Image popup state
  const [imagePopup, setImagePopup] = useState<{ visible: boolean; image: string; title: string }>({
    visible: false,
    image: '',
    title: ''
  });
  const [teamDetailModal, setTeamDetailModal] = useState<{ visible: boolean; team: TeamItem | null }>({ visible: false, team: null });
  
  // Food & Beverages state
  const [selectedFoodCategory, setSelectedFoodCategory] = useState<'breakfast' | 'lunch' | 'dinner' | 'beverages' | 'desserts' | 'snacks' | 'fish-seafood' | 'mutton-beef'>('breakfast');
  const [selectedFoodType, setSelectedFoodType] = useState<'veg' | 'non-veg'>('veg');

  // Helper: Calculate item cost including extra hours if applicable
  // Must be defined before totals useMemo that uses it
  // Wrapped in useCallback to ensure stable reference
  const calculateItemCost = useCallback((item: CakeItem | SnackItem | TeamItem, qty: number, hoursUsed?: number): number => {
    const baseCost = item.price * qty;
    if (!hoursUsed || !item.base_hours_included || item.base_hours_included <= 0 || !item.rate_per_extra_hour) {
      return baseCost;
    }
    const extraHours = Math.max(0, hoursUsed - item.base_hours_included);
    const extraCost = extraHours * (item.rate_per_extra_hour || 0) * qty;
    return baseCost + extraCost;
  }, []);

  // Totals
  const totals = useMemo(() => {
    if (activeSheet === 'cake') {
      const items = Object.values(cakeQty).reduce((a, b) => a + (b || 0), 0);
      const cost = cakes.reduce((sum, c) => {
        const qty = cakeQty[c.id] || 0;
        if (qty > 0) {
          const hoursUsed = cakeHours[c.id] || c.base_hours_included || 0;
          return sum + calculateItemCost(c, qty, hoursUsed);
        }
        return sum;
      }, 0);
      return { count: items, cost, label: 'items' } as const;
    }
    if (activeSheet === 'snack') {
      const items = Object.values(snackQty).reduce((a, b) => a + (b || 0), 0);
      const cost = snacks.reduce((sum, s) => {
        const qty = snackQty[s.id] || 0;
        if (qty > 0) {
          const hoursUsed = snackHours[s.id] || s.base_hours_included || 0;
          return sum + calculateItemCost(s, qty, hoursUsed);
        }
        return sum;
      }, 0);
      return { count: items, cost, label: 'items' } as const;
    }
    if (activeSheet === 'team') {
      const items = Object.values(teamSelected).filter(Boolean).length;
      const cost = teams.reduce((sum, t) => {
        if (teamSelected[t.id]) {
          const hoursUsed = teamHours[t.id] || t.base_hours_included || 0;
          return sum + calculateItemCost(t, 1, hoursUsed);
        }
        return sum;
      }, 0);
      return { count: items, cost, label: 'Programs' } as const;
    }
    return { count: 0, cost: 0, label: 'items' } as const;
  }, [activeSheet, cakes, cakeQty, cakeHours, snacks, snackQty, snackHours, teams, teamSelected, teamHours, calculateItemCost]);

  // Compute grand total across all categories (regardless of active sheet)
  const computeGrandTotal = () => {
    let total = 0;
    // Cakes
    Object.entries(cakeQty).forEach(([id, qty]) => {
      const cake = cakes.find((c) => c.id === id);
      if (cake && qty) {
        const hoursUsed = cakeHours[id] || cake.base_hours_included || 0;
        total += calculateItemCost(cake, qty, hoursUsed);
      }
    });
    // Snacks
    Object.entries(snackQty).forEach(([id, qty]) => {
      const snack = snacks.find((s) => s.id === id);
      if (snack && qty) {
        const hoursUsed = snackHours[id] || snack.base_hours_included || 0;
        total += calculateItemCost(snack, qty, hoursUsed);
      }
    });
    // Teams
    Object.entries(teamSelected).forEach(([id, selected]) => {
      const team = teams.find((t) => t.id === id);
      if (team && selected) {
        const hoursUsed = teamHours[id] || team.base_hours_included || 0;
        total += calculateItemCost(team, 1, hoursUsed);
      }
    });
    return total;
  };

  // Category counts (for showing number of items chosen per category)
  const categoryCounts = useMemo(() => {
    const cakesCount = Object.values(cakeQty).reduce((a,b)=>a+(b||0),0);
    const snacksCount = Object.values(snackQty).reduce((a,b)=>a+(b||0),0);
    const teamsCount = Object.values(teamSelected).filter(Boolean).length;
    return { cakes: cakesCount, snacks: snacksCount, teams: teamsCount };
  }, [cakeQty, snackQty, teamSelected]);

  const computeDetails = (): AddonPick[] => {
    const details: AddonPick[] = [];
    // Cakes
    Object.entries(cakeQty).forEach(([id, qty]) => {
      const cake = cakes.find((c) => c.id === id);
      if (cake && qty) {
        const hoursUsed = cakeHours[id] || cake.base_hours_included || undefined;
        const amount = calculateItemCost(cake, qty, hoursUsed);
        details.push({ 
          id, 
          name: cake.name, 
          category: 'cake', 
          qty, 
          unitPrice: cake.price, 
          amount,
          hours_used: hoursUsed
        });
      }
    });
    // Snacks
    Object.entries(snackQty).forEach(([id, qty]) => {
      const snack = snacks.find((s) => s.id === id);
      if (snack && qty) {
        const hoursUsed = snackHours[id] || snack.base_hours_included || undefined;
        const amount = calculateItemCost(snack, qty, hoursUsed);
        details.push({ 
          id, 
          name: snack.name, 
          category: 'snack', 
          qty, 
          unitPrice: snack.price, 
          amount,
          hours_used: hoursUsed
        });
      }
    });
    // Teams
    Object.entries(teamSelected).forEach(([id, selected]) => {
      const team = teams.find((t) => t.id === id);
      if (team && selected) {
        const hoursUsed = teamHours[id] || team.base_hours_included || undefined;
        const amount = calculateItemCost(team, 1, hoursUsed);
        details.push({ 
          id, 
          name: team.name, 
          category: 'team', 
          qty: 1, 
          unitPrice: team.price, 
          amount,
          hours_used: hoursUsed
        });
      }
    });
    return details;
  };

  // Prefill (edit mode) once cakes/snacks/teams loaded OR on mount if items injected
  useEffect(() => {
    if (didPrefill) return;
    if (!prefillItems || !prefillItems.length) return;
    // We require at least one catalogue fetch cycle (or proceed anyway for ids user supplied)
    let changedCake = false, changedSnack = false, changedTeam = false;
    const nextCake: Record<string, number> = { ...cakeQty };
    const nextSnack: Record<string, number> = { ...snackQty };
    const nextTeam: Record<string, boolean> = { ...teamSelected };
    prefillItems.forEach(p => {
      const qty = Math.max(1, p.qty || 1);
      if (p.category === 'cake') {
        // Match by id or (case-insensitive) name
        let id = p.id;
        if (!id && p.name) {
          const match = cakes.find(c => c.name.toLowerCase() === p.name!.toLowerCase());
          id = match?.id;
        }
        if (id) { nextCake[id] = qty; changedCake = true; }
      } else if (p.category === 'snack') {
        let id = p.id;
        if (!id && p.name) {
          const match = snacks.find(s => s.name.toLowerCase() === p.name!.toLowerCase());
          id = match?.id;
        }
        if (id) { nextSnack[id] = qty; changedSnack = true; }
      } else if (p.category === 'team') {
        let id = p.id;
        if (!id && p.name) {
          const match = teams.find(t => t.name.toLowerCase() === p.name!.toLowerCase());
          id = match?.id;
        }
        if (id) { nextTeam[id] = true; changedTeam = true; }
      }
    });
    if (changedCake) setCakeQty(nextCake);
    if (changedSnack) setSnackQty(nextSnack);
    if (changedTeam) setTeamSelected(nextTeam);
    if (changedCake || changedSnack || changedTeam) {
      setDidPrefill(true);
      // Push totals/details upward so parent reflects immediately
      const total = computeGrandTotal();
      onApplyTotal?.(total);
      onApplyDetails?.(computeDetails());
    }
  }, [prefillItems, cakes, snacks, teams, didPrefill]);

  // Auto-update parent when quantities or hours change (so selected add-ons container updates in real-time)
  useEffect(() => {
    if (onApplyDetails) {
      const details = computeDetails();
      onApplyDetails(details);
    }
    if (onApplyTotal) {
      const total = computeGrandTotal();
      onApplyTotal(total);
    }
  }, [cakeQty, snackQty, teamSelected, cakeHours, snackHours, teamHours, cakes, snacks, teams]);

  // Filtering based on current sheet
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (activeSheet === 'cake') {
      if (!q) return cakes;
      return cakes.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (activeSheet === 'snack') {
      if (programMode) {
        let filtered = snacks;
        if (q) filtered = filtered.filter((s) => s.name.toLowerCase().includes(q));
        return filtered;
      } else {
        let filtered = snacks.filter((s) => s.category === selectedFoodCategory);
        if (['breakfast', 'lunch', 'dinner', 'snacks'].includes(selectedFoodCategory)) {
          filtered = filtered.filter((s) => s.type === selectedFoodType);
        }
        if (q) {
          filtered = filtered.filter((s) => s.name.toLowerCase().includes(q));
        }
        return filtered;
      }
    }
    if (activeSheet === 'team') {
      if (!q) return teams;
      return teams.filter((t) => t.name.toLowerCase().includes(q));
    }
    return [];
  }, [activeSheet, cakes, snacks, teams, query, selectedFoodCategory, selectedFoodType]);

  const fetchCakes = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (!silent) { setLoading(true); setError(null); }
    try {
      const res = await ItemsAPI.list({ category: 'cake', space_id: spaceId });
      const mapped: CakeItem[] = res.items
        .filter((it: any) => !excludeItemNames.some(ex => String(it.name || '').toLowerCase().includes(String(ex).toLowerCase())))
        .map((it) => ({
        id: String(it.id),
        name: it.name,
        description: it.description || undefined,
        price: Math.round(Number(it.price) || 0),
        image: it.image_url || undefined,
        item_status: it.item_status,
        preparation_time_minutes: it.preparation_time_minutes,
        base_hours_included: it.base_hours_included || undefined,
        rate_per_extra_hour: it.rate_per_extra_hour || undefined,
      }));
      setCakes(mapped);
    } catch (e: any) {
      if (!silent) setError(e?.message || 'Failed to load cakes');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const openCakeModal = async () => {
    setActiveSheet('cake');
    if (cakes.length === 0) await fetchCakes();
  };

  const fetchSnacks = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (!silent) { setLoading(true); setError(null); }
    if (programMode) {
      setSnacks([
        { id: 'e1', name: 'Zumba Mat', description: 'Non-slip, high-density mat for workouts', price: 500, image: 'https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=400&q=60&auto=format&fit=crop', category: 'snacks', type: 'veg' },
        { id: 'e2', name: 'Zumba Dress', description: 'Breathable, quick-dry performance wear', price: 1200, image: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?w=400&q=60&auto=format&fit=crop', category: 'snacks', type: 'veg' },
        { id: 'e3', name: 'Resistance Bands Set', description: 'Set of 5 latex bands with carry pouch', price: 800, image: 'https://images.unsplash.com/photo-1585510879311-1511a60f7bae?w=400&q=60&auto=format&fit=crop', category: 'snacks', type: 'veg' },
        { id: 'e4', name: 'Skipping Rope', description: 'Adjustable speed jump rope', price: 300, image: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=400&q=60&auto=format&fit=crop', category: 'snacks', type: 'veg' },
        { id: 'e5', name: 'Sweat Towel', description: 'Microfiber quick-dry towel', price: 150, image: 'https://images.unsplash.com/photo-1520975939641-5a810fda9664?w=400&q=60&auto=format&fit=crop', category: 'snacks', type: 'veg' },
        { id: 'e6', name: 'Water Bottle (1L)', description: 'BPA-free shaker bottle', price: 250, image: 'https://images.unsplash.com/photo-1571757392712-7abcbdf1c510?w=400&q=60&auto=format&fit=crop', category: 'snacks', type: 'veg' },
        { id: 'e7', name: 'Yoga Block', description: 'High-density EVA foam block', price: 350, image: 'https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=400&q=60&auto=format&fit=crop', category: 'snacks', type: 'veg' },
        { id: 'e8', name: 'Ankle Weights (Pair)', description: 'Adjustable 1.5kg pair', price: 900, image: 'https://images.unsplash.com/photo-1579758682665-53b29330ad6b?w=400&q=60&auto=format&fit=crop', category: 'snacks', type: 'veg' },
      ]);
    } else {
      try {
        // Fetch all food items for the space, filter client-side by subcategory/type
        const res = await ItemsAPI.list({ category: 'food', space_id: spaceId });
        const mapped: SnackItem[] = res.items
          .filter((it: any) => !excludeItemNames.some(ex => String(it.name || '').toLowerCase().includes(String(ex).toLowerCase())))
          .map((it) => ({
            id: String(it.id),
            name: it.name,
            description: it.description || undefined,
            price: Math.round(Number(it.price) || 0),
            image: it.image_url || undefined,
            category: (it.subcategory as SnackItem['category']) || 'snacks',
            type: ((it.type as any) === 'non-veg' ? 'non-veg' : 'veg'),
            item_status: it.item_status,
            preparation_time_minutes: it.preparation_time_minutes,
            base_hours_included: it.base_hours_included || undefined,
            rate_per_extra_hour: it.rate_per_extra_hour || undefined,
          }));
        setSnacks(mapped);
      } catch (e: any) {
        if (!silent) setError(e?.message || 'Failed to load food & beverages');
      } finally {
        if (!silent) setLoading(false);
      }
      return;
    }
    if (!silent) setLoading(false);
  };

  const openSnackModal = async () => {
    setActiveSheet('snack');
    if (snacks.length === 0) await fetchSnacks();
  };

  const fetchTeams = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (!silent) { setLoading(true); setError(null); }
    try {
      const res = await ItemsAPI.list({ category: 'team', space_id: spaceId });
      const mapped: TeamItem[] = res.items
        .filter((it: any) => !excludeItemNames.some(ex => String(it.name || '').toLowerCase().includes(String(ex).toLowerCase())))
        .map((it) => ({
        id: String(it.id),
        name: it.name,
        description: it.description || undefined,
        price: Math.round(Number(it.price) || 0),
        image: it.image_url || require('@/assets/images/ganamela.jpg'),
        video_url: it.video_url || undefined,
        profile_image_url: it.profile_image_url || undefined,
        profile_info: it.profile_info || undefined,
        performance_team_profile: it.performance_team_profile || undefined,
        item_status: it.item_status,
        preparation_time_minutes: it.preparation_time_minutes,
        base_hours_included: it.base_hours_included || undefined,
        rate_per_extra_hour: it.rate_per_extra_hour || undefined,
      }));
      setTeams(mapped);
    } catch (e: any) {
      if (!silent) setError(e?.message || 'Failed to load teams');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const openTeamModal = async () => {
    setActiveSheet('team');
    if (teams.length === 0) await fetchTeams();
  };

  // Handle external modal trigger from paid features
  useEffect(() => {
    if (triggerModal === 'cake') {
      openCakeModal();
    } else if (triggerModal === 'snack') {
      openSnackModal();
    } else if (triggerModal === 'team') {
      openTeamModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerModal]);

  // Pull-to-refresh and manual refresh
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (activeSheet === 'cake') await fetchCakes();
      else if (activeSheet === 'snack') await fetchSnacks();
      else if (activeSheet === 'team') await fetchTeams();
    } finally {
      setRefreshing(false);
    }
  };

  // Auto-refetch when vendor items change (e.g., after editing in vendor screen)
  useEffect(() => {
    const unsubscribe = Events.on('vendor-items-changed', () => {
      // Silently refetch lists that were already loaded, to keep UI up-to-date
      if (cakes.length > 0) fetchCakes({ silent: true });
      if (snacks.length > 0) fetchSnacks({ silent: true });
      if (teams.length > 0) fetchTeams({ silent: true });
    });
    return unsubscribe;
  }, [cakes.length, snacks.length, teams.length, spaceId]);

  // Prefetch data on mount or when dependency changes
  useEffect(() => {
    if (prefetch) {
      fetchCakes({ silent: true });
      fetchSnacks({ silent: true });
      fetchTeams({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefetch, spaceId, programMode]);

  // Quantity helpers - with availability checks
  const incCake = (id: string) => {
    const cake = cakes.find(c => c.id === id);
    if (!cake) return;
    
    // Check if date/time is selected for items with prep time
    const prepTime = cake.preparation_time_minutes || 0;
    if (prepTime > 0 && !eventDateTime) {
      Alert.alert(
        'Date & Time Required',
        'Please select date and time first to check if this item can be prepared in time.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    const deliveryCheck = canItemBeDelivered(prepTime);
    const isUnavailable = cake.item_status ? cake.item_status !== 'available' : false;
    const cannotDeliver = prepTime > 0 && !deliveryCheck.canDeliver;
    if (isUnavailable || cannotDeliver) return; // Don't allow increment if disabled
    setCakeQty((q) => ({ ...q, [id]: (q[id] || 0) + 1 }));
  };
  const decCake = (id: string) => setCakeQty((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) - 1) }));
  const incSnack = (id: string) => {
    const snack = snacks.find(s => s.id === id);
    if (!snack) return;
    
    // Check if date/time is selected for items with prep time
    const prepTime = snack.preparation_time_minutes || 0;
    if (prepTime > 0 && !eventDateTime) {
      Alert.alert(
        'Date & Time Required',
        'Please select date and time first to check if this item can be prepared in time.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    const deliveryCheck = canItemBeDelivered(prepTime);
    const isUnavailable = snack.item_status ? snack.item_status !== 'available' : false;
    const cannotDeliver = prepTime > 0 && !deliveryCheck.canDeliver;
    if (isUnavailable || cannotDeliver) return; // Don't allow increment if disabled
    setSnackQty((q) => ({ ...q, [id]: (q[id] || 0) + 1 }));
  };
  const decSnack = (id: string) => setSnackQty((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) - 1) }));
  
  // Editable quantity functions
  const updateCakeQty = (id: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setCakeQty((q) => ({ ...q, [id]: Math.max(0, numValue) }));
  };
  
  const updateSnackQty = (id: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setSnackQty((q) => ({ ...q, [id]: Math.max(0, numValue) }));
  };
  
  // Hour update functions
  const updateCakeHours = (id: string, hours: number) => {
    setCakeHours((h) => ({ ...h, [id]: Math.max(0, hours) }));
  };
  const updateSnackHours = (id: string, hours: number) => {
    setSnackHours((h) => ({ ...h, [id]: Math.max(0, hours) }));
  };
  const updateTeamHours = (id: string, hours: number) => {
    setTeamHours((h) => ({ ...h, [id]: Math.max(0, hours) }));
  };

  // Hour stepper helpers (enforce minimum of base included hours)
  const incCakeHours = (id: string, baseIncluded: number = 0) => {
    setCakeHours((h) => {
      const current = h[id] ?? baseIncluded;
      const next = Math.max(baseIncluded, current + 1);
      return { ...h, [id]: next };
    });
  };
  const decCakeHours = (id: string, baseIncluded: number = 0) => {
    setCakeHours((h) => {
      const current = h[id] ?? baseIncluded;
      const next = Math.max(baseIncluded, current - 1);
      return { ...h, [id]: next };
    });
  };
  const incSnackHours = (id: string, baseIncluded: number = 0) => {
    setSnackHours((h) => {
      const current = h[id] ?? baseIncluded;
      const next = Math.max(baseIncluded, current + 1);
      return { ...h, [id]: next };
    });
  };
  const decSnackHours = (id: string, baseIncluded: number = 0) => {
    setSnackHours((h) => {
      const current = h[id] ?? baseIncluded;
      const next = Math.max(baseIncluded, current - 1);
      return { ...h, [id]: next };
    });
  };
  const incTeamHours = (id: string, baseIncluded: number = 0) => {
    setTeamHours((h) => {
      const current = h[id] ?? baseIncluded;
      const next = Math.max(baseIncluded, current + 1);
      return { ...h, [id]: next };
    });
  };
  const decTeamHours = (id: string, baseIncluded: number = 0) => {
    setTeamHours((h) => {
      const current = h[id] ?? baseIncluded;
      const next = Math.max(baseIncluded, current - 1);
      return { ...h, [id]: next };
    });
  };
  
  const toggleTeam = (id: string) => {
    const team = teams.find(t => t.id === id);
    if (!team) return;
    
    // Check if date/time is selected for items with prep time
    const prepTime = team.preparation_time_minutes || 0;
    if (prepTime > 0 && !eventDateTime) {
      Alert.alert(
        'Date & Time Required',
        'Please select date and time first to check if this item can be prepared in time.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    const deliveryCheck = canItemBeDelivered(prepTime);
    const isUnavailable = team.item_status ? team.item_status !== 'available' : false;
    const cannotDeliver = prepTime > 0 && !deliveryCheck.canDeliver;
    if (isUnavailable || cannotDeliver) return; // Don't allow toggle if disabled
    setTeamSelected((s) => ({ ...s, [id]: !s[id] }));
  };

  return (
    <ThemedView style={[!embedded ? styles.card : null, embedded ? styles.containerEmbedded : styles.container]}>
      {/* Title */}
      <ThemedText style={styles.cardTitle}>{title || 'Optional Add-ons'}</ThemedText>

      {/* List of add-ons (rows, matching card content style) */}
      <View style={{ gap: 8 }}>
        {addons.map((item, idx) => (
        <TouchableOpacity
          key={item.key}
          activeOpacity={0.8}
          style={[styles.row, idx < addons.length - 1 ? styles.rowDivided : null]}
          onPress={() => {
            if (item.key === 'cake') openCakeModal();
            if (item.key === 'snack') openSnackModal();
            if (item.key === 'team') openTeamModal();
          }}
        >
            <View style={styles.thumbWrap}>
              <RNImage source={resolveImageSource(item.image) || placeholderImg} style={styles.thumb} resizeMode="cover" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.rowTitle}>{item.title}</ThemedText>
              {item.subtitle ? <ThemedText style={styles.rowSub}>{item.subtitle}</ThemedText> : null}
              {/* Count badge */}
              <View style={{ flexDirection:'row', marginTop:4, gap:6 }}>
                {item.key === 'cake' && categoryCounts.cakes > 0 ? (
                  <View style={styles.countBadge}><ThemedText style={styles.countBadgeText}>{categoryCounts.cakes} selected</ThemedText></View>
                ) : null}
                {item.key === 'snack' && categoryCounts.snacks > 0 ? (
                  <View style={styles.countBadge}><ThemedText style={styles.countBadgeText}>{categoryCounts.snacks} selected</ThemedText></View>
                ) : null}
                {item.key === 'team' && categoryCounts.teams > 0 ? (
                  <View style={styles.countBadge}><ThemedText style={styles.countBadgeText}>{categoryCounts.teams} selected</ThemedText></View>
                ) : null}
              </View>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => {
                if (item.key === 'cake') return openCakeModal();
                if (item.key === 'snack') return openSnackModal();
                if (item.key === 'team') return openTeamModal();
              }}
            >
              <ThemedText style={styles.addBtnText}>Add</ThemedText>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom Sheet Modal (dynamic for cake/snack/team) */}
      <Modal visible={!!activeSheet} animationType="slide" transparent onRequestClose={() => setActiveSheet(null)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setActiveSheet(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <ThemedText style={styles.sheetTitle}>
                  {activeSheet === 'cake' ? 'Cake' : activeSheet === 'snack' ? 'Food & Beverages' : 'Performing Team'}
                </ThemedText>
                <ThemedText style={styles.sheetSub}>
                  {activeSheet === 'cake' ? 'Choose your favorite cake' : activeSheet === 'snack' ? 'Select food and beverages' : 'Choose performing team'}
                </ThemedText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  style={{ borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
                  onPress={() => {
                    if (activeSheet === 'cake') return fetchCakes();
                    if (activeSheet === 'snack') return fetchSnacks();
                    if (activeSheet === 'team') return fetchTeams();
                  }}
                >
                  <ThemedText style={{ color: '#111827', fontWeight: '600' }}>Refresh</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveSheet(null)}>
                  <ThemedText style={styles.skip}>Skip</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#9CA3AF" />
              <TextInput
                placeholder="Search for items"
                placeholderTextColor="#9CA3AF"
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
              />
            </View>

            {/* Food Category Tabs (only for snack modal in event mode) */}
            {activeSheet === 'snack' && !programMode && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.foodCategoryTabsScrollView}
                contentContainerStyle={{ gap: 8 }}
              >
                <TouchableOpacity
                  style={[styles.foodCategoryTab, selectedFoodCategory === 'breakfast' && styles.foodCategoryTabActive]}
                  onPress={() => setSelectedFoodCategory('breakfast')}
                >
                  <ThemedText style={[styles.foodCategoryTabText, selectedFoodCategory === 'breakfast' && styles.foodCategoryTabTextActive]}>
                    Breakfast
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.foodCategoryTab, selectedFoodCategory === 'lunch' && styles.foodCategoryTabActive]}
                  onPress={() => setSelectedFoodCategory('lunch')}
                >
                  <ThemedText style={[styles.foodCategoryTabText, selectedFoodCategory === 'lunch' && styles.foodCategoryTabTextActive]}>
                    Lunch
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.foodCategoryTab, selectedFoodCategory === 'dinner' && styles.foodCategoryTabActive]}
                  onPress={() => setSelectedFoodCategory('dinner')}
                >
                  <ThemedText style={[styles.foodCategoryTabText, selectedFoodCategory === 'dinner' && styles.foodCategoryTabTextActive]}>
                    Dinner
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.foodCategoryTab, selectedFoodCategory === 'beverages' && styles.foodCategoryTabActive]}
                  onPress={() => setSelectedFoodCategory('beverages')}
                >
                  <ThemedText style={[styles.foodCategoryTabText, selectedFoodCategory === 'beverages' && styles.foodCategoryTabTextActive]}>
                    Beverages
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.foodCategoryTab, selectedFoodCategory === 'desserts' && styles.foodCategoryTabActive]}
                  onPress={() => setSelectedFoodCategory('desserts')}
                >
                  <ThemedText style={[styles.foodCategoryTabText, selectedFoodCategory === 'desserts' && styles.foodCategoryTabTextActive]}>
                    Desserts
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.foodCategoryTab, selectedFoodCategory === 'snacks' && styles.foodCategoryTabActive]}
                  onPress={() => setSelectedFoodCategory('snacks')}
                >
                  <ThemedText style={[styles.foodCategoryTabText, selectedFoodCategory === 'snacks' && styles.foodCategoryTabTextActive]}>
                    Snacks
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.foodCategoryTab, selectedFoodCategory === 'fish-seafood' && styles.foodCategoryTabActive]}
                  onPress={() => setSelectedFoodCategory('fish-seafood')}
                >
                  <ThemedText style={[styles.foodCategoryTabText, selectedFoodCategory === 'fish-seafood' && styles.foodCategoryTabTextActive]}>
                    Fish & Seafood
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.foodCategoryTab, selectedFoodCategory === 'mutton-beef' && styles.foodCategoryTabActive]}
                  onPress={() => setSelectedFoodCategory('mutton-beef')}
                >
                  <ThemedText style={[styles.foodCategoryTabText, selectedFoodCategory === 'mutton-beef' && styles.foodCategoryTabTextActive]}>
                    Mutton & Beef
                  </ThemedText>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Veg/Non-Veg Tabs (only for snack modal in event mode) */}
            {activeSheet === 'snack' && !programMode && (
              <View style={styles.vegNonVegContainer}>
                {['breakfast', 'lunch', 'dinner', 'snacks'].includes(selectedFoodCategory) ? (
                  <View style={styles.vegNonVegTabs}>
                <TouchableOpacity
                  style={[styles.vegNonVegTab, selectedFoodType === 'veg' && styles.vegNonVegTabActive]}
                  onPress={() => setSelectedFoodType('veg')}
                >
                  <View style={styles.vegNonVegIndicator}>
                    <View style={[styles.vegNonVegDot, { backgroundColor: '#10B981' }]} />
                    <ThemedText style={[styles.vegNonVegTabText, selectedFoodType === 'veg' && styles.vegNonVegTabTextActive]}>
                      Veg
                    </ThemedText>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.vegNonVegTab, selectedFoodType === 'non-veg' && styles.vegNonVegTabActive]}
                  onPress={() => setSelectedFoodType('non-veg')}
                >
                  <View style={styles.vegNonVegIndicator}>
                    <View style={[styles.vegNonVegDot, { backgroundColor: '#ef4444' }]} />
                    <ThemedText style={[styles.vegNonVegTabText, selectedFoodType === 'non-veg' && styles.vegNonVegTabTextActive]}>
                      Non-Veg
                    </ThemedText>
                  </View>
                </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.vegNonVegPlaceholder} />
                )}
              </View>
            )}

            {error ? (
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            ) : null}

            {/* Render list based on active sheet */}
            {loading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color="#10B981" />
                <ThemedText style={{ marginTop: 8, color: '#6B7280' }}>Loading items…</ThemedText>
              </View>
            ) : (
              <FlatList
                data={filteredItems as (CakeItem | SnackItem | TeamItem)[]}
                keyExtractor={(item) => item.id}
                key={`${activeSheet}-${eventDateTime?.getTime() || 'no-date'}-list`}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
                refreshing={refreshing}
                onRefresh={onRefresh}
                renderItem={({ item, index }) => {
                // Add category headers
                const showEverydayHeader = activeSheet === 'cake' && index === 0;
                const showTrendyHeader = activeSheet === 'cake' && item.id === '12'; // First trendy item
                
                if (activeSheet === 'cake') {
                  const count = cakeQty[item.id] || 0;
                  return (
                    <View>
                      {showEverydayHeader && (
                        <View style={styles.categoryHeader}>
                          <ThemedText style={styles.categoryTitle}>Everyday & Celebration Cakes</ThemedText>
                        </View>
                      )}
                      {showTrendyHeader && (
                        <View style={styles.categoryHeader}>
                          <ThemedText style={styles.categoryTitle}>Trendy Specials</ThemedText>
                        </View>
                      )}
                      <View style={styles.itemRow}>
                        <View>
                          <TouchableOpacity onPress={() => {
                            setImagePopup({
                              visible: true,
                              image: typeof item.image === 'string' ? item.image : '',
                              title: item.name
                            });
                          }}>
                            <RNImage source={resolveImageSource(item.image) || placeholderImg} style={styles.itemImage} resizeMode="cover" />
                          </TouchableOpacity>
                          {/* Item Media Viewer - shows count link */}
                          <ItemMediaViewer
                            itemId={parseInt(item.id)}
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
                          <ThemedText style={styles.itemTitle}>{item.name}</ThemedText>
                          <ThemedText style={styles.itemDesc}>{item.description}</ThemedText>
                          <ThemedText style={styles.itemPrice}>₹{item.price}</ThemedText>
                          
                          {/* Item Status Badge */}
                          {item.item_status && item.item_status !== 'available' && (
                            <View style={[
                              styles.badge,
                              item.item_status === 'out_of_stock' ? styles.badgeOutOfStock : styles.badgeMaintenance
                            ]}>
                              <Ionicons 
                                name={item.item_status === 'out_of_stock' ? 'close-circle' : 'construct'} 
                                size={12} 
                                color={item.item_status === 'out_of_stock' ? '#DC2626' : '#D97706'} 
                              />
                              <ThemedText style={[
                                styles.badgeText,
                                item.item_status === 'out_of_stock' ? styles.badgeTextOutOfStock : styles.badgeTextMaintenance
                              ]}>
                                {item.item_status === 'out_of_stock' ? 'Out of Stock' : 'Currently Not Available'}
                              </ThemedText>
                            </View>
                          )}
                          
                          {/* Preparation Time - Only show warning if prep time is required AND insufficient time */}
                          {(() => {
                            const prepTime = item.preparation_time_minutes || 0;
                            
                            // Only show badge if prep time is required, date/time is selected, AND insufficient time
                            if (prepTime <= 0 || !eventDateTime) {
                              return null;
                            }
                            
                            const deliveryCheck = canItemBeDelivered(prepTime);
                            
                            // Only show warning badge if not enough time
                            if (!deliveryCheck.canDeliver) {
                              return (
                                <View style={[styles.badge, styles.badgePrepWarning]}>
                                  <Ionicons name="alert-circle" size={12} color="#DC2626" />
                                  <ThemedText style={[styles.badgeText, styles.badgeTextPrepWarning]}>
                                    Needs {Math.ceil(prepTime / 60)}h prep
                                  </ThemedText>
                                </View>
                              );
                            }
                            
                            // Don't show badge if prep time is sufficient
                            return null;
                          })()}
                        </View>
                        {(() => {
                          const prepTime = item.preparation_time_minutes || 0;
                          const deliveryCheck = canItemBeDelivered(prepTime);
                          // If item_status exists, check it's available; if undefined/null, treat as available
                          const isUnavailable = item.item_status ? item.item_status !== 'available' : false;
                          const cannotDeliver = prepTime > 0 && !deliveryCheck.canDeliver;
                          const isDisabled = isUnavailable || cannotDeliver;
                          
                          if (count === 0) {
                            // Check if date/time is needed for items with prep time
                            const prepTimeForCheck = item.preparation_time_minutes || 0;
                            const needsDateTime = prepTimeForCheck > 0 && !eventDateTime;
                            
                            return (
                              <TouchableOpacity 
                                style={[styles.itemAdd, (isDisabled || needsDateTime) && { backgroundColor: '#E5E7EB', opacity: 0.6 }]} 
                                onPress={() => {
                                  if (needsDateTime) {
                                    Alert.alert(
                                      'Date & Time Required',
                                      'Please select date and time first to check if this item can be prepared in time.',
                                      [{ text: 'OK' }]
                                    );
                                    return;
                                  }
                                  if (!isDisabled) incCake(item.id);
                                }}
                                disabled={isDisabled || needsDateTime}
                              >
                                <ThemedText style={[styles.itemAddText, (isDisabled || needsDateTime) && { color: '#9CA3AF' }]}>
                                  {needsDateTime ? 'Select Date & Time' :
                                   isUnavailable ? (item.item_status === 'out_of_stock' ? 'Out of Stock' : 'Currently Not Available') : 
                                   cannotDeliver ? 'Not Enough Time' : 'Add'}
                                </ThemedText>
                              </TouchableOpacity>
                            );
                          }
                          
                          return (
                            <View style={styles.qtyCtrl}>
                              <TouchableOpacity onPress={() => decCake(item.id)}>
                                <Ionicons name="remove-circle" size={22} color="#ef4444" />
                              </TouchableOpacity>
                              <TextInput
                                style={styles.qtyInput}
                                value={count.toString()}
                                onChangeText={(value) => {
                                  const numValue = parseInt(value) || 0;
                                  // Don't allow setting quantity if item is disabled
                                  const prepTime = item.preparation_time_minutes || 0;
                                  const deliveryCheck = canItemBeDelivered(prepTime);
                                  const isUnavailable = item.item_status ? item.item_status !== 'available' : false;
                                  const cannotDeliver = prepTime > 0 && !deliveryCheck.canDeliver;
                                  if (!isUnavailable && !cannotDeliver) {
                                    updateCakeQty(item.id, value);
                                  }
                                }}
                                keyboardType="numeric"
                                selectTextOnFocus
                                editable={!isDisabled}
                              />
                              <TouchableOpacity onPress={() => incCake(item.id)} disabled={isDisabled}>
                                <Ionicons name="add-circle" size={22} color={isDisabled ? "#9CA3AF" : "#10B981"} />
                              </TouchableOpacity>
                            </View>
                          );
                        })()}
                        
                        {/* Hour-based Pricing UI for Cakes */}
                        {count > 0 && item.base_hours_included && item.base_hours_included > 0 && item.rate_per_extra_hour && (
                          <View style={{ marginTop: 12, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                              <ThemedText style={{ fontSize: 12, color: '#6B7280' }}>Included Hours:</ThemedText>
                              <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>{item.base_hours_included} hours</ThemedText>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                              <ThemedText style={{ fontSize: 12, color: '#6B7280' }}>Rate per Extra Hour:</ThemedText>
                              <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>₹{item.rate_per_extra_hour}/hour</ThemedText>
                            </View>
                            <View style={{ marginBottom: 8 }}>
                              <ThemedText style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Total Hours Required:</ThemedText>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <TouchableOpacity onPress={() => decCakeHours(item.id, item.base_hours_included ?? 0)}>
                                  <Ionicons name="remove-circle" size={22} color="#ef4444" />
                                </TouchableOpacity>
                                <TextInput
                                  style={{ width: 70, height: 36, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, textAlign: 'center', backgroundColor: '#fff', fontSize: 14, fontWeight: '600', color: '#111827' }}
                                  value={String((cakeHours[item.id] ?? (item.base_hours_included ?? 0)))}
                                  onChangeText={(value) => {
                                    const parsed = parseInt(value, 10);
                                    if (Number.isNaN(parsed)) return; // ignore non-numeric
                                    updateCakeHours(item.id, Math.max(item.base_hours_included ?? 0, parsed));
                                  }}
                                  keyboardType="numeric"
                                  placeholder={`${item.base_hours_included}`}
                                />
                                <TouchableOpacity onPress={() => incCakeHours(item.id, item.base_hours_included ?? 0)}>
                                  <Ionicons name="add-circle" size={22} color="#10B981" />
                                </TouchableOpacity>
                              </View>
                            </View>
                            {(() => {
                              const hoursUsed = cakeHours[item.id] || item.base_hours_included || 0;
                              const extraHours = Math.max(0, hoursUsed - item.base_hours_included);
                              const extraCost = extraHours * item.rate_per_extra_hour * count;
                              if (extraHours > 0) {
                                return (
                                  <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                                    <ThemedText style={{ fontSize: 12, color: '#DC2626', fontWeight: '600' }}>
                                      Extra {extraHours} hour{extraHours !== 1 ? 's' : ''} × ₹{item.rate_per_extra_hour} × {count} = ₹{extraCost} extra
                                    </ThemedText>
                                  </View>
                                );
                              }
                              return null;
                            })()}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                }
                if (activeSheet === 'snack') {
                  const count = snackQty[item.id] || 0;
                  return (
                    <View style={styles.foodItemCard}>
                      <View>
                        <View style={styles.foodItemImageContainer}>
                          <TouchableOpacity onPress={() => {
                            setImagePopup({
                              visible: true,
                              image: typeof item.image === 'string' ? item.image : '',
                              title: item.name
                            });
                          }}>
                            <RNImage source={resolveImageSource(item.image) || placeholderImg} style={styles.foodItemImage} resizeMode="cover" />
                            <View style={[styles.foodItemVegDot, { backgroundColor: (item as any).type === 'veg' ? '#10B981' : '#ef4444' }]} />
                          </TouchableOpacity>
                        </View>
                        {/* Item Media Viewer - shows count link */}
                        <ItemMediaViewer
                          itemId={parseInt(item.id)}
                          media={item.media}
                          showThumbnails={false}
                          onMediaLoad={(media) => {
                            if (media && media.length > 0) {
                              setItemsWithMedia(prev => new Set(prev).add(item.id));
                            }
                          }}
                        />
                      </View>
                      <View style={styles.foodItemContent}>
                        <View style={styles.foodItemHeader}>
                          <ThemedText style={styles.foodItemTitle}>{item.name}</ThemedText>
                        </View>
                        <ThemedText style={styles.foodItemDesc}>{item.description}</ThemedText>
                        
                        {/* Item Status Badge */}
                        {item.item_status && item.item_status !== 'available' && (
                          <View style={[
                            styles.badge,
                            item.item_status === 'out_of_stock' ? styles.badgeOutOfStock : styles.badgeMaintenance
                          ]}>
                            <Ionicons 
                              name={item.item_status === 'out_of_stock' ? 'close-circle' : 'construct'} 
                              size={12} 
                              color={item.item_status === 'out_of_stock' ? '#DC2626' : '#D97706'} 
                            />
                            <ThemedText style={[
                              styles.badgeText,
                              item.item_status === 'out_of_stock' ? styles.badgeTextOutOfStock : styles.badgeTextMaintenance
                            ]}>
                              {item.item_status === 'out_of_stock' ? 'Out of Stock' : 'Under Maintenance'}
                            </ThemedText>
                          </View>
                        )}
                        
                        {/* Preparation Time - Always Show */}
                        {(() => {
                          const prepTime = item.preparation_time_minutes || 0;
                          const deliveryCheck = canItemBeDelivered(prepTime);
                          
                          if (prepTime > 0 && !deliveryCheck.canDeliver) {
                            return (
                              <View style={[styles.badge, styles.badgePrepWarning]}>
                                <Ionicons name="alert-circle" size={12} color="#DC2626" />
                                <ThemedText style={[styles.badgeText, styles.badgeTextPrepWarning]}>
                                  Needs {Math.ceil(prepTime / 60)}h prep
                                </ThemedText>
                              </View>
                            );
                          }
                          
                          if (prepTime > 0) {
                            return (
                              <View style={[styles.badge, styles.badgePrepInfo]}>
                                <Ionicons name="time-outline" size={11} color="#6B7280" />
                                <ThemedText style={[styles.badgeText, styles.badgeTextPrepInfo]}>
                                  {Math.ceil(prepTime / 60)}h prep
                                </ThemedText>
                              </View>
                            );
                          }
                          
                          return null;
                        })()}
                        
                        <View style={styles.foodItemFooter}>
                          <ThemedText style={styles.foodItemPrice}>₹{item.price}</ThemedText>
                          {(() => {
                            const prepTime = item.preparation_time_minutes || 0;
                            const deliveryCheck = canItemBeDelivered(prepTime);
                            // If item_status exists, check it's available; if undefined/null, treat as available
                            const isUnavailable = item.item_status ? item.item_status !== 'available' : false;
                            const cannotDeliver = prepTime > 0 && !deliveryCheck.canDeliver;
                            const isDisabled = isUnavailable || cannotDeliver;
                            
                            if (count === 0) {
                              // Check if date/time is needed for items with prep time
                              const prepTimeForCheck = item.preparation_time_minutes || 0;
                              const needsDateTime = prepTimeForCheck > 0 && !eventDateTime;
                              
                              return (
                                <TouchableOpacity 
                                  style={[styles.foodItemAddBtn, (isDisabled || needsDateTime) && { backgroundColor: '#E5E7EB', opacity: 0.6 }]} 
                                  onPress={() => {
                                    if (needsDateTime) {
                                      Alert.alert(
                                        'Date & Time Required',
                                        'Please select date and time first to check if this item can be prepared in time.',
                                        [{ text: 'OK' }]
                                      );
                                      return;
                                    }
                                    if (!isDisabled) incSnack(item.id);
                                  }}
                                  disabled={isDisabled || needsDateTime}
                                >
                                  <ThemedText style={[styles.foodItemAddText, (isDisabled || needsDateTime) && { color: '#9CA3AF' }]}>
                                    {needsDateTime ? 'Select Date & Time' :
                                     isUnavailable ? (item.item_status === 'out_of_stock' ? 'Out of Stock' : 'Currently Not Available') : 
                                     cannotDeliver ? 'Not Enough Time' : 'Add'}
                                  </ThemedText>
                                </TouchableOpacity>
                              );
                            }
                            
                            return (
                              <View style={styles.foodItemQtyCtrl}>
                                <TouchableOpacity onPress={() => decSnack(item.id)}>
                                  <Ionicons name="remove-circle" size={22} color="#ef4444" />
                                </TouchableOpacity>
                                <TextInput
                                  style={styles.foodItemQtyInput}
                                  value={count.toString()}
                                  onChangeText={(value) => {
                                    const numValue = parseInt(value) || 0;
                                    // Don't allow setting quantity if item is disabled
                                    const prepTime = item.preparation_time_minutes || 0;
                                    const deliveryCheck = canItemBeDelivered(prepTime);
                                    const isUnavailable = item.item_status ? item.item_status !== 'available' : false;
                                    const cannotDeliver = prepTime > 0 && !deliveryCheck.canDeliver;
                                    if (!isUnavailable && !cannotDeliver) {
                                      updateSnackQty(item.id, value);
                                    }
                                  }}
                                  keyboardType="numeric"
                                  selectTextOnFocus
                                  editable={!isDisabled}
                                />
                                <TouchableOpacity onPress={() => incSnack(item.id)} disabled={isDisabled}>
                                  <Ionicons name="add-circle" size={22} color={isDisabled ? "#9CA3AF" : "#10B981"} />
                                </TouchableOpacity>
                              </View>
                            );
                          })()}
                          
                          {/* Hour-based Pricing UI for Snacks */}
                          {count > 0 && item.base_hours_included && item.base_hours_included > 0 && item.rate_per_extra_hour && (
                            <View style={{ marginTop: 12, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                <ThemedText style={{ fontSize: 12, color: '#6B7280' }}>Included Hours:</ThemedText>
                                <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>{item.base_hours_included} hours</ThemedText>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                <ThemedText style={{ fontSize: 12, color: '#6B7280' }}>Rate per Extra Hour:</ThemedText>
                                <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>₹{item.rate_per_extra_hour}/hour</ThemedText>
                              </View>
                              <View style={{ marginBottom: 8 }}>
                                <ThemedText style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Total Hours Required:</ThemedText>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <TouchableOpacity onPress={() => decSnackHours(item.id, item.base_hours_included ?? 0)}>
                                    <Ionicons name="remove-circle" size={22} color="#ef4444" />
                                  </TouchableOpacity>
                                  <TextInput
                                    style={{ width: 70, height: 36, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, textAlign: 'center', backgroundColor: '#fff', fontSize: 14, fontWeight: '600', color: '#111827' }}
                                    value={String((snackHours[item.id] ?? (item.base_hours_included ?? 0)))}
                                    onChangeText={(value) => {
                                      const parsed = parseInt(value, 10);
                                      if (Number.isNaN(parsed)) return;
                                      updateSnackHours(item.id, Math.max(item.base_hours_included ?? 0, parsed));
                                    }}
                                    keyboardType="numeric"
                                    placeholder={`${item.base_hours_included}`}
                                  />
                                  <TouchableOpacity onPress={() => incSnackHours(item.id, item.base_hours_included ?? 0)}>
                                    <Ionicons name="add-circle" size={22} color="#10B981" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                              {(() => {
                                const hoursUsed = snackHours[item.id] || item.base_hours_included || 0;
                                const extraHours = Math.max(0, hoursUsed - item.base_hours_included);
                                const extraCost = extraHours * item.rate_per_extra_hour * count;
                                if (extraHours > 0) {
                                  return (
                                    <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                                      <ThemedText style={{ fontSize: 12, color: '#DC2626', fontWeight: '600' }}>
                                        Extra {extraHours} hour{extraHours !== 1 ? 's' : ''} × ₹{item.rate_per_extra_hour} × {count} = ₹{extraCost} extra
                                      </ThemedText>
                                    </View>
                                  );
                                }
                                return null;
                              })()}
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                }
                if (activeSheet === 'team') {
                  const teamItem = item as TeamItem;
                  const selected = teamSelected[teamItem.id] || false;
                  const profile = teamItem.performance_team_profile;
                  const teamName = profile?.team_name || teamItem.name;
                  const specialties = profile?.specialties || [];
                  const genres = profile?.genres || [];
                  const teamMembers = profile?.team_members || [];
                  const experience = profile?.experience || [];
                  const achievements = profile?.achievements || [];
                  const establishedYear = profile?.established_year;
                  const totalExperience = profile?.total_experience;
                  const videoCount = (profile?.performance_videos || []).length;
                  
                  return (
                    <View style={[styles.itemRow, { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginVertical: 8, marginHorizontal: 16, borderWidth: selected ? 2 : 1, borderColor: selected ? '#2563EB' : '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }]}>
                      {/* Image Container with Badges */}
                      <View style={{ position: 'relative', marginRight: 12 }}>
                        <TouchableOpacity onPress={() => setTeamDetailModal({ visible: true, team: teamItem })}>
                          <RNImage 
                            source={resolveImageSource(teamItem.profile_image_url || teamItem.image) || placeholderImg} 
                            style={{ width: 120, height: 120, borderRadius: 12 }} 
                            resizeMode="cover" 
                          />
                        </TouchableOpacity>
                        {(videoCount > 0 || teamItem.video_url) && (
                          <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0, 0, 0, 0.7)', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Ionicons name="play-circle" size={14} color="#fff" />
                            <ThemedText style={{ fontSize: 10, fontWeight: '600', color: '#fff' }}>
                              {videoCount || 1}+
                            </ThemedText>
                          </View>
                        )}
                        {/* Item Media Viewer - shows count link */}
                        <ItemMediaViewer
                          itemId={parseInt(teamItem.id)}
                          media={teamItem.media}
                          showThumbnails={false}
                          onMediaLoad={(media) => {
                            if (media && media.length > 0) {
                              setItemsWithMedia(prev => new Set(prev).add(teamItem.id));
                            }
                          }}
                        />
                      </View>
                      
                      {/* Content */}
                      <View style={{ flex: 1 }}>
                        {/* Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <TouchableOpacity onPress={() => setTeamDetailModal({ visible: true, team: teamItem })} style={{ flex: 1 }}>
                            <ThemedText style={[styles.itemTitle, { fontSize: 16, fontWeight: '700' }]} numberOfLines={2}>
                              {teamName}
                            </ThemedText>
                          </TouchableOpacity>
                        </View>
                        
                        {/* Meta Info */}
                        {(totalExperience || teamMembers.length > 0) && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                            {totalExperience && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Ionicons name="time-outline" size={11} color="#6B7280" />
                                <ThemedText style={{ fontSize: 10, color: '#6B7280', fontWeight: '500' }}>{totalExperience}</ThemedText>
                              </View>
                            )}
                            {teamMembers.length > 0 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Ionicons name="people-outline" size={11} color="#6B7280" />
                                <ThemedText style={{ fontSize: 10, color: '#6B7280', fontWeight: '500' }}>{teamMembers.length} Members</ThemedText>
                              </View>
                            )}
                          </View>
                        )}
                        
                        {/* Bio/Description */}
                        {(profile?.detailed_bio || teamItem.description) && (
                          <ThemedText style={{ fontSize: 12, color: '#6B7280', lineHeight: 16, marginBottom: 6 }} numberOfLines={2}>
                            {profile?.detailed_bio || teamItem.description}
                          </ThemedText>
                        )}
                        
                        {/* Specialties & Genres Tags */}
                        {(specialties.length > 0 || genres.length > 0) && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                            {specialties.slice(0, 2).map((spec: string, idx: number) => (
                              <View key={idx} style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#DBEAFE' }}>
                                <ThemedText style={{ fontSize: 10, color: '#1E40AF', fontWeight: '500' }}>{spec}</ThemedText>
                              </View>
                            ))}
                            {genres.slice(0, 1).map((genre: string, idx: number) => (
                              <View key={`genre-${idx}`} style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0' }}>
                                <ThemedText style={{ fontSize: 10, color: '#059669', fontWeight: '500' }}>{genre}</ThemedText>
                              </View>
                            ))}
                            {(specialties.length > 2 || genres.length > 1) && (
                              <View style={{ paddingHorizontal: 6, paddingVertical: 2 }}>
                                <ThemedText style={{ fontSize: 10, color: '#9CA3AF', fontStyle: 'italic' }}>
                                  +{Math.max(0, (specialties.length - 2) + (genres.length - 1))} more
                                </ThemedText>
                              </View>
                            )}
                          </View>
                        )}
                        
                        {/* Highlights */}
                        {(experience.length > 0 || achievements.length > 0) && (
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                            {experience.length > 0 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Ionicons name="star-outline" size={12} color="#F59E0B" />
                                <ThemedText style={{ fontSize: 11, color: '#374151', fontWeight: '500' }}>
                                  {experience.length} {experience.length === 1 ? 'Event' : 'Events'}
                                </ThemedText>
                              </View>
                            )}
                            {achievements.length > 0 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Ionicons name="trophy-outline" size={12} color="#10B981" />
                                <ThemedText style={{ fontSize: 11, color: '#374151', fontWeight: '500' }}>
                                  {achievements.length} {achievements.length === 1 ? 'Achievement' : 'Achievements'}
                                </ThemedText>
                              </View>
                            )}
                          </View>
                        )}
                        
                        {/* Price and Select Button Row */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                          <View>
                            <ThemedText style={{ fontSize: 10, color: '#6B7280', marginBottom: 2 }}>Starting from</ThemedText>
                            <ThemedText style={[styles.itemPrice, { fontSize: 18, fontWeight: '700', color: '#2563EB' }]}>₹{teamItem.price}</ThemedText>
                          </View>
                          {/* Select Button */}
                          {(() => {
                            const prepTime = teamItem.preparation_time_minutes || 0;
                            const deliveryCheck = canItemBeDelivered(prepTime);
                            const isUnavailable = teamItem.item_status ? teamItem.item_status !== 'available' : false;
                            const cannotDeliver = prepTime > 0 && !deliveryCheck.canDeliver;
                            const isDisabled = isUnavailable || cannotDeliver;
                            const prepTimeForCheck = teamItem.preparation_time_minutes || 0;
                            const needsDateTime = prepTimeForCheck > 0 && !eventDateTime;
                            const isDisabledWithDateTime = isDisabled || needsDateTime;
                            
                            return (
                              <TouchableOpacity
                                style={[styles.itemAdd, selected ? styles.itemAddSelected : null, isDisabledWithDateTime && { backgroundColor: '#E5E7EB', opacity: 0.6 }]}
                                onPress={() => {
                                  if (needsDateTime) {
                                    Alert.alert(
                                      'Date & Time Required',
                                      'Please select date and time first to check if this item can be prepared in time.',
                                      [{ text: 'OK' }]
                                    );
                                    return;
                                  }
                                  if (!isDisabled) toggleTeam(teamItem.id);
                                }}
                                disabled={isDisabledWithDateTime}
                              >
                                <ThemedText style={[styles.itemAddText, selected ? styles.itemAddTextSelected : null, isDisabledWithDateTime && { color: '#9CA3AF' }]}>
                                  {needsDateTime ? 'Select Date & Time' :
                                   isUnavailable ? (teamItem.item_status === 'out_of_stock' ? 'Out of Stock' : 'Currently Not Available') : 
                                   cannotDeliver ? 'Not Enough Time' : 
                                   selected ? 'Selected' : 'Select'}
                                </ThemedText>
                              </TouchableOpacity>
                            );
                          })()}
                        </View>
                        
                        {/* Status and Warning Badges */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                          {/* Item Status Badge */}
                          {teamItem.item_status && teamItem.item_status !== 'available' && (
                            <View style={[
                              styles.badge,
                              teamItem.item_status === 'out_of_stock' ? styles.badgeOutOfStock : styles.badgeMaintenance
                            ]}>
                              <Ionicons 
                                name={teamItem.item_status === 'out_of_stock' ? 'close-circle' : 'construct'} 
                                size={12} 
                                color={teamItem.item_status === 'out_of_stock' ? '#DC2626' : '#D97706'} 
                              />
                              <ThemedText style={[
                                styles.badgeText,
                                teamItem.item_status === 'out_of_stock' ? styles.badgeTextOutOfStock : styles.badgeTextMaintenance
                              ]}>
                                {teamItem.item_status === 'out_of_stock' ? 'Out of Stock' : 'Currently Not Available'}
                              </ThemedText>
                            </View>
                          )}
                          
                          {/* Preparation Time Warning */}
                          {(() => {
                            const prepTime = teamItem.preparation_time_minutes || 0;
                            if (prepTime <= 0 || !eventDateTime) {
                              return null;
                            }
                            const deliveryCheck = canItemBeDelivered(prepTime);
                            if (!deliveryCheck.canDeliver) {
                              return (
                                <View style={[styles.badge, styles.badgePrepWarning]}>
                                  <Ionicons name="alert-circle" size={12} color="#DC2626" />
                                  <ThemedText style={[styles.badgeText, styles.badgeTextPrepWarning]}>
                                    Needs {Math.ceil(prepTime / 60)}h prep
                                  </ThemedText>
                                </View>
                              );
                            }
                            return null;
                          })()}
                          
                          {/* View Details Button */}
                          <TouchableOpacity
                            style={{ paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#F3F4F6', borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            onPress={() => setTeamDetailModal({ visible: true, team: teamItem })}
                          >
                            <Ionicons name="information-circle-outline" size={12} color="#2563EB" />
                            <ThemedText style={{ fontSize: 11, fontWeight: '600', color: '#2563EB' }}>Details</ThemedText>
                          </TouchableOpacity>
                        </View>
                        
                        {/* Hour-based Pricing UI for Teams */}
                        {selected && teamItem.base_hours_included && teamItem.base_hours_included > 0 && teamItem.rate_per_extra_hour && (
                          <View style={{ marginTop: 12, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                              <ThemedText style={{ fontSize: 12, color: '#6B7280' }}>Included Hours:</ThemedText>
                              <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>{teamItem.base_hours_included} hours</ThemedText>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                              <ThemedText style={{ fontSize: 12, color: '#6B7280' }}>Rate per Extra Hour:</ThemedText>
                              <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>₹{teamItem.rate_per_extra_hour}/hour</ThemedText>
                            </View>
                            <View style={{ marginBottom: 8 }}>
                              <ThemedText style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Total Hours Required:</ThemedText>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <TouchableOpacity onPress={() => decTeamHours(teamItem.id, teamItem.base_hours_included ?? 0)}>
                                  <Ionicons name="remove-circle" size={22} color="#ef4444" />
                                </TouchableOpacity>
                                <TextInput
                                  style={{ width: 70, height: 36, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, textAlign: 'center', backgroundColor: '#fff', fontSize: 14, fontWeight: '600', color: '#111827' }}
                                  value={String((teamHours[teamItem.id] ?? (teamItem.base_hours_included ?? 0)))}
                                  onChangeText={(value) => {
                                    const parsed = parseInt(value, 10);
                                    if (Number.isNaN(parsed)) return;
                                    updateTeamHours(teamItem.id, Math.max(teamItem.base_hours_included ?? 0, parsed));
                                  }}
                                  keyboardType="numeric"
                                  placeholder={`${teamItem.base_hours_included}`}
                                />
                                <TouchableOpacity onPress={() => incTeamHours(teamItem.id, teamItem.base_hours_included ?? 0)}>
                                  <Ionicons name="add-circle" size={22} color="#10B981" />
                                </TouchableOpacity>
                              </View>
                            </View>
                            {(() => {
                              const hoursUsed = teamHours[teamItem.id] || teamItem.base_hours_included || 0;
                              const extraHours = Math.max(0, hoursUsed - teamItem.base_hours_included);
                              const extraCost = extraHours * teamItem.rate_per_extra_hour;
                              if (extraHours > 0) {
                                return (
                                  <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                                    <ThemedText style={{ fontSize: 12, color: '#DC2626', fontWeight: '600' }}>
                                      Extra {extraHours} hour{extraHours !== 1 ? 's' : ''} × ₹{teamItem.rate_per_extra_hour} = ₹{extraCost} extra
                                    </ThemedText>
                                  </View>
                                );
                              }
                              return null;
                            })()}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                }
                return null;
              }}
            />
            )}

            {/* Note */}
            <View style={styles.noteBox}>
              {(activeSheet === 'team'
                ? ['Images are for representation purposes only.', 'Prices inclusive of taxes.', 'Once booked, cannot be canceled one day of the scheduled day.']
                : programMode
                  ? ['Images are for representation purposes only.', 'Prices inclusive of taxes.', 'Sizes and availability may vary.']
                  : ['Images are for representation purposes only.', 'Prices inclusive of taxes.', 'All nutritional information is indicative; values may vary.']
              ).map((n, i) => (
                <ThemedText key={i} style={styles.noteLine}>{i + 1}. {n}</ThemedText>
              ))}
            </View>

            {/* Bottom summary bar (optional) */}
            {!hideSheetSummaryBar && (
              <View style={styles.summaryBar}>
                <ThemedText style={styles.summaryItems}>{totals.count} {totals.label}</ThemedText>
                <ThemedText style={styles.summaryTotal}>Total Cost  INR {totals.cost.toFixed(0)}</ThemedText>
                <TouchableOpacity
                  style={styles.summaryGo}
                  onPress={() => {
                    const grand = computeGrandTotal();
                    onApplyTotal?.(grand);
                    const details = computeDetails();
                    onApplyDetails?.(details);
                    setActiveSheet(null);
                  }}
                >
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Performance Team Detail Modal */}
      <Modal visible={teamDetailModal.visible} animationType="slide" transparent onRequestClose={() => setTeamDetailModal({ visible: false, team: null })}>
        <View style={styles.imagePopupBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setTeamDetailModal({ visible: false, team: null })} />
          <View style={[styles.imagePopupContainer, { maxHeight: '90%', width: '95%', maxWidth: 600 }]}>
            {teamDetailModal.team && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.imagePopupHeader}>
                  <ThemedText style={styles.imagePopupTitle}>{teamDetailModal.team.name}</ThemedText>
                  <TouchableOpacity onPress={() => setTeamDetailModal({ visible: false, team: null })}>
                    <Ionicons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                
                {/* Profile Image */}
                {teamDetailModal.team.profile_image_url && (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <RNImage
                      source={{ uri: teamDetailModal.team.profile_image_url }}
                      style={{ width: 200, height: 200, borderRadius: 100, backgroundColor: '#E5E7EB' }}
                      resizeMode="cover"
                    />
                  </View>
                )}
                
                {/* Main Image */}
                {teamDetailModal.team.image && (
                  <View style={{ padding: 16 }}>
                    <RNImage
                      source={resolveImageSource(teamDetailModal.team.image) || placeholderImg}
                      style={{ width: '100%', height: 300, borderRadius: 12, backgroundColor: '#E5E7EB' }}
                      resizeMode="cover"
                    />
                  </View>
                )}
                
                {/* Video */}
                {teamDetailModal.team.video_url && (
                  <View style={{ padding: 16 }}>
                    <ThemedText style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#111827' }}>Performance Video</ThemedText>
                    {Platform.OS === 'web' ? (
                      <iframe
                        src={teamDetailModal.team.video_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                        style={{ width: '100%', height: 300, borderRadius: 12, border: 'none' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <TouchableOpacity
                        style={{ padding: 16, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center' }}
                        onPress={() => {
                          const Linking = require('react-native').Linking;
                          Linking.openURL(teamDetailModal.team!.video_url!);
                        }}
                      >
                        <Ionicons name="play-circle" size={48} color="#2563EB" />
                        <ThemedText style={{ marginTop: 8, fontSize: 14, color: '#2563EB', fontWeight: '600' }}>Watch Video</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                
                {/* Comprehensive Performance Team Profile */}
                {teamDetailModal.team.performance_team_profile ? (
                  <View style={{ padding: 16, paddingTop: 0 }}>
                    <PerformanceTeamProfileCard profile={teamDetailModal.team.performance_team_profile} />
                  </View>
                ) : teamDetailModal.team.profile_info ? (
                  <View style={{ padding: 16, paddingTop: 0 }}>
                    <ThemedText style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#111827' }}>About the Team</ThemedText>
                    <ThemedText style={{ fontSize: 14, lineHeight: 22, color: '#4B5563' }}>{teamDetailModal.team.profile_info}</ThemedText>
                  </View>
                ) : null}
                
                {/* Description */}
                {teamDetailModal.team.description && (
                  <View style={{ padding: 16, paddingTop: 0 }}>
                    <ThemedText style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#111827' }}>Description</ThemedText>
                    <ThemedText style={{ fontSize: 14, lineHeight: 22, color: '#4B5563' }}>{teamDetailModal.team.description}</ThemedText>
                  </View>
                )}
                
                {/* Price */}
                <View style={{ padding: 16, paddingTop: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Price</ThemedText>
                  <ThemedText style={{ fontSize: 20, fontWeight: '700', color: '#2563EB' }}>₹{teamDetailModal.team.price}</ThemedText>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Image Popup Modal */}
      <Modal visible={imagePopup.visible} animationType="fade" transparent onRequestClose={() => setImagePopup({ visible: false, image: '', title: '' })}>
        <View style={styles.imagePopupBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setImagePopup({ visible: false, image: '', title: '' })} />
          <View style={styles.imagePopupContainer}>
            <View style={styles.imagePopupHeader}>
              <ThemedText style={styles.imagePopupTitle}>{imagePopup.title}</ThemedText>
              <TouchableOpacity onPress={() => setImagePopup({ visible: false, image: '', title: '' })}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.imagePopupContent}>
              <RNImage 
                source={resolveImageSource(imagePopup.image) || placeholderImg} 
                style={styles.imagePopupImage} 
                resizeMode="contain" 
              />
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // Outer card to match Event Type container style
  card: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12 },
  container: {},
  containerEmbedded: { marginTop: 8 },
  cardTitle: { fontWeight: '700', color: '#111827', marginBottom: 8 },

  // Rows inside card (no shadows/margins like standalone cards)
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowDivided: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  thumbWrap: { width: 84, height: 56, borderRadius: 10, overflow: 'hidden', backgroundColor: '#f3f4f6' },
  thumb: { width: '100%', height: '100%' },
  rowTitle: { fontWeight: '600', color: '#111827' },
  rowSub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  addBtn: { backgroundColor: '#E6F4EA', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText: { color: '#065F46', fontWeight: '600' },
  countBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countBadgeText: { color: '#3730A3', fontSize: 11, fontWeight: '700' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '94%',
  },
  sheetHandle: { alignSelf: 'center', width: 50, height: 5, borderRadius: 3, backgroundColor: '#E5E7EB', marginTop: 8 },
  sheetHeader: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontWeight: '600', color: '#111827' },
  sheetSub: { color: '#6b7280', fontSize: 12 },
  skip: { color: '#ef4444', fontWeight: '600' },
  searchBox: {
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
  },
  searchInput: { flex: 1, color: '#111827' },
  errorText: { color: '#ef4444', paddingHorizontal: 16, marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  itemImage: { width: 60, height: 60, borderRadius: 8 },
  itemTitle: { fontWeight: '600', color: '#111827' },
  itemDesc: { color: '#6b7280', fontSize: 12 },
  itemPrice: { marginTop: 4, fontWeight: '700', color: '#111827' },
  itemAdd: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  itemAddSelected: { borderColor: '#10B981', backgroundColor: '#10B981' },
  itemAddText: { fontWeight: '600', color: '#111827' },
  itemAddTextSelected: { color: '#fff' },
  qtyCtrl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyVal: { fontWeight: '600', color: '#111827' },
  qtyInput: {
    width: 50,
    height: 32,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#fff'
  },
  categoryHeader: { 
    paddingVertical: 12, 
    paddingHorizontal: 4, 
    marginTop: 8, 
    backgroundColor: '#F3F4F6', 
    borderRadius: 8,
    marginBottom: 4
  },
  categoryTitle: { 
    fontWeight: '700', 
    color: '#111827', 
    fontSize: 16,
    textAlign: 'center'
  },
  // Image popup styles
  imagePopupBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  imagePopupContainer: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    margin: 20, 
    maxWidth: '90%', 
    maxHeight: '80%' 
  },
  imagePopupHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb' 
  },
  imagePopupTitle: { 
    fontWeight: '700', 
    color: '#111827', 
    fontSize: 18 
  },
  imagePopupContent: { 
    padding: 16 
  },
  imagePopupImage: { 
    width: 300, 
    height: 300, 
    borderRadius: 12 
  },
  // Food & Beverages styles
        foodCategoryTabs: {
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 8,
          gap: 8,
          backgroundColor: '#F9FAFB',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB'
        },
        foodCategoryTabsScrollView: {
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: '#F9FAFB',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
          minHeight: 48
        },
  foodCategoryTab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40
  },
  foodCategoryTabActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981'
  },
  foodCategoryTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center'
  },
  foodCategoryTabTextActive: {
    color: '#fff'
  },
        vegNonVegContainer: {
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
          minHeight: 48
        },
        vegNonVegTabs: {
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 8,
          gap: 12,
          backgroundColor: '#fff'
        },
        vegNonVegPlaceholder: {
          height: 48,
          backgroundColor: '#fff'
        },
  vegNonVegTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44
  },
  vegNonVegTabActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981'
  },
  vegNonVegIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1
  },
  vegNonVegDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  vegNonVegTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center'
  },
  vegNonVegTabTextActive: {
    color: '#10B981'
  },
  foodItemCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 3,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  foodItemCardGrid: {
    width: '48%',
    marginHorizontal: 0,
    marginVertical: 6,
  },
  foodItemImageContainer: {
    position: 'relative',
    width: 80,
    height: 80
  },
  foodItemImage: {
    width: 80,
    height: 80,
    borderRadius: 8
  },
  foodItemVegDot: {
    position: 'absolute',
    bottom: -6,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2
  },
  foodItemContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between'
  },
  foodItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  foodItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1
  },
  foodItemDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 16
  },
  foodItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  foodItemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827'
  },
  foodItemAddBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6
  },
  foodItemAddText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  foodItemQtyCtrl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  foodItemQtyVal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    minWidth: 20,
    textAlign: 'center'
  },
  foodItemQtyInput: {
    width: 50,
    height: 32,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#fff'
  },
  // Team booking styles
  bookBtn: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  book: { borderColor: '#ef4444', backgroundColor: '#fff' },
  booked: { borderColor: '#ef4444', backgroundColor: '#ef4444' },
  bookText: { fontWeight: '600' },
  bookTextInactive: { color: '#ef4444' },
  bookTextActive: { color: '#fff' },
  noteBox: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F3F4F6', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  noteLine: { color: '#6b7280', fontSize: 12 },
  summaryBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryItems: { color: '#111827', fontWeight: '700' },
  summaryTotal: { color: '#059669', fontWeight: '600', marginLeft: 'auto' },
  summaryGo: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  // Professional Badge Styles
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  badgeOutOfStock: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  badgeMaintenance: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  badgePrepWarning: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  badgePrepInfo: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  badgeIcon: {
    fontSize: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  badgeTextOutOfStock: {
    color: '#DC2626',
  },
  badgeTextMaintenance: {
    color: '#D97706',
  },
  badgeTextPrepWarning: {
    color: '#DC2626',
  },
  badgeTextPrepInfo: {
    color: '#6B7280',
  },
});
