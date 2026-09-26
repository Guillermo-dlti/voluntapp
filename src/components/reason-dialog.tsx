import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { AppFonts, Brand, Elevation, Radius } from '@/constants/theme';

interface ReasonDialogProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  busyLabel: string;
  // Resolves to an error sentence to show, or null when done (the dialog then closes).
  onConfirm: (reason: string) => Promise<string | null>;
  onClose: () => void;
  testID?: string;
}

const reasonMessage = 'Escribe el motivo (de 3 a 500 caracteres).';

// Asks for a short written reason before a critical action. Android has no text prompt in Alert,
// so this is a small modal sheet with one field.
export function ReasonDialog({ visible, title, body, confirmLabel, busyLabel, onConfirm, onClose, testID }: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setReason(''); setError('');
    onClose();
  }

  async function confirm() {
    if (busy) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3 || trimmed.length > 500) { setError(reasonMessage); return; }
    setBusy(true);
    const problem = await onConfirm(trimmed);
    setBusy(false);
    if (problem) { setError(problem); return; }
    setReason(''); setError('');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <Pressable accessibilityLabel="Cerrar" style={StyleSheet.absoluteFill} onPress={close} />
        <View testID={testID} style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <FormField testID={testID ? `${testID}-reason` : undefined} label="Motivo" value={reason}
            onChangeText={(text) => { setReason(text); setError(''); }} error={error || undefined}
            maxLength={500} multiline editable={!busy} style={styles.reason} textAlignVertical="top" />
          <View style={styles.actions}>
            <View style={styles.action}><Button label="Volver" variant="secondary" onPress={close} /></View>
            <View style={styles.action}>
              <Button testID={testID ? `${testID}-confirm` : undefined} label={confirmLabel} busyLabel={busyLabel} busy={busy}
                variant="critical" onPress={() => void confirm()} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: Brand.scrim },
  sheet: { gap: 16, padding: 20, borderRadius: Radius.card, backgroundColor: Brand.surface, boxShadow: Elevation.raised },
  title: { fontFamily: AppFonts.heading, fontSize: 20, color: Brand.text },
  body: { fontFamily: AppFonts.body, fontSize: 15, lineHeight: 21, color: Brand.textSecondary },
  reason: { minHeight: 90, paddingTop: 14 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
});
