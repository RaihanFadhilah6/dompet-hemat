# Dompet Hemat

Dompet Hemat adalah aplikasi web pencatat keuangan yang dibuat dengan React + Vite. Aplikasi ini menyediakan fitur login demo, dashboard saldo, ringkasan pemasukan dan pengeluaran, serta form tambah transaksi dan riwayat transaksi.

## Fitur

- Login dan register demo
- Dashboard saldo
- Ringkasan pemasukan dan pengeluaran
- Tambah transaksi baru
- Riwayat transaksi terbaru
- Tampilan mobile-friendly

## Demo login

- Email: user@test.com
- Password: 123456

## Teknologi

- React
- Vite
- Firebase-ready (tersedia untuk integrasi lebih lanjut)

## Cara menjalankan lokal

```bash
npm install
npm run dev
```

Buka URL yang ditampilkan di terminal, biasanya:

```bash
http://localhost:5173
```

## Build produksi

```bash
npm run build
```

## Catatan

Versi saat ini masih dalam mode demo. Data transaksi disimpan di browser menggunakan localStorage agar mudah dipakai untuk presentasi dan tugas. Untuk versi real production, dapat dikembangkan lagi dengan Firebase Auth dan Firestore.
