import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/theme/app_theme.dart';
import 'data/local/prefs_service.dart';
import 'data/services/api_client.dart';
import 'data/services/api_service.dart';
import 'providers/app_providers.dart';
import 'screens/admin/admin_screens.dart';
import 'screens/auth/login_screen.dart';
import 'screens/odontologo/odontologo_screens.dart';
import 'screens/paciente/paciente_screens.dart';
import 'screens/shared/settings_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await PrefsService.create();
  final apiClient = ApiClient(prefs);
  final api = ApiService(apiClient);

  runApp(OdontocitasApp(prefs: prefs, api: api));
}

class OdontocitasApp extends StatelessWidget {
  const OdontocitasApp({super.key, required this.prefs, required this.api});

  final PrefsService prefs;
  final ApiService api;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider.value(value: prefs),
        Provider.value(value: api),
        ChangeNotifierProvider(create: (_) => AuthProvider(prefs, api)..bootstrap()),
        ChangeNotifierProvider(create: (_) => SettingsProvider(prefs)),
      ],
      child: Consumer<SettingsProvider>(
        builder: (context, settings, _) {
          return MaterialApp(
            title: 'Odontocitas',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light(),
            darkTheme: AppTheme.dark(),
            themeMode: settings.themeMode,
            routes: {
              '/login': (_) => const LoginScreen(),
              '/settings': (_) => const SettingsScreen(),
            },
            home: const _RootGate(),
          );
        },
      ),
    );
  }
}

class _RootGate extends StatelessWidget {
  const _RootGate();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (!auth.isLoggedIn) return const LoginScreen();

    switch (auth.rol) {
      case 'admin':
        return const AdminShell();
      case 'odontologo':
        return const OdontologoShell();
      case 'paciente':
        return const PacienteShell();
      default:
        return const LoginScreen();
    }
  }
}
