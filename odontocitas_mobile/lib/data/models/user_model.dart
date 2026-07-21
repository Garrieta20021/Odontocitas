class UserModel {
  const UserModel({
    required this.id,
    required this.cedula,
    required this.nombre,
    required this.email,
    required this.telefono,
    required this.rol,
    this.perfilId,
    this.initials,
  });

  final String id;
  final String? perfilId;
  final String cedula;
  final String nombre;
  final String email;
  final String telefono;
  final String rol;
  final String? initials;

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      perfilId: json['perfilId']?.toString(),
      cedula: json['cedula']?.toString() ?? '',
      nombre: json['nombre']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      telefono: json['telefono']?.toString() ?? '',
      rol: json['rol']?.toString() ?? '',
      initials: json['initials']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'perfilId': perfilId,
        'cedula': cedula,
        'nombre': nombre,
        'email': email,
        'telefono': telefono,
        'rol': rol,
        'initials': initials,
      };

  String get displayInitials =>
      initials ??
      nombre
          .split(' ')
          .where((e) => e.isNotEmpty)
          .take(2)
          .map((e) => e[0].toUpperCase())
          .join();
}

class CitaModel {
  const CitaModel({
    required this.id,
    this.fechaHora,
    this.estado,
    this.motivo,
    this.pacienteNombre,
    this.odontologoNombre,
    this.tratamientoNombre,
    this.duracionMinutos,
  });

  final String id;
  final String? fechaHora;
  final String? estado;
  final String? motivo;
  final String? pacienteNombre;
  final String? odontologoNombre;
  final String? tratamientoNombre;
  final int? duracionMinutos;

  factory CitaModel.fromJson(Map<String, dynamic> json) {
    return CitaModel(
      id: json['id']?.toString() ?? '',
      fechaHora: (json['fecha_hora'] ?? json['fechaHora'])?.toString(),
      estado: json['estado']?.toString(),
      motivo: json['motivo']?.toString(),
      pacienteNombre: (json['paciente_nombre'] ?? json['pacienteNombre'])?.toString(),
      odontologoNombre:
          (json['odontologo_nombre'] ?? json['odontologoNombre'])?.toString(),
      tratamientoNombre:
          (json['tratamiento_nombre'] ?? json['tratamientoNombre'])?.toString(),
      duracionMinutos: int.tryParse(
        (json['duracion_minutos'] ?? json['duracionMinutos'] ?? '').toString(),
      ),
    );
  }
}

class PacienteModel {
  const PacienteModel({
    required this.id,
    required this.nombre,
    this.cedula,
    this.email,
    this.telefono,
    this.activo,
  });

  final String id;
  final String nombre;
  final String? cedula;
  final String? email;
  final String? telefono;
  final bool? activo;

  factory PacienteModel.fromJson(Map<String, dynamic> json) {
    return PacienteModel(
      id: json['id']?.toString() ?? '',
      nombre: (json['nombre'] ?? json['usuario_nombre'] ?? '').toString(),
      cedula: (json['cedula'] ?? json['usuario_cedula'])?.toString(),
      email: (json['email'] ?? json['usuario_email'])?.toString(),
      telefono: (json['telefono'] ?? json['usuario_telefono'])?.toString(),
      activo: json['activo'] is bool ? json['activo'] as bool : null,
    );
  }
}

class TratamientoModel {
  const TratamientoModel({
    required this.id,
    required this.nombre,
    this.descripcion,
    this.duracionMinutos,
    this.tarifa,
    this.especialidad,
  });

  final String id;
  final String nombre;
  final String? descripcion;
  final int? duracionMinutos;
  final num? tarifa;
  final String? especialidad;

  factory TratamientoModel.fromJson(Map<String, dynamic> json) {
    return TratamientoModel(
      id: json['id']?.toString() ?? '',
      nombre: json['nombre']?.toString() ?? '',
      descripcion: json['descripcion']?.toString(),
      duracionMinutos: int.tryParse((json['duracion_minutos'] ?? '').toString()),
      tarifa: num.tryParse((json['tarifa'] ?? '').toString()),
      especialidad: json['especialidad']?.toString(),
    );
  }
}

class OdontologoModel {
  const OdontologoModel({
    required this.id,
    required this.nombre,
    this.especialidad,
    this.email,
    this.telefono,
  });

  final String id;
  final String nombre;
  final String? especialidad;
  final String? email;
  final String? telefono;

  factory OdontologoModel.fromJson(Map<String, dynamic> json) {
    return OdontologoModel(
      id: json['id']?.toString() ?? '',
      nombre: (json['nombre'] ?? json['usuario_nombre'] ?? '').toString(),
      especialidad: json['especialidad']?.toString(),
      email: (json['email'] ?? json['usuario_email'])?.toString(),
      telefono: (json['telefono'] ?? json['usuario_telefono'])?.toString(),
    );
  }
}

class FacturaModel {
  const FacturaModel({
    required this.id,
    this.numero,
    this.estado,
    this.total,
    this.pacienteNombre,
    this.creadoEn,
  });

  final String id;
  final String? numero;
  final String? estado;
  final num? total;
  final String? pacienteNombre;
  final String? creadoEn;

  factory FacturaModel.fromJson(Map<String, dynamic> json) {
    return FacturaModel(
      id: json['id']?.toString() ?? '',
      numero: (json['numero'] ?? json['numero_factura'])?.toString(),
      estado: json['estado']?.toString(),
      total: num.tryParse((json['total'] ?? '').toString()),
      pacienteNombre: (json['paciente_nombre'] ?? json['pacienteNombre'])?.toString(),
      creadoEn: (json['creado_en'] ?? json['created_at'])?.toString(),
    );
  }
}

class InsumoModel {
  const InsumoModel({
    required this.id,
    required this.nombre,
    this.categoria,
    this.stockActual,
    this.stockMinimo,
    this.unidad,
    this.estado,
  });

  final String id;
  final String nombre;
  final String? categoria;
  final num? stockActual;
  final num? stockMinimo;
  final String? unidad;
  final String? estado;

  factory InsumoModel.fromJson(Map<String, dynamic> json) {
    return InsumoModel(
      id: json['id']?.toString() ?? '',
      nombre: json['nombre']?.toString() ?? '',
      categoria: json['categoria']?.toString(),
      stockActual: num.tryParse((json['stock_actual'] ?? '').toString()),
      stockMinimo: num.tryParse((json['stock_minimo'] ?? '').toString()),
      unidad: json['unidad']?.toString(),
      estado: json['estado']?.toString(),
    );
  }
}

class NotificacionModel {
  const NotificacionModel({
    required this.id,
    this.titulo,
    this.mensaje,
    this.tipo,
    this.leida,
    this.creadoEn,
  });

  final String id;
  final String? titulo;
  final String? mensaje;
  final String? tipo;
  final bool? leida;
  final String? creadoEn;

  factory NotificacionModel.fromJson(Map<String, dynamic> json) {
    return NotificacionModel(
      id: json['id']?.toString() ?? '',
      titulo: json['titulo']?.toString(),
      mensaje: json['mensaje']?.toString(),
      tipo: json['tipo']?.toString(),
      leida: json['leida'] is bool ? json['leida'] as bool : null,
      creadoEn: (json['creado_en'] ?? json['created_at'])?.toString(),
    );
  }
}

class DashboardMetricas {
  const DashboardMetricas({
    this.citasHoy,
    this.pacientesActivos,
    this.ingresosMes,
    this.citasPendientes,
    raw,
  }) : raw = raw ?? const {};

  final int? citasHoy;
  final int? pacientesActivos;
  final num? ingresosMes;
  final int? citasPendientes;
  final Map<String, dynamic> raw;

  factory DashboardMetricas.fromJson(Map<String, dynamic> json) {
    return DashboardMetricas(
      citasHoy: int.tryParse((json['citas_hoy'] ?? json['citasHoy'] ?? '').toString()),
      pacientesActivos: int.tryParse(
        (json['pacientes_activos'] ?? json['pacientesActivos'] ?? '').toString(),
      ),
      ingresosMes:
          num.tryParse((json['ingresos_mes'] ?? json['ingresosMes'] ?? '').toString()),
      citasPendientes: int.tryParse(
        (json['citas_pendientes'] ?? json['citasPendientes'] ?? '').toString(),
      ),
      raw: json,
    );
  }
}
