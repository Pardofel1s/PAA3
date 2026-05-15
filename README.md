# Pac-Man — Procedural Maze Edition

A browser-based Pac-Man game built with **React**, **TypeScript**, and **Vite**. Setiap sesi menghasilkan labirin baru secara prosedural menggunakan algoritma *Recursive Backtracking*, sehingga pengalaman bermain selalu segar.

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?style=flat-square&logo=tailwindcss)

---

## Fitur

- **Procedural maze generation** — labirin baru setiap main, dibuat dengan algoritma *Recursive Backtracking*
- **4 Ghost dengan AI berbeda** — Blinky (Chase), Pinky (Scatter), Inky (Patrol), Clyde (Caged, dilepas saat skor ≥ 100)
- **Power Pellet** — makan pellet besar untuk menakuti ghost selama 8 detik
- **Skor & High Score** — tersimpan selama sesi berlangsung
- **3 nyawa** — tampil sebagai ikon Pac-Man di sidebar
- **Pause / Resume** — tekan Space kapan saja
- **Neon arcade UI** — tema hitam & cyan dengan efek CRT scanline
- **Responsive layout** — sidebar tersembunyi di layar kecil

---

## Cara Main

| Tombol | Aksi |
|---|---|
| `Arrow Keys` / `WASD` | Gerak Pac-Man |
| `Space` | Pause / Resume |

**Sistem poin:**
- Pellet biasa → **+10**
- Power Pellet → **+50**
- Makan Ghost saat Power Mode → **+200**

---

## Struktur Proyek

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

## Tech Stack

| Teknologi | Kegunaan |
|---|---|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| Tailwind CSS v4 | Styling |
| shadcn/ui + Radix UI | Komponen UI |
| SVG | Rendering maze, Pac-Man, dan ghost |

---

