import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:geolocator/geolocator.dart';

import '../data/work_api.dart';
import '../data/work_repository.dart';

class WorkState extends Equatable {
  const WorkState({this.loading = true, this.busy = false, this.session, this.error});

  final bool loading;
  final bool busy;
  final WorkSession? session;
  final String? error;

  bool get active => session?.active ?? false;
  String? get startedAt => session?.startedAt;

  WorkState copyWith({bool? loading, bool? busy, WorkSession? session, bool clearSession = false, String? error}) {
    return WorkState(
      loading: loading ?? this.loading,
      busy: busy ?? this.busy,
      session: clearSession ? null : (session ?? this.session),
      error: error,
    );
  }

  @override
  List<Object?> get props => [loading, busy, session, error];
}

/// Owns the collector's shift: check-in/out and periodic location pings while on shift. The pings run
/// on a foreground timer — true OS-background tracking needs a foreground-service package (follow-up).
class WorkCubit extends Cubit<WorkState> {
  WorkCubit(this._repo) : super(const WorkState());

  final WorkRepository _repo;
  Timer? _pingTimer;

  Future<void> load() async {
    try {
      final s = await _repo.current();
      emit(state.copyWith(loading: false, session: s, clearSession: s == null));
      _syncTimer();
    } catch (_) {
      emit(state.copyWith(loading: false));
    }
  }

  Future<void> toggle() async {
    emit(state.copyWith(busy: true, error: null));
    final loc = await _location();
    try {
      if (state.active) {
        await _repo.end(lat: loc?.$1, lng: loc?.$2);
        emit(state.copyWith(busy: false, clearSession: true));
      } else {
        final s = await _repo.start(lat: loc?.$1, lng: loc?.$2);
        emit(state.copyWith(busy: false, session: s, clearSession: s == null));
      }
      _syncTimer();
    } catch (_) {
      emit(state.copyWith(busy: false, error: 'Amalni bajarib bo‘lmadi'));
    }
  }

  void _syncTimer() {
    _pingTimer?.cancel();
    if (state.active) {
      _pingTimer = Timer.periodic(const Duration(minutes: 5), (_) => _ping());
    }
  }

  Future<void> _ping() async {
    final loc = await _location();
    if (loc != null) await _repo.ping(lat: loc.$1, lng: loc.$2);
  }

  /// Best-effort current coordinates; null when permission is denied or it fails.
  Future<(double, double)?> _location() async {
    try {
      var p = await Geolocator.checkPermission();
      if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
      if (p == LocationPermission.denied || p == LocationPermission.deniedForever) return null;
      final pos = await Geolocator.getCurrentPosition();
      return (pos.latitude, pos.longitude);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> close() {
    _pingTimer?.cancel();
    return super.close();
  }
}
