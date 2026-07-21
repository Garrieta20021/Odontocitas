import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../data/models/user_model.dart';
import '../../data/services/api_service.dart';
import '../../providers/app_providers.dart';
import '../../widgets/common_widgets.dart';

class AdminShell extends StatefulWidget {
  const AdminShell({super.key});

  @override
  State<AdminShell> createState() => _AdminShellState();
}

class _AdminShellState extends State<AdminShell> {
  int _index = 0;

  static const _titles = [
    'Dashboard',
    'Agenda',
    'Pacientes',
    'Más',
  ];

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final pages = [
      const AdminDashboardScreen(),
      const AdminAgendaScreen(),
      const AdminPacientesScreen(),
      AdminMoreScreen(onOpenSettings: () => Navigator.pushNamed(context, '/settings')),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_index]),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Text(
                auth.nombre.split(' ').first,
                style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
              ),
            ),
          ),
        ],
      ),
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Inicio'),
          NavigationDestination(icon: Icon(Icons.calendar_month_outlined), selectedIcon: Icon(Icons.calendar_month), label: 'Agenda'),
          NavigationDestination(icon: Icon(Icons.people_outline), selectedIcon: Icon(Icons.people), label: 'Pacientes'),
          NavigationDestination(icon: Icon(Icons.grid_view_outlined), selectedIcon: Icon(Icons.grid_view), label: 'Más'),
        ],
      ),
    );
  }
}

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  Future<({DashboardMetricas metricas, List<CitaModel> hoy})>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _fetch();
  }

  Future<({DashboardMetricas metricas, List<CitaModel> hoy})> _fetch() async {
    final api = context.read<ApiService>();
    final metricas = await api.getMetricas();
    final hoy = await api.getCitasHoy();
    return (metricas: metricas, hoy: hoy);
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
        if (snap.hasError) {
          return ErrorState(message: snap.error.toString(), onRetry: _load);
        }
        final data = snap.data!;
        final m = data.metricas;
        return RefreshIndicator(
          onRefresh: () async => _load(),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              StatTile(label: 'Citas hoy', value: '${m.citasHoy ?? data.hoy.length}', icon: Icons.event),
              StatTile(label: 'Pacientes activos', value: '${m.pacientesActivos ?? '—'}', icon: Icons.people, color: AppColors.info),
              StatTile(label: 'Ingresos del mes', value: _money(m.ingresosMes), icon: Icons.payments, color: AppColors.success),
              StatTile(label: 'Citas pendientes', value: '${m.citasPendientes ?? '—'}', icon: Icons.pending_actions, color: AppColors.warning),
              const SectionHeader('Citas de hoy (GET /citas/hoy)'),
              if (data.hoy.isEmpty)
                const EmptyState(message: 'No hay citas para hoy')
              else
                ...data.hoy.take(8).map(_citaTile),
            ],
          ),
        );
      },
    );
  }
}

class AdminAgendaScreen extends StatefulWidget {
  const AdminAgendaScreen({super.key});

  @override
  State<AdminAgendaScreen> createState() => _AdminAgendaScreenState();
}

class _AdminAgendaScreenState extends State<AdminAgendaScreen> {
  Future<List<CitaModel>>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= context.read<ApiService>().getCitas();
  }

  void _load() {
    setState(() => _future = context.read<ApiService>().getCitas());
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
        if (citas.isEmpty) return const EmptyState(message: 'Sin citas (GET /citas)');
        return RefreshIndicator(
          onRefresh: () async => _load(),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: citas.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) => _citaTile(citas[i]),
          ),
        );
      },
    );
  }
}

class AdminPacientesScreen extends StatefulWidget {
  const AdminPacientesScreen({super.key});

  @override
  State<AdminPacientesScreen> createState() => _AdminPacientesScreenState();
}

class _AdminPacientesScreenState extends State<AdminPacientesScreen> {
  final _search = TextEditingController();
  Future<List<PacienteModel>>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= context.read<ApiService>().getPacientes();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _load([String? q]) {
    setState(() => _future = context.read<ApiService>().getPacientes(busqueda: q));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: TextField(
            controller: _search,
            decoration: InputDecoration(
              hintText: 'Buscar paciente…',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                icon: const Icon(Icons.arrow_forward),
                onPressed: () => _load(_search.text.trim()),
              ),
            ),
            onSubmitted: _load,
          ),
        ),
        Expanded(
          child: FutureBuilder(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snap.hasError) return ErrorState(message: snap.error.toString(), onRetry: _load);
              final items = snap.data ?? [];
              if (items.isEmpty) return const EmptyState(message: 'Sin pacientes (GET /pacientes)');
              return RefreshIndicator(
                onRefresh: () async => _load(_search.text.trim()),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final p = items[i];
                    return Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                          child: Text(p.nombre.isNotEmpty ? p.nombre[0] : '?', style: const TextStyle(color: AppColors.primary)),
                        ),
                        title: Text(p.nombre),
                        subtitle: Text([p.cedula, p.telefono].where((e) => e != null && e.isNotEmpty).join(' · ')),
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => AdminPacienteDetalleScreen(pacienteId: p.id, nombre: p.nombre)),
                        ),
                      ),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class AdminPacienteDetalleScreen extends StatelessWidget {
  const AdminPacienteDetalleScreen({super.key, required this.pacienteId, required this.nombre});

  final String pacienteId;
  final String nombre;

  @override
  Widget build(BuildContext context) {
    final api = context.read<ApiService>();
    return Scaffold(
      appBar: AppBar(title: Text(nombre)),
      body: FutureBuilder(
        future: Future.wait([api.getPaciente(pacienteId), api.getHistoria(pacienteId)]),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return ErrorState(message: snap.error.toString());
          final paciente = snap.data![0] as PacienteModel;
          final historia = snap.data![1] as List<dynamic>;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: ListTile(
                  title: Text(paciente.nombre),
                  subtitle: Text('Cédula: ${paciente.cedula ?? '—'}\n${paciente.email ?? ''}\n${paciente.telefono ?? ''}'),
                  isThreeLine: true,
                ),
              ),
              const SectionHeader('Historia clínica (GET)'),
              if (historia.isEmpty)
                const EmptyState(message: 'Sin registros de historia')
              else
                ...historia.map((h) {
                  final map = Map<String, dynamic>.from(h as Map);
                  return Card(
                    child: ListTile(
                      title: Text((map['diagnostico'] ?? map['motivo'] ?? 'Registro').toString()),
                      subtitle: Text((map['observaciones'] ?? map['notas'] ?? '').toString()),
                    ),
                  );
                }),
            ],
          );
        },
      ),
    );
  }
}

class AdminMoreScreen extends StatelessWidget {
  const AdminMoreScreen({super.key, required this.onOpenSettings});

  final VoidCallback onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final items = [
      _MoreItem('Facturación', Icons.receipt_long, () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminFacturacionScreen()))),
      _MoreItem('Inventario', Icons.inventory_2_outlined, () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminInventarioScreen()))),
      _MoreItem('Tratamientos', Icons.medical_services_outlined, () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminTratamientosScreen()))),
      _MoreItem('Odontólogos', Icons.health_and_safety_outlined, () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminOdontologosScreen()))),
      _MoreItem('Notificaciones', Icons.notifications_outlined, () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminNotificacionesScreen()))),
      _MoreItem('Reportes', Icons.bar_chart, () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminReportesScreen()))),
      _MoreItem('Config. clínica', Icons.business, () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminConfigClinicaScreen()))),
      _MoreItem('Ajustes app', Icons.settings, onOpenSettings),
    ];

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final item = items[i];
        return Card(
          child: ListTile(
            leading: Icon(item.icon, color: AppColors.primary),
            title: Text(item.title),
            trailing: const Icon(Icons.chevron_right),
            onTap: item.onTap,
          ),
        );
      },
    );
  }
}

class _MoreItem {
  _MoreItem(this.title, this.icon, this.onTap);
  final String title;
  final IconData icon;
  final VoidCallback onTap;
}

class AdminFacturacionScreen extends StatelessWidget {
  const AdminFacturacionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = context.read<ApiService>();
    return Scaffold(
      appBar: AppBar(title: const Text('Facturación')),
      body: FutureBuilder(
        future: Future.wait([api.getFacturas(), api.getFacturasResumen()]),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return ErrorState(message: snap.error.toString());
          final facturas = snap.data![0] as List<FacturaModel>;
          final resumen = snap.data![1] as Map<String, dynamic>;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              StatTile(label: 'Resumen', value: resumen.isEmpty ? '—' : resumen.values.take(2).join(' · '), icon: Icons.summarize),
              const SectionHeader('Facturas (GET /facturas)'),
              if (facturas.isEmpty)
                const EmptyState(message: 'Sin facturas')
              else
                ...facturas.map((f) => Card(
                      child: ListTile(
                        title: Text(f.numero ?? f.id),
                        subtitle: Text('${f.pacienteNombre ?? '—'} · ${_money(f.total)}'),
                        trailing: StatusChip(label: f.estado ?? '—'),
                      ),
                    )),
            ],
          );
        },
      ),
    );
  }
}

class AdminInventarioScreen extends StatelessWidget {
  const AdminInventarioScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Inventario')),
      body: FutureBuilder(
        future: context.read<ApiService>().getInventario(),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return ErrorState(message: snap.error.toString());
          final items = snap.data ?? [];
          if (items.isEmpty) return const EmptyState(message: 'Sin insumos (GET /inventario)');
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final n = items[i];
              return Card(
                child: ListTile(
                  title: Text(n.nombre),
                  subtitle: Text('${n.categoria ?? '—'} · Stock: ${n.stockActual ?? 0} ${n.unidad ?? ''}'),
                  trailing: StatusChip(label: n.estado ?? 'ok'),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class AdminTratamientosScreen extends StatelessWidget {
  const AdminTratamientosScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tratamientos')),
      body: FutureBuilder(
        future: context.read<ApiService>().getTratamientos(),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return ErrorState(message: snap.error.toString());
          final items = snap.data ?? [];
          if (items.isEmpty) return const EmptyState(message: 'Sin tratamientos');
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final t = items[i];
              return Card(
                child: ListTile(
                  title: Text(t.nombre),
                  subtitle: Text('${t.especialidad ?? '—'} · ${t.duracionMinutos ?? '—'} min'),
                  trailing: Text(_money(t.tarifa), style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class AdminOdontologosScreen extends StatelessWidget {
  const AdminOdontologosScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Odontólogos')),
      body: FutureBuilder(
        future: context.read<ApiService>().getOdontologos(),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return ErrorState(message: snap.error.toString());
          final items = snap.data ?? [];
          if (items.isEmpty) return const EmptyState(message: 'Sin odontólogos');
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final o = items[i];
              return Card(
                child: ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.person)),
                  title: Text(o.nombre),
                  subtitle: Text(o.especialidad ?? 'General'),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class AdminNotificacionesScreen extends StatelessWidget {
  const AdminNotificacionesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notificaciones')),
      body: FutureBuilder(
        future: context.read<ApiService>().getNotificaciones(),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return ErrorState(message: snap.error.toString());
          final items = snap.data ?? [];
          if (items.isEmpty) return const EmptyState(message: 'Sin notificaciones');
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final n = items[i];
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.notifications),
                  title: Text(n.titulo ?? 'Aviso'),
                  subtitle: Text(n.mensaje ?? ''),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class AdminReportesScreen extends StatelessWidget {
  const AdminReportesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reportes')),
      body: FutureBuilder(
        future: context.read<ApiService>().getReportes(),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return ErrorState(message: snap.error.toString());
          final data = snap.data ?? {};
          if (data.isEmpty) return const EmptyState(message: 'Sin datos de reportes');
          return ListView(
            padding: const EdgeInsets.all(16),
            children: data.entries.map((e) {
              return Card(
                child: ListTile(
                  title: Text(e.key),
                  subtitle: Text(e.value.toString()),
                ),
              );
            }).toList(),
          );
        },
      ),
    );
  }
}

class AdminConfigClinicaScreen extends StatelessWidget {
  const AdminConfigClinicaScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Configuración clínica')),
      body: FutureBuilder(
        future: context.read<ApiService>().getConfiguracion(),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return ErrorState(message: snap.error.toString());
          final data = snap.data ?? {};
          if (data.isEmpty) return const EmptyState(message: 'Sin configuración');
          return ListView(
            padding: const EdgeInsets.all(16),
            children: data.entries.map((e) {
              return Card(
                child: ListTile(
                  title: Text(e.key),
                  subtitle: Text('${e.value}'),
                ),
              );
            }).toList(),
          );
        },
      ),
    );
  }
}

Widget _citaTile(CitaModel c) {
  final fecha = _formatDate(c.fechaHora);
  return Card(
    child: ListTile(
      title: Text(c.pacienteNombre ?? c.motivo ?? 'Cita'),
      subtitle: Text('$fecha\n${c.odontologoNombre ?? ''} · ${c.tratamientoNombre ?? ''}'),
      isThreeLine: true,
      trailing: StatusChip(label: c.estado ?? '—'),
    ),
  );
}

String _formatDate(String? raw) {
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
