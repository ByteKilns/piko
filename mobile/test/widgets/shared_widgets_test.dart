import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:piko/widgets/amount_field.dart';
import 'package:piko/widgets/money_text.dart';
import 'package:piko/widgets/monogram.dart';
import 'package:piko/widgets/segmented.dart';

void main() {
  Future<void> pump(WidgetTester tester, Widget child) {
    return tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(body: Center(child: child)),
      ),
    );
  }

  testWidgets('MoneyText shows grouped rupees with the paisa in lighter grey', (tester) async {
    await pump(tester, const MoneyText(1234.5));

    final amount = find.text('1,234.50', findRichText: true);
    expect(amount, findsOneWidget);
    final paisa = <TextSpan>[];
    tester.widget<RichText>(amount).text.visitChildren((span) {
      if (span is TextSpan && span.text == '.50') paisa.add(span);
      return true;
    });
    expect(paisa.single.style!.color, PikoColors.light.n500);
  });

  testWidgets('MoneyText puts a minus sign before a negative amount', (tester) async {
    await pump(tester, const MoneyText(-80));

    expect(find.text('−80.00', findRichText: true), findsOneWidget);
  });

  testWidgets('Segmented reports the tapped option', (tester) async {
    String? picked;
    await pump(
      tester,
      Segmented<String>(
        options: const [('a', 'Me'), ('b', 'Karuna'), ('c', 'Shared')],
        value: 'a',
        onChanged: (value) => picked = value,
      ),
    );

    await tester.tap(find.text('Shared'));

    expect(picked, 'c');
  });

  testWidgets('Monogram shows each initial, upper-cased', (tester) async {
    await pump(tester, const Monogram(people: [(name: 'nirjal', isMe: true), (name: 'Karuna', isMe: false)]));

    expect(find.text('N'), findsOneWidget);
    expect(find.text('K'), findsOneWidget);
  });

  testWidgets('AmountField only accepts an amount', (tester) async {
    final controller = TextEditingController();
    await pump(tester, AmountField(controller: controller));

    await tester.enterText(find.byType(TextField), 'Rs 1,500.505');

    expect(controller.text, '1500.50');
  });
}
