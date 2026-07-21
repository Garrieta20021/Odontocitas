import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../providers/app_providers.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _apiCtrl;

  @override
  void initState() {
    super.initState();
    _apiCtrl = TextEditingController(text: context.read<SettingsProvider>().apiUrl);
  }

  @override
  void dispose() {
    _apiCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsProvider>();
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('Configuración')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Apariencia', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'system', label: Text('Sistema'), icon: Icon(Icons.phone_iphone)),
              ButtonSegment(value: 'light', label: Text('Claro'), icon: Icon(Icons.light_mode)),
              ButtonSegment(value: 'dark', label: Text('Oscuro'), icon: Icon(Icons.dark_mode)),
            ],
            selected: {settings.themeModeLabel},
            onSelectionChanged: (s) => settings.setThemeMode(s.first),
          ),
          const SizedBox(height: 24),
          const Text('Conexión API', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            controller: _apiCtrl,
            decoration: const InputDecoration(
              labelText: 'URL base (…/api)',
              hintText: 'http://localhost:3001/api',
            ),
          ),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: () async {
              await settings.setApiUrl(_apiCtrl.text);
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('URL de API guardada en SharedPreferences')),
              );
            },
            child: const Text('Guardar URL'),
          ),
          const SizedBox(height: 24),
          SwitchListTile(
            title: const Text('Notificaciones'),
            subtitle: const Text('Preferencia local de la app'),
            value: settings.notificationsEnabled,
            activeThumbColor: AppColors.primary,
            onChanged: settings.setNotificationsEnabled,
          ),
          if (auth.isLoggedIn) ...[
            const Divider(height: 32),
            ListTile(
              leading: CircleAvatar(
                backgroundColor: AppColors.primary,
                child: Text(auth.user?.displayInitials ?? '?', style: const TextStyle(color: Colors.white)),
              ),
              title: Text(auth.nombre),
              subtitle: Text('${auth.rol} · ${auth.user?.cedula ?? ''}'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () async {
                await auth.logout();
                if (!context.mounted) return;
                Navigator.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
              },
              icon: const Icon(Icons.logout),
              label: const Text('Cerrar sesión'),
            ),
          ],
        ],
      ),
    );
  }
}
