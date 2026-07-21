import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../core/constants/app_constants.dart';
import '../models/user_model.dart';

/// Persistencia local con SharedPreferences (sesión, tema, config).
class PrefsService {
  PrefsService(this._prefs);

  final SharedPreferences _prefs;

  static Future<PrefsService> create() async {
    final prefs = await SharedPreferences.getInstance();
    return PrefsService(prefs);
  }

  // --- Sesión ---
  Future<void> saveSession({required String token, required UserModel user}) async {
    await _prefs.setString(AppConstants.prefsToken, token);
    await _prefs.setString(AppConstants.prefsUserJson, jsonEncode(user.toJson()));
  }

  String? get token => _prefs.getString(AppConstants.prefsToken);

  UserModel? get user {
    final raw = _prefs.getString(AppConstants.prefsUserJson);
    if (raw == null || raw.isEmpty) return null;
    try {
      return UserModel.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearSession() async {
    await _prefs.remove(AppConstants.prefsToken);
    await _prefs.remove(AppConstants.prefsUserJson);
  }

  bool get isLoggedIn => (token?.isNotEmpty ?? false) && user != null;

  // --- Credenciales recordadas ---
  Future<void> rememberLogin({required String cedula, required String rol}) async {
    await _prefs.setString(AppConstants.prefsRememberCedula, cedula);
    await _prefs.setString(AppConstants.prefsRememberRol, rol);
  }

  String? get rememberedCedula => _prefs.getString(AppConstants.prefsRememberCedula);
  String? get rememberedRol => _prefs.getString(AppConstants.prefsRememberRol);

  // --- Tema ---
  Future<void> setThemeMode(String mode) =>
      _prefs.setString(AppConstants.prefsThemeMode, mode);

  String get themeMode => _prefs.getString(AppConstants.prefsThemeMode) ?? 'system';

  // --- Configuración ---
  Future<void> setApiUrl(String url) =>
      _prefs.setString(AppConstants.prefsApiUrl, url);

  String get apiUrl =>
      _prefs.getString(AppConstants.prefsApiUrl) ?? AppConstants.apiBaseUrl;

  Future<void> setNotificationsEnabled(bool value) =>
      _prefs.setBool(AppConstants.prefsNotifEnabled, value);

  bool get notificationsEnabled =>
      _prefs.getBool(AppConstants.prefsNotifEnabled) ?? true;
}
