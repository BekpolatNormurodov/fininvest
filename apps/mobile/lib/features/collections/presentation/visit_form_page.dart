import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:iconsax/iconsax.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';

import '../../../app/theme.dart';
import '../../../core/di/injector.dart';
import '../../../core/i18n/locale_cubit.dart';
import '../../../core/network/api_exception.dart';
import '../data/collections_repository.dart';

const _letterLabels = {
  'NONE': 'Xatsiz',
  'WARNING': 'Ogohlantirish xati',
  'EXPLANATION': 'Tushuntirish xati',
  'OTHER': 'Boshqa',
};

/// Records a field visit for one collection: current GPS, collected amount, letter served, a
/// comment and an optional photo — submitted to the real API.
class VisitFormPage extends StatefulWidget {
  const VisitFormPage({super.key, required this.collectionId, required this.title});

  final String collectionId;
  final String title;

  @override
  State<VisitFormPage> createState() => _VisitFormPageState();
}

class _VisitFormPageState extends State<VisitFormPage> {
  final _amountController = TextEditingController();
  final _commentController = TextEditingController();
  String _letter = 'NONE';
  double? _lat;
  double? _lng;
  File? _photo;
  bool _locating = false;
  bool _submitting = false;

  @override
  void dispose() {
    _amountController.dispose();
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _getLocation() async {
    setState(() => _locating = true);
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        _snack('Joylashuvga ruxsat berilmadi');
        return;
      }
      final pos = await Geolocator.getCurrentPosition();
      setState(() {
        _lat = pos.latitude;
        _lng = pos.longitude;
      });
    } catch (_) {
      _snack('Joylashuvni aniqlab bo‘lmadi');
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.camera, imageQuality: 60, maxWidth: 1600);
    if (file != null) setState(() => _photo = File(file.path));
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_amountController.text.replaceAll(RegExp(r'[^\d.]'), '')) ?? 0;
    setState(() => _submitting = true);
    try {
      await sl<CollectionsRepository>().createVisit(
        widget.collectionId,
        amount: amount,
        letterType: _letter,
        comment: _commentController.text.trim(),
        lat: _lat,
        lng: _lng,
        photos: _photo != null ? [_photo!] : const [],
      );
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      _snack(e.message);
    } catch (_) {
      _snack('Tashrifni saqlab bo‘lmadi');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _snack(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(m)));
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LocaleCubit>().state;
    return Scaffold(
      appBar: AppBar(title: Text(lang.tr('visit.add'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(widget.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 16),
          TextField(
            controller: _amountController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(labelText: '${lang.tr('field.collected')} (${lang.tr('field.amount').toLowerCase()})', prefixIcon: const Icon(Iconsax.money_recive, size: 20)),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _letter,
            decoration: InputDecoration(labelText: lang.tr('visit.letter'), prefixIcon: const Icon(Iconsax.document_text, size: 20)),
            items: _letterLabels.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
            onChanged: (v) => setState(() => _letter = v ?? 'NONE'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _commentController,
            maxLines: 2,
            decoration: InputDecoration(labelText: lang.tr('field.comment'), alignLabelWithHint: true),
          ),
          const SizedBox(height: 16),
          _LocationCard(lat: _lat, lng: _lng, locating: _locating, onGet: _getLocation, label: lang.tr('visit.getLocation')),
          const SizedBox(height: 12),
          _PhotoCard(photo: _photo, onPick: _pickPhoto, label: lang.tr('visit.photo')),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: _submitting ? null : _submit,
            icon: _submitting
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                : const Icon(Iconsax.tick_circle, size: 20),
            label: Text(lang.tr('visit.save')),
          ),
        ],
      ),
    );
  }
}

class _LocationCard extends StatelessWidget {
  const _LocationCard({required this.lat, required this.lng, required this.locating, required this.onGet, required this.label});

  final double? lat;
  final double? lng;
  final bool locating;
  final VoidCallback onGet;
  final String label;

  @override
  Widget build(BuildContext context) {
    final has = lat != null && lng != null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Iconsax.location, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    has ? '${lat!.toStringAsFixed(5)}, ${lng!.toStringAsFixed(5)}' : label,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                TextButton(onPressed: locating ? null : onGet, child: Text(locating ? '...' : label)),
              ],
            ),
            if (has) ...[
              const SizedBox(height: 8),
              SizedBox(
                height: 160,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: FlutterMap(
                    options: MapOptions(initialCenter: LatLng(lat!, lng!), initialZoom: 16),
                    children: [
                      TileLayer(
                        urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'uz.fininvest.undiruv',
                      ),
                      MarkerLayer(
                        markers: [
                          Marker(
                            point: LatLng(lat!, lng!),
                            width: 40,
                            height: 40,
                            child: const Icon(Iconsax.location5, color: AppTheme.danger, size: 34),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PhotoCard extends StatelessWidget {
  const _PhotoCard({required this.photo, required this.onPick, required this.label});

  final File? photo;
  final VoidCallback onPick;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            if (photo != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.file(photo!, width: 56, height: 56, fit: BoxFit.cover),
              )
            else
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(10)),
                child: const Icon(Iconsax.gallery, size: 22),
              ),
            const SizedBox(width: 12),
            Expanded(child: Text(photo != null ? 'Rasm tanlandi' : label)),
            TextButton.icon(onPressed: onPick, icon: const Icon(Iconsax.camera, size: 18), label: Text(label)),
          ],
        ),
      ),
    );
  }
}
