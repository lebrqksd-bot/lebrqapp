import { Asset } from 'expo-asset';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';
import { Platform } from 'react-native';

export type TicketPdfDetails = {
  title: string;
  venue: string;
  dateLabel: string;
  showTime?: string;
  seat?: string;
  section?: string;
  round?: string;
  quantity: number;
  price: number;
  total: number;
  bookingRef: string;
  extras?: string[];
  logoUrl?: string; // optional brand logo
  qrValue?: string; // optional custom QR content; defaults to bookingRef
};

function ticketHtmlTemplate(details: TicketPdfDetails, qrSvg: string) {
  const { title, venue, dateLabel, showTime, seat = 'GA', section = 'A', round, quantity, price, total, bookingRef, extras = [], logoUrl } = details;
  const extrasHtml = extras.map((e) => `<div class="small">${e}</div>`).join('');
  return `
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { font-family: -apple-system, Segoe UI, Roboto, Arial; padding: 16px; }
        .wrapper { max-width: 800px; margin: 0 auto; }
        .card { border: 2px solid #5B2C91; border-radius: 8px; padding: 12px 16px 16px; }
        .logoBar { text-align: center; margin-bottom: 12px; }
        .columns { display: flex; }
        .left { flex: 3; padding-right: 12px; }
        .right { flex: 1; border-left: 1px solid #E5E7EB; padding-left: 12px; text-align:center; }
        .title { font-size: 18px; font-weight: 800; color: #111; }
        .small { font-size: 12px; color: #444; }
        .boldSmall { font-size: 12px; font-weight: 700; color: #111; }
        .metaRow { display:flex; gap: 12px; margin-top: 8px; }
        .metaBlock { background:#F3F4F6; border-radius:6px; padding:6px 10px; }
        .metaLabel { font-size:10px; color:#6B7280; }
        .metaValue { font-size:18px; font-weight:800; color:#111; }
        .divider { height:1px; background:#E5E7EB; margin:10px 0; }
        .footer { font-size: 11px; color: #6B7280; margin-top: 8px; text-align:center; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="card">
          <div class="logoBar">${logoUrl ? `<img src="${logoUrl}" style="height:46px" />` : ''}</div>
          <div class="columns">
            <div class="left">
              <div class="boldSmall">${venue}</div>
              ${round ? `<div class="small">Round: ${round}</div>` : ''}
              <div class="small">${dateLabel}</div>
              ${showTime ? `<div class="small">Showtime: ${showTime}</div>` : ''}
              <div class="metaRow">
                <div class="metaBlock">
                  <div class="metaLabel">SEAT NO.</div>
                  <div class="metaValue">${seat}</div>
                </div>
                <div class="metaBlock">
                  <div class="metaLabel">SECTION</div>
                  <div class="metaValue">${section}</div>
                </div>
              </div>
              <div class="divider"></div>
              <div class="title">${title}</div>
              ${extrasHtml}
              <div style="margin-top:10px">
                <div class="small">Qty: ${quantity} × ₹${price}</div>
                <div class="small" style="font-weight:700">Total: ₹${total}</div>
              </div>
            </div>
            <div class="right">
              <div class="boldSmall" style="margin-top:6px">Booking Ref</div>
              <div class="small" style="font-weight:700">${bookingRef}</div>
              <div style="margin-top:12px; display:flex; justify-content:center; align-items:center;">
                ${qrSvg}
              </div>
              <div class="small" style="margin-top:8px; text-align:center;">Scan at entry</div>
            </div>
          </div>
        </div>
        <div class="footer">Include VAT where applicable. Keep this ticket handy for entry.</div>
      </div>
    </body>
  </html>
  `;
}

export async function generateTicketPdf(details: TicketPdfDetails) {
  try {
    const qrContent = details.qrValue || details.bookingRef;
    
    // Generate QR code with proper size and error correction for better visibility
    const qrOptions = { 
      type: 'svg', 
      margin: 2, 
      width: 150,
      errorCorrectionLevel: 'M' as const,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };

    // On web, generate and download PDF directly without opening print dialogs using jsPDF
    if (Platform.OS === 'web') {
      // Use expo-print to generate a PDF file and auto-download it.
      // This avoids jsPDF's html2canvas dependency and AMD/require issues in Expo Web.
      const qrSvg = await QRCode.toString(qrContent, qrOptions);
      const html = ticketHtmlTemplate(details, qrSvg);
      const file = await Print.printToFileAsync({ html });
      const uri = (file as any)?.uri || (file as any)?.url;
      if (uri && typeof window !== 'undefined') {
        const a = document.createElement('a');
        a.href = uri;
        a.download = `${details.bookingRef}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return uri;
      }
      return `${details.bookingRef}.pdf`;
    }

    // Native: continue using expo-print to create a file, then share/save (include logo if available)
    let nativeLogoUrl = details.logoUrl;
    try {
      if (!nativeLogoUrl) {
        const logoMod = require('@/assets/images/lebrq-logo.png');
        const asset = Asset.fromModule(logoMod);
        await asset.downloadAsync();
        nativeLogoUrl = asset.localUri || asset.uri;
      }
    } catch {}

    const qrSvg = await QRCode.toString(qrContent, qrOptions);
    const html = ticketHtmlTemplate({ ...details, logoUrl: nativeLogoUrl || details.logoUrl }, qrSvg);
    const file = await Print.printToFileAsync({ html });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
    }
    return file.uri;
  } catch (e) {
    console.warn('generateTicketPdf error', e);
    throw e;
  }
}
