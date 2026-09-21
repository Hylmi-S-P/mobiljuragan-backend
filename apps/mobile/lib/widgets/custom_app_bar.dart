import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// App Bar khusus bertema Navy dengan tombol kembali dan teks langkah stepper
class CustomAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final String? stepSubtitle;
  final VoidCallback? onBackPressed;
  final List<Widget>? actions;

  const CustomAppBar({
    super.key,
    required this.title,
    this.stepSubtitle,
    this.onBackPressed,
    this.actions,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.primaryNavy,
      child: SafeArea(
        bottom: false,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          child: Row(
            children: [
              if (onBackPressed != null || Navigator.canPop(context))
                IconButton(
                  icon: const Icon(Icons.arrow_back_ios_new, color: AppColors.textWhite, size: 18),
                  onPressed: onBackPressed ?? () => Navigator.of(context).maybePop(),
                  tooltip: 'Kembali',
                )
              else
                const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: AppColors.textWhite,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        fontFamily: 'Inter',
                      ),
                    ),
                    if (stepSubtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        stepSubtitle!,
                        style: TextStyle(
                          color: AppColors.textWhite.withValues(alpha: 0.75),
                          fontSize: 12,
                          fontWeight: FontWeight.w400,
                          fontFamily: 'Inter',
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              ...?actions,
            ],
          ),
        ),
      ),
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(64);
}
