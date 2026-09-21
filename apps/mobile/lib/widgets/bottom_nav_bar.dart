import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Bottom Navigation Bar 4-Tab dengan active indicator teal
class CustomBottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const CustomBottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.cardWhite,
        border: Border(
          top: BorderSide(color: AppColors.borderSubtle, width: 1),
        ),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(
                index: 0,
                label: 'Beranda',
                icon: Icons.home_outlined,
                activeIcon: Icons.home,
              ),
              _buildNavItem(
                index: 1,
                label: 'Pesan',
                icon: Icons.directions_car_outlined,
                activeIcon: Icons.directions_car,
              ),
              _buildNavItem(
                index: 2,
                label: 'Status',
                icon: Icons.access_time_outlined,
                activeIcon: Icons.access_time_filled,
              ),
              _buildNavItem(
                index: 3,
                label: 'Bantuan',
                icon: Icons.help_outline,
                activeIcon: Icons.help,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required int index,
    required String label,
    required IconData icon,
    required IconData activeIcon,
  }) {
    final bool isActive = currentIndex == index;
    final Color itemColor = isActive ? AppColors.primaryTeal : AppColors.textSecondary;

    return Expanded(
      child: InkWell(
        onTap: () => onTap(index),
        splashColor: Colors.transparent,
        highlightColor: Colors.transparent,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isActive ? activeIcon : icon,
              size: 22,
              color: itemColor,
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                color: itemColor,
                fontSize: 11,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                fontFamily: 'Inter',
              ),
            ),
            const SizedBox(height: 3),
            // Active underline indicator
            Container(
              width: 28,
              height: 2.5,
              decoration: BoxDecoration(
                color: isActive ? AppColors.primaryTeal : Colors.transparent,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
