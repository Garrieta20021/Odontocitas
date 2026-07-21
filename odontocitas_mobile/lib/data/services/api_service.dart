import '../models/user_model.dart';
import 'api_client.dart';

class ApiService {
  ApiService(this._client);

  final ApiClient _client;

  // --- Auth ---
  Future<({String token, UserModel user})> login({
    required String cedula,
    required String password,
    required String rol,
  }) async {
    final data = await _client.post(
      '/auth/login',
      auth: false,
      body: {'cedula': cedula, 'password': password, 'rol': rol},
    ) as Map<String, dynamic>;
    return (
      token: data['token'] as String,
      user: UserModel.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  // --- GET endpoints ---
  Future<DashboardMetricas> getMetricas() async {
    final data = await _client.get('/dashboard/metricas') as Map<String, dynamic>;
    return DashboardMetricas.fromJson(data);
  }

  Future<List<CitaModel>> getCitas({Map<String, String>? query}) async {
    final data = await _client.get('/citas', query: query);
    return _asList(data).map((e) => CitaModel.fromJson(e)).toList();
  }

  Future<List<CitaModel>> getCitasHoy() async {
    final data = await _client.get('/citas/hoy');
    return _asList(data).map((e) => CitaModel.fromJson(e)).toList();
  }

  Future<CitaModel> getCita(String id) async {
    final data = await _client.get('/citas/$id') as Map<String, dynamic>;
    return CitaModel.fromJson(data);
  }

  Future<List<PacienteModel>> getPacientes({String? busqueda}) async {
    final data = await _client.get(
      '/pacientes',
      query: busqueda == null || busqueda.isEmpty ? null : {'busqueda': busqueda},
    );
    return _asList(data).map((e) => PacienteModel.fromJson(e)).toList();
  }

  Future<PacienteModel> getPaciente(String id) async {
    final data = await _client.get('/pacientes/$id') as Map<String, dynamic>;
    return PacienteModel.fromJson(data);
  }

  Future<List<dynamic>> getHistoria(String pacienteId) async {
    final data = await _client.get('/pacientes/$pacienteId/historia');
    return _asList(data);
  }

  Future<List<OdontologoModel>> getOdontologos() async {
    final data = await _client.get('/odontologos');
    return _asList(data).map((e) => OdontologoModel.fromJson(e)).toList();
  }

  Future<List<TratamientoModel>> getTratamientos() async {
    final data = await _client.get('/tratamientos');
    return _asList(data).map((e) => TratamientoModel.fromJson(e)).toList();
  }

  Future<List<FacturaModel>> getFacturas() async {
    final data = await _client.get('/facturas');
    return _asList(data).map((e) => FacturaModel.fromJson(e)).toList();
  }

  Future<Map<String, dynamic>> getFacturasResumen() async {
    final data = await _client.get('/facturas/resumen');
    return data is Map<String, dynamic> ? data : {};
  }

  Future<List<InsumoModel>> getInventario() async {
    final data = await _client.get('/inventario');
    return _asList(data).map((e) => InsumoModel.fromJson(e)).toList();
  }

  Future<Map<String, dynamic>> getInventarioResumen() async {
    final data = await _client.get('/inventario/resumen');
    return data is Map<String, dynamic> ? data : {};
  }

  Future<List<NotificacionModel>> getNotificaciones() async {
    final data = await _client.get('/notificaciones');
    return _asList(data).map((e) => NotificacionModel.fromJson(e)).toList();
  }

  Future<Map<String, dynamic>> getConfiguracion() async {
    final data = await _client.get('/configuracion');
    return data is Map<String, dynamic> ? data : {};
  }

  Future<Map<String, dynamic>> getReportes({String? mes}) async {
    final data = await _client.get(
      '/dashboard/reportes',
      query: mes == null ? null : {'mes': mes},
    );
    return data is Map<String, dynamic> ? data : {};
  }

  List<Map<String, dynamic>> _asList(dynamic data) {
    if (data is List) {
      return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    if (data is Map && data['data'] is List) {
      return (data['data'] as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    return [];
  }
}
