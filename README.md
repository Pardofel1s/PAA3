# 👾 Pac-Man — Procedural Maze Edition

A browser-based Pac-Man game built with **React**, **TypeScript**, and **Vite**. Setiap sesi menghasilkan labirin baru secara prosedural menggunakan algoritma *Recursive Backtracking*, sehingga pengalaman bermain selalu segar.

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?style=flat-square&logo=tailwindcss)

---

## ✨ Fitur

- 🗺️ **Procedural maze generation** — labirin baru setiap main, dibuat dengan algoritma *Recursive Backtracking*
- 👻 **4 Ghost dengan AI berbeda** — Blinky (Chase), Pinky (Scatter), Inky (Patrol), Clyde (Caged, dilepas saat skor ≥ 100)
- ⚡ **Power Pellet** — makan pellet besar untuk menakuti ghost selama 8 detik
- 🔢 **Skor & High Score** — tersimpan selama sesi berlangsung
- ❤️ **3 nyawa** — tampil sebagai ikon Pac-Man di sidebar
- ⏸️ **Pause / Resume** — tekan Space kapan saja
- 🎨 **Neon arcade UI** — tema hitam & cyan dengan efek CRT scanline
- 📐 **Responsive layout** — sidebar tersembunyi di layar kecil

---

## 🎮 Cara Main

| Tombol | Aksi |
|---|---|
| `Arrow Keys` / `WASD` | Gerak Pac-Man |
| `Space` | Pause / Resume |

**Sistem poin:**
- Pellet biasa → **+10**
- Power Pellet → **+50**
- Makan Ghost saat Power Mode → **+200**

---

## 🚀 Menjalankan Secara Lokal

### Prasyarat

- [Node.js](https://nodejs.org/) versi **18 atau lebih baru**
- npm (sudah termasuk bersama Node.js)

### Langkah-langkah

```bash
# 1. Clone repositori
git clone https://github.com/username/pacman-web.git
cd pacman-web

# 2. Install dependensi
npm install

# 3. Jalankan development server
npm run dev
```

Buka browser dan akses `http://localhost:5173`.

### Build untuk Produksi

```bash
npm run build
```

Hasil build tersimpan di folder `dist/` dan siap di-deploy.

---

## 📂 Struktur Proyek

```
project/
├── src/
│   ├── app/
│   │   ├── App.tsx          # Komponen utama & game logic
│   │   └── components/
│   │       └── ui/          # Komponen UI (shadcn/ui)
│   ├── styles/              # CSS global & Tailwind
│   └── main.tsx             # Entry point
├── index.html
├── vite.config.ts
└── package.json
```

---

## 🌐 Deploy

### Vercel (Direkomendasikan — Paling Mudah)

1. Push kode ke GitHub
2. Buka [vercel.com](https://vercel.com) → **New Project** → import repo kamu
3. Vercel otomatis mendeteksi Vite — klik **Deploy**
4. Selesai! Dapat URL public gratis 🎉

### Netlify

1. Push kode ke GitHub
2. Buka [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
3. Isi pengaturan build:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Klik **Deploy site**

### GitHub Pages

```bash
# Install gh-pages
npm install --save-dev gh-pages
```

Tambahkan script berikut di `package.json`:

```json
"scripts": {
  "deploy": "gh-pages -d dist"
}
```

Tambahkan `base` di `vite.config.ts` (ganti `nama-repo` dengan nama repo kamu):

```ts
export default defineConfig({
  base: '/nama-repo/',
  // ... konfigurasi lainnya
})
```

Lalu jalankan:

```bash
npm run build
npm run deploy
```

Aktifkan GitHub Pages di Settings → Pages → Source: `gh-pages` branch.

---

## 🛠️ Tech Stack

| Teknologi | Kegunaan |
|---|---|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| Tailwind CSS v4 | Styling |
| shadcn/ui + Radix UI | Komponen UI |
| SVG | Rendering maze, Pac-Man, dan ghost |

---

## 📄 Lisensi

MIT License — bebas digunakan dan dimodifikasi.
