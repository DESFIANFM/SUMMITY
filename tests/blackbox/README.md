# Pengujian Black Box

Skrip yang menjalankan skenario di `docs/SUMMITY-Pengujian-Black-Box.pdf`
melalui peramban terhadap https://www.summity.id.

```bash
npm install --no-save playwright-core@1 qrcode@1
set -a; . ./.env; . ./.env.secrets; set +a

node tests/blackbox/setup-akun.mjs   # sekali saja: membuat akun uji
node tests/blackbox/a-login.mjs
node tests/blackbox/b-registrasi.mjs
node tests/blackbox/b-ulang-duplikat.mjs   # uji ulang B13–B15 setelah perbaikan
node tests/blackbox/c-reset.mjs
node tests/blackbox/d-e-simaksi.mjs
node tests/blackbox/f-g-h.mjs
node tests/blackbox/i-h-g-j.mjs
```

Hasil aktual tiap skenario ditulis ke `hasil.json`.

Catatan: skrip memakai Google Chrome yang terpasang di macOS, menulis data
uji ke database produksi (akun, SIMAKSI, riwayat tracking), dan skenario C1
mengirim email sungguhan. Beberapa skenario mengubah status data milik akun
uji, sehingga menjalankan ulang tidak selalu menghasilkan kondisi awal yang
sama.
