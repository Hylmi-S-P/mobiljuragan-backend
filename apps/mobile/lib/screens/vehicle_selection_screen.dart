import 'package:flutter/material.dart';
import '../models/vehicle_model.dart';
import '../theme/app_colors.dart';
import '../widgets/custom_app_bar.dart';
import '../widgets/vehicle_card_item.dart';
import 'vehicle_detail_screen.dart';

/// Layar 02: Pilih Kendaraan (Langkah 1 dari 5)
class VehicleSelectionScreen extends StatefulWidget {
  final bool showBottomNav;

  const VehicleSelectionScreen({super.key, this.showBottomNav = false});

  @override
  State<VehicleSelectionScreen> createState() => _VehicleSelectionScreenState();
}

class _VehicleSelectionScreenState extends State<VehicleSelectionScreen> {
  String _selectedCategory = 'Semua';
  String _selectedVehicleId = 'avanza-g-putih';

  final List<String> _categories = ['Semua', 'MPV', 'SUV', 'Pickup'];

  @override
  Widget build(BuildContext context) {
    // Filter kendaraan sesuai kategori
    final filteredVehicles = _selectedCategory == 'Semua'
        ? VehicleModel.sampleVehicles
        : VehicleModel.sampleVehicles
            .where((v) => v.category == _selectedCategory)
            .toList();

    // Dapatkan kendaraan yang sedang dipilih
    final selectedVehicle = VehicleModel.sampleVehicles.firstWhere(
      (v) => v.id == _selectedVehicleId,
      orElse: () => VehicleModel.sampleVehicles.first,
    );

    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      appBar: const CustomAppBar(
        title: 'Pilih Kendaraan',
        stepSubtitle: 'Langkah 1 dari 5',
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Judul Section
                  const Text(
                    'Katalog Armada Tersedia',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                      fontFamily: 'Inter',
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Bandingkan tipe, kapasitas, dan plat nomor kendaraan.',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w400,
                      color: AppColors.textSecondary,
                      fontFamily: 'Inter',
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Filter Kategori Horizontal
                  _buildCategoryFilterBar(),
                  const SizedBox(height: 16),

                  // Daftar Kartu Kendaraan
                  ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: filteredVehicles.length,
                    itemBuilder: (context, index) {
                      final vehicle = filteredVehicles[index];
                      return VehicleCardItem(
                        vehicle: vehicle,
                        isSelected: vehicle.id == _selectedVehicleId,
                        onTap: () {
                          setState(() {
                            _selectedVehicleId = vehicle.id;
                          });
                        },
                      );
                    },
                  ),
                  const SizedBox(height: 8),

                  // Info Box Armada Tambahan
                  _buildNoticeCard(),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),

          // Bottom Sticky Button
          _buildStickyCTA(selectedVehicle),
        ],
      ),
    );
  }

  /// Horizontal Category Filter Bar
  Widget _buildCategoryFilterBar() {
    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _categories.length,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final category = _categories[index];
          final bool isSelected = _selectedCategory == category;

          return InkWell(
            onTap: () {
              setState(() {
                _selectedCategory = category;
              });
            },
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.primaryTeal : AppColors.cardWhite,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isSelected ? AppColors.primaryTeal : AppColors.borderSubtle,
                  width: 1,
                ),
              ),
              child: Center(
                child: Text(
                  category,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected ? AppColors.textWhite : AppColors.textPrimary,
                    fontFamily: 'Inter',
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  /// Notice Card Informasi Ketersediaan Armada Lainnya
  Widget _buildNoticeCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.tealLight.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.primaryTeal.withValues(alpha: 0.3), width: 1),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '5 kendaraan lainnya tersedia dalam armada',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.primaryTeal,
              fontFamily: 'Inter',
            ),
          ),
          SizedBox(height: 2),
          Text(
            'Gunakan filter di atas untuk melihat pilihan lainnya',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w400,
              color: AppColors.primaryTeal,
              fontFamily: 'Inter',
            ),
          ),
        ],
      ),
    );
  }

  /// Sticky Bottom CTA Button
  Widget _buildStickyCTA(VehicleModel selectedVehicle) {
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
                  builder: (context) => VehicleDetailScreen(vehicle: selectedVehicle),
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
            child: Text(
              'Pilih ${selectedVehicle.name}',
              style: const TextStyle(
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
