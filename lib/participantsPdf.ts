import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type ParticipantRow = {
  id: number;
  name?: string;
  mobile?: string;
  user_email?: string | null;
  subscription_type?: string | null;
  ticket_quantity?: number;
  program_type?: string;
  start_date?: string | null;
  end_date?: string | null;
  is_verified?: boolean;
};

type Context = { bookingRef?: string; title?: string };

function buildHtml(rows: ParticipantRow[], ctx?: Context) {
  const now = new Date().toLocaleString();
  const header = ctx?.title
    ? `${ctx.title}${ctx?.bookingRef ? ` (Ref #${ctx.bookingRef})` : ''}`
    : ctx?.bookingRef
      ? `Participants for Booking #${ctx.bookingRef}`
      : 'Participants List';
  const tableRows = rows.map(r => {
    const start = r.start_date ? new Date(r.start_date).toLocaleDateString() : '';
    const end = r.end_date ? new Date(r.end_date).toLocaleDateString() : '';
    return `<tr>
      <td>${r.id}</td>
      <td>${(r.name||'').replace(/</g,'&lt;')}</td>
      <td>${(r.user_email||'').replace(/</g,'&lt;')}</td>
      <td>${(r.mobile||'').replace(/</g,'&lt;')}</td>
      <td>${r.ticket_quantity||1}</td>
      <td>${(r.subscription_type||'').replace(/</g,'&lt;')}</td>
      <td>${(r.program_type||'').replace(/</g,'&lt;')}</td>
      <td>${start}</td>
      <td>${end}</td>
      <td>${r.is_verified ? 'Yes' : 'No'}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset='utf-8' />
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial; padding:16px; }
    h1 { font-size:20px; margin:0 0 12px; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th, td { border:1px solid #ddd; padding:6px; text-align:left; }
    th { background:#111; color:#fff; }
    tr:nth-child(even){ background:#f9f9f9; }
    .meta { font-size:11px; color:#555; margin-bottom:12px; }
  </style></head><body>
  <h1>${header}</h1>
  <div class='meta'>Generated ${now}</div>
  <table>
    <thead><tr>
      <th>ID</th><th>Name</th><th>Email</th><th>Mobile</th><th>Qty</th><th>Subscription</th><th>Program</th><th>Start</th><th>End</th><th>Verified</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  </body></html>`;
}

export async function generateParticipantsPdf(rows: ParticipantRow[], ctx?: string | Context) {
  const context: Context | undefined = typeof ctx === 'string' ? { bookingRef: ctx } : ctx;
  const html = buildHtml(rows, context);
  const file = await Print.printToFileAsync({ html });
  if (Platform.OS === 'web') {
    const uri = (file as any).uri || (file as any).url;
    if (uri && typeof window !== 'undefined') {
      const a = document.createElement('a');
      a.href = uri;
      a.download = `${context?.bookingRef || 'participants'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    return uri;
  }
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
  }
  return file.uri;
}

function toCsvValue(v: any) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Escape quotes and wrap in quotes if contains comma or quote
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export async function generateParticipantsCsv(rows: ParticipantRow[], ctx?: string | Context) {
  const context: Context | undefined = typeof ctx === 'string' ? { bookingRef: ctx } : ctx;
  const header = ['ID','Name','Email','Mobile','Qty','Subscription','Program','Start','End','Verified'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const start = r.start_date ? new Date(r.start_date).toISOString() : '';
    const end = r.end_date ? new Date(r.end_date).toISOString() : '';
    lines.push([
      toCsvValue(r.id),
      toCsvValue(r.name || ''),
      toCsvValue(r.user_email || ''),
      toCsvValue(r.mobile || ''),
      toCsvValue(r.ticket_quantity || 1),
      toCsvValue(r.subscription_type || ''),
      toCsvValue(r.program_type || ''),
      toCsvValue(start),
      toCsvValue(end),
      toCsvValue(r.is_verified ? 'Yes' : 'No'),
    ].join(','));
  }
  const csv = lines.join('\n');

  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${context?.bookingRef || 'participants'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return url;
  }

  const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
  const fileUri = cacheDir + `${context?.bookingRef || 'participants'}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: 'utf8' as any });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, { mimeType: 'text/csv' });
  }
  return fileUri;
}
