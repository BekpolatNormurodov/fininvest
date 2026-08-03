import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:iconsax/iconsax.dart';
import 'package:latlong2/latlong.dart';

import '../../../app/theme.dart';

/// The collector's own live location on an OpenStreetMap map. Follows GPS while the page is open,
/// so the collector can see where they are (the same position the backend receives while on shift).
class MapPage extends StatefulWidget {
  const MapPage({super.key});

  @override
  State<MapPage> createState() => _MapPageState();
}

class _MapPageState extends State<MapPage> {
  final _map = MapController();
  StreamSubscription<Position>? _sub;
  LatLng? _me;
  bool _follow = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    try {
      var p = await Geolocator.checkPermission();
      if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
      if (p == LocationPermission.denied || p == LocationPermission.deniedForever) {
        setState(() => _error = 'Lokatsiya ruxsati berilmagan.');
        return;
      }
      final pos = await Geolocator.getCurrentPosition();
      _onPos(pos);
      _sub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 10),
      ).listen(_onPos, onError: (_) {/* transient GPS error — keep the last position */});
    } catch (_) {
      setState(() => _error = 'Lokatsiyani aniqlab bo‘lmadi.');
    }
  }

  void _onPos(Position pos) {
    final here = LatLng(pos.latitude, pos.longitude);
    setState(() => _me = here);
    if (_follow) _map.move(here, _map.camera.zoom == 0 ? 16 : _map.camera.zoom);
  }

  @override
  void dispose() {
    _sub?.cancel();
    _map.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Iconsax.location_slash, size: 40, color: Colors.grey),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(onPressed: () { setState(() => _error = null); _start(); }, child: const Text('Qayta urinish')),
            ],
          ),
        ),
      );
    }
    if (_me == null) return const Center(child: CircularProgressIndicator());
    return Stack(
      children: [
        FlutterMap(
          mapController: _map,
          options: MapOptions(
            initialCenter: _me!,
            initialZoom: 16,
            onPointerDown: (_, _) { if (_follow) setState(() => _follow = false); },
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'uz.fininvest.undiruv',
            ),
            MarkerLayer(
              markers: [
                Marker(
                  point: _me!,
                  width: 44,
                  height: 44,
                  child: const _MeDot(),
                ),
              ],
            ),
          ],
        ),
        Positioned(
          right: 16,
          bottom: 16,
          child: FloatingActionButton.small(
            heroTag: 'recenter',
            backgroundColor: _follow ? AppTheme.brand : Colors.white,
            foregroundColor: _follow ? Colors.white : AppTheme.brand,
            onPressed: () {
              setState(() => _follow = true);
              if (_me != null) _map.move(_me!, 16);
            },
            child: const Icon(Iconsax.gps),
          ),
        ),
      ],
    );
  }
}

/// A pulsing brand dot marking the collector's position.
class _MeDot extends StatelessWidget {
  const _MeDot();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 18,
        height: 18,
        decoration: BoxDecoration(
          color: AppTheme.brand,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 3),
          boxShadow: [BoxShadow(color: AppTheme.brand.withValues(alpha: 0.4), blurRadius: 8, spreadRadius: 2)],
        ),
      ),
    );
  }
}
