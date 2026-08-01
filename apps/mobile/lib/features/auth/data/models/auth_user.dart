import 'package:equatable/equatable.dart';

/// The signed-in collector, as returned by `/auth/login` and `/auth/me`.
class AuthUser extends Equatable {
  const AuthUser({
    required this.id,
    required this.fullName,
    required this.login,
    required this.role,
    this.phone,
    this.branchId,
  });

  final String id;
  final String fullName;
  final String login;
  final String role;
  final String? phone;
  final String? branchId;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      fullName: json['fullName'] as String? ?? '',
      login: json['login'] as String? ?? '',
      role: json['role'] as String? ?? '',
      phone: json['phone'] as String?,
      branchId: json['branchId'] as String?,
    );
  }

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }

  @override
  List<Object?> get props => [id, fullName, login, role, phone, branchId];
}
