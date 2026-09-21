import 'package:flutter/material.dart';
import '../models/vehicle_model.dart';
import '../theme/app_colors.dart';
import '../widgets/custom_app_bar.dart';
import '../widgets/spec_card_item.dart';
import 'date_time_screen.dart';

/// Layar 03: Detail Kendaraan (Langkah 2 dari 5)
class VehicleDetailScreen extends StatelessWidget {
  final VehicleModel vehicle;

  const VehicleDetailScreen({
    super.key,
    required this.vehicle,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      appBar: const CustomAppBar(
        title: 'Detail Kendaraan',
        stepSubtitle: 'Langkah 2 dari 5',
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header Nama Kendaraan & Badge Data Contoh
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            vehicle.name,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                              fontFamily: 'Inter',
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Plat Nomor: ${vehicle.plateNumber}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                              color: AppColors.textSecondary,
                              fontFamily: 'Inter',
                            ),
                          ),
                        ],
                      ),
                      // Badge Data Contoh
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.badgeAmberBg,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'Data contoh',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: AppColors.badgeAmberText,
                            fontFamily: 'Inter',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Hero Visual Box dengan Status Badge "Tersedia"
                  _buildVehicleImageCard(),
                  const SizedBox(height: 16),

                  // Grid Spesifikasi 2x2
                  _buildSpecsGrid(),
                  const SizedBox(height: 16),

                  // Info Box Tarif Rental
                  _buildTariffInfoBox(),
                  const SizedBox(height: 12),

                  // Box Catatan Ketentuan
                  _buildRequirementNoteBox(),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),

          // Bottom Sticky CTA
          _buildStickyCTA(context),
        ],
      ),
    );
  }

  /// Gambar Besar Kendaraan dengan Badge "Tersedia"
  Widget _buildVehicleImageCard() {
    return Container(
      width: double.infinity,
      height: 170,
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderSubtle, width: 1),
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Image.asset(
                vehicle.detailImageUrl ?? vehicle.imageUrl,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) {
                  return const Center(
                    child: Icon(
                      Icons.directions_car,
                      color: AppColors.textSecondary,
                      size: 64,
                    ),
                  );
                },
              ),
            ),
          ),
          Positioned(
            top: 10,
            right: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.badgeGreenBg,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.badgeGreenText.withValues(alpha: 0.3), width: 1),
              ),
              child: const Text(
                'Tersedia',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.badgeGreenText,
                  fontFamily: 'Inter',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 2x2 Spesifikasi Grid
  Widget _buildSpecsGrid() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: SpecCardItem(
                label: 'Kapasitas Kursi',
                value: vehicle.seatCapacity,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: SpecCardItem(
                label: 'Tipe Transmisi',
                value: vehicle.transmission,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: SpecCardItem(
                label: 'Kategori Bodi',
                value: vehicle.bodyType,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: SpecCardItem(
                label: 'Kondisi Unit',
                value: vehicle.condition,
                valueColor: AppColors.badgeGreenText,
              ),
            ),
          ],
        ),
      ],
    );
  }

  /// Info Box Tarif Rental
  Widget _buildTariffInfoBox() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF), // Soft Blue tint
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFBFDBFE), width: 1),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Informasi Tarif Rental',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1D4ED8),
              fontFamily: 'Inter',
            ),
          ),
          SizedBox(height: 2),
          Text(
            'Tarif resmi dikonfirmasi tim MobilJuragan sesuai rute dan durasi pemakaian.',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w400,
              color: Color(0xFF3B82F6),
              fontFamily: 'Inter',
            ),
          ),
        ],
      ),
    );
  }

  /// Box Catatan Persyaratan
  Widget _buildRequirementNoteBox() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardWhite,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderSubtle, width: 1),
      ),
      child: const Text(
        'Pastikan tipe mobil dan plat nomor sesuai kebutuhan sebelum melanjutkan ke jadwal sewa.',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w400,
          color: AppColors.textSecondary,
          fontFamily: 'Inter',
        ),
      ),
    );
  }

  /// Bottom Sticky Button
  Widget _buildStickyCTA(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: const BoxDecoration(
        color: AppColors.cardWhite,
        border: Border(top: BorderSide(color: AppColors.borderSubtle, width: 1)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => DateTimeScreen(vehicle: vehicle),
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryNavy,
              foregroundColor: AppColors.textWhite,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              elevation: 0,
            ),
            child: const Text(
              'Pilih Tanggal dan Waktu',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                fontFamily: 'Inter',
              ),
            ),
          ),
        ),
      ),
    );
  }
}
