import 'package:flutter/material.dart';
import '../models/vehicle_model.dart';
import '../theme/app_colors.dart';
import '../widgets/custom_app_bar.dart';

/// Layar 04: Tanggal & Waktu (Langkah 3 dari 5)
/// Dilengkapi kontrol panah kanan dan kiri (< >) untuk pergantian bulan kalender secara interaktif.
class DateTimeScreen extends StatefulWidget {
  final VehicleModel vehicle;

  const DateTimeScreen({
    super.key,
    required this.vehicle,
  });

  @override
  State<DateTimeScreen> createState() => _DateTimeScreenState();
}

class _DateTimeScreenState extends State<DateTimeScreen> {
  // State Tanggal & Bulan
  late DateTime _displayedMonth;
  late DateTime _selectedDate;
  
  // State Waktu & Durasi
  String _selectedTime = '09.00 WIT';
  String _timeDescription = 'Pagi hari';
  int _durationDays = 2;

  final List<String> _monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  final List<String> _dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  @override
  void initState() {
    super.initState();
    // Inisialisasi sesuai desain Hi-Fi: April 2026
    _displayedMonth = DateTime(2026, 4, 1);
    _selectedDate = DateTime(2026, 4, 1);
  }

  void _previousMonth() {
    setState(() {
      _displayedMonth = DateTime(
        _displayedMonth.year,
        _displayedMonth.month - 1,
        1,
      );
    });
  }

  void _nextMonth() {
    setState(() {
      _displayedMonth = DateTime(
        _displayedMonth.year,
        _displayedMonth.month + 1,
        1,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      appBar: const CustomAppBar(
        title: 'Tanggal & Waktu',
        stepSubtitle: 'Langkah 3 dari 5',
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header Judul & Badge
                  _buildHeaderSection(),
                  const SizedBox(height: 16),

                  // Kalender Interaktif dengan Panah Navigasi Bulan (< >)
                  _buildInteractiveCalendarCard(),
                  const SizedBox(height: 16),

                  // 2 Kolom: Waktu Mulai & Durasi Sewa
                  _buildTimeAndDurationRow(),
                  const SizedBox(height: 16),

                  // Ketentuan Waktu Penjemputan
                  _buildPickupPolicyCard(),
                  const SizedBox(height: 12),

                  // Info Tahapan Berikutnya
                  _buildNextStepNotice(),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),

          // Bottom Sticky Button
          _buildStickyCTA(),
        ],
      ),
    );
  }

  /// Header Section
  Widget _buildHeaderSection() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Tentukan Jadwal Rental',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
                fontFamily: 'Inter',
              ),
            ),
            SizedBox(height: 2),
            Text(
              'Pilih tanggal mulai sewa dan durasi pemakaian.',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w400,
                color: AppColors.textSecondary,
                fontFamily: 'Inter',
              ),
            ),
          ],
        ),
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
    );
  }

  /// Kalender Interaktif dengan Panah Navigasi Bulan (< >)
  Widget _buildInteractiveCalendarCard() {
    final int daysInMonth = DateUtils.getDaysInMonth(
      _displayedMonth.year,
      _displayedMonth.month,
    );

    // Dapatkan offset hari pertama dalam minggu (Senin = 1, Minggu = 7)
    final DateTime firstDayOfMonth = DateTime(
      _displayedMonth.year,
      _displayedMonth.month,
      1,
    );
    final int startingWeekday = firstDayOfMonth.weekday; // 1 = Senin, ..., 7 = Minggu

    final String monthName = _monthNames[_displayedMonth.month - 1];
    final String formattedYear = _displayedMonth.year.toString();

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
          // Header Bulan dengan Tombol Panah Kiri (<) dan Kanan (>)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  // Tombol Panah Kiri (Bulan Sebelumnya)
                  InkWell(
                    onTap: _previousMonth,
                    borderRadius: BorderRadius.circular(6),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLight,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.borderSubtle, width: 1),
                      ),
                      child: const Icon(
                        Icons.chevron_left,
                        size: 18,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Nama Bulan & Tahun
                  Text(
                    '$monthName $formattedYear',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                      fontFamily: 'Inter',
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Tombol Panah Kanan (Bulan Berikutnya)
                  InkWell(
                    onTap: _nextMonth,
                    borderRadius: BorderRadius.circular(6),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLight,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.borderSubtle, width: 1),
                      ),
                      child: const Icon(
                        Icons.chevron_right,
                        size: 18,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
              const Text(
                'Bulan terpilih',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primaryTeal,
                  fontFamily: 'Inter',
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Header Nama Hari (Sen - Min)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: _dayNames.map((day) {
              return SizedBox(
                width: 36,
                child: Center(
                  child: Text(
                    day,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textSecondary,
                      fontFamily: 'Inter',
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 10),

          // Grid Tanggal
          _buildDatesGrid(daysInMonth, startingWeekday),
          const SizedBox(height: 14),

          // Keterangan Tanggal Terpilih
          Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: AppColors.primaryTeal,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '${_selectedDate.day.toString().padLeft(2, '0')} ${_monthNames[_selectedDate.month - 1]} ${_selectedDate.year} dipilih sebagai tanggal mulai sewa',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                  fontFamily: 'Inter',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Grid generator untuk penanggalan
  Widget _buildDatesGrid(int totalDays, int startingWeekday) {
    final List<Widget> dayWidgets = [];

    // Tambahkan kotak kosong untuk hari sebelum tanggal 1
    for (int i = 1; i < startingWeekday; i++) {
      dayWidgets.add(const SizedBox(width: 36, height: 36));
    }

    // Tambahkan tanggal 1 s/d totalDays
    for (int day = 1; day <= totalDays; day++) {
      final isSelected = _selectedDate.year == _displayedMonth.year &&
          _selectedDate.month == _displayedMonth.month &&
          _selectedDate.day == day;

      dayWidgets.add(
        InkWell(
          onTap: () {
            setState(() {
              _selectedDate = DateTime(
                _displayedMonth.year,
                _displayedMonth.month,
                day,
              );
            });
          },
          borderRadius: BorderRadius.circular(18),
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: isSelected ? AppColors.primaryTeal : Colors.transparent,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                day.toString().padLeft(2, '0'),
                style: TextStyle(
                  fontSize: 12,
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

    return Wrap(
      alignment: WrapAlignment.start,
      spacing: 6,
      runSpacing: 6,
      children: dayWidgets,
    );
  }

  /// 2 Kolom: Waktu Mulai & Durasi Sewa
  Widget _buildTimeAndDurationRow() {
    final returnDate = _selectedDate.add(Duration(days: _durationDays));
    final formattedReturn = '${returnDate.day.toString().padLeft(2, '0')} ${_monthNames[returnDate.month - 1]}';

    return Row(
      children: [
        // Waktu Mulai
        Expanded(
          child: InkWell(
            onTap: _showTimePickerModal,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.cardWhite,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.borderSubtle, width: 1),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Waktu Mulai',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w400,
                      color: AppColors.textSecondary,
                      fontFamily: 'Inter',
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _selectedTime,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                      fontFamily: 'Inter',
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _timeDescription,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: AppColors.primaryTeal,
                      fontFamily: 'Inter',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),

        // Durasi Sewa
        Expanded(
          child: InkWell(
            onTap: _showDurationPickerModal,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.cardWhite,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.borderSubtle, width: 1),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Durasi Sewa',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w400,
                      color: AppColors.textSecondary,
                      fontFamily: 'Inter',
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$_durationDays Hari',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                      fontFamily: 'Inter',
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Selesai $formattedReturn',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: AppColors.primaryTeal,
                      fontFamily: 'Inter',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Dialog pemilihan waktu
  void _showTimePickerModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.cardWhite,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        final times = [
          {'time': '08.00 WIT', 'desc': 'Pagi hari'},
          {'time': '09.00 WIT', 'desc': 'Pagi hari'},
          {'time': '13.00 WIT', 'desc': 'Siang hari'},
          {'time': '16.00 WIT', 'desc': 'Sore hari'},
        ];

        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Pilih Jam Penjemputan (WIT)',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'Inter',
                  ),
                ),
                const SizedBox(height: 12),
                ...times.map((t) => ListTile(
                      title: Text(t['time']!, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(t['desc']!),
                      trailing: _selectedTime == t['time']
                          ? const Icon(Icons.check, color: AppColors.primaryTeal)
                          : null,
                      onTap: () {
                        setState(() {
                          _selectedTime = t['time']!;
                          _timeDescription = t['desc']!;
                        });
                        Navigator.pop(context);
                      },
                    )),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Dialog pemilihan durasi sewa
  void _showDurationPickerModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.cardWhite,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Tentukan Jumlah Hari Sewa',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        fontFamily: 'Inter',
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        IconButton(
                          onPressed: _durationDays > 1
                              ? () {
                                  setState(() => _durationDays--);
                                  setModalState(() {});
                                }
                              : null,
                          icon: const Icon(Icons.remove_circle_outline, size: 32),
                        ),
                        const SizedBox(width: 20),
                        Text(
                          '$_durationDays Hari',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            fontFamily: 'Inter',
                          ),
                        ),
                        const SizedBox(width: 20),
                        IconButton(
                          onPressed: () {
                            setState(() => _durationDays++);
                            setModalState(() {});
                          },
                          icon: const Icon(Icons.add_circle_outline, size: 32, color: AppColors.primaryTeal),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Terapkan Durasi'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  /// Ketentuan Waktu Penjemputan Box
  Widget _buildPickupPolicyCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF), // Soft Blue
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFBFDBFE), width: 1),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Ketentuan Waktu Penjemputan',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1D4ED8),
              fontFamily: 'Inter',
            ),
          ),
          SizedBox(height: 2),
          Text(
            'Waktu sewa dihitung per 24 jam sejak serah terima armada di lokasi penjemputan Merauke.',
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

  /// Box Catatan Tahapan Berikutnya
  Widget _buildNextStepNotice() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardWhite,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderSubtle, width: 1),
      ),
      child: const Text(
        'Pilih moda rental (dengan sopir atau lepas kunci) pada tahapan langkah berikutnya.',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w400,
          color: AppColors.textSecondary,
          fontFamily: 'Inter',
        ),
      ),
    );
  }

  /// Bottom Sticky CTA
  Widget _buildStickyCTA() {
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
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  backgroundColor: AppColors.primaryNavy,
                  content: Text(
                    'Jadwal ${_selectedDate.day} ${_monthNames[_selectedDate.month - 1]} ${_selectedDate.year} ($_durationDays Hari) tersimpan. Siap ke Opsi Rental.',
                    style: const TextStyle(fontFamily: 'Inter'),
                  ),
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
              'Lanjutkan ke Opsi Rental',
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
