import type { SampleScreen } from "../types";

export const SAMPLE_SCREENS: SampleScreen[] = [
  {
    id: "rpg-lobby",
    title: "Lobi Game RPG",
    category: "Game Mobile 16:9",
    imageUrl: "/src/assets/images/sample_rpg_lobby_1794821242520.jpg",
    presets: [
      "Tombol 'Mulai' berwarna hijau",
      "Ikon peti harta karun",
      "Ikon gulungan Daily Quests",
      "Ikon toko (Store)",
      "Ikon pengaturan (Settings)",
      "Tombol keluar yang tidak ada",
    ],
  },
  {
    id: "strategy-hud",
    title: "Popup Hadiah Strategi",
    category: "Game HUD 16:9",
    imageUrl: "/src/assets/images/sample_strategy_hud_1794821243395.jpg",
    presets: [
      "Tombol 'Klaim Hadiah' berwarna hijau",
      "Ikon peti harta karun emas di popup",
      "Ikon gear pengaturan di kanan atas",
      "Tombol jeda (pause) di kanan atas",
      "Ikon hati nyawa di bar atas",
    ],
  },
  {
    id: "shop-checkout",
    title: "Checkout Belanja",
    category: "Aplikasi Mobile 9:16",
    imageUrl: "/src/assets/images/sample_shop_checkout_1794821243434.jpg",
    presets: [
      "Tombol 'Bayar Sekarang' berwarna hijau",
      "Ikon keranjang belanja di kanan atas",
      "Tautan teks 'Ubah' alamat pengiriman",
      "Opsi pembayaran ShopeePay",
      "Tombol kembali di kiri atas",
    ],
  },
];
