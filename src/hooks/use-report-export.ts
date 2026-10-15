import { useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import { downloadReport, shareReport, type ReportKind } from '@/services/reports';
import type { ReportRange } from '@/utils/report-range';

export type ExportAction = 'download' | 'share';

// The CSV is always built by the server. "download" saves it in a folder staff pick on the phone;
// "share" opens the share sheet (Drive, Gmail, WhatsApp) from the app's private cache.
export function useReportExport(range: ReportRange) {
  const { refresh } = useAuth();
  const [busy, setBusy] = useState<ExportAction | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const run = async (kind: ReportKind, action: ExportAction) => {
    setBusy(action);
    setMessage(null);
    try {
      if (action === 'share') await shareReport(kind, range);
      else if (await downloadReport(kind, range)) setMessage({ text: 'Listo. Guardamos el archivo CSV en la carpeta que elegiste.', error: false });
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage({ text: apiMessage(cause), error: true });
    } finally {
      setBusy(null);
    }
  };

  return { busy, message, run };
}
