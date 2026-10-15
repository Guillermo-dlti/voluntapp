import { printAsync } from 'expo-print';
import QRCode from 'qrcode';

import { bamxLogoDataUri } from '@/constants/bamx-logo-data';
import { Brand } from '@/constants/theme';

export interface CardHolder {
  firstName: string;
  lastName: string;
  checkinToken: string;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// The same card the preview screen draws, as a print page: ID card size (54 × 85.6 mm) with a dashed
// cut line, on a Letter sheet. Names are staff input, so they're escaped before going into the HTML.
async function cardHtml(holder: CardHolder): Promise<string> {
  const qr = await QRCode.toString(holder.checkinToken, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: Brand.text, light: '#FFFFFF' } });
  const name = escapeHtml(`${holder.firstName} ${holder.lastName}`);
  return `<!doctype html>
<html lang="es-MX"><head><meta charset="utf-8">
<style>
  @page { size: letter; margin: 18mm; }
  * { box-sizing: border-box; margin: 0; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; }
  .cut { width: 58mm; padding: 2mm; border: 0.3mm dashed ${Brand.textTertiary}; border-radius: 4mm; }
  .card { width: 54mm; height: 85.6mm; border-radius: 3mm; overflow: hidden; background: #FFFFFF; border: 0.2mm solid ${Brand.border}; display: flex; flex-direction: column; }
  .band { background: ${Brand.forest}; color: ${Brand.forestText}; padding: 4mm 4mm 5mm; display: flex; align-items: center; gap: 3mm; }
  .band img { width: 9mm; height: 12.5mm; object-fit: contain; }
  .org { font-size: 6.5pt; line-height: 1.25; color: ${Brand.forestMuted}; }
  .app { font-size: 13pt; font-weight: 700; letter-spacing: -0.3pt; }
  .body { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 3.5mm 4mm 3mm; text-align: center; }
  .role { font-size: 6.5pt; font-weight: 600; color: ${Brand.primary}; }
  .name { margin-top: 1mm; font-size: 11pt; font-weight: 700; line-height: 1.15; color: ${Brand.text}; }
  .qr { margin-top: auto; width: 34mm; height: 34mm; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .hint { margin-top: 2mm; font-size: 5.5pt; color: ${Brand.textSecondary}; }
  .note { margin-top: 5mm; font-size: 8pt; color: ${Brand.textSecondary}; }
</style></head>
<body>
  <div class="cut"><div class="card">
    <div class="band">
      <img src="${bamxLogoDataUri}" alt="">
      <div><div class="org">Banco de Alimentos<br>de Guadalajara</div><div class="app">Voluntapp</div></div>
    </div>
    <div class="body">
      <div class="role">Voluntario</div>
      <div class="name">${name}</div>
      <div class="qr">${qr}</div>
      <div class="hint">Muéstralo al llegar a una actividad</div>
    </div>
  </div></div>
  <p class="note">Recorta por la línea punteada.</p>
</body></html>`;
}

// iOS rejects with this when staff close the print dialog without printing; that's a cancel, not a failure.
const isCancel = (error: unknown) =>
  error instanceof Error && ((error as Error & { code?: string }).code === 'ERR_PRINT_INCOMPLETE' || error.message.includes('did not complete'));

// Opens the system print dialog (printer or "Guardar como PDF") for the volunteer's card.
export async function printVolunteerCard(holder: CardHolder): Promise<void> {
  const html = await cardHtml(holder);
  try {
    await printAsync({ html });
  } catch (error: unknown) {
    if (!isCancel(error)) throw error;
  }
}
