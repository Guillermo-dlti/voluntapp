import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFonts, Brand, Radius } from '@/constants/theme';
import {
  MOCK_PAST_ACTIVITIES,
  MOCK_UPCOMING_ACTIVITIES,
  type Registration,
} from '@/constants/mock-data';

export default function MisActividadesScreen() {
  const [selectedTab, setSelectedTab] = useState<'proximas' | 'pasadas'>('proximas');

  const activities =
    selectedTab === 'proximas' ? MOCK_UPCOMING_ACTIVITIES : MOCK_PAST_ACTIVITIES;

  function renderItem({ item }: { item: Registration }) {
    const isUpcoming = selectedTab === 'proximas';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.badge,
              { backgroundColor: isUpcoming ? Brand.primaryLight : '#F1F5F9' },
            ]}>
            <Text
              style={[
                styles.badgeText,
                { color: isUpcoming ? Brand.primary : Brand.textSecondary },
              ]}>
              {isUpcoming ? 'Próxima' : 'Completada'}
            </Text>
          </View>
          <Text style={styles.timeText}>{item.timeText}</Text>
        </View>

        <Text style={styles.activityTitle}>{item.activityTitle}</Text>
        <Text style={styles.metaLine}>📅 {item.dateText}</Text>
        <Text style={styles.metaLine}>📍 {item.location}</Text>

        {isUpcoming ? (
          <Pressable
            style={styles.checkInButton}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/mis-actividades/check-in',
                params: {
                  id: item.id,
                  title: item.activityTitle,
                  code: item.checkInCode,
                },
              })
            }
            accessibilityRole="button">
            <Text style={styles.checkInButtonText}>Check-In</Text>
          </Pressable>
        ) : (
          <View style={styles.completedFooter}>
            <Text style={styles.completedBadge}>✓ Horas validadas por BAMX</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Actividades</Text>

        {/* Segmented Control */}
        <View style={styles.segmentedControl}>
          <Pressable
            style={[
              styles.segmentButton,
              selectedTab === 'proximas' && styles.segmentButtonActive,
            ]}
            onPress={() => setSelectedTab('proximas')}
            accessibilityRole="button">
            <Text
              style={[
                styles.segmentText,
                selectedTab === 'proximas' && styles.segmentTextActive,
              ]}>
              Próximas
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.segmentButton,
              selectedTab === 'pasadas' && styles.segmentButtonActive,
            ]}
            onPress={() => setSelectedTab('pasadas')}
            accessibilityRole="button">
            <Text
              style={[
                styles.segmentText,
                selectedTab === 'pasadas' && styles.segmentTextActive,
              ]}>
              Pasadas
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No tienes actividades {selectedTab}</Text>
            <Text style={styles.emptySubtitle}>
              Explora las oportunidades disponibles para registrarte.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 16,
  },
  title: {
    fontFamily: AppFonts.heading,
    fontSize: 24,
    color: Brand.text,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: Radius.button,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.button - 2,
  },
  segmentButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  segmentText: {
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 14,
    color: Brand.textSecondary,
  },
  segmentTextActive: {
    color: Brand.primary,
  },
  list: {
    padding: 24,
    paddingTop: 8,
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.card,
    padding: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  badgeText: {
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 11,
  },
  timeText: {
    fontFamily: AppFonts.body,
    fontSize: 12,
    color: Brand.textSecondary,
  },
  activityTitle: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 17,
    color: Brand.text,
  },
  metaLine: {
    fontFamily: AppFonts.body,
    fontSize: 13,
    color: Brand.textSecondary,
  },
  checkInButton: {
    backgroundColor: Brand.primary,
    borderRadius: Radius.button,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  checkInButtonText: {
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 15,
    color: '#ffffff',
  },
  completedFooter: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  completedBadge: {
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 12,
    color: Brand.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 16,
    color: Brand.text,
  },
  emptySubtitle: {
    fontFamily: AppFonts.body,
    fontSize: 13,
    color: Brand.textSecondary,
    textAlign: 'center',
    maxWidth: 240,
  },
});
