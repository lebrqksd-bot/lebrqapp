import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

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
  subscription_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type Props = {
  participants: Participant[];
  onVerify?: (participantId: number) => void;
  showPaymentStatus?: boolean;
  emptyMessage?: string;
};

export default function ParticipantsList({
  participants,
  onVerify,
  showPaymentStatus = true,
  emptyMessage = 'No participants yet',
}: Props) {
  
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const getPaymentStatusColor = (status?: string | null) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'confirmed':
        return { bg: '#D1FAE5', text: '#059669' };
      case 'pending':
        return { bg: '#FEF3C7', text: '#D97706' };
      case 'cancelled':
      case 'failed':
        return { bg: '#FEE2E2', text: '#DC2626' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };

  if (participants.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={32} color="#D1D5DB" />
        <ThemedText style={styles.emptyText}>{emptyMessage}</ThemedText>
      </View>
    );
  }

  // Calculate totals
  const totalTickets = participants.reduce((sum, p) => sum + p.ticket_quantity, 0);
  const totalRevenue = participants.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  const verifiedCount = participants.filter(p => p.is_verified).length;
  const paidCount = participants.filter(p => 
    p.payment_status?.toLowerCase() === 'paid' || 
    (p.amount_paid && p.amount_paid > 0)
  ).length;

  return (
    <View style={styles.container}>
      {/* Summary Header */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <ThemedText style={styles.summaryValue}>{participants.length}</ThemedText>
          <ThemedText style={styles.summaryLabel}>Entries</ThemedText>
        </View>
        <View style={styles.summaryItem}>
          <ThemedText style={styles.summaryValue}>{totalTickets}</ThemedText>
          <ThemedText style={styles.summaryLabel}>Tickets</ThemedText>
        </View>
        <View style={styles.summaryItem}>
          <ThemedText style={[styles.summaryValue, { color: '#059669' }]}>
            ₹{totalRevenue.toFixed(0)}
          </ThemedText>
          <ThemedText style={styles.summaryLabel}>Revenue</ThemedText>
        </View>
        <View style={styles.summaryItem}>
          <ThemedText style={styles.summaryValue}>{verifiedCount}/{paidCount}</ThemedText>
          <ThemedText style={styles.summaryLabel}>Verified</ThemedText>
        </View>
      </View>

      {/* Participant List */}
      <View style={styles.listContainer}>
        {participants.map((participant, index) => {
          const paymentColor = getPaymentStatusColor(participant.payment_status);
          const isPaid = participant.payment_status?.toLowerCase() === 'paid' || 
                         (participant.amount_paid && participant.amount_paid > 0);
          
          return (
            <View 
              key={participant.id} 
              style={[
                styles.participantRow,
                index === participants.length - 1 && { borderBottomWidth: 0 },
                !isPaid && styles.unpaidRow,
              ]}
            >
              <View style={styles.participantInfo}>
                <View style={styles.nameRow}>
                  <ThemedText style={styles.participantName}>{participant.name}</ThemedText>
                  {participant.ticket_quantity > 1 && (
                    <View style={styles.ticketBadge}>
                      <ThemedText style={styles.ticketBadgeText}>
                        ×{participant.ticket_quantity}
                      </ThemedText>
                    </View>
                  )}
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="call-outline" size={12} color="#9CA3AF" />
                  <ThemedText style={styles.metaText}>{participant.mobile}</ThemedText>
                  {participant.booking_reference && (
                    <>
                      <ThemedText style={styles.metaDot}>•</ThemedText>
                      <ThemedText style={styles.metaText}>
                        #{participant.booking_reference.slice(-6)}
                      </ThemedText>
                    </>
                  )}
                </View>
                {participant.joined_at && (
                  <ThemedText style={styles.joinedText}>
                    Joined {formatDate(participant.joined_at)} {formatTime(participant.joined_at)}
                  </ThemedText>
                )}
              </View>

              <View style={styles.participantActions}>
                {/* Amount */}
                {participant.amount_paid != null && participant.amount_paid > 0 && (
                  <ThemedText style={styles.amountText}>
                    ₹{participant.amount_paid.toFixed(0)}
                  </ThemedText>
                )}

                {/* Payment Status */}
                {showPaymentStatus && participant.payment_status && (
                  <View style={[styles.statusBadge, { backgroundColor: paymentColor.bg }]}>
                    <ThemedText style={[styles.statusText, { color: paymentColor.text }]}>
                      {participant.payment_status}
                    </ThemedText>
                  </View>
                )}

                {/* Verification Status & Action */}
                <View style={styles.verifyCol}>
                  {participant.is_verified ? (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#059669" />
                      {participant.scan_count != null && participant.scan_count > 0 && (
                        <ThemedText style={styles.scanCount}>
                          {participant.scan_count}×
                        </ThemedText>
                      )}
                    </View>
                  ) : onVerify && isPaid ? (
                    <TouchableOpacity 
                      style={styles.verifyButton}
                      onPress={() => onVerify(participant.id)}
                    >
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      <ThemedText style={styles.verifyButtonText}>Verify</ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.notVerifiedBadge}>
                      <Ionicons name="time-outline" size={14} color="#D97706" />
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  listContainer: {
    paddingVertical: 4,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  unpaidRow: {
    opacity: 0.6,
    backgroundColor: '#FEF2F2',
  },
  participantInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  ticketBadge: {
    backgroundColor: '#2D5016',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ticketBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  metaText: {
    fontSize: 11,
    color: '#6B7280',
  },
  metaDot: {
    fontSize: 11,
    color: '#D1D5DB',
    marginHorizontal: 2,
  },
  joinedText: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  participantActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  verifyCol: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  scanCount: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '500',
  },
  notVerifiedBadge: {
    padding: 4,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2D5016',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  verifyButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
