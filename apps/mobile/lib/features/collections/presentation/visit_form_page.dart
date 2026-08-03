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
import '../../../core/widgets/app_toast.dart';
import '../../face/data/face_service.dart';
import '../../face/presentation/face_capture_page.dart';
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
  final List<File> _media = [];
  bool _locating = false;
  bool _submitting = false;

  static final _videoExt = RegExp(r'\.(mp4|mov|m4v|avi|mkv|webm|3gp)$', caseSensitive: false);
  bool _isVideo(File f) => _videoExt.hasMatch(f.path);

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

  Future<void> _addMedia({required ImageSource source, bool video = false}) async {
    final picker = ImagePicker();
    final XFile? file = video
        ? await picker.pickVideo(source: source, maxDuration: const Duration(minutes: 2))
        : await picker.pickImage(source: source, imageQuality: 60, maxWidth: 1600);
    if (file != null) setState(() => _media.add(File(file.path)));
  }

  Future<void> _submit() async {
    // Face gate on arrival: verify the collector's identity (enrol on first use) before the visit is saved.
    final face = sl<FaceService>();
    final enrolled = await face.isEnrolled();
    if (!mounted) return;
    final ok = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => FaceCapturePage(mode: enrolled ? FaceMode.verify : FaceMode.enroll)),
    );
    if (ok != true) {
      if (mounted) AppToast.error('Yuz tasdiqlanmadi — tashrif saqlanmadi');
      return;
    }
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
        photos: _media,
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
          _MediaCard(
            media: _media,
            isVideo: _isVideo,
            onCamera: () => _addMedia(source: ImageSource.camera),
            onGallery: () => _addMedia(source: ImageSource.gallery),
            onVideo: () => _addMedia(source: ImageSource.camera, video: true),
            onRemove: (i) => setState(() => _media.removeAt(i)),
          ),
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

class _MediaCard extends StatelessWidget {
  const _MediaCard({
    required this.media,
    required this.isVideo,
    required this.onCamera,
    required this.onGallery,
    required this.onVideo,
    required this.onRemove,
  });

  final List<File> media;
  final bool Function(File) isVideo;
  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final VoidCallback onVideo;
  final void Function(int) onRemove;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Iconsax.gallery, size: 18),
                const SizedBox(width: 8),
                Text('Fayllar (${media.length})', style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
            if (media.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (var i = 0; i < media.length; i++)
                    Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: isVideo(media[i])
                              ? Container(
                                  width: 64, height: 64,
                                  color: Colors.black87,
                                  child: const Icon(Iconsax.video5, color: Colors.white, size: 24),
                                )
                              : Image.file(media[i], width: 64, height: 64, fit: BoxFit.cover),
                        ),
                        Positioned(
                          right: -6, top: -6,
                          child: IconButton(
                            iconSize: 18,
                            icon: const Icon(Iconsax.close_circle5, color: AppTheme.danger),
                            onPressed: () => onRemove(i),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                _AddButton(icon: Iconsax.camera, label: 'Kamera', onTap: onCamera),
                const SizedBox(width: 8),
                _AddButton(icon: Iconsax.gallery_add, label: 'Galereya', onTap: onGallery),
                const SizedBox(width: 8),
                _AddButton(icon: Iconsax.video_add, label: 'Video', onTap: onVideo),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _AddButton extends StatelessWidget {
  const _AddButton({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: OutlinedButton.icon(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 10), minimumSize: const Size(0, 0)),
        icon: Icon(icon, size: 16),
        label: Text(label, style: const TextStyle(fontSize: 12)),
      ),
    );
  }
}
