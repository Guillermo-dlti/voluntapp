import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFonts, Brand, Radius } from '@/constants/theme';
import { type Activity, MOCK_ACTIVITIES } from '@/constants/mock-data';

export default function OportunidadesList() {
  function handleSelect(activity: Activity) {
    router.push({
      pathname: '/(tabs)/ofertas/detalles',
      params: { id: activity.id },
    });
  }

  function renderActivityCard({ item }: { item: Activity }) {
    return (
      <Pressable
        style={styles.card}
        onPress={() => handleSelect(item)}
        accessibilityRole="button"
        accessibilityLabel={`Ver detalles de ${item.title}`}>
        <View style={styles.cardHeader}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
          <Text style={styles.spotsText}>
            {item.spotsLeft} vacantes restantes
          </Text>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>

        <View style={styles.cardMeta}>
          <Text style={styles.metaLine}>
            📅 {item.date}
          </Text>
          <Text style={styles.metaLine}>
            📍 {item.location}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.timeText}>⏰ {item.time}</Text>
          <View style={styles.selectAction}>
            <Text style={styles.selectActionText}>Seleccionar</Text>
            <Text style={styles.arrow}>›</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Oportunidades</Text>
        <Text style={styles.subtitle}>
          Selecciona un turno para registrar tu participación
        </Text>
      </View>

      <FlatList
        data={MOCK_ACTIVITIES}
        keyExtractor={(item) => item.id}
        renderItem={renderActivityCard}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
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
    paddingBottom: 12,
  },
  title: {
    fontFamily: AppFonts.heading,
    fontSize: 24,
    color: Brand.text,
  },
  subtitle: {
    fontFamily: AppFonts.body,
    fontSize: 13,
    color: Brand.textSecondary,
    marginTop: 2,
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
    padding: 16,
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
  categoryBadge: {
    backgroundColor: Brand.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  categoryText: {
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 11,
    color: Brand.primary,
  },
  spotsText: {
    fontFamily: AppFonts.body,
    fontSize: 12,
    color: Brand.textSecondary,
  },
  cardTitle: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 17,
    color: Brand.text,
  },
  cardMeta: {
    gap: 4,
  },
  metaLine: {
    fontFamily: AppFonts.body,
    fontSize: 13,
    color: Brand.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  timeText: {
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 13,
    color: Brand.text,
  },
  selectAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectActionText: {
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 14,
    color: Brand.primary,
  },
  arrow: {
    fontSize: 18,
    color: Brand.primary,
    fontWeight: 'bold',
  },
});
