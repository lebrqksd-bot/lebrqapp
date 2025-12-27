import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import ParticipantsList from './ParticipantsList';

export type Participant = {
  id: number;
  user_id?: number | null;
  name: string;
  mobile: string;
  ticket_quantity: number;
  amount_paid?: number | null;
  is_verified: boolean;
  scan_count?: number | null;
  joined_at?: string | null;
  booking_reference?: string | null;
  payment_status?: string | null;
  event_title?: string | null;
};

export type Schedule = {
  id: number;
  event_definition_id: number;
  event_code: string;
  event_title: string;
  event_type: string;
  event_category: string;
  schedule_date: string;
  start_time?: string | null;
  end_time?: string | null;
  max_tickets: number;
  tickets_sold: number;
  tickets_available: number;
  ticket_price: number;
  status: string;
  is_blocked: boolean;
  banner_image_url?: string | null;
  poster_url?: string | null;
  participants: Participant[];
};

type Props = {
  schedule: Schedule;
  onVerifyParticipant?: (participantId: number) => void;
  onRefresh?: () => void;
  showDetails?: boolean;
};

export default function EventScheduleCard({ 
  schedule, 
  onVerifyParticipant,
  onRefresh,
  showDetails = true 
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return '-';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return '#059669';
      case 'completed': return '#6B7280';
      case 'cancelled': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const isToday = schedule.schedule_date === new Date().toISOString().split('T')[0];
  const isPast = new Date(schedule.schedule_date) < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <View style={[
      styles.card,
      isToday && styles.todayCard,
      isPast && styles.pastCard,
    ]}>
      {/* Header Row */}
      <TouchableOpacity 
        style={styles.headerRow} 
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.dateTimeCol}>
          <View style={styles.dateRow}>
            <Ionicons 
              name="calendar-outline" 
              size={16} 
              color={isToday ? '#2563EB' : '#6B7280'} 
            />
            <ThemedText style={[styles.dateText, isToday && styles.todayText]}>
              {formatDate(schedule.schedule_date)}
              {isToday && ' (Today)'}
            </ThemedText>
          </View>
          <ThemedText style={styles.timeText}>
            {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
          </ThemedText>
        </View>

        <View style={styles.statsCol}>
          <View style={styles.ticketBox}>
            <Ionicons name="ticket-outline" size={14} color="#6B7280" />
            <ThemedText style={styles.ticketText}>
              {schedule.tickets_sold}/{schedule.max_tickets}
            </ThemedText>
          </View>
          <ThemedText style={styles.priceText}>
            ₹{schedule.ticket_price.toFixed(0)}
          </ThemedText>
        </View>

        <View style={styles.statusCol}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(schedule.status) + '20' }]}>
            <ThemedText style={[styles.statusText, { color: getStatusColor(schedule.status) }]}>
              {schedule.status}
            </ThemedText>
          </View>
          {schedule.is_blocked && (
            <View style={styles.blockedBadge}>
              <Ionicons name="lock-closed" size={10} color="#DC2626" />
              <ThemedText style={styles.blockedText}>Blocked</ThemedText>
            </View>
          )}
        </View>

        <View style={styles.expandCol}>
          <View style={styles.participantCount}>
            <Ionicons name="people-outline" size={14} color="#2D5016" />
            <ThemedText style={styles.participantCountText}>
              {schedule.participants.length}
            </ThemedText>
          </View>
          <Ionicons 
            name={expanded ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color="#6B7280" 
          />
        </View>
      </TouchableOpacity>

      {/* Progress Bar */}
      {showDetails && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${(schedule.tickets_sold / schedule.max_tickets) * 100}%`,
                  backgroundColor: schedule.tickets_sold >= schedule.max_tickets ? '#DC2626' : '#059669',
                }
              ]} 
            />
          </View>
          <ThemedText style={styles.progressText}>
            {schedule.tickets_available} remaining
          </ThemedText>
        </View>
      )}

      {/* Expanded Participants List */}
      {expanded && (
        <View style={styles.expandedContent}>
          <ParticipantsList 
            participants={schedule.participants}
            onVerify={onVerifyParticipant}
            showPaymentStatus={true}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    overflow: 'hidden',
  },
  todayCard: {
    borderColor: '#2563EB',
    borderWidth: 2,
  },
  pastCard: {
    opacity: 0.7,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  dateTimeCol: {
    flex: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  todayText: {
    color: '#2563EB',
  },
  timeText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    marginLeft: 22,
  },
  statsCol: {
    flex: 1,
    alignItems: 'center',
  },
  ticketBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ticketText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  priceText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '500',
    marginTop: 2,
  },
  statusCol: {
    flex: 1,
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  blockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  blockedText: {
    fontSize: 9,
    color: '#DC2626',
    fontWeight: '500',
  },
  expandCol: {
    width: 60,
    alignItems: 'center',
  },
  participantCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  participantCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D5016',
  },
  progressContainer: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    color: '#6B7280',
    minWidth: 70,
    textAlign: 'right',
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
});
