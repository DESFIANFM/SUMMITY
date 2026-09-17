import QRCode from 'qrcode';
import { mkdirSync } from 'fs';
const DIR = new URL('./qr/', import.meta.url).pathname;
mkdirSync(DIR, { recursive: true });
/** Buat gambar QR berisi `isi`, kembalikan path filenya. */
export async function qr(isi) {
  const f = `${DIR}${isi.replace(/[^A-Za-z0-9-]/g, '_')}.png`;
  await QRCode.toFile(f, isi, { width: 480, margin: 4 });
  return f;
}
/** Unggah gambar QR lewat mode "Scan an Image File" milik Html5QrcodeScanner. */
export async function scanGambar(p, file) {
  const link = p.locator('#html5-qrcode-anchor-scan-type-change');
  await link.waitFor({ timeout: 15000 });
  if (/Image File/i.test(await link.innerText())) await link.click();
  await p.locator('#html5-qrcode-private-filescan-input').setInputFiles(file);
}
