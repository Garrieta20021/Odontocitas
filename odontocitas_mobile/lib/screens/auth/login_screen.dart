import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../providers/app_providers.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _cedulaCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  String _rol = 'admin';
  bool _obscure = true;
  bool _remember = true;

  final _roles = const [
    ('admin', 'Admin'),
    ('odontologo', 'Odontólogo'),
    ('paciente', 'Paciente'),
  ];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_prefilled) {
      final settings = context.read<SettingsProvider>();
      _cedulaCtrl.text = settings.rememberedCedula ?? '';
      _rol = settings.rememberedRol ?? 'admin';
      _prefilled = true;
    }
  }

  bool _prefilled = false;

  @override
  void dispose() {
    _cedulaCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final auth = context.read<AuthProvider>();
    final ok = await auth.login(
      cedula: _cedulaCtrl.text.trim(),
      password: _passCtrl.text,
      rol: _rol,
      remember: _remember,
    );
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(auth.error ?? 'Error de acceso')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.medical_services, color: Colors.white),
                      ),
                      const SizedBox(width: 12),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Odontocitas', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                          Text('Gestión odontológica móvil', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  const Text('Bienvenido de nuevo', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  const Text('Ingresa tus credenciales para continuar', style: TextStyle(color: AppColors.textMuted)),
                  const SizedBox(height: 24),
                  const Text('Ingresando como', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                  const SizedBox(height: 8),
                  Row(
                    children: _roles.map((r) {
                      final selected = _rol == r.$1;
                      return Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: ChoiceChip(
                            label: Text(r.$2, style: TextStyle(fontSize: 11, color: selected ? Colors.white : AppColors.textMuted)),
                            selected: selected,
                            selectedColor: AppColors.primary,
                            onSelected: (_) => setState(() => _rol = r.$1),
                            showCheckmark: false,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _cedulaCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Número de identificación',
                      prefixIcon: Icon(Icons.badge_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passCtrl,
                    obscureText: _obscure,
                    decoration: InputDecoration(
                      labelText: 'Contraseña',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                    onSubmitted: (_) => _submit(),
                  ),
                  const SizedBox(height: 8),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _remember,
                    onChanged: (v) => setState(() => _remember = v ?? true),
                    title: const Text('Recordar cédula y rol', style: TextStyle(fontSize: 13)),
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: auth.loading ? null : _submit,
                    child: auth.loading
                        ? const SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Iniciar sesión'),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => Navigator.of(context).pushNamed('/settings'),
                    child: const Text('Configuración de la app'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
