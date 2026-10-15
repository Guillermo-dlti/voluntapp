import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Brand, Elevation, Spacing, Type } from '@/constants/theme';
import type { CardHolder } from '@/services/volunteer-card';

// On screen width of the preview; the height keeps the printed card's ID size ratio (54 × 85.6 mm).
const WIDTH = 248;
const HEIGHT = Math.round(WIDTH * (85.6 / 54));
const QR_SIZE = 150;

// What the printed card looks like, drawn on screen before printing. The print page itself is built in
// `src/services/volunteer-card.ts` with the same layout: forest band with the BAMX logo, then the name and QR.
export function VolunteerIdCard({ holder }: { holder: CardHolder }) {
  const name = `${holder.firstName} ${holder.lastName}`;
  return (
    <View testID="volunteer-id-card" style={styles.card} accessible accessibilityRole="image"
      accessibilityLabel={`Tarjeta de voluntario de ${name} con su código QR`}>
      <View style={styles.band}>
        <Image source={require('@/assets/images/bamx-logo.png')} style={styles.logo} contentFit="contain" />
        <View style={styles.bandText}>
          <Text style={styles.org}>Banco de Alimentos{'\n'}de Guadalajara</Text>
          <Text style={styles.app}>Voluntapp</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.role}>Voluntario</Text>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>
        <View style={styles.qr}>
          <QRCode value={holder.checkinToken} size={QR_SIZE} color={Brand.text} backgroundColor={Brand.surface} ecl="M" />
        </View>
        <Text style={styles.hint}>Muéstralo al llegar a una actividad</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: WIDTH, height: HEIGHT, alignSelf: 'center', borderRadius: 14, overflow: 'hidden',
    backgroundColor: Brand.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: Brand.border, boxShadow: Elevation.raised,
  },
  band: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Brand.forest, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  logo: { width: 38, height: 53 },
  bandText: { flex: 1, gap: 2 },
  org: { ...Type.caption, color: Brand.forestMuted },
  app: { ...Type.title, color: Brand.forestText },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  role: { ...Type.caption, color: Brand.primary },
  name: { ...Type.headline, color: Brand.text, textAlign: 'center', marginTop: Spacing.xs },
  qr: { marginTop: 'auto' },
  hint: { ...Type.caption, color: Brand.textSecondary, marginTop: Spacing.sm, textAlign: 'center' },
});
