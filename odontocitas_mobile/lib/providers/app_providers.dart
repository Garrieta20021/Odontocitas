import 'package:flutter/material.dart';

import '../data/local/prefs_service.dart';
import '../data/models/user_model.dart';
import '../data/services/api_client.dart';
import '../data/services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider(this._prefs, this._api);

  final PrefsService _prefs;
  final ApiService _api;

  UserModel? _user;
  bool _loading = false;
  String? _error;

  UserModel? get user => _user ?? _prefs.user;
  bool get isLoggedIn => _prefs.isLoggedIn;
  bool get loading => _loading;
  String? get error => _error;
  String get nombre => user?.nombre ?? '';
  String get rol => user?.rol ?? '';

  void bootstrap() {
    _user = _prefs.user;
    notifyListeners();
  }

  Future<bool> login({
    required String cedula,
    required String password,
    required String rol,
    bool remember = true,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final result = await _api.login(cedula: cedula, password: password, rol: rol);
      await _prefs.saveSession(token: result.token, user: result.user);
      if (remember) {
        await _prefs.rememberLogin(cedula: cedula, rol: rol);
      }
      _user = result.user;
      _loading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _loading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'No se pudo conectar con el servidor';
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _prefs.clearSession();
    _user = null;
    notifyListeners();
  }
}

class SettingsProvider extends ChangeNotifier {
  SettingsProvider(this._prefs);

  final PrefsService _prefs;

  ThemeMode get themeMode {
    switch (_prefs.themeMode) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  String get themeModeLabel => _prefs.themeMode;
  String get apiUrl => _prefs.apiUrl;
  bool get notificationsEnabled => _prefs.notificationsEnabled;
  String? get rememberedCedula => _prefs.rememberedCedula;
  String? get rememberedRol => _prefs.rememberedRol;

  Future<void> setThemeMode(String mode) async {
    await _prefs.setThemeMode(mode);
    notifyListeners();
  }

  Future<void> setApiUrl(String url) async {
    await _prefs.setApiUrl(url.trim());
    notifyListeners();
  }

  Future<void> setNotificationsEnabled(bool value) async {
    await _prefs.setNotificationsEnabled(value);
    notifyListeners();
  }
}
