import 'package:flutter/material.dart';
import '../models/vehicle_model.dart';
import '../theme/app_colors.dart';
import 'vehicle_selection_screen.dart';

/// Layar 01: Beranda Aplikasi Mobile MobilJuragan (Hi-Fi)
/// Status bar statis sengaja dihilangkan dan menggunakan SafeArea native.
class HomeScreen extends StatefulWidget {
  final VoidCallback? onNavigateToPesan;

  const HomeScreen({super.key, this.onNavigateToPesan});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedOptionIndex = 0; // 0: Lepas Kunci, 1: Dengan Sopir, 2: Antar Bandara

  @override
  Widget build(BuildContext context) {
    final featuredVehicle = VehicleModel.sampleVehicles.first;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Brand & Lokasi
              _buildTopHeader(),
              const SizedBox(height: 18),

              // Hero Card: Mobil Terpopuler
              _buildFeaturedCard(featuredVehicle),
              const SizedBox(height: 22),

              // Bagian Status Reservasi
              _buildReservationStatusSection(),
              const SizedBox(height: 16),

              // Banner Keunggulan / Layanan
              _buildAssuranceBanner(),
              const SizedBox(height: 22),

              // Tombol Aksi Utama
              _buildPrimaryCTA(),
              const SizedBox(height: 10),

              // Subteks Keterangan
              const Center(
                child: Text(
                  'Tarif transparan • Konfirmasi instan via admin operasional',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w400,
                    color: AppColors.textSecondary,
                    fontFamily: 'Inter',
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  /// Header bagian atas: Lokasi Merauke & Profil Singkat
  Widget _buildTopHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'MobilJuragan',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: AppColors.textSecondary,
                fontFamily: 'Inter',
              ),
            ),
            const SizedBox(height: 2),
            InkWell(
              onTap: () {},
              borderRadius: BorderRadius.circular(4),
              child: const Row(
                children: [
                  Text(
                    'Merauke, Papua Selatan',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                      fontFamily: 'Inter',
                    ),
                  ),
                  SizedBox(width: 4),
                  Icon(
                    Icons.arrow_drop_down,
                    color: AppColors.textPrimary,
                    size: 20,
                  ),
                ],
              ),
            ),
          ],
        ),
        // Avatar Circle "MJ"
        Container(
          width: 40,
          height: 40,
          decoration: const BoxDecoration(
            color: AppColors.primaryTeal,
            shape: BoxShape.circle,
          ),
          child: const Center(
            child: Text(
              'MJ',
              style: TextStyle(
                color: AppColors.textWhite,
                fontSize: 14,
                fontWeight: FontWeight.w700,
                fontFamily: 'Inter',
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Hero Card: Mobil Terpopuler di Merauke (Avanza G)
  Widget _buildFeaturedCard(VehicleModel vehicle) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardWhite,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderSubtle, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Baris Badge: Terpopuler + Pelat Nomor
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.tealLight,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'TERPOPULER DI MERAUKE',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryTeal,
                    fontFamily: 'Inter',
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.badgeNavyBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  vehicle.plateNumber,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textWhite,
                    fontFamily: 'Inter',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Nama & Spesifikasi Singkat
          const Text(
            'Toyota New Avanza 1.3 G',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
              fontFamily: 'Inter',
            ),
          ),
          const SizedBox(height: 2),
          const Text(
            'MPV 7 Kursi • Manual • AC Double Dingin',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w400,
              color: AppColors.textSecondary,
              fontFamily: 'Inter',
            ),
          ),
          const SizedBox(height: 12),

          // Foto Kendaraan
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Container(
              height: 130,
              width: double.infinity,
              color: AppColors.surfaceLight,
              child: Image.asset(
                vehicle.heroImageUrl ?? vehicle.imageUrl,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) {
                  return const Center(
                    child: Icon(
                      Icons.directions_car,
                      color: AppColors.textSecondary,
                      size: 48,
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Quick Filter Chips (Lepas Kunci / Dengan Sopir / Antar Bandara)
          Row(
            children: [
              _buildOptionChip(index: 0, label: 'Lepas Kunci'),
              const SizedBox(width: 8),
              _buildOptionChip(index: 1, label: 'Dengan Sopir'),
              const SizedBox(width: 8),
              _buildOptionChip(index: 2, label: 'Antar Bandara'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildOptionChip({required int index, required String label}) {
    final bool isSelected = _selectedOptionIndex == index;
    return Expanded(
      child: InkWell(
        onTap: () {
          setState(() {
            _selectedOptionIndex = index;
          });
        },
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primaryTeal : AppColors.cardWhite,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? AppColors.primaryTeal : AppColors.borderSubtle,
              width: 1,
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? AppColors.textWhite : AppColors.textPrimary,
                fontFamily: 'Inter',
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Bagian Status Reservasi Aktif
  Widget _buildReservationStatusSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Status Reservasi',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
                fontFamily: 'Inter',
              ),
            ),
            InkWell(
              onTap: () {},
              child: const Text(
                'Riwayat ›',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primaryTeal,
                  fontFamily: 'Inter',
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.cardWhite,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.borderSubtle, width: 1),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.tealLight,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(
                  child: Text(
                    'MJ',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryTeal,
                      fontFamily: 'Inter',
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Belum ada sewa aktif',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                        fontFamily: 'Inter',
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Pilih armada siap pakai di Merauke',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w400,
                        color: AppColors.textSecondary,
                        fontFamily: 'Inter',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Banner Jaminan & Keunggulan Layanan
  Widget _buildAssuranceBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.cardWhite,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderSubtle, width: 1),
      ),
      child: const Row(
        children: [
          Icon(Icons.check, color: AppColors.primaryTeal, size: 20),
          SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Armada Bersih, Terawat & Sopir Ramah',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    fontFamily: 'Inter',
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Gratis antar-jemput Bandara Mopah & Hotel Kota',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w400,
                    color: AppColors.textSecondary,
                    fontFamily: 'Inter',
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Tombol Utama Pesan Mobil Sekarang
  Widget _buildPrimaryCTA() {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        onPressed: () {
          if (widget.onNavigateToPesan != null) {
            widget.onNavigateToPesan!();
          } else {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (context) => const VehicleSelectionScreen(),
              ),
            );
          }
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primaryNavy,
          foregroundColor: AppColors.textWhite,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: 0,
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'Pesan Mobil Sekarang',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                fontFamily: 'Inter',
              ),
            ),
            SizedBox(width: 8),
            Icon(Icons.arrow_forward, size: 18),
          ],
        ),
      ),
    );
  }
}
