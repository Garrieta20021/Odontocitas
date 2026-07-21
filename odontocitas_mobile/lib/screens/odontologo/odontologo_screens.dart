import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../data/models/user_model.dart';
import '../../data/services/api_service.dart';
import '../../providers/app_providers.dart';
import '../../widgets/common_widgets.dart';

class OdontologoShell extends StatefulWidget {
  const OdontologoShell({super.key});

  @override
  State<OdontologoShell> createState() => _OdontologoShellState();
}

class _OdontologoShellState extends State<OdontologoShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final pages = [
      OdontologoAgendaScreen(perfilId: auth.user?.perfilId),
      const OdontologoPacientesScreen(),
      const OdontologoPerfilScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(['Mi agenda', 'Pacientes', 'Perfil'][_index]),
      ),
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.calendar_today_outlined), selectedIcon: Icon(Icons.calendar_today), label: 'Agenda'),
          NavigationDestination(icon: Icon(Icons.people_outline), selectedIcon: Icon(Icons.people), label: 'Pacientes'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Perfil'),
        ],
      ),
    );
  }
}

class OdontologoAgendaScreen extends StatefulWidget {
  const OdontologoAgendaScreen({super.key, this.perfilId});

  final String? perfilId;

  @override
  State<OdontologoAgendaScreen> createState() => _OdontologoAgendaScreenState();
}

class _OdontologoAgendaScreenState extends State<OdontologoAgendaScreen> {
  Future<List<CitaModel>>? _future;

  Future<List<CitaModel>> _fetch() {
    final query = <String, String>{};
    if (widget.perfilId != null && widget.perfilId!.isNotEmpty) {
      query['odontologo_id'] = widget.perfilId!;
    }
    return context.read<ApiService>().getCitas(query: query.isEmpty ? null : query);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _fetch();
  }

  void _load() {
    setState(() => _future = _fetch());
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) return ErrorState(message: snap.error.toString(), onRetry: _load);
        final citas = snap.data ?? [];
        if (citas.isEmpty) return const EmptyState(message: 'Sin citas asignadas');
        return RefreshIndicator(
          onRefresh: () async => _load(),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: citas.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final c = citas[i];
              return Card(
                child: ListTile(
                  title: Text(c.pacienteNombre ?? 'Paciente'),
                  subtitle: Text('${_fmt(c.fechaHora)}\n${c.tratamientoNombre ?? c.motivo ?? ''}'),
                  isThreeLine: true,
                  trailing: StatusChip(label: c.estado ?? '—'),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => OdontologoDetalleCitaScreen(citaId: c.id)),
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

class OdontologoDetalleCitaScreen extends StatelessWidget {
  const OdontologoDetalleCitaScreen({super.key, required this.citaId});

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
                      Text(c.pacienteNombre ?? 'Paciente', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      Text(_fmt(c.fechaHora)),
                      const SizedBox(height: 8),
                      StatusChip(label: c.estado ?? '—'),
                      const SizedBox(height: 12),
                      Text('Tratamiento: ${c.tratamientoNombre ?? '—'}'),
                      Text('Motivo: ${c.motivo ?? '—'}'),
                      Text('Duración: ${c.duracionMinutos ?? '—'} min'),
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

class OdontologoPacientesScreen extends StatelessWidget {
  const OdontologoPacientesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: context.read<ApiService>().getPacientes(),
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) return ErrorState(message: snap.error.toString());
        final items = snap.data ?? [];
        if (items.isEmpty) return const EmptyState(message: 'Sin pacientes');
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final p = items[i];
            return Card(
              child: ListTile(
                title: Text(p.nombre),
                subtitle: Text(p.cedula ?? ''),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => OdontologoHistoriaScreen(pacienteId: p.id, nombre: p.nombre),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class OdontologoHistoriaScreen extends StatelessWidget {
  const OdontologoHistoriaScreen({super.key, required this.pacienteId, required this.nombre});

  final String pacienteId;
  final String nombre;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Historia · $nombre')),
      body: FutureBuilder(
        future: context.read<ApiService>().getHistoria(pacienteId),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return ErrorState(message: snap.error.toString());
          final historia = snap.data ?? [];
          if (historia.isEmpty) return const EmptyState(message: 'Sin historia clínica');
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

class OdontologoPerfilScreen extends StatelessWidget {
  const OdontologoPerfilScreen({super.key});

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
            subtitle: Text('${auth.user?.email ?? ''}\n${auth.user?.telefono ?? ''}'),
            isThreeLine: true,
          ),
        ),
        const SizedBox(height: 12),
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

String _fmt(String? raw) {
  if (raw == null || raw.isEmpty) return 'Sin fecha';
  try {
    return DateFormat('dd/MM/yyyy HH:mm').format(DateTime.parse(raw).toLocal());
  } catch (_) {
    return raw;
  }
}
