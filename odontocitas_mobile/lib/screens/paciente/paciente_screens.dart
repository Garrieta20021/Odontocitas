import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../data/models/user_model.dart';
import '../../data/services/api_service.dart';
import '../../providers/app_providers.dart';
import '../../widgets/common_widgets.dart';

class PacienteShell extends StatefulWidget {
  const PacienteShell({super.key});

  @override
  State<PacienteShell> createState() => _PacienteShellState();
}

class _PacienteShellState extends State<PacienteShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      const PacientePortalScreen(),
      const PacienteMisCitasScreen(),
      const PacienteInfoScreen(),
      const PacientePerfilScreen(),
    ];

    return Scaffold(
      appBar: AppBar(title: Text(['Portal', 'Mis citas', 'Consultorio', 'Perfil'][_index])),
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Inicio'),
          NavigationDestination(icon: Icon(Icons.event_note_outlined), selectedIcon: Icon(Icons.event_note), label: 'Citas'),
          NavigationDestination(icon: Icon(Icons.info_outline), selectedIcon: Icon(Icons.info), label: 'Info'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Perfil'),
        ],
      ),
    );
  }
}

class PacientePortalScreen extends StatelessWidget {
  const PacientePortalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final api = context.read<ApiService>();
    final perfilId = auth.user?.perfilId;

    return FutureBuilder(
      future: Future.wait([
        api.getCitas(query: perfilId == null ? null : {'paciente_id': perfilId}),
        api.getTratamientos(),
        api.getNotificaciones(),
      ]),
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) return ErrorState(message: snap.error.toString());
        final citas = snap.data![0] as List<CitaModel>;
        final tratamientos = snap.data![1] as List<TratamientoModel>;
        final notifs = snap.data![2] as List<NotificacionModel>;

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Hola, ${auth.nombre.split(' ').first}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            const Text('Tu portal de atención odontológica', style: TextStyle(color: AppColors.textMuted)),
            const SizedBox(height: 16),
            StatTile(label: 'Mis citas', value: '${citas.length}', icon: Icons.event),
            StatTile(label: 'Tratamientos disponibles', value: '${tratamientos.length}', icon: Icons.medical_services, color: AppColors.info),
            const SectionHeader('Próximas citas'),
            if (citas.isEmpty)
              const EmptyState(message: 'Aún no tienes citas')
            else
              ...citas.take(3).map((c) => Card(
                    child: ListTile(
                      title: Text(c.tratamientoNombre ?? c.motivo ?? 'Cita'),
                      subtitle: Text(_fmt(c.fechaHora)),
                      trailing: StatusChip(label: c.estado ?? '—'),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => PacienteDetalleCitaScreen(citaId: c.id)),
                      ),
                    ),
                  )),
            const SectionHeader('Avisos'),
            if (notifs.isEmpty)
              const Text('Sin notificaciones', style: TextStyle(color: AppColors.textMuted))
            else
              ...notifs.take(3).map((n) => ListTile(
                    dense: true,
                    leading: const Icon(Icons.notifications_none),
                    title: Text(n.titulo ?? 'Aviso'),
                    subtitle: Text(n.mensaje ?? ''),
                  )),
          ],
        );
      },
    );
  }
}

class PacienteMisCitasScreen extends StatelessWidget {
  const PacienteMisCitasScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final perfilId = auth.user?.perfilId;

    return FutureBuilder(
      future: context.read<ApiService>().getCitas(
            query: perfilId == null ? null : {'paciente_id': perfilId},
          ),
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) return ErrorState(message: snap.error.toString());
        final citas = snap.data ?? [];
        if (citas.isEmpty) return const EmptyState(message: 'Sin citas (GET /citas)');
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: citas.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final c = citas[i];
            return Card(
              child: ListTile(
                title: Text(c.tratamientoNombre ?? c.motivo ?? 'Cita'),
                subtitle: Text('${_fmt(c.fechaHora)}\nDr(a). ${c.odontologoNombre ?? '—'}'),
                isThreeLine: true,
                trailing: StatusChip(label: c.estado ?? '—'),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => PacienteDetalleCitaScreen(citaId: c.id)),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class PacienteDetalleCitaScreen extends StatelessWidget {
  const PacienteDetalleCitaScreen({super.key, required this.citaId});

  final String citaId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Detalle de cita')),
      body: FutureBuilder(
        future: context.read<ApiService>().getCita(citaId),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return ErrorState(message: snap.error.toString());
          final c = snap.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c.tratamientoNombre ?? 'Cita', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      Text(_fmt(c.fechaHora)),
                      const SizedBox(height: 8),
                      StatusChip(label: c.estado ?? '—'),
                      const SizedBox(height: 12),
                      Text('Odontólogo: ${c.odontologoNombre ?? '—'}'),
                      Text('Motivo: ${c.motivo ?? '—'}'),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class PacienteInfoScreen extends StatelessWidget {
  const PacienteInfoScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: Future.wait([
        context.read<ApiService>().getConfiguracion(),
        context.read<ApiService>().getTratamientos(),
        context.read<ApiService>().getOdontologos(),
      ]),
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) return ErrorState(message: snap.error.toString());
        final config = snap.data![0] as Map<String, dynamic>;
        final tratamientos = snap.data![1] as List<TratamientoModel>;
        final odontologos = snap.data![2] as List<OdontologoModel>;

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const SectionHeader('Información del consultorio'),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: config.isEmpty
                    ? const Text('Configuración no disponible')
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: config.entries.take(8).map((e) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Text('${e.key}: ${e.value}', style: const TextStyle(fontSize: 13)),
                          );
                        }).toList(),
                      ),
              ),
            ),
            const SectionHeader('Tratamientos'),
            ...tratamientos.map((t) => Card(
                  child: ListTile(
                    title: Text(t.nombre),
                    subtitle: Text('${t.duracionMinutos ?? '—'} min'),
                    trailing: Text(_money(t.tarifa)),
                  ),
                )),
            const SectionHeader('Nuestro equipo'),
            ...odontologos.map((o) => Card(
                  child: ListTile(
                    leading: const Icon(Icons.person),
                    title: Text(o.nombre),
                    subtitle: Text(o.especialidad ?? 'General'),
                  ),
                )),
          ],
        );
      },
    );
  }
}

class PacientePerfilScreen extends StatelessWidget {
  const PacientePerfilScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: AppColors.primary,
              child: Text(auth.user?.displayInitials ?? '?', style: const TextStyle(color: Colors.white)),
            ),
            title: Text(auth.nombre),
            subtitle: Text('Cédula ${auth.user?.cedula ?? ''}\n${auth.user?.email ?? ''}'),
            isThreeLine: true,
          ),
        ),
        ListTile(
          leading: const Icon(Icons.history),
          title: const Text('Historial'),
          onTap: () {
            final id = auth.user?.perfilId;
            if (id == null) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Perfil de paciente no disponible')),
              );
              return;
            }
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => PacienteHistorialScreen(pacienteId: id, nombre: auth.nombre),
              ),
            );
          },
        ),
        ListTile(
          leading: const Icon(Icons.settings),
          title: const Text('Configuración'),
          onTap: () => Navigator.pushNamed(context, '/settings'),
        ),
        ListTile(
          leading: const Icon(Icons.logout, color: AppColors.danger),
          title: const Text('Cerrar sesión', style: TextStyle(color: AppColors.danger)),
          onTap: () async {
            await auth.logout();
            if (!context.mounted) return;
            Navigator.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
          },
        ),
      ],
    );
  }
}

class PacienteHistorialScreen extends StatelessWidget {
  const PacienteHistorialScreen({super.key, required this.pacienteId, required this.nombre});

  final String pacienteId;
  final String nombre;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Historial')),
      body: FutureBuilder(
        future: context.read<ApiService>().getHistoria(pacienteId),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return ErrorState(message: snap.error.toString());
          final historia = snap.data ?? [];
          if (historia.isEmpty) return const EmptyState(message: 'Sin historial clínico');
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: historia.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final map = Map<String, dynamic>.from(historia[i] as Map);
              return Card(
                child: ListTile(
                  title: Text((map['diagnostico'] ?? map['motivo'] ?? 'Registro').toString()),
                  subtitle: Text((map['observaciones'] ?? map['notas'] ?? '').toString()),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

String _fmt(String? raw) {
  if (raw == null || raw.isEmpty) return 'Sin fecha';
  try {
    return DateFormat('dd/MM/yyyy HH:mm').format(DateTime.parse(raw).toLocal());
  } catch (_) {
    return raw;
  }
}

String _money(num? value) {
  if (value == null) return '—';
  return NumberFormat.currency(locale: 'es_CO', symbol: '\$', decimalDigits: 0).format(value);
}
