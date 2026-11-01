/**
 * Daftar titik serah terima resmi MobilJuragan.
 *
 * Sebelumnya titik jemput dihitung klien dari koordinat lewat reverse
 * geocoding, sehingga label yang muncul bergantung pada data peta pihak ketiga
 * dan sering tidak sesuai (mis. nama jalan keluar sebagai nama tempat). Daftar
 * ini menjadi satu sumber untuk mobile maupun dashboard.
 *
 * Alamat lengkap belum final (menunggu data pemilik produk), karena itu boleh
 * null: yang dipakai di layar adalah `label`.
 */
export type PickupPoint = {
  id: string;
  label: string;
  address: string | null;
  latitude: number;
  longitude: number;
  /** true bila antar-jemput ke titik ini tidak menambah biaya. */
  isFree: boolean;
};

/** Label default bila pelanggan tidak memilih titik tertentu. */
export const DEFAULT_PICKUP_POINT_ID = 'kantor-mobiljuragan';

export const PICKUP_POINTS: PickupPoint[] = [
  {
    id: 'kantor-mobiljuragan',
    label: 'Kantor MobilJuragan',
    // TODO(G24): alamat lengkap menunggu konfirmasi pemilik produk.
    address: null,
    latitude: -8.4905,
    longitude: 140.3995,
    isFree: true,
  },
  {
    id: 'bandara-mopah',
    label: 'Bandara Mopah Merauke',
    address: 'Lobi Kedatangan & Parkir VIP Bandara Mopah',
    latitude: -8.5202,
    longitude: 140.418,
    isFree: true,
  },
  {
    id: 'pelabuhan-merauke',
    label: 'Pelabuhan Merauke',
    address: 'Area Parkir Pelabuhan Merauke',
    latitude: -8.4935,
    longitude: 140.4012,
    isFree: false,
  },
];

export function findPickupPoint(idOrLabel: string | null | undefined): PickupPoint | undefined {
  if (!idOrLabel) return undefined;
  const needle = idOrLabel.trim().toLowerCase();
  return PICKUP_POINTS.find(
    (point) => point.id.toLowerCase() === needle || point.label.toLowerCase() === needle,
  );
}

/**
 * Menormalkan input pelanggan ke label resmi.
 *
 * Data lama dan label lama ("Pool Kantor") tetap diterima agar pesanan yang
 * sudah ada tidak kehilangan informasinya, tetapi yang disimpan selalu label
 * baru sehingga tidak ada dua nama untuk satu tempat.
 */
export function normalizePickupLocation(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (value === '') return null;

  if (/pool kantor/i.test(value)) {
    return PICKUP_POINTS[0]!.label;
  }

  const match = findPickupPoint(value);
  return match ? match.label : value;
}
