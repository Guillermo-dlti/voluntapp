import { StyleSheet, View } from 'react-native';

import { Brand, Radius } from '@/constants/theme';

interface QRCodeGraphicProps {
  size?: number;
}

/**
 * Clean native QR code graphic with standard finder patterns and grid cells.
 * Renders without external dependencies on iOS, Android, and Web.
 */
export function QRCodeGraphic({ size = 200 }: QRCodeGraphicProps) {
  const innerSize = size * 0.28;
  const dotSize = size * 0.12;

  return (
    <View style={[styles.container, { width: size + 32, height: size + 32 }]}>
      <View style={[styles.qrCanvas, { width: size, height: size }]}>
        {/* Top-Left Finder */}
        <View style={[styles.finderOuter, { top: 0, left: 0, width: innerSize, height: innerSize }]}>
          <View style={[styles.finderInner, { width: dotSize, height: dotSize }]} />
        </View>

        {/* Top-Right Finder */}
        <View style={[styles.finderOuter, { top: 0, right: 0, width: innerSize, height: innerSize }]}>
          <View style={[styles.finderInner, { width: dotSize, height: dotSize }]} />
        </View>

        {/* Bottom-Left Finder */}
        <View style={[styles.finderOuter, { bottom: 0, left: 0, width: innerSize, height: innerSize }]}>
          <View style={[styles.finderInner, { width: dotSize, height: dotSize }]} />
        </View>

        {/* Data pattern blocks simulated to look like a clean high-tech QR */}
        <View style={[styles.dataBlock, { top: size * 0.38, left: size * 0.08, width: size * 0.16, height: size * 0.08 }]} />
        <View style={[styles.dataBlock, { top: size * 0.52, left: size * 0.12, width: size * 0.08, height: size * 0.16 }]} />
        <View style={[styles.dataBlock, { top: size * 0.15, left: size * 0.38, width: size * 0.24, height: size * 0.08 }]} />
        <View style={[styles.dataBlock, { top: size * 0.32, left: size * 0.35, width: size * 0.12, height: size * 0.12 }]} />
        <View style={[styles.dataBlock, { top: size * 0.52, left: size * 0.40, width: size * 0.20, height: size * 0.10 }]} />
        <View style={[styles.dataBlock, { top: size * 0.70, left: size * 0.35, width: size * 0.12, height: size * 0.20 }]} />
        <View style={[styles.dataBlock, { top: size * 0.38, right: size * 0.08, width: size * 0.14, height: size * 0.14 }]} />
        <View style={[styles.dataBlock, { bottom: size * 0.05, right: size * 0.12, width: size * 0.22, height: size * 0.12 }]} />
        <View style={[styles.dataBlock, { top: size * 0.65, right: size * 0.25, width: size * 0.10, height: size * 0.10 }]} />
        <View style={[styles.dataBlock, { top: size * 0.10, right: size * 0.35, width: size * 0.08, height: size * 0.14 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: Radius.card,
    borderWidth: 1.5,
    borderColor: Brand.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  qrCanvas: {
    position: 'relative',
  },
  finderOuter: {
    position: 'absolute',
    borderWidth: 6,
    borderColor: Brand.text,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finderInner: {
    backgroundColor: Brand.primary,
    borderRadius: 4,
  },
  dataBlock: {
    position: 'absolute',
    backgroundColor: Brand.text,
    borderRadius: 2,
  },
});
