import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

const CHART_HEIGHT = 200;
const CHART_PADDING = 16;

export function RevenueChart({ 
  data, 
  labels, 
  title = 'Revenue Trend',
  color = '#2D5016' 
}: { 
  data: number[]; 
  labels?: string[]; 
  title?: string;
  color?: string;
}) {
  const maxValue = Math.max(...data, 1);
  const chartWidth = Dimensions.get('window').width - (CHART_PADDING * 4);
  const barWidth = (chartWidth - ((data.length - 1) * 8)) / data.length;
  
  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Ionicons name="trending-up" size={20} color={color} />
        <ThemedText style={styles.chartTitle}>{title}</ThemedText>
      </View>
      <View style={styles.chart}>
        <View style={styles.chartBars}>
          {data.map((value, index) => {
            const height = (value / maxValue) * (CHART_HEIGHT - 40);
            return (
              <View key={index} style={styles.barContainer}>
                <View 
                  style={[
                    styles.bar, 
                    { 
                      width: barWidth, 
                      height: Math.max(height, 4),
                      backgroundColor: color,
                    }
                  ]} 
                />
                {labels && labels[index] && (
                  <ThemedText style={styles.barLabel} numberOfLines={1}>
                    {labels[index]}
                  </ThemedText>
                )}
                <ThemedText style={styles.barValue}>
                  ₹{(value / 1000).toFixed(0)}k
                </ThemedText>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export function ProfitLossChart({
  revenue,
  costs,
  profit,
  title = 'Profit & Loss Overview'
}: {
  revenue: number;
  costs: number;
  profit: number;
  title?: string;
}) {
  const maxValue = Math.max(revenue, costs, Math.abs(profit), 1);
  
  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Ionicons name="pie-chart" size={20} color="#2D5016" />
        <ThemedText style={styles.chartTitle}>{title}</ThemedText>
      </View>
      <View style={styles.plChart}>
        <View style={styles.plBarGroup}>
          <View style={styles.plBarContainer}>
            <ThemedText style={styles.plBarLabel}>Revenue</ThemedText>
            <View style={styles.plBarWrapper}>
              <View 
                style={[
                  styles.plBar, 
                  { 
                    width: `${(revenue / maxValue) * 100}%`, 
                    backgroundColor: '#10b981' 
                  }
                ]} 
              />
            </View>
            <ThemedText style={styles.plBarValue}>₹{revenue.toLocaleString()}</ThemedText>
          </View>
          
          <View style={styles.plBarContainer}>
            <ThemedText style={styles.plBarLabel}>Costs</ThemedText>
            <View style={styles.plBarWrapper}>
              <View 
                style={[
                  styles.plBar, 
                  { 
                    width: `${(costs / maxValue) * 100}%`, 
                    backgroundColor: '#ef4444' 
                  }
                ]} 
              />
            </View>
            <ThemedText style={styles.plBarValue}>₹{costs.toLocaleString()}</ThemedText>
          </View>
          
          <View style={styles.plBarContainer}>
            <ThemedText style={styles.plBarLabel}>Net Profit</ThemedText>
            <View style={styles.plBarWrapper}>
              <View 
                style={[
                  styles.plBar, 
                  { 
                    width: `${(Math.abs(profit) / maxValue) * 100}%`, 
                    backgroundColor: profit >= 0 ? '#10b981' : '#ef4444'
                  }
                ]} 
              />
            </View>
            <ThemedText style={[styles.plBarValue, { color: profit >= 0 ? '#10b981' : '#ef4444' }]}>
              ₹{profit.toLocaleString()}
            </ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

export function RevenueBreakdownChart({
  completed,
  approved,
  pending,
  cancelled,
  title = 'Revenue Breakdown'
}: {
  completed: number;
  approved: number;
  pending: number;
  cancelled: number;
  title?: string;
}) {
  const total = completed + approved + pending + cancelled;
  const data = [
    { label: 'Completed', value: completed, color: '#10b981' },
    { label: 'Approved', value: approved, color: '#3b82f6' },
    { label: 'Pending', value: pending, color: '#f59e0b' },
    { label: 'Cancelled', value: cancelled, color: '#ef4444' },
  ];
  
  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Ionicons name="bar-chart" size={20} color="#2D5016" />
        <ThemedText style={styles.chartTitle}>{title}</ThemedText>
      </View>
      <View style={styles.breakdownChart}>
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <View key={index} style={styles.breakdownItem}>
              <View style={styles.breakdownLabelRow}>
                <View style={[styles.breakdownColorDot, { backgroundColor: item.color }]} />
                <ThemedText style={styles.breakdownLabel}>{item.label}</ThemedText>
                <ThemedText style={styles.breakdownPercentage}>
                  {percentage.toFixed(1)}%
                </ThemedText>
              </View>
              <View style={styles.breakdownBarWrapper}>
                <View 
                  style={[
                    styles.breakdownBar, 
                    { 
                      width: `${percentage}%`, 
                      backgroundColor: item.color 
                    }
                  ]} 
                />
              </View>
              <ThemedText style={styles.breakdownValue}>
                ₹{item.value.toLocaleString()}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6E8EA',
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  chart: {
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: CHART_HEIGHT - 40,
    paddingBottom: 20,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 80,
  },
  bar: {
    borderRadius: 4,
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#111827',
    marginTop: 2,
  },
  plChart: {
    paddingVertical: 8,
  },
  plBarGroup: {
    gap: 16,
  },
  plBarContainer: {
    marginBottom: 12,
  },
  plBarLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  plBarWrapper: {
    height: 24,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    overflow: 'hidden',
  },
  plBar: {
    height: '100%',
    borderRadius: 6,
  },
  plBarValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
    textAlign: 'right',
  },
  breakdownChart: {
    gap: 12,
  },
  breakdownItem: {
    marginBottom: 8,
  },
  breakdownLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  breakdownPercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginLeft: 8,
  },
  breakdownBarWrapper: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  breakdownBar: {
    height: '100%',
    borderRadius: 4,
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
});

