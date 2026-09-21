/// Model data kendaraan untuk katalog dan detail rental MobilJuragan
class VehicleModel {
  final String id;
  final String name;
  final String plateNumber;
  final String category; // MPV, SUV, Pickup
  final String seatCapacity;
  final String transmission;
  final String bodyType;
  final String condition;
  final String availabilityTag;
  final bool isPopular;
  final int pricePerDay;
  final String imageUrl;
  final String? heroImageUrl;
  final String? detailImageUrl;

  const VehicleModel({
    required this.id,
    required this.name,
    required this.plateNumber,
    required this.category,
    required this.seatCapacity,
    required this.transmission,
    required this.bodyType,
    required this.condition,
    required this.availabilityTag,
    this.isPopular = false,
    required this.pricePerDay,
    required this.imageUrl,
    this.heroImageUrl,
    this.detailImageUrl,
  });

  /// Data armada riil resmi MobilJuragan Merauke
  static const List<VehicleModel> sampleVehicles = [
    VehicleModel(
      id: 'avanza-g-putih',
      name: 'AVANZA G PUTIH',
      plateNumber: 'PS1692B',
      category: 'MPV',
      seatCapacity: '7 Penumpang',
      transmission: 'Manual 5-Speed',
      bodyType: 'MPV Keluarga',
      condition: 'Siap & AC Dingin',
      availabilityTag: 'Tersedia • Lepas Kunci',
      isPopular: true,
      pricePerDay: 400000,
      imageUrl: 'assets/images/avanza_card.png',
      heroImageUrl: 'assets/images/avanza_hero.png',
      detailImageUrl: 'assets/images/avanza_detail.png',
    ),
    VehicleModel(
      id: 'fortuner-vrz-hitam',
      name: 'FORTUNER VRZ TRD HITAM',
      plateNumber: 'B8833AKU',
      category: 'SUV',
      seatCapacity: '7 Penumpang',
      transmission: 'Otomatis 6-Speed',
      bodyType: 'SUV Tangguh',
      condition: 'Siap & AC Dingin',
      availabilityTag: 'Tersedia • Lepas Kunci/Supir',
      isPopular: false,
      pricePerDay: 900000,
      imageUrl: 'assets/images/fortuner_card.png',
      detailImageUrl: 'assets/images/fortuner_card.png',
    ),
    VehicleModel(
      id: 'hilux-g-hitam',
      name: 'HILUX G HITAM',
      plateNumber: 'PA8593GZ',
      category: 'Pickup',
      seatCapacity: '5 Penumpang (Double Cabin)',
      transmission: 'Manual 6-Speed 4x4',
      bodyType: 'D-Cab Ekspedisi',
      condition: 'Siap & Tangguh Proyek',
      availabilityTag: 'Tersedia • Tangguh Proyek',
      isPopular: false,
      pricePerDay: 850000,
      imageUrl: 'assets/images/hilux_card.png',
      detailImageUrl: 'assets/images/hilux_card.png',
    ),
    VehicleModel(
      id: 'innova-reborn-hitam',
      name: 'INNOVA REBORN G HITAM',
      plateNumber: 'PA1504G',
      category: 'MPV',
      seatCapacity: '7 Penumpang',
      transmission: 'Otomatis 6-Speed',
      bodyType: 'Premium MPV',
      condition: 'Siap & Nyaman',
      availabilityTag: 'Tersedia • Premium MPV',
      isPopular: false,
      pricePerDay: 600000,
      imageUrl: 'assets/images/innova_card.png',
      detailImageUrl: 'assets/images/innova_card.png',
    ),
  ];
}
