import 'package:flutter/material.dart';

import '../models/category_option.dart';
import '../models/expense_draft.dart';
import '../models/member_option.dart';
import '../services/bs_calendar.dart';
import '../services/note_suggest.dart';
import '../services/people.dart';
import '../theme/app_theme.dart';
import 'amount_field.dart';
import 'bs_date_picker.dart';
import 'labeled_field.dart';
import 'segmented.dart';
import 'sheet_frame.dart';

// The website's Add expense dialog as a bottom sheet: the big amount, the
// category with one-tap chips, For and Paid by as segments, the date and a
// note. Voice drafts open it pre-filled for checking.
class ExpenseConfirmSheet extends StatefulWidget {
  final ExpenseDraft initialDraft;
  final List<CategoryOption> categories;
  final List<MemberOption> members;
  // The signed-in member, so the sheet can say "Me". Null from an older server.
  final String? currentMemberId;
  // Categories offered as chips under the picker, most used first.
  final List<String> quickCategoryIds;
  // Word → category id from the household's past notes (CategoriesResult.noteWords).
  final Map<String, String> noteWords;
  final AppDateFormat dateFormat;
  final BsCalendar calendar;
  final Future<void> Function(ExpenseDraft draft) onSave;

  const ExpenseConfirmSheet({
    super.key,
    required this.initialDraft,
    required this.categories,
    required this.members,
    this.currentMemberId,
    this.quickCategoryIds = const [],
    this.noteWords = const {},
    required this.dateFormat,
    required this.calendar,
    required this.onSave,
  });

  @override
  State<ExpenseConfirmSheet> createState() => _ExpenseConfirmSheetState();
}

class _ExpenseConfirmSheetState extends State<ExpenseConfirmSheet> {
  late TextEditingController _amountController;
  late TextEditingController _noteController;
  late String _categoryId;
  late String _paidByMemberId;
  late String? _ownerMemberId; // null = shared
  late String _date;
  bool _saving = false;
  // Once a category is picked by hand, the note stops changing it.
  bool _categoryPicked = false;
  bool _categorySuggested = false;

  double get _amount => double.tryParse(_amountController.text) ?? -1;
  bool get _canSave =>
      _amount > 0 &&
      !_saving &&
      widget.categories.any((c) => c.id == _categoryId) &&
      widget.members.any((m) => m.id == _paidByMemberId);

  @override
  void initState() {
    super.initState();
    final d = widget.initialDraft;
    _amountController = TextEditingController(text: d.amount > 0 ? _formatAmount(d.amount) : '');
    _noteController = TextEditingController(text: d.note ?? '');
    _categoryId = d.categoryId;
    _paidByMemberId = d.paidByMemberId;
    _ownerMemberId = d.ownerMemberId;
    _date = d.date;
  }

  String _formatAmount(double amount) {
    return amount == amount.roundToDouble() ? amount.toStringAsFixed(0) : amount.toString();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  void _pickCategory(String id) {
    setState(() {
      _categoryId = id;
      _categoryPicked = true;
      _categorySuggested = false;
    });
  }

  // The category follows what the note says, from the household's past notes,
  // until one is picked by hand. A note it can't place leaves it as it is.
  void _noteChanged(String note) {
    if (_categoryPicked) return;
    final id = suggestCategoryId(note, widget.noteWords, widget.categories.map((c) => c.id));
    if (id == null || id == _categoryId) return;
    setState(() {
      _categoryId = id;
      _categorySuggested = true;
    });
  }

  // Someone's own expense is usually paid by them; Shared keeps whoever was picked.
  void _chooseOwner(String? memberId) {
    setState(() {
      _ownerMemberId = memberId;
      if (memberId != null) _paidByMemberId = memberId;
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final draft = ExpenseDraft(
      amount: _amount,
      categoryId: _categoryId,
      ownerMemberId: _ownerMemberId,
      paidByMemberId: _paidByMemberId,
      date: _date,
      note: _noteController.text.trim().isEmpty ? null : _noteController.text.trim(),
    );
    try {
      await widget.onSave(draft);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickDate() async {
    if (widget.dateFormat == AppDateFormat.nepali) {
      final picked = await showBsDatePicker(
        context,
        calendar: widget.calendar,
        initialAd: _date,
        todayAd: formatAd(DateTime.now()),
      );
      if (picked != null) setState(() => _date = picked);
      return;
    }
    final initial = DateTime.tryParse(_date) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(initial.year - 5),
      lastDate: DateTime(initial.year + 1),
    );
    if (picked != null) setState(() => _date = formatAd(picked));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;
    final people = meFirst(widget.members, widget.currentMemberId);
    final quick = [
      for (final id in widget.quickCategoryIds) ...widget.categories.where((category) => category.id == id),
    ];

    return SheetFrame(
      title: 'Add expense',
      footer: Row(
        children: [
          Expanded(
            child: FilledButton(
              key: const Key('save-button'),
              onPressed: _canSave ? _save : null,
              child: Text(_saving ? 'Saving...' : 'Add expense'),
            ),
          ),
          const SizedBox(width: 12),
          OutlinedButton(onPressed: () => Navigator.of(context).maybePop(), child: const Text('Cancel')),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AmountField(
            key: const Key('amount-field'),
            controller: _amountController,
            // A typed-in expense starts with the amount; a voice draft already has one.
            autofocus: widget.initialDraft.amount <= 0,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 22),
          LabeledField(
            label: 'Category',
            child: InputDecorator(
              decoration: const InputDecoration(contentPadding: EdgeInsets.fromLTRB(12, 4, 8, 4)),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  key: const Key('category-field'),
                  value: widget.categories.any((cat) => cat.id == _categoryId) ? _categoryId : null,
                  hint: Text('Choose a category', style: text.bodyLarge!.copyWith(color: c.n500)),
                  isExpanded: true,
                  style: text.bodyLarge,
                  dropdownColor: c.paper,
                  items: [
                    for (final category in widget.categories)
                      DropdownMenuItem(value: category.id, child: Text(category.name)),
                  ],
                  onChanged: (value) => _pickCategory(value!),
                ),
              ),
            ),
          ),
          if (_categorySuggested) ...[
            const SizedBox(height: 6),
            Text('From your notes', key: const Key('category-suggested'), style: text.bodySmall),
          ],
          if (quick.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final category in quick)
                  _QuickChip(
                    key: Key('quick-category-${category.id}'),
                    label: category.name,
                    selected: category.id == _categoryId,
                    onTap: () => _pickCategory(category.id),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 22),
          LabeledField(
            label: 'For',
            child: Segmented<String?>(
              key: const Key('owner-field'),
              options: [
                for (final member in people) (member.id, personLabel(member, widget.currentMemberId)),
                (null, 'Shared'),
              ],
              value: _ownerMemberId,
              onChanged: _chooseOwner,
            ),
          ),
          const SizedBox(height: 22),
          LabeledField(
            label: 'Paid by',
            child: Segmented<String>(
              key: const Key('paid-by-field'),
              options: [for (final member in people) (member.id, personLabel(member, widget.currentMemberId))],
              value: _paidByMemberId,
              onChanged: (value) => setState(() => _paidByMemberId = value),
            ),
          ),
          const SizedBox(height: 22),
          LabeledField(
            label: 'Date',
            child: InkWell(
              onTap: _pickDate,
              child: InputDecorator(
                decoration: InputDecoration(
                  suffixIcon: Icon(Icons.calendar_today_outlined, size: 18, color: c.n600),
                ),
                child: Text(formatAppDate(_date, widget.dateFormat, widget.calendar), style: text.bodyLarge),
              ),
            ),
          ),
          const SizedBox(height: 22),
          LabeledField(
            label: 'Note',
            child: TextField(
              key: const Key('note-field'),
              controller: _noteController,
              textCapitalization: TextCapitalization.sentences,
              onChanged: _noteChanged,
            ),
          ),
        ],
      ),
    );
  }
}

// A one-tap category under the picker; the chosen one is filled with ink.
class _QuickChip extends StatelessWidget {
  const _QuickChip({super.key, required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    return Material(
      color: selected ? c.ink : Colors.transparent,
      shape: RoundedRectangleBorder(side: BorderSide(color: selected ? c.ink : c.n400)),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium!.copyWith(
                  color: selected ? c.paper : c.n800,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                ),
          ),
        ),
      ),
    );
  }
}
