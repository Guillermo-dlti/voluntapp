import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Confetti, makeConfetti, type ConfettiPiece } from '@/components/confetti';
import { Toast, type ToastTone } from '@/components/toast';
import { Motion } from '@/constants/theme';
import { useMotion } from '@/utils/motion';

interface Feedback {
  // A one line confirmation after something saved.
  toast: (message: string, tone?: ToastTone) => void;
  // The confetti burst. Reserved for finalizing attendance; nothing else celebrates.
  celebrate: () => void;
}

const FeedbackContext = createContext<Feedback | null>(null);

// Draws toasts and the celebration above every screen, so a screen can show one and navigate away
// (a save that goes back) without cutting it off.
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { reduced } = useMotion();
  const [toast, setToast] = useState<{ id: number; message: string; tone: ToastTone } | null>(null);
  const [burst, setBurst] = useState<{ id: number; pieces: ConfettiPiece[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: ++nextId.current, message, tone });
    timer.current = setTimeout(() => setToast(null), Motion.toast);
  }, []);

  // Under Reduce Motion there's no confetti at all; the toast still says what happened.
  const celebrate = useCallback(() => {
    if (!reduced) setBurst({ id: ++nextId.current, pieces: makeConfetti() });
  }, [reduced]);
  const clearBurst = useCallback(() => setBurst(null), []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo(() => ({ toast: showToast, celebrate }), [showToast, celebrate]);
  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <View style={styles.overlay}>
        {burst ? <Confetti key={burst.id} pieces={burst.pieces} onDone={clearBurst} /> : null}
        {toast ? <Toast key={toast.id} message={toast.message} tone={toast.tone} onDismiss={dismiss} /> : null}
      </View>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): Feedback {
  const feedback = useContext(FeedbackContext);
  if (!feedback) throw new Error('useFeedback must be used inside FeedbackProvider');
  return feedback;
}

const styles = StyleSheet.create({
  // Lets touches through everywhere except on the toast itself.
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'box-none' },
});
