import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/categories_result.dart';
import '../models/category_option.dart';
import '../models/expense.dart';
import '../models/expense_draft.dart';
import '../providers/calendar_provider.dart';
import '../providers/categories_provider.dart';
import '../providers/esewa_provider.dart';
import '../providers/expenses_provider.dart';
import '../providers/settings_provider.dart';
import '../services/api_client.dart';
import '../services/bs_calendar.dart';
import '../services/expense_list.dart';
import '../theme/app_theme.dart';
import '../widgets/category_icon.dart';
import '../widgets/expense_confirm_sheet.dart';
import '../widgets/money_text.dart';
import 'models.dart';
import 'piko_txn_repository.dart';
import 'review_rows.dart';

/// Review inbox for auto-captured eSewa drafts, in Piko's design (it replaces
/// the module's minimal one). Swipe right approves a draft as it is, swipe
/// left rejects it, and a tap opens the Add expense sheet to check it first.
class EsewaReviewScreen extends ConsumerStatefulWidget {
  const EsewaReviewScreen({super.key});

  @override
  ConsumerState<EsewaReviewScreen> createState() => _EsewaReviewScreenState();
}

class _EsewaReviewScreenState extends ConsumerState<EsewaReviewScreen> {
  List<Txn> _drafts = const [];
  bool _loading = true;
  bool _failed = false;
  bool _approvingAll = false;
  StreamSubscription<Txn>? _sub;

  @override
  void initState() {
    super.initState();
    _sub = ref.read(esewaServiceProvider)?.onDraft.listen((_) => _load());
    _load();
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final service = ref.read(esewaServiceProvider);
    if (service == null) return;
    try {
      final drafts = await service.pendingReview();
      if (!mounted) return;
      setState(() {
        _drafts = drafts;
        _loading = false;
        _failed = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _failed = true;
      });
    }
  }

  String _message(Object error) =>
      error is ApiException ? error.message : "Couldn't reach Piko — check your connection and try again.";

  void _show(Object error) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_message(error))));
  }

  // The module marks a Txn before saving it; when saving fails it is still a
  // draft on the server, so put it back here too.
  Future<bool> _save(Txn t, Future<void> Function() action) async {
    try {
      await action();
      return true;
    } catch (e) {
      t.status = TxnStatus.draft;
      _show(e);
      return false;
    }
  }

  Future<bool> _approveAsIs(Txn t) => _save(t, () => ref.read(esewaServiceProvider)!.approve(t));

  Future<bool> _reject(Txn t) => _save(t, () => ref.read(esewaServiceProvider)!.reject(t));

  // Swipe right approves as it is when the draft has one of the household's
  // categories; without one, it opens the sheet to pick one instead.
  Future<bool> _confirmSwipe(Txn t, DismissDirection direction, CategoriesResult options) async {
    if (direction == DismissDirection.endToStart) return _reject(t);
    if (ref.read(esewaRepositoryProvider)!.approvalDraft(t, options) == null) {
      await _check(t, options);
      return false;
    }
    return _approveAsIs(t);
  }

  void _dismissed(Txn t) {
    setState(() => _drafts = [..._drafts]..remove(t));
    ref.invalidate(recentExpensesProvider);
  }

  // The Add expense sheet, filled in from the draft. Saving approves it with
  // what was checked; a changed category is learned for that payee. The
  // payee stays separate from the note, which can be anything.
  Future<void> _check(Txn t, CategoriesResult options) async {
    final repo = ref.read(esewaRepositoryProvider)!;
    final service = ref.read(esewaServiceProvider)!;
    final initial = repo.approvalDraft(t, options) ??
        ExpenseDraft(
          amount: t.amount,
          categoryId: '',
          ownerMemberId: options.currentMemberId,
          paidByMemberId: options.currentMemberId ?? options.members.firstOrNull?.id ?? '',
          date: formatAd(t.occurredAt.toLocal()),
          note: t.counterparty,
        );
    final recent = ref.read(recentExpensesProvider).valueOrNull ?? const <Expense>[];

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(sheetContext).viewInsets.bottom),
        child: ExpenseConfirmSheet(
          title: 'Approve payment',
          saveLabel: 'Approve',
          initialDraft: initial,
          categories: options.categories,
          members: options.members,
          currentMemberId: options.currentMemberId,
          quickCategoryIds: quickCategoryIds(recent, options.categories),
          noteWords: options.noteWords,
          dateFormat: ref.read(dateFormatProvider),
          calendar: ref.read(bsCalendarProvider),
          onSave: (draft) async {
            final category = options.categories.firstWhere((c) => c.id == draft.categoryId);
            repo.prepareApproval(t, draft);
            try {
              await service.approve(t, category: category.name, amount: draft.amount);
              if (sheetContext.mounted) Navigator.of(sheetContext).pop();
            } catch (e) {
              t.status = TxnStatus.draft;
              if (sheetContext.mounted) {
                ScaffoldMessenger.of(sheetContext).showSnackBar(SnackBar(content: Text(_message(e))));
              }
            }
          },
        ),
      ),
    );
    ref.invalidate(recentExpensesProvider);
    await _load();
  }

  // Approves every draft that has a category, one at a time; the rest stay.
  Future<void> _approveAll(CategoriesResult options) async {
    final repo = ref.read(esewaRepositoryProvider)!;
    setState(() => _approvingAll = true);
    for (final t in _drafts.where((t) => repo.approvalDraft(t, options) != null).toList()) {
      if (!await _approveAsIs(t)) break;
    }
    if (!mounted) return;
    setState(() => _approvingAll = false);
    ref.invalidate(recentExpensesProvider);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;
    final optionsAsync = ref.watch(categoriesProvider);
    final options = optionsAsync.valueOrNull;
    final repo = ref.watch(esewaRepositoryProvider);
    final format = ref.watch(dateFormatProvider);
    final calendar = ref.watch(bsCalendarProvider);
    final approvable =
        options == null || repo == null ? 0 : _drafts.where((t) => repo.approvalDraft(t, options) != null).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Review'),
        actions: [
          if (approvable > 0)
            TextButton(
              key: const Key('approve-all'),
              onPressed: _approvingAll ? null : () => _approveAll(options!),
              child: Text(_approvingAll ? 'Approving...' : 'Approve all'),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            Text('eSewa payments', style: text.headlineLarge),
            const SizedBox(height: 6),
            Text('Swipe right to approve, left to reject, or tap to check it first.', style: text.bodySmall),
            const SizedBox(height: 20),
            if (_failed || optionsAsync.hasError)
              Text("Couldn't load the payments. Pull down to try again.", style: text.bodyMedium)
            else if (_loading || options == null)
              const LinearProgressIndicator()
            else if (_drafts.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Text('Nothing to review.', style: text.titleLarge),
              )
            else ...[
              // The 2px ink rule that tops every list on the website.
              Container(height: 2, color: c.ink),
              for (final t in _drafts)
                _DraftRow(
                  txn: t,
                  category: categoryNamed(t.category, options.categories),
                  when: draftWhen(t, format, calendar),
                  onTap: () => _check(t, options),
                  confirmDismiss: (direction) => _confirmSwipe(t, direction, options),
                  onDismissed: () => _dismissed(t),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

// One draft, laid out like a row of the expense list: the category's icon,
// who was paid with the category (or "Pick a category") and when, and the
// amount. Swiping shows what it will do.
class _DraftRow extends StatelessWidget {
  const _DraftRow({
    required this.txn,
    required this.category,
    required this.when,
    required this.onTap,
    required this.confirmDismiss,
    required this.onDismissed,
  });

  final Txn txn;
  final CategoryOption? category;
  final String when;
  final VoidCallback onTap;
  final Future<bool> Function(DismissDirection direction) confirmDismiss;
  final VoidCallback onDismissed;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;

    return Dismissible(
      key: ObjectKey(txn),
      confirmDismiss: confirmDismiss,
      onDismissed: (_) => onDismissed(),
      background: _SwipeLabel(
        alignment: Alignment.centerLeft,
        color: c.ink,
        foreground: c.paper,
        icon: Icons.check,
        label: 'Approve',
      ),
      secondaryBackground: _SwipeLabel(
        alignment: Alignment.centerRight,
        color: c.signalFill,
        foreground: Colors.white,
        icon: Icons.close,
        label: 'Reject',
      ),
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.n300))),
          child: Row(
            children: [
              CategoryIcon(name: category?.name ?? 'Uncategorized', iconKey: category?.icon),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(draftTitle(txn), maxLines: 1, overflow: TextOverflow.ellipsis, style: text.titleMedium),
                    const SizedBox(height: 4),
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: category?.name ?? 'Pick a category',
                            style: category == null ? TextStyle(color: c.signalInk) : null,
                          ),
                          TextSpan(text: ' · $when'),
                        ],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              MoneyText(txn.amount, style: text.titleMedium),
            ],
          ),
        ),
      ),
    );
  }
}

class _SwipeLabel extends StatelessWidget {
  const _SwipeLabel({
    required this.alignment,
    required this.color,
    required this.foreground,
    required this.icon,
    required this.label,
  });

  final Alignment alignment;
  final Color color;
  final Color foreground;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: color,
      alignment: alignment,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: foreground, size: 20),
          const SizedBox(width: 8),
          Text(label, style: Theme.of(context).textTheme.titleMedium!.copyWith(color: foreground)),
        ],
      ),
    );
  }
}
