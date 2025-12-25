import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

// FileSystem is optional, handle gracefully
let FileSystem: any = null;
try {
  FileSystem = require('expo-file-system');
} catch (e) {
  // FileSystem not available
}

// CSV Export Helper
function toCsvValue(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function arrayToCsv(data: any[][]): string {
  return data.map(row => row.map(cell => toCsvValue(cell)).join(',')).join('\n');
}

// Export CSV
export async function exportToCsv(data: any[][], filename: string): Promise<void> {
  const csv = arrayToCsv(data);
  
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  if (Platform.OS !== 'web' && FileSystem) {
    try {
      const fileUri = `${FileSystem.cacheDirectory}${filename}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv' });
      } else {
        Alert.alert('Success', `CSV saved to ${fileUri}`);
      }
    } catch (error) {
      console.error('CSV export error:', error);
      Alert.alert('Error', 'Failed to export CSV file');
    }
  }
}

// Export Excel (as XLSX using CSV format that Excel can open)
export async function exportToExcel(data: any[][], filename: string): Promise<void> {
  // Use CSV format with UTF-8 BOM for Excel compatibility
  const csv = '\uFEFF' + arrayToCsv(data);
  
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  if (Platform.OS !== 'web' && FileSystem) {
    try {
      const fileUri = `${FileSystem.cacheDirectory}${filename}.xlsx`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      } else {
        Alert.alert('Success', `Excel file saved to ${fileUri}`);
      }
    } catch (error) {
      console.error('Excel export error:', error);
      Alert.alert('Error', 'Failed to export Excel file');
    }
  }
}

// Export PDF - new version that accepts data directly for jsPDF
export async function exportToPdf(
  html: string, 
  filename: string,
  options?: {
    title?: string;
    subtitle?: string;
    headers?: string[];
    rows?: any[][];
    summary?: { label: string; value: string }[];
  }
): Promise<void> {
  try {
    // On web, use window.print() with hidden iframe
    // Note: expo-print doesn't work reliably on web, so we use browser's print API
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Create hidden iframe and trigger print dialog
      // User will need to select "Save as PDF" in the print dialog
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Trigger print dialog
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        
        // Cleanup after delay
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        }, 1000);
        
        // Note: This will show the print dialog
        // User must select "Save as PDF" as the destination
        // This is the standard web browser behavior - there's no way to avoid it without server-side PDF generation
        return;
      }
      
      // Cleanup if failed
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
      return;
    }

    // Native platforms: Use expo-print and share
    try {
      const file = await Print.printToFileAsync({ 
        html,
        width: 595.28,
        height: 841.89,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert('Success', `PDF saved to ${file.uri}`);
      }
    } catch (printError) {
      console.error('PDF generation error:', printError);
      Alert.alert('Error', 'Failed to export PDF file');
    }
  } catch (error) {
    console.error('PDF export error:', error);
    Alert.alert('Error', 'Failed to export PDF file');
  }
}

// Generate PDF HTML for reports
export function generateReportPdfHtml(
  title: string,
  subtitle: string,
  headers: string[],
  rows: any[][],
  summary?: { label: string; value: string }[]
): string {
  const tableRows = rows.map(row => `
    <tr>
      ${row.map(cell => `<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: left;">${toCsvValue(cell)}</td>`).join('')}
    </tr>
  `).join('');

  const summaryRows = summary ? summary.map(item => `
    <tr>
      <td style="padding: 8px; font-weight: 600;">${item.label}</td>
      <td style="padding: 8px; text-align: right; font-weight: 700;">${item.value}</td>
    </tr>
  `).join('') : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #111827; }
        .header { margin-bottom: 30px; border-bottom: 2px solid #2D5016; padding-bottom: 15px; }
        h1 { margin: 0; font-size: 24px; color: #2D5016; }
        h2 { margin: 5px 0 0 0; font-size: 14px; color: #6b7280; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background-color: #2D5016; color: white; padding: 12px; text-align: left; font-weight: 600; }
        .summary { margin-top: 30px; border-top: 2px solid #e5e7eb; padding-top: 15px; }
        .summary table { width: 100%; }
        .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <h2>${subtitle}</h2>
        <h2>Generated on ${new Date().toLocaleString()}</h2>
      </div>
      
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      
      ${summary ? `
      <div class="summary">
        <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">Summary</h2>
        <table>
          <tbody>
            ${summaryRows}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      <div class="footer">
        <p>Generated by LeBRQ Admin Portal</p>
      </div>
    </body>
    </html>
  `;
}

