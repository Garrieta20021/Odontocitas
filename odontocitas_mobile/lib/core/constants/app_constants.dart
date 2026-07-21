/// Constantes de la app móvil OdontoCitas.
class AppConstants {
  /// URL base de la API (PostgreSQL vía odontocitas-api).
  /// iOS Simulator / desktop: localhost
  /// Android emulator: usa 10.0.2.2
  /// Dispositivo físico: IP de tu PC en la LAN
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3001/api',
  );

  static const String prefsToken = 'odontocitas_token';
  static const String prefsUserJson = 'odontocitas_user';
  static const String prefsThemeMode = 'odontocitas_theme_mode';
  static const String prefsApiUrl = 'odontocitas_api_url';
  static const String prefsRememberCedula = 'odontocitas_remember_cedula';
  static const String prefsRememberRol = 'odontocitas_remember_rol';
  static const String prefsNotifEnabled = 'odontocitas_notif_enabled';
}
