import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

import '../models/expense_draft.dart';
import '../providers/api_client_provider.dart';
import '../providers/app_update_provider.dart';
import '../providers/categories_provider.dart';
import '../services/api_client.dart';
import '../services/bs_calendar.dart';
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
        _notUnderstoodMessage = "Couldn't quite catch that as an expense — try rephrasing, or type it instead.";
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

  // Hands back an empty expense, so Home opens the sheet for typing.
  void _typeInstead() {
    Navigator.of(context).pop(ExpenseDraft.blank(ref.read(categoriesProvider).valueOrNull, today: formatAd(DateTime.now())));
  }

  @override
  Widget build(BuildContext context) {
    // This screen covers Home's update banner, so surface updates here too.
    final update = ref.watch(availableUpdateProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(
        actions: [
          if (update != null)
            IconButton(
              icon: const Badge(child: Icon(Icons.system_update_outlined)),
              tooltip: 'Update available',
              onPressed: () => showAppUpdateSheet(context, update),
            ),
          const SizedBox(width: 8),
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
    final c = context.piko;
    final text = Theme.of(context).textTheme;

    switch (_stage) {
      case _VoiceStage.listening:
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(child: _ListeningMark(pulse: _pulse, soundLevel: _soundLevel)),
            const SizedBox(height: 28),
            Center(child: _ListeningLabel(pulse: _pulse)),
            const SizedBox(height: 16),
            AnimatedSize(
              duration: const Duration(milliseconds: 200),
              child: Text(
                _transcript.isEmpty ? 'Say what you spent — e.g. "400 on groceries".' : _transcript,
                textAlign: TextAlign.center,
                style: _transcript.isEmpty
                    ? text.bodyLarge!.copyWith(color: c.n600)
                    : TextStyle(fontSize: 24, height: 1.25, fontWeight: FontWeight.w800, letterSpacing: -0.24, color: c.ink),
              ),
            ),
            const SizedBox(height: 36),
            FilledButton.icon(
              onPressed: _stopAndParse,
              icon: const Icon(Icons.check),
              label: const Text('Done'),
            ),
            const SizedBox(height: 8),
            TextButton(onPressed: _typeInstead, child: const Text('Type it instead')),
          ],
        );
      case _VoiceStage.parsing:
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('UNDERSTANDING', style: text.labelSmall),
            const SizedBox(height: 16),
            const SizedBox(width: 160, child: LinearProgressIndicator()),
            if (_transcript.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text('"$_transcript"', textAlign: TextAlign.center, style: text.bodyLarge!.copyWith(color: c.n700)),
            ],
          ],
        );
      case _VoiceStage.notUnderstood:
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(_notUnderstoodMessage ?? 'Not understood.', textAlign: TextAlign.center, style: text.titleMedium),
            if (_transcript.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('"$_transcript"', textAlign: TextAlign.center, style: text.bodySmall),
            ],
            const SizedBox(height: 28),
            FilledButton.icon(
              onPressed: _startListening,
              icon: const Icon(Icons.mic),
              label: const Text('Try again'),
            ),
            if (_transcript.isNotEmpty) ...[
              const SizedBox(height: 8),
              OutlinedButton(onPressed: () => _parse(_transcript), child: const Text('Retry parsing')),
            ],
            const SizedBox(height: 8),
            TextButton(onPressed: _typeInstead, child: const Text('Type it instead')),
          ],
        );
    }
  }
}

/// A red square with the mic, surrounded by square outlines rippling out from
/// it; the square swells with the live sound level.
class _ListeningMark extends StatelessWidget {
  const _ListeningMark({required this.pulse, required this.soundLevel});

  final Animation<double> pulse;
  final double soundLevel;

  static const _size = 200.0;
  static const _coreSize = 88.0;
  static const _ringCount = 3;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;

    return SizedBox(
      width: _size,
      height: _size,
      child: AnimatedBuilder(
        animation: pulse,
        builder: (context, child) => Stack(
          alignment: Alignment.center,
          children: [
            for (var i = 0; i < _ringCount; i++) _ring((pulse.value + i / _ringCount) % 1, c.signal),
            // Soft block that tracks how loud the user is speaking.
            AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              width: _coreSize + 32 * soundLevel,
              height: _coreSize + 32 * soundLevel,
              color: c.signal.withValues(alpha: 0.16),
            ),
            child!,
          ],
        ),
        child: AnimatedScale(
          duration: const Duration(milliseconds: 120),
          scale: 1 + 0.1 * soundLevel,
          child: Container(
            width: _coreSize,
            height: _coreSize,
            color: c.signalFill,
            child: const Icon(Icons.mic, size: 40, color: Colors.white),
          ),
        ),
      ),
    );
  }

  Widget _ring(double t, Color color) {
    final side = _coreSize + (_size - _coreSize) * Curves.easeOut.transform(t);
    return Container(
      width: side,
      height: side,
      decoration: BoxDecoration(
        border: Border.all(color: color.withValues(alpha: 0.45 * (1 - t)), width: 1.5),
      ),
    );
  }
}

/// "LISTENING" micro-label with three square dots that bounce in sequence.
class _ListeningLabel extends StatelessWidget {
  const _ListeningLabel({required this.pulse});

  final Animation<double> pulse;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;

    return AnimatedBuilder(
      animation: pulse,
      builder: (context, _) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('LISTENING', style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(width: 6),
          for (var i = 0; i < 3; i++)
            Transform.translate(
              offset: Offset(0, -3 * math.sin(((pulse.value * 2 - i * 0.15) % 1) * math.pi)),
              child: Container(
                width: 4,
                height: 4,
                margin: const EdgeInsets.symmetric(horizontal: 1.5),
                color: c.n600,
              ),
            ),
        ],
      ),
    );
  }
}
