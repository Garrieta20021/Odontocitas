import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:odontocitas_mobile/data/local/prefs_service.dart';
import 'package:odontocitas_mobile/data/services/api_client.dart';
import 'package:odontocitas_mobile/data/services/api_service.dart';
import 'package:odontocitas_mobile/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Muestra pantalla de login', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await PrefsService.create();
    final api = ApiService(ApiClient(prefs));

    await tester.pumpWidget(OdontocitasApp(prefs: prefs, api: api));
    await tester.pumpAndSettle();

    expect(find.text('Bienvenido de nuevo'), findsOneWidget);
    expect(find.text('Iniciar sesión'), findsOneWidget);
  });
}
