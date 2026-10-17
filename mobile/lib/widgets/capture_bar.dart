import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

// Pinned at the bottom of Home: add an expense (the main action, since eSewa
// payments arrive on their own), or say it with the mic.
class CaptureBar extends StatelessWidget {
  const CaptureBar({super.key, required this.onAdd, required this.onVoice});

  final VoidCallback onAdd;
  final VoidCallback onVoice;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;

    return Container(
      decoration: BoxDecoration(
        color: c.paper,
        border: Border(top: BorderSide(color: c.rule, width: 2)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
          child: Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: onAdd,
                  icon: const Icon(Icons.add, size: 20),
                  label: const Text('Add expense'),
                ),
              ),
              const SizedBox(width: 12),
              IconButton.outlined(
                tooltip: 'Add by voice',
                onPressed: onVoice,
                icon: const Icon(Icons.mic_none),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
