import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/network/api_exception.dart';
import '../../data/auth_repository.dart';
import '../../data/models/auth_user.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState extends Equatable {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.user,
    this.submitting = false,
    this.error,
  });

  final AuthStatus status;
  final AuthUser? user;
  final bool submitting;
  final String? error;

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
    bool? submitting,
    String? error,
    bool clearError = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      submitting: submitting ?? this.submitting,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [status, user, submitting, error];
}

/// Owns the session: bootstraps a stored token on launch, handles login, and clears on logout.
class AuthCubit extends Cubit<AuthState> {
  AuthCubit(this._repository) : super(const AuthState());

  final AuthRepository _repository;

  Future<void> bootstrap() async {
    try {
      final user = await _repository.currentUser();
      emit(state.copyWith(
        status: user != null ? AuthStatus.authenticated : AuthStatus.unauthenticated,
        user: user,
      ));
    } catch (_) {
      emit(state.copyWith(status: AuthStatus.unauthenticated));
    }
  }

  Future<void> login(String login, String password) async {
    emit(state.copyWith(submitting: true, clearError: true));
    try {
      final user = await _repository.login(login.trim(), password);
      emit(state.copyWith(status: AuthStatus.authenticated, user: user, submitting: false));
    } on ApiException catch (e) {
      emit(state.copyWith(submitting: false, error: e.message));
    } catch (_) {
      emit(state.copyWith(submitting: false, error: 'Kirishda xatolik yuz berdi.'));
    }
  }

  Future<void> logout() async {
    await _repository.logout();
    emit(const AuthState(status: AuthStatus.unauthenticated));
  }
}
