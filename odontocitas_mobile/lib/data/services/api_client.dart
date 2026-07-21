import 'dart:convert';

import 'package:http/http.dart' as http;

import '../local/prefs_service.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

/// Cliente HTTP hacia odontocitas-api (PostgreSQL).
class ApiClient {
  ApiClient(this._prefs);

  final PrefsService _prefs;

  String get _base => _prefs.apiUrl.replaceAll(RegExp(r'/$'), '');

  Map<String, String> _headers({bool auth = true}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    final token = _prefs.token;
    if (auth && token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final clean = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$_base$clean').replace(queryParameters: query);
  }

  Future<dynamic> get(String path, {Map<String, String>? query, bool auth = true}) async {
    final res = await http
        .get(_uri(path, query), headers: _headers(auth: auth))
        .timeout(const Duration(seconds: 20));
    return _decode(res);
  }

  Future<dynamic> post(
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    final res = await http
        .post(
          _uri(path),
          headers: _headers(auth: auth),
          body: body == null ? null : jsonEncode(body),
        )
        .timeout(const Duration(seconds: 20));
    return _decode(res);
  }

  dynamic _decode(http.Response res) {
    dynamic data;
    try {
      data = res.body.isEmpty ? null : jsonDecode(res.body);
    } catch (_) {
      data = res.body;
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return data;
    }

    String message = 'Error ${res.statusCode}';
    if (data is Map) {
      message = (data['error'] ??
              (data['errors'] is List && (data['errors'] as List).isNotEmpty
                  ? (data['errors'] as List).first['msg']
                  : null) ??
              message)
          .toString();
    }
    throw ApiException(message, statusCode: res.statusCode);
  }
}
