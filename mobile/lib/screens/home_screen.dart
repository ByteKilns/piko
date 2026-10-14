import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/categories_result.dart';
import '../models/expense.dart';
import '../models/expense_draft.dart';
import '../providers/api_client_provider.dart';
import '../providers/app_update_provider.dart';
import '../providers/calendar_provider.dart';
import '../providers/categories_provider.dart';
import '../providers/expenses_provider.dart';
import '../providers/settings_provider.dart';
import '../services/api_client.dart';
import '../services/bs_calendar.dart';
import '../services/expense_list.dart';
import '../theme/app_theme.dart';
import '../widgets/app_update_sheet.dart';
import '../widgets/brand_mark.dart';
import '../widgets/expense_confirm_sheet.dart';
import '../widgets/expense_list_tile.dart';
import '../widgets/money_text.dart';
import 'settings_screen.dart';
import 'voice_capture_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  // Re-check for a new build whenever the app comes back to the foreground, not just on cold start.
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(onResume: () => ref.invalidate(availableUpdateProvider));
    // Capturing an expense is the app's main job, so jump straight into voice capture on launch.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _openVoiceFlow(context, ref);
    });
  }

  Future<void> _openVoiceFlow(BuildContext context, WidgetRef ref) async {
    final draft = await Navigator.of(context).push<ExpenseDraft?>(
      MaterialPageRoute(builder: (_) => const VoiceCaptureScreen()),
    );
    if (draft != null && context.mounted) {
      await _openConfirmSheet(context, ref, draft);
    }
  }

  // A null draft means a new expense typed by hand.
  Future<void> _openConfirmSheet(BuildContext context, WidgetRef ref, ExpenseDraft? draft) async {
    // Voice capture opens on launch, so categories may still be loading — wait rather than drop the draft.
    final CategoriesResult categoriesResult;
    try {
      categoriesResult = await ref.read(categoriesProvider.future);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Couldn't load categories — check your connection and try again.")),
        );
      }
      return;
    }
    if (!context.mounted) return;

    final recent = ref.read(recentExpensesProvider).valueOrNull ?? const <Expense>[];
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(sheetContext).viewInsets.bottom),
        child: ExpenseConfirmSheet(
          initialDraft: draft ?? ExpenseDraft.blank(categoriesResult, today: formatAd(DateTime.now())),
          categories: categoriesResult.categories,
          members: categoriesResult.members,
          currentMemberId: categoriesResult.currentMemberId,
          quickCategoryIds: quickCategoryIds(recent, categoriesResult.categories),
          dateFormat: ref.read(dateFormatProvider),
          calendar: ref.read(bsCalendarProvider),
          onSave: (finalDraft) async {
            final client = ref.read(apiClientProvider);
            try {
              await client.createExpense(finalDraft);
              ref.invalidate(recentExpensesProvider);
              if (sheetContext.mounted) Navigator.of(sheetContext).pop();
            } on ApiException catch (e) {
              if (sheetContext.mounted) {
                ScaffoldMessenger.of(sheetContext).showSnackBar(SnackBar(content: Text(e.message)));
              }
            }
          },
        ),
      ),
    );
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;
    final expensesAsync = ref.watch(recentExpensesProvider);
    final update = ref.watch(availableUpdateProvider).valueOrNull;
    final options = ref.watch(categoriesProvider).valueOrNull;
    final dateFormat = ref.watch(dateFormatProvider);
    final calendar = ref.watch(bsCalendarProvider);
    final today = formatAd(DateTime.now());

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 20,
        title: const BrandMark(),
        actions: [
          IconButton(
            tooltip: 'Settings',
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(recentExpensesProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            if (update != null) ...[AppUpdateBanner(release: update), const SizedBox(height: 20)],
            Text('Recent expenses', style: text.headlineLarge),
            const SizedBox(height: 6),
            Text('The latest across the household', style: text.bodySmall),
            const SizedBox(height: 20),
            ...expensesAsync.when(
              loading: () => [const LinearProgressIndicator()],
              error: (error, _) => [
                _Message(
                  title: "Couldn't load expenses.",
                  body: '$error',
                  action: OutlinedButton(
                    onPressed: () => ref.invalidate(recentExpensesProvider),
                    child: const Text('Try again'),
                  ),
                ),
              ],
              data: (expenses) {
                if (expenses.isEmpty) {
                  return [const _Message(title: 'No expenses yet.', body: 'Tap Add by voice and say what you spent.')];
                }
                return [
                  // The 2px ink rule that tops every list on the website.
                  Container(height: 2, color: c.ink),
                  for (final group in groupByDay(expenses, limit: recentExpensesLimit)) ...[
                    _DayHead(
                      label: dayLabel(group.date, today),
                      date: formatAppDate(group.date, dateFormat, calendar),
                      total: group.total,
                    ),
                    for (final expense in group.expenses)
                      ExpenseListTile(
                        expense: expense,
                        category: options?.categories.where((cat) => cat.id == expense.categoryId).firstOrNull,
                        members: options?.members ?? const [],
                        currentMemberId: options?.currentMemberId,
                      ),
                  ],
                ];
              },
            ),
          ],
        ),
      ),
      bottomNavigationBar: _CaptureBar(
        onType: () => _openConfirmSheet(context, ref, null),
        onVoice: () => _openVoiceFlow(context, ref),
      ),
    );
  }
}

// A day's head in the list: "Today" and its date, with the day's total.
class _DayHead extends StatelessWidget {
  const _DayHead({required this.label, required this.date, required this.total});

  final String label;
  final String date;
  final double? total;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsets.only(top: 16, bottom: 8),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.rule))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(label, style: text.titleMedium),
          const SizedBox(width: 8),
          Expanded(child: Text(date, style: text.bodySmall)),
          if (total != null) MoneyText(total!, style: text.titleMedium),
        ],
      ),
    );
  }
}

// A heading, one sentence and an optional action — the website's EmptyState.
class _Message extends StatelessWidget {
  const _Message({required this.title, required this.body, this.action});

  final String title;
  final String body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: text.titleLarge),
          const SizedBox(height: 8),
          Text(body, style: text.bodyMedium),
          if (action != null) ...[const SizedBox(height: 20), action!],
        ],
      ),
    );
  }
}

// Pinned at the bottom: type an expense, or (the main action) say it.
class _CaptureBar extends StatelessWidget {
  const _CaptureBar({required this.onType, required this.onVoice});

  final VoidCallback onType;
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
              OutlinedButton.icon(
                onPressed: onType,
                icon: const Icon(Icons.edit_outlined, size: 18),
                label: const Text('Type it'),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: onVoice,
                  icon: const Icon(Icons.mic, size: 20),
                  label: const Text('Add by voice'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
