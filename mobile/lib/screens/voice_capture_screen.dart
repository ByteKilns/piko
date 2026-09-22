import 'dart:math' as math;

import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

import '../models/expense_draft.dart';
import '../providers/api_client_provider.dart';
import '../providers/app_update_provider.dart';
import '../providers/categories_provider.dart';
import '../services/api_client.dart';
import '../theme/app_theme.dart';
import '../widgets/app_update_sheet.dart';

enum _VoiceStage { listening, parsing, notUnderstood }

class VoiceCaptureScreen extends ConsumerStatefulWidget {
  const VoiceCaptureScreen({super.key});

  @override
  ConsumerState<VoiceCaptureScreen> createState() => _VoiceCaptureScreenState();
}

class _VoiceCaptureScreenState extends ConsumerState<VoiceCaptureScreen> with SingleTickerProviderStateMixin {
  final stt.SpeechToText _speech = stt.SpeechToText();
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 2400))
    ..repeat();
  _VoiceStage _stage = _VoiceStage.listening;
  String _transcript = '';
  String? _notUnderstoodMessage;

  // Raw sound levels differ by platform (roughly -2..10 on Android, negative dB on iOS),
  // so track the observed range and normalise into 0..1.
  double _minSoundLevel = double.infinity;
  double _maxSoundLevel = double.negativeInfinity;
  double _soundLevel = 0;

  @override
  void initState() {
    super.initState();
    _startListening();
  }

  @override
  void dispose() {
    _pulse.dispose();
    _speech.stop();
    super.dispose();
  }

  void _onSoundLevelChange(double level) {
    if (!mounted) return;
    _minSoundLevel = math.min(_minSoundLevel, level);
    _maxSoundLevel = math.max(_maxSoundLevel, level);
    final range = _maxSoundLevel - _minSoundLevel;
    final normalised = range <= 0 ? 0.0 : (level - _minSoundLevel) / range;
    setState(() => _soundLevel = normalised.clamp(0.0, 1.0));
  }

  Future<void> _startListening() async {
    final available = await _speech.initialize(
      onError: (error) {
        if (!mounted) return;
        setState(() {
          _stage = _VoiceStage.notUnderstood;
          _notUnderstoodMessage = 'Microphone error: ${error.errorMsg}';
        });
      },
    );

    if (!available) {
      setState(() {
        _stage = _VoiceStage.notUnderstood;
        _notUnderstoodMessage = "Voice input isn't available on this device.";
      });
      return;
    }

    if (!mounted) return;
    setState(() {
      _stage = _VoiceStage.listening;
      _transcript = '';
      _soundLevel = 0;
    });

    await _speech.listen(
      onResult: (result) {
        if (!mounted) return;
        setState(() => _transcript = result.recognizedWords);
        // The recogniser ends on its own after a pause — parse right away so hands-free capture needs no tap.
        if (result.finalResult) _stopAndParse();
      },
      onSoundLevelChange: _onSoundLevelChange,
    );
  }

  Future<void> _stopAndParse() async {
    // Guards against the Done tap and the recogniser's final result both triggering a parse.
    if (_stage != _VoiceStage.listening) return;
    setState(() => _stage = _VoiceStage.parsing);
    await _speech.stop();
    if (!mounted) return;
    final transcript = _transcript.trim();
    if (transcript.isEmpty) {
      setState(() {
        _stage = _VoiceStage.notUnderstood;
        _notUnderstoodMessage = "Didn't catch anything — try again.";
      });
      return;
    }
    await _parse(transcript);
  }

  Future<void> _parse(String transcript) async {
    setState(() => _stage = _VoiceStage.parsing);

    try {
      final client = ref.read(apiClientProvider);
      final result = await client.parseVoiceTranscript(transcript);
      if (!mounted) return;

      if (result.ok && result.draft != null) {
        Navigator.of(context).pop(result.draft);
        return;
      }

      setState(() {
        _stage = _VoiceStage.notUnderstood;
        _notUnderstoodMessage = "Couldn't quite catch that as an expense — try rephrasing, or add it manually.";
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _stage = _VoiceStage.notUnderstood;
        _notUnderstoodMessage = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _stage = _VoiceStage.notUnderstood;
        _notUnderstoodMessage = 'Something went wrong — check your connection and try again.';
      });
    }
  }

  ExpenseDraft _emptyDraft() {
    final categories = ref.read(categoriesProvider).valueOrNull;
    final firstCategoryId = categories?.categories.firstOrNull?.id ?? '';
    final firstMemberId = categories?.members.firstOrNull?.id ?? '';
    final today = DateTime.now();
    final dateStr =
        '${today.year.toString().padLeft(4, '0')}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    return ExpenseDraft(
      amount: 0,
      categoryId: firstCategoryId,
      ownerMemberId: null,
      paidByMemberId: firstMemberId,
      date: dateStr,
      note: null,
    );
  }

  @override
  Widget build(BuildContext context) {
    // This screen opens on launch and covers the home banner, so surface updates here too.
    final update = ref.watch(availableUpdateProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(
        actions: [
          if (update != null)
            IconButton(
              icon: const Badge(child: Icon(Icons.system_update)),
              tooltip: 'Update available',
              onPressed: () => showAppUpdateSheet(context, update),
            ),
        ],
        leading: IconButton(
          icon: const Icon(Icons.close),
          tooltip: 'Close',
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('Add by voice'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              child: KeyedSubtree(key: ValueKey(_stage), child: _buildBody()),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    switch (_stage) {
      case _VoiceStage.listening:
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _ListeningOrb(pulse: _pulse, soundLevel: _soundLevel),
            const SizedBox(height: 16),
            _ListeningLabel(pulse: _pulse),
            const SizedBox(height: 16),
            AnimatedSize(
              duration: const Duration(milliseconds: 200),
              child: Text(
                _transcript.isEmpty ? 'Say what you spent — e.g. "400 on groceries".' : _transcript,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'SpaceGrotesk',
                  fontSize: _transcript.isEmpty ? 16 : 22,
                  fontWeight: _transcript.isEmpty ? FontWeight.w400 : FontWeight.w500,
                  color: _transcript.isEmpty ? AppColors.textMuted : AppColors.textPrimary,
                ),
              ),
            ),
            const SizedBox(height: 32),
            FilledButton.icon(
              onPressed: _stopAndParse,
              icon: const Icon(Icons.check),
              label: const Text('Done'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(_emptyDraft()),
              child: const Text('Type it instead'),
            ),
          ],
        );
      case _VoiceStage.parsing:
        return const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: AppColors.primary),
            SizedBox(height: 16),
            Text('Understanding…', style: TextStyle(fontFamily: 'SpaceGrotesk', color: AppColors.textPrimary)),
          ],
        );
      case _VoiceStage.notUnderstood:
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _notUnderstoodMessage ?? 'Not understood.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontFamily: 'SpaceGrotesk', color: AppColors.textPrimary),
            ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 8,
              alignment: WrapAlignment.center,
              children: [
                OutlinedButton(onPressed: _startListening, child: const Text('Try again')),
                if (_transcript.isNotEmpty)
                  OutlinedButton(
                    onPressed: () => _parse(_transcript),
                    child: const Text('Retry parsing'),
                  ),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(_emptyDraft()),
                  child: const Text('Add manually'),
                ),
              ],
            ),
          ],
        );
    }
  }
}

/// Mic button surrounded by expanding ripple rings; the core swells with the live sound level.
class _ListeningOrb extends StatelessWidget {
  const _ListeningOrb({required this.pulse, required this.soundLevel});

  final Animation<double> pulse;
  final double soundLevel;

  static const _size = 220.0;
  static const _coreSize = 96.0;
  static const _ringCount = 3;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _size,
      height: _size,
      child: AnimatedBuilder(
        animation: pulse,
        builder: (context, child) => Stack(
          alignment: Alignment.center,
          children: [
            for (var i = 0; i < _ringCount; i++) _ring((pulse.value + i / _ringCount) % 1),
            // Soft glow that tracks how loud the user is speaking.
            AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              width: _coreSize + 36 * soundLevel,
              height: _coreSize + 36 * soundLevel,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primary.withValues(alpha: 0.18),
              ),
            ),
            child!,
          ],
        ),
        child: AnimatedScale(
          duration: const Duration(milliseconds: 120),
          scale: 1 + 0.12 * soundLevel,
          child: Container(
            width: _coreSize,
            height: _coreSize,
            decoration: BoxDecoration(
              color: AppColors.primary,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.35),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: const Icon(Icons.mic, size: 40, color: Colors.white),
          ),
        ),
      ),
    );
  }

  Widget _ring(double t) {
    final diameter = _coreSize + (_size - _coreSize) * Curves.easeOut.transform(t);
    return Container(
      width: diameter,
      height: diameter,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.45 * (1 - t)), width: 2),
      ),
    );
  }
}

/// "LISTENING" eyebrow with three dots that bounce in sequence.
class _ListeningLabel extends StatelessWidget {
  const _ListeningLabel({required this.pulse});

  final Animation<double> pulse;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: pulse,
      builder: (context, _) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('LISTENING', style: AppTheme.eyebrow),
          const SizedBox(width: 6),
          for (var i = 0; i < 3; i++)
            Transform.translate(
              offset: Offset(0, -3 * math.sin(((pulse.value * 2 - i * 0.15) % 1) * math.pi)),
              child: Container(
                width: 4,
                height: 4,
                margin: const EdgeInsets.symmetric(horizontal: 1.5),
                decoration: const BoxDecoration(color: AppColors.textMuted, shape: BoxShape.circle),
              ),
            ),
        ],
      ),
    );
  }
}
