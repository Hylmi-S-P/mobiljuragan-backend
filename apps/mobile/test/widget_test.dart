import 'package:flutter_test/flutter_test.dart';
import 'package:mobiljuragan_mobile/main.dart';

void main() {
  testWidgets('MobilJuraganApp renders smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const MobilJuraganApp());
    expect(find.text('MobilJuragan'), findsWidgets);
  });
}

