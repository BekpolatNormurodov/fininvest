import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/network/api_exception.dart';
import '../../data/models/app_notification.dart';
import '../../data/notifications_repository.dart';

enum NotificationsStatus { initial, loading, loaded, error }

class NotificationsState extends Equatable {
  const NotificationsState({
    this.status = NotificationsStatus.initial,
    this.items = const [],
    this.error,
  });

  final NotificationsStatus status;
  final List<AppNotification> items;
  final String? error;

  int get unread => items.where((n) => !n.read).length;

  NotificationsState copyWith({
    NotificationsStatus? status,
    List<AppNotification>? items,
    String? error,
  }) {
    return NotificationsState(
      status: status ?? this.status,
      items: items ?? this.items,
      error: error,
    );
  }

  @override
  List<Object?> get props => [status, items, error];
}

class NotificationsCubit extends Cubit<NotificationsState> {
  NotificationsCubit(this._repository) : super(const NotificationsState());

  final NotificationsRepository _repository;

  Future<void> load() async {
    emit(state.copyWith(status: NotificationsStatus.loading, error: null));
    try {
      final items = await _repository.list();
      emit(state.copyWith(status: NotificationsStatus.loaded, items: items));
    } on ApiException catch (e) {
      emit(state.copyWith(status: NotificationsStatus.error, error: e.message));
    } catch (_) {
      emit(state.copyWith(status: NotificationsStatus.error, error: 'Xatolik'));
    }
  }

  Future<void> markRead(String id) async {
    emit(state.copyWith(items: state.items.map((n) => n.id == id ? n.copyWith(read: true) : n).toList()));
    try {
      await _repository.markRead(id);
    } catch (_) {
      /* optimistic — a failure just means the badge reappears on next load */
    }
  }

  Future<void> markAll() async {
    emit(state.copyWith(items: state.items.map((n) => n.copyWith(read: true)).toList()));
    try {
      await _repository.markAll();
    } catch (_) {}
  }
}
