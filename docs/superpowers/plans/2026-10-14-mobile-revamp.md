# Piko Mobile Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. If you don't have those skills, do the tasks in order, one step at a time. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Flutter app (`mobile/`) to the web app's modernist design (warm paper and ink, one red accent, square corners, Host Grotesk, light and dark), and make its Add expense sheet work like the web's Add expense dialog.

**Architecture:** Nine tasks on one branch. Each task is one commit that leaves the app building with every test passing. Task 1 adds one field to the mobile API. Tasks 2–3 lay the foundation: a palette (`PikoColors`, a Flutter `ThemeExtension` with light and dark values copied from the website), one `ThemeData` builder, and small shared widgets that mirror the website's components. Tasks 4–8 rewrite the screens on top of them, and Task 9 removes the old purple theme. How the app talks to the server, signs in, listens, saves and updates itself doesn't change.

**Tech Stack:** Flutter 3.44 / Dart 3.12, flutter_riverpod 2, flutter_test; one Next.js 16 route handler (TypeScript); Husky pre-commit hook (`tsc` + `next build`).

**Spec:** There is no separate spec file. The design is the "Design (agreed)" section below: points 1–4 were agreed with the owner on 2026-10-14. The owner asked for no mockups and a direct plan, so points 5–11 were decided in this plan, and the owner approves them by approving the plan. The website design it follows is `docs/superpowers/specs/2026-10-07-modernist-redesign-design.md`. Read the Design section fully before starting.

**Verified:** on 2026-10-14 this whole plan was dry-run end to end in a throwaway copy of the repo, starting from commit `abbc92d`:
- Every step applied cleanly, in order, exactly as written here. This file was replayed in a fresh copy of the repo, and each of its nine commits matched the dry run's file for file.
- After each task, `flutter analyze` and `flutter test` gave exactly what that task's checks expect: 47, 52, 76, 76, 87, 95, 95, 95 and 95 passing tests.
- Each task's new tests failed first with the errors shown in its Step 2.
- `flutter build apk --release --split-per-abi` built all three APKs (arm64: 18.1 MB).
- Every screen (start, sign in, Home, the Add expense sheet, voice, Settings, update) was rendered with the real fonts in Light and Dark and checked by eye.
- The website change passed `npx tsc --noEmit` and ESLint. The dry run's commits didn't go through the pre-commit hook, because Husky isn't wired into a throwaway copy, and `next build` couldn't run there. The hook runs both checks on your first commit, so watch its result on Task 1.

If a step doesn't match what you see, something has changed since then. Stop and report rather than improvise.

## How to use this plan

- Do the tasks **in order**, 1 → 9. There is one **STOP checkpoint**, at the end. When you reach it, stop and send the owner the report it describes.
- Code blocks are complete. Every code step is one of these kinds:
  - **"Create `path` with:"** — a new file; paste the whole block.
  - **"Replace the whole of `path` with:"** — overwrite the file with the whole block.
  - **"In `path`, find:" … "Replace it with:"** — find the exact old text (match by text, not line number) and replace it with the new text. Each old block occurs exactly once in the file at that point.
  - **"Delete `path`:"** — remove the file with the `git rm` command shown.
- Before Task 1, create the branch once: `git switch -c feat/mobile-revamp`. Every task commits to that branch.
- Flutter commands must run inside `mobile/`. Each one is written as `cd mobile; <command>; cd ..` so you end up back at the repo root, where every other command runs.

## Design (agreed)

### Why

The website was restyled to the "modernist" design between 2026-10-07 and 2026-10-11. The phone app still has the September look (lavender background, purple buttons, rounded white cards with shadows, pastel category chips, Space Grotesk). The same two people use both every day, so the two should look and behave like one product.

### Agreed with the owner (2026-10-14)

1. **Scope: restyle and align.** Same screens and features. Every screen gets the new look, and the Add expense sheet takes the web dialog's layout: a big amount, quick category chips, For and Paid by as segments, and "Me". Nothing new on Home (no month summary).
2. **Themes:** Light, Dark and System, chosen in Settings and stored on the phone. The app opens in Light until changed, like the website. Dark uses the website's dark palette.
3. **Font:** Host Grotesk, the website's font, at weights 400 / 600 / 800, bundled as static TTFs from the font's 1.002 release (SIL Open Font License). Space Grotesk is removed.
4. **"Me":** `GET /api/mobile/categories` also returns `currentMemberId`, the signed-in member. The field is additive, so installed older builds ignore it. The sheet says "Me" and lists the signed-in person first, and an expense typed in by hand starts as for and paid by them, as voice drafts already do.

### Decided in this plan

5. **Colours** are copied from `src/app/globals.css` into `mobile/lib/theme/piko_colors.dart`:

   | Token | Light | Dark | Use |
   | --- | --- | --- | --- |
   | paper | `#FAF8F4` | `#161413` | page and sheet background |
   | surface | `#F0EDE7` | `#22201E` | icon tiles, the update strip |
   | ink | `#201E1D` | `#F3EFE8` | text, chosen segment, 2px rule above a list |
   | rule | `#3D3936` | `#D3CEC6` | 2px rule under headings, 1px under a day head |
   | n200…n800 | `#E6E2DB` `#D8D3CB` `#B5AFA6` `#8F8981` `#6E6862` `#56514C` `#3D3936` | `#2A2725` `#3A3633` `#57524D` `#7A746D` `#9A948C` `#B7B1A9` `#D3CEC6` | 200 tracks, 300 row rules, 400 field borders, 500 paisa and placeholders, 600 labels, 700 secondary text, 800 body |
   | signal | `#EC3013` | `#FF6247` | the red accent for marks: progress bar, today, caret, mic |
   | signalInk | `#C02A10` | `#FF9C88` | red text: errors, Log out |
   | signalFill | `#EC3013` | `#EC3013` | primary buttons, white text (same red in both themes so the text keeps 4.5:1) |

   Screens read colours with `context.piko`, never as hard-coded values.
6. **Type** (Host Grotesk, through the theme's `TextTheme`): `displaySmall` 42/800 ("Sign in"), `headlineLarge` 32/800 (page titles), `titleLarge` 20/800 (headings, sheet titles), `titleMedium` 15/600 (row titles, amounts), `bodyLarge` 15 (field text), `bodyMedium` 14 (body), `bodySmall` 13 grey (meta), `labelMedium` 12 (field labels), `labelSmall` 11/600 spaced uppercase (micro-labels). Amounts use tabular figures, with the paisa smaller and lighter, as the website's `Money` does.
7. **Shape:** corners are square everywhere, and there are no cards or shadows. Rules do the work: 2px ink above a list, 2px rule under a heading or sheet title, 1px rule under a day head, and 1px n300 between rows.
8. **Buttons:** primary buttons are red with white text and 52px tall; secondary buttons have a 1px ink outline; text buttons are ink; Log out is red text.
9. **Shared widgets** (`mobile/lib/widgets/`), each the counterpart of a website component: `MoneyText` (Money), `Monogram`, `Segmented`, `AmountField` (AmountInput), `CategoryIcon` (icon from the category's own `icon` key, else a guess from its name, with the same keyword list as the website), `SheetFrame` (Modal), `LabeledField`, and `BrandMark` (the ink "P" square and "Piko").
10. **Screens:**
    - **Start:** just the brand mark while sign-in state loads.
    - **Sign in:** the brand over a 2px rule, then "Sign in" at 42px, labelled square fields, and a full-width red **Sign in** ("Signing in..." while waiting). The settings gear stays, because it holds the server URL. There is no sign-up.
    - **Home:** the brand and the settings gear at the top, then the update strip, "Recent expenses" and "The latest across the household".
      - The list sits under a 2px ink rule and is grouped by day: "Today" / "Yesterday" / weekday, the date (BS or AD), and the day's total. When the list holds all 20 expenses it can show, the oldest day may be cut short, so its total is left off.
      - Each row has the category's icon tile and name, then the monogram badges and a line like "Me", "Karuna · paid by Me" or "Shared · paid by Karuna", followed by the note unless it only repeats the category. The amount sits on the right.
      - A bar is pinned at the bottom: an outlined **Type it** and a red **Add by voice**. Opening straight into voice on launch stays, and so does pull to refresh.
      - The empty and error states are a heading and one sentence (plus **Try again** on error).
    - **Add expense sheet:** the website's dialog layout: the title and a close button over a 2px rule.
      - **Amount** is a big "Rs" field that takes only digits and one point with two places. It gets focus when typing a new expense.
      - **Category** is a dropdown plus up to 5 chips: the most used in the recent list (a tie goes to the more recent), then the rest in the server's order.
      - **For** (Me / the other person / Shared) and **Paid by** (Me / the other person) are segments. Choosing a person under For makes them the payer too; Shared keeps the payer, as on the website.
      - **Date** opens the BS or AD picker, and **Note** is a plain field.
      - The footer has a red **Add expense** ("Saving..." while saving) and **Cancel**. The rules for when Save is allowed don't change: an amount above 0, and a category and a payer that exist.
    - **BS date picker:** square day cells; the chosen day is filled with ink and today is outlined in red; the month name sits over a 2px rule.
    - **Add by voice:** the same flow and messages.
      - The purple orb becomes a red square mic with square outlines rippling out. Below it are a LISTENING micro-label with square dots and the transcript at 24/800, then a full-width red **Done** and **Type it instead**.
      - While parsing, the screen shows UNDERSTANDING, a thin red bar and the transcript. A failure shows the message and the transcript, then **Try again** (red), **Retry parsing** and **Type it instead**.
    - **Settings:** four sections under 20px headings with 2px rules: Appearance (Theme: Light / Dark / System), Dates (BS / AD), Server (URL + Save) and Account (Log out).
    - **Update:** a strip on Home with a red square; the update sheet uses the dialog layout, with **Update now** / **Later** and the download progress as a thin red bar.
11. **Release:** the version becomes `1.2.0+3`. The owner builds and publishes the APK (see `mobile/README.md`).

### Out of scope (do NOT build)

- New data on Home: a month summary, safe to spend, budgets.
- Editing or deleting expenses from the app, "Paid from" savings or funds, pay back later.
- The app icon (the penguin stays) and Android's native launch screen.
- Searching inside the category picker.
- Any API change other than adding `currentMemberId` (the `icon` field is already sent).
- New packages, `flutter pub upgrade`, or changes to `pubspec.lock`.

## Global Constraints

- **Staging:** stage files only by exact path, as each task's commit step lists them. Never use `git add -A`, `git add .`, `git commit -a`, `git stash`, `git checkout -- <file>` or `git reset --hard`.
- **Shell:** this is a Windows machine. Commands work in both PowerShell and Git Bash unless a step says otherwise, and run from the repo root `C:\Users\nirja\OneDrive\Documents\piko`.
- **Line endings:** files are checked out with Windows line endings (CRLF), while the code blocks in this plan use LF. If your edit tool matches text byte for byte, compare line by line and ignore `\r`. Don't convert whole files' line endings.
- **Pre-commit hook:** it runs `npx tsc --noEmit` then `npm run build` on every commit, even one that only touches `mobile/`, and takes 1–2 minutes. That's expected. **Never use `--no-verify`.** If the hook fails, read the error, fix the code, `git add` the same files again, and commit again. If `tsc` complains that `LayoutProps` or `PageProps` can't be found, run `npx next typegen` once and commit again.
- **Flutter checks after every task:**
  - `flutter analyze` must end with `No issues found!`. Until Task 5 it reports exactly 3 issues that are already there, all `deprecated_member_use` (`'value' is deprecated`) in `lib/widgets/expense_confirm_sheet.dart`; Task 5 rewrites that file and they go away.
  - `flutter test` must end with `All tests passed!`.
- **Colours and fonts:** never hard-code a colour in a screen or widget; read `context.piko`. The only literal colours allowed are `Colors.white` (text on the red fill) and `Colors.transparent`. Use font weights 400, 600 and 800 only (`FontWeight.w400` / `w600` / `w800`); the bundled font has no other weights.
- **Don't touch** the API client, auth, the update download (`ota_update`) logic, the speech-to-text logic, the expense validation rules or the BS calendar maths, except where a step says so.
- **Don't run `dart format`** on whole files; it would reformat code this plan doesn't change.
- **Lint for the one TypeScript change** (Task 1): `npm run lint` must show **0 errors**; the 2 existing warnings (`NepaliDateField.tsx`, `ExpenseDialog.tsx`) are fine.
- **No database work:** never run `npm run db:generate`, `npm run db:migrate` or `npm run db:seed`.
- **Comments:** short `//` comments that say *why*, matching the surrounding code.
- **Edits:** change only what each step says. Don't rename, reformat or "tidy" other code. If a "find" block doesn't match exactly, find the same code by meaning, make the same change, and mention it in your report.

## Review Focus

The five things most likely to go wrong for the two people using this, each pinned by a test in the task that owns it:

1. **An older server.** If the website isn't deployed yet, it doesn't send `currentMemberId`. The app must still work, showing names instead of "Me", and a typed expense starts as shared and paid by the first member, as before. Pinned in Task 1 by "leaves currentMemberId null for an older server", in Task 5 by "uses names when the server does not say who is signed in", and in Task 6 by "is shared and paid by the first member when the server does not say who is signed in".
2. **Odd amounts.** Pasted amounts like "Rs 1,500.50", a minus sign, or two decimal points must leave a clean amount, and a minus can't be typed. Pinned in Task 3 by the `sanitizeAmountInput` tests and "AmountField only accepts an amount", and in Task 5 by "a minus sign can't be typed into the amount".
3. **A day cut short.** Home loads only the latest 20 expenses, so the oldest day shown may be missing some; its total must not be shown as if complete. Pinned in Task 6 by "leaves the total off the oldest day when the list is full".
4. **For changes Paid by.** Choosing a person under For also makes them the payer, but Shared keeps whoever paid, as on the website. A wrong payer moves the money to the wrong person's month. Pinned in Task 5 by "choosing someone under For makes them the payer too" and "choosing Shared keeps whoever paid".
5. **The red button in dark mode.** The primary red must be the same in both themes so its white text stays readable. Pinned in Task 2 by "primary buttons are the same red in both themes".

Also worth a reviewer's eye, with no automated test because they need a real phone:

- Status-bar icons are dark on light screens and light in dark mode (set by the app bar theme).
- The Add expense sheet with the keyboard open on a small phone: the sheet must scroll, and the footer must stay reachable.
- Long category names in the chips and rows (they wrap or end in "…", never overflow).
- The voice flow from launch, including **Type it instead**.

---

### Task 1: The signed-in member and category icons from the API

The app can't say "Me" because nothing tells it who is signed in. The categories endpoint already knows (`auth.memberId`), so it sends that too. The app also starts reading each category's `icon`, which the endpoint already sends but the app ignored.

**Files:**
- Modify: `src/app/api/mobile/categories/route.ts`
- Modify: `mobile/lib/models/category_option.dart`
- Modify: `mobile/lib/models/categories_result.dart`
- Test: `mobile/test/models/categories_result_test.dart`

**Interfaces:**
- Produces: `CategoryOption({required String id, required String name, String? icon})` with `final String? icon`; `CategoriesResult({required List<CategoryOption> categories, required List<MemberOption> members, String? currentMemberId})` with `final String? currentMemberId`. The JSON gains `"currentMemberId": "<member id>"`.

- [ ] **Step 1: Write the failing test**

Replace the whole of `mobile/test/models/categories_result_test.dart` with:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/categories_result.dart';

void main() {
  test('CategoriesResult.fromJson parses categories and members', () {
    final result = CategoriesResult.fromJson({
      'categories': [
        {'id': 'cat-1', 'name': 'Groceries'},
        {'id': 'cat-2', 'name': 'Transport'},
      ],
      'members': [
        {'id': 'mem-1', 'name': 'Nirjal'},
        {'id': 'mem-2', 'name': 'Karuna'},
      ],
    });

    expect(result.categories, hasLength(2));
    expect(result.categories.first.id, 'cat-1');
    expect(result.categories.first.name, 'Groceries');
    expect(result.members, hasLength(2));
    expect(result.members.last.name, 'Karuna');
  });

  test('CategoriesResult.fromJson reads the signed-in member and category icons', () {
    final result = CategoriesResult.fromJson({
      'categories': [
        {'id': 'cat-1', 'name': 'Internet', 'icon': 'wifi'},
        {'id': 'cat-2', 'name': 'Transport', 'icon': null},
      ],
      'currentMemberId': 'mem-2',
      'members': [
        {'id': 'mem-1', 'name': 'Nirjal'},
        {'id': 'mem-2', 'name': 'Karuna'},
      ],
    });

    expect(result.currentMemberId, 'mem-2');
    expect(result.categories.first.icon, 'wifi');
    expect(result.categories.last.icon, isNull);
  });

  test('CategoriesResult.fromJson leaves currentMemberId null for an older server', () {
    final result = CategoriesResult.fromJson({
      'categories': <dynamic>[],
      'members': <dynamic>[],
    });

    expect(result.currentMemberId, isNull);
  });
}
```

- [ ] **Step 2: Run the test to see it fail**

Run: `cd mobile; flutter test test/models/categories_result_test.dart; cd ..`

Expected: FAIL. The test file doesn't compile; among the errors:

```text
Error: The getter 'currentMemberId' isn't defined for the type 'CategoriesResult'.
Error: The getter 'icon' isn't defined for the type 'CategoryOption'.
```

- [ ] **Step 3: Read the new fields in the app**

Replace the whole of `mobile/lib/models/category_option.dart` with:

```dart
class CategoryOption {
  final String id;
  final String name;
  // The web's icon key (e.g. "wifi"); null when the category has none, and
  // the app then guesses one from the name.
  final String? icon;

  CategoryOption({required this.id, required this.name, this.icon});

  factory CategoryOption.fromJson(Map<String, dynamic> json) {
    return CategoryOption(id: json['id'] as String, name: json['name'] as String, icon: json['icon'] as String?);
  }
}
```

Replace the whole of `mobile/lib/models/categories_result.dart` with:

```dart
import 'category_option.dart';
import 'member_option.dart';

class CategoriesResult {
  final List<CategoryOption> categories;
  final List<MemberOption> members;
  // The signed-in member. Null from a server older than this field.
  final String? currentMemberId;

  CategoriesResult({required this.categories, required this.members, this.currentMemberId});

  factory CategoriesResult.fromJson(Map<String, dynamic> json) {
    return CategoriesResult(
      categories: (json['categories'] as List<dynamic>)
          .map((c) => CategoryOption.fromJson(c as Map<String, dynamic>))
          .toList(),
      members: (json['members'] as List<dynamic>)
          .map((m) => MemberOption.fromJson(m as Map<String, dynamic>))
          .toList(),
      currentMemberId: json['currentMemberId'] as String?,
    );
  }
}
```

- [ ] **Step 4: Send the signed-in member from the server**

In `src/app/api/mobile/categories/route.ts`, find:

```ts
  return NextResponse.json({
    categories: categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
    members: members.map((m) => ({ id: m.id, name: m.user.name })),
  });
```

Replace it with:

```ts
  return NextResponse.json({
    categories: categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
    // Lets the app say "Me" and pick the signed-in person by default.
    currentMemberId: auth.memberId,
    members: members.map((m) => ({ id: m.id, name: m.user.name })),
  });
```

- [ ] **Step 5: Run the checks**

Run:

```bash
cd mobile; flutter test; cd ..
cd mobile; flutter analyze; cd ..
npx tsc --noEmit
npm run lint
```

Expected: 47 tests pass (`All tests passed!`); analyze reports the 3 existing `deprecated_member_use` issues and nothing else; `tsc` prints nothing; lint shows 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/mobile/categories/route.ts mobile/lib/models/category_option.dart mobile/lib/models/categories_result.dart mobile/test/models/categories_result_test.dart
git commit -m "feat(mobile-api): send the signed-in member and category icons to the app"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 2: Host Grotesk, the website's palette, light and dark

This task swaps in the website's font and colours and adds the Light / Dark / System setting. `PikoColors` holds both palettes, and `AppTheme.light` / `AppTheme.dark` build every Material component's look from it. The old purple `AppColors` and the old text styles stay for now, because Tasks 4–8 still read them until each screen is rewritten; Task 9 deletes them.

**Files:**
- Create: `mobile/assets/fonts/HostGrotesk-Regular.ttf`, `HostGrotesk-SemiBold.ttf`, `HostGrotesk-ExtraBold.ttf`, `HostGrotesk-OFL.txt` (downloaded)
- Delete: `mobile/assets/fonts/SpaceGrotesk-Regular.ttf`, `SpaceGrotesk-Medium.ttf`, `SpaceGrotesk-Bold.ttf`
- Modify: `mobile/pubspec.yaml`
- Create: `mobile/lib/theme/piko_colors.dart`
- Replace: `mobile/lib/theme/app_theme.dart`
- Modify: `mobile/lib/services/settings_service.dart`, `mobile/lib/providers/settings_provider.dart`, `mobile/lib/main.dart`
- Test: `mobile/test/services/settings_service_test.dart`, `mobile/test/theme/app_theme_test.dart`

**Interfaces:**
- Produces:
  - `PikoColors` (a `ThemeExtension<PikoColors>`) with the `Color` fields `paper`, `surface`, `ink`, `rule`, `n200`, `n300`, `n400`, `n500`, `n600`, `n700`, `n800`, `signal`, `signalInk` and `signalFill`, and the constants `PikoColors.light` / `PikoColors.dark`.
  - `extension on BuildContext { PikoColors get piko }`, which falls back to `PikoColors.light` when a test pumps a bare `MaterialApp`.
  - `AppTheme.light` / `AppTheme.dark` (`ThemeData`) and `AppTheme.font` (`'HostGrotesk'`). `app_theme.dart` re-exports `piko_colors.dart`, so importing `../theme/app_theme.dart` is enough.
  - `SettingsService.readThemeMode()` → `Future<ThemeMode>` (default `ThemeMode.light`) and `writeThemeMode(ThemeMode)`.
  - `themeModeProvider` (`StateNotifierProvider<ThemeModeNotifier, ThemeMode>`) with `setMode(ThemeMode)`.

- [ ] **Step 1: Write the failing tests**

In `mobile/test/services/settings_service_test.dart` (change 1 of 2), find:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/services/bs_calendar.dart';
```

Replace it with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/services/bs_calendar.dart';
```

In `mobile/test/services/settings_service_test.dart` (change 2 of 2), find:

```dart
      expect(await service.readDateFormat(), AppDateFormat.english);
    });
  });
}
```

Replace it with:

```dart
      expect(await service.readDateFormat(), AppDateFormat.english);
    });

    test('readThemeMode defaults to light', () async {
      SharedPreferences.setMockInitialValues({});

      expect(await SettingsService().readThemeMode(), ThemeMode.light);
    });

    test('writeThemeMode persists dark', () async {
      SharedPreferences.setMockInitialValues({});
      final service = SettingsService();

      await service.writeThemeMode(ThemeMode.dark);

      expect(await service.readThemeMode(), ThemeMode.dark);
    });
  });
}
```

Create `mobile/test/theme/app_theme_test.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/theme/app_theme.dart';

void main() {
  test('the light theme carries the light palette on paper', () {
    final theme = AppTheme.light;

    expect(theme.brightness, Brightness.light);
    expect(theme.extension<PikoColors>(), PikoColors.light);
    expect(theme.scaffoldBackgroundColor, PikoColors.light.paper);
  });

  test('the dark theme carries the dark palette', () {
    final theme = AppTheme.dark;

    expect(theme.brightness, Brightness.dark);
    expect(theme.extension<PikoColors>(), PikoColors.dark);
    expect(theme.colorScheme.onSurface, PikoColors.dark.ink);
  });

  test('primary buttons are the same red in both themes', () {
    expect(PikoColors.light.signalFill, PikoColors.dark.signalFill);
  });
}
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd mobile; flutter test test/services/settings_service_test.dart test/theme/app_theme_test.dart; cd ..`

Expected: FAIL. Neither file compiles; among the errors:

```text
Error: The method 'readThemeMode' isn't defined for the type 'SettingsService'.
Error: Member not found: 'light'.
Error: 'PikoColors' isn't a type.
```

- [ ] **Step 3: Download Host Grotesk and remove Space Grotesk**

Run these in **PowerShell** from the repo root (in Git Bash, `tar` can't open a zip). Copy the new fonts in *before* removing the old ones, so the `mobile/assets/fonts` folder never disappears:

```powershell
curl.exe -L -o "$env:TEMP\HostGrotesk-1.002.zip" https://github.com/Element-Type/HostGrotesk/releases/download/1.002/HostGrotesk-1.002.zip
Expand-Archive -Force "$env:TEMP\HostGrotesk-1.002.zip" "$env:TEMP\HostGrotesk-1.002"
$src = "$env:TEMP\HostGrotesk-1.002\HostGrotesk-1.002"
Copy-Item "$src\fonts\ttf\HostGrotesk-Regular.ttf", "$src\fonts\ttf\HostGrotesk-SemiBold.ttf", "$src\fonts\ttf\HostGrotesk-ExtraBold.ttf" mobile\assets\fonts\
Copy-Item "$src\OFL.txt" mobile\assets\fonts\HostGrotesk-OFL.txt
git rm mobile/assets/fonts/SpaceGrotesk-Regular.ttf mobile/assets/fonts/SpaceGrotesk-Medium.ttf mobile/assets/fonts/SpaceGrotesk-Bold.ttf
Get-FileHash mobile\assets\fonts\HostGrotesk-* | Format-Table Hash, Path -AutoSize
```

Expected hashes (SHA-256). If any differ, stop and report:

```text
9F776B45E8376BFC999A16F9ED3484F113E1FF6ADC0CC028E7138886766965F7  HostGrotesk-ExtraBold.ttf
386B93ABFF8765EEAE26A8E4CF58421E724E15CD5317CEC8101DF84E4693687E  HostGrotesk-OFL.txt
0983AE45C50C69BBC3271A58C70D550133B23D601D90835A696BD65547642B88  HostGrotesk-Regular.ttf
C2FFCFDBCCCEC647358F8CD61B211B460952BA6899E01B65D2268900A8DCA7A5  HostGrotesk-SemiBold.ttf
```

- [ ] **Step 4: Point the app at the new font**

In `mobile/pubspec.yaml`, find:

```yaml
  # see https://flutter.dev/to/font-from-package
  fonts:
    - family: SpaceGrotesk
      fonts:
        - asset: assets/fonts/SpaceGrotesk-Regular.ttf
        - asset: assets/fonts/SpaceGrotesk-Medium.ttf
          weight: 500
        - asset: assets/fonts/SpaceGrotesk-Bold.ttf
          weight: 700
```

Replace it with:

```yaml
  # see https://flutter.dev/to/font-from-package
  fonts:
    - family: HostGrotesk
      fonts:
        - asset: assets/fonts/HostGrotesk-Regular.ttf
        - asset: assets/fonts/HostGrotesk-SemiBold.ttf
          weight: 600
        - asset: assets/fonts/HostGrotesk-ExtraBold.ttf
          weight: 800
```

- [ ] **Step 5: Add the palette and the themes**

Create `mobile/lib/theme/piko_colors.dart` with:

```dart
import 'package:flutter/material.dart';

// The website's modernist palette (src/app/globals.css), light and dark.
// Widgets read it through `context.piko`, so they follow the theme mode.
@immutable
class PikoColors extends ThemeExtension<PikoColors> {
  const PikoColors({
    required this.paper,
    required this.surface,
    required this.ink,
    required this.rule,
    required this.n200,
    required this.n300,
    required this.n400,
    required this.n500,
    required this.n600,
    required this.n700,
    required this.n800,
    required this.signal,
    required this.signalInk,
    required this.signalFill,
  });

  // Page and sheet background.
  final Color paper;
  // Icon tiles, chips and the update banner.
  final Color surface;
  // Text, selected segments and the 2px rule above a list.
  final Color ink;
  // 2px rules under headings, 1px under day heads.
  final Color rule;
  // Warm neutrals: 200 progress tracks, 300 row rules, 400 field borders,
  // 500 paisa and placeholders, 600 labels, 700 secondary text, 800 body copy.
  final Color n200;
  final Color n300;
  final Color n400;
  final Color n500;
  final Color n600;
  final Color n700;
  final Color n800;
  // The one red accent, for marks: progress, today, the caret, the mic.
  final Color signal;
  // Red text: errors and Log out.
  final Color signalInk;
  // Primary buttons. The same red in both themes so white text keeps 4.5:1.
  final Color signalFill;

  static const light = PikoColors(
    paper: Color(0xFFFAF8F4),
    surface: Color(0xFFF0EDE7),
    ink: Color(0xFF201E1D),
    rule: Color(0xFF3D3936),
    n200: Color(0xFFE6E2DB),
    n300: Color(0xFFD8D3CB),
    n400: Color(0xFFB5AFA6),
    n500: Color(0xFF8F8981),
    n600: Color(0xFF6E6862),
    n700: Color(0xFF56514C),
    n800: Color(0xFF3D3936),
    signal: Color(0xFFEC3013),
    signalInk: Color(0xFFC02A10),
    signalFill: Color(0xFFEC3013),
  );

  static const dark = PikoColors(
    paper: Color(0xFF161413),
    surface: Color(0xFF22201E),
    ink: Color(0xFFF3EFE8),
    rule: Color(0xFFD3CEC6),
    n200: Color(0xFF2A2725),
    n300: Color(0xFF3A3633),
    n400: Color(0xFF57524D),
    n500: Color(0xFF7A746D),
    n600: Color(0xFF9A948C),
    n700: Color(0xFFB7B1A9),
    n800: Color(0xFFD3CEC6),
    signal: Color(0xFFFF6247),
    signalInk: Color(0xFFFF9C88),
    signalFill: Color(0xFFEC3013),
  );

  // Nothing overrides single colours; the theme only swaps whole palettes.
  @override
  PikoColors copyWith() => this;

  @override
  PikoColors lerp(PikoColors? other, double t) {
    if (other == null) return this;
    Color mix(Color a, Color b) => Color.lerp(a, b, t)!;
    return PikoColors(
      paper: mix(paper, other.paper),
      surface: mix(surface, other.surface),
      ink: mix(ink, other.ink),
      rule: mix(rule, other.rule),
      n200: mix(n200, other.n200),
      n300: mix(n300, other.n300),
      n400: mix(n400, other.n400),
      n500: mix(n500, other.n500),
      n600: mix(n600, other.n600),
      n700: mix(n700, other.n700),
      n800: mix(n800, other.n800),
      signal: mix(signal, other.signal),
      signalInk: mix(signalInk, other.signalInk),
      signalFill: mix(signalFill, other.signalFill),
    );
  }
}

extension PikoColorsContext on BuildContext {
  // Widget tests that pump a bare MaterialApp get the light palette.
  PikoColors get piko => Theme.of(this).extension<PikoColors>() ?? PikoColors.light;
}
```

Replace the whole of `mobile/lib/theme/app_theme.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'piko_colors.dart';

export 'piko_colors.dart';

// Legacy purple palette, still read by screens that haven't moved to
// `context.piko` yet. Removed once the last one has.
class AppColors {
  AppColors._();

  static const background = Color(0xFFF5F1FA);
  static const surface = Color(0xFFFFFFFF);
  static const primary = Color(0xFF5B3FA6);
  static const textPrimary = Color(0xFF1A1625);
  static const textMuted = Color(0xFF8A8398);
  static const accentLight = Color(0xFFF3E8FF);
  static const accentLightForeground = Color(0xFF7C3AED);
}

class AppTheme {
  AppTheme._();

  static const font = 'HostGrotesk';

  // Legacy text styles, removed with AppColors.
  static const eyebrow = TextStyle(fontWeight: FontWeight.w600, fontSize: 12, letterSpacing: 1.5, color: AppColors.textMuted);
  static const headline = TextStyle(fontWeight: FontWeight.w800, fontSize: 32, color: AppColors.textPrimary, height: 1.15);
  static const wordmark = TextStyle(fontWeight: FontWeight.w800, fontSize: 32, color: AppColors.textPrimary);
  static const sectionHeading = TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: AppColors.textPrimary);
  static const subtitle = TextStyle(fontSize: 15, color: AppColors.textMuted);

  static ThemeData get light => _build(PikoColors.light, Brightness.light);
  static ThemeData get dark => _build(PikoColors.dark, Brightness.dark);

  static ThemeData _build(PikoColors c, Brightness brightness) {
    const square = RoundedRectangleBorder();
    const buttonText = TextStyle(fontFamily: font, fontSize: 15, fontWeight: FontWeight.w600);
    final tint = c.ink.withValues(alpha: 0.06);

    OutlineInputBorder fieldBorder(Color color, [double width = 1]) =>
        OutlineInputBorder(borderRadius: BorderRadius.zero, borderSide: BorderSide(color: color, width: width));

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      fontFamily: font,
      extensions: [c],
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: c.ink,
        onPrimary: c.paper,
        primaryContainer: c.surface,
        onPrimaryContainer: c.ink,
        secondary: c.ink,
        onSecondary: c.paper,
        secondaryContainer: c.surface,
        onSecondaryContainer: c.ink,
        error: c.signalInk,
        onError: c.paper,
        surface: c.paper,
        onSurface: c.ink,
        onSurfaceVariant: c.n600,
        surfaceContainerLowest: c.paper,
        surfaceContainerLow: c.paper,
        surfaceContainer: c.paper,
        surfaceContainerHigh: c.paper,
        surfaceContainerHighest: c.surface,
        surfaceTint: Colors.transparent,
        outline: c.n400,
        outlineVariant: c.n300,
        inverseSurface: c.ink,
        onInverseSurface: c.paper,
      ),
      scaffoldBackgroundColor: c.paper,
      canvasColor: c.paper,
      splashColor: tint,
      highlightColor: tint,
      // Type scale from the web: 32/800 page titles, 20/800 headings, 15/600
      // row titles, 13 meta, 11/600 uppercase micro-labels.
      textTheme: TextTheme(
        displaySmall: TextStyle(fontSize: 42, height: 1, fontWeight: FontWeight.w800, letterSpacing: -0.84, color: c.ink),
        headlineLarge: TextStyle(fontSize: 32, height: 1.05, fontWeight: FontWeight.w800, letterSpacing: -0.64, color: c.ink),
        titleLarge: TextStyle(fontSize: 20, height: 1.2, fontWeight: FontWeight.w800, letterSpacing: -0.2, color: c.ink),
        titleMedium: TextStyle(fontSize: 15, height: 1.3, fontWeight: FontWeight.w600, color: c.ink),
        bodyLarge: TextStyle(fontSize: 15, height: 1.4, color: c.ink),
        bodyMedium: TextStyle(fontSize: 14, height: 1.4, color: c.n800),
        bodySmall: TextStyle(fontSize: 13, height: 1.35, color: c.n600),
        labelLarge: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.ink),
        labelMedium: TextStyle(fontSize: 12, color: c.n700),
        labelSmall: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.88, color: c.n600),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: c.paper,
        foregroundColor: c.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: TextStyle(fontFamily: font, fontSize: 17, fontWeight: FontWeight.w800, color: c.ink),
        // Dark status-bar icons on paper, light ones in dark mode.
        systemOverlayStyle: brightness == Brightness.light ? SystemUiOverlayStyle.dark : SystemUiOverlayStyle.light,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: c.signalFill,
          foregroundColor: Colors.white,
          disabledBackgroundColor: c.n200,
          disabledForegroundColor: c.n500,
          minimumSize: const Size(64, 52),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          shape: square,
          textStyle: buttonText,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: c.ink,
          side: BorderSide(color: c.ink),
          minimumSize: const Size(64, 52),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          shape: square,
          textStyle: buttonText,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: c.ink,
          minimumSize: const Size(48, 44),
          shape: square,
          textStyle: buttonText,
        ),
      ),
      iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(foregroundColor: c.ink, shape: square)),
      inputDecorationTheme: InputDecorationTheme(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        border: fieldBorder(c.n400),
        enabledBorder: fieldBorder(c.n400),
        focusedBorder: fieldBorder(c.signal, 1.5),
        errorBorder: fieldBorder(c.signalInk),
        focusedErrorBorder: fieldBorder(c.signalInk, 1.5),
        hintStyle: TextStyle(color: c.n500),
        errorStyle: TextStyle(color: c.signalInk, fontSize: 13),
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: c.signal,
        selectionColor: c.signal.withValues(alpha: 0.25),
        selectionHandleColor: c.signal,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: c.signal,
        linearTrackColor: c.n200,
        linearMinHeight: 2,
        refreshBackgroundColor: c.paper,
      ),
      dividerTheme: DividerThemeData(color: c.n300, thickness: 1, space: 1),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: c.ink,
        contentTextStyle: TextStyle(fontFamily: font, fontSize: 14, color: c.paper),
        actionTextColor: c.paper,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.paper,
        modalBackgroundColor: c.paper,
        surfaceTintColor: Colors.transparent,
        shape: square,
      ),
      dialogTheme: DialogThemeData(backgroundColor: c.paper, surfaceTintColor: Colors.transparent, shape: square),
      datePickerTheme: DatePickerThemeData(
        backgroundColor: c.paper,
        surfaceTintColor: Colors.transparent,
        shape: square,
        headerBackgroundColor: c.paper,
        headerForegroundColor: c.ink,
        dayShape: const WidgetStatePropertyAll(square),
        dayBackgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? c.ink : null),
        dayForegroundColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? c.paper : (s.contains(WidgetState.disabled) ? c.n400 : c.ink),
        ),
        todayBackgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? c.ink : null),
        todayForegroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? c.paper : c.ink),
        todayBorder: BorderSide(color: c.signal, width: 1.5),
        yearShape: const WidgetStatePropertyAll(square),
      ),
    );
  }
}
```

- [ ] **Step 6: Store the theme choice and apply it**

In `mobile/lib/services/settings_service.dart` (change 1 of 3), find:

```dart
import 'package:shared_preferences/shared_preferences.dart';

import 'bs_calendar.dart';
```

Replace it with:

```dart
import 'package:flutter/material.dart' show ThemeMode;
import 'package:shared_preferences/shared_preferences.dart';

import 'bs_calendar.dart';
```

In `mobile/lib/services/settings_service.dart` (change 2 of 3), find:

```dart
  static const _urlKey = 'piko_server_url';
  static const _dateFormatKey = 'piko_date_format';
  static const defaultUrl = 'https://piko-kn.vercel.app';

  Future<String> readServerUrl() async {
```

Replace it with:

```dart
  static const _urlKey = 'piko_server_url';
  static const _dateFormatKey = 'piko_date_format';
  static const _themeModeKey = 'piko_theme_mode';
  static const defaultUrl = 'https://piko-kn.vercel.app';

  Future<String> readServerUrl() async {
```

In `mobile/lib/services/settings_service.dart` (change 3 of 3), find:

```dart
    await prefs.setString(_dateFormatKey, format.name);
  }
}
```

Replace it with:

```dart
    await prefs.setString(_dateFormatKey, format.name);
  }

  // Light until someone picks otherwise, as on the website.
  Future<ThemeMode> readThemeMode() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_themeModeKey);
    return ThemeMode.values.firstWhere((mode) => mode.name == stored, orElse: () => ThemeMode.light);
  }

  Future<void> writeThemeMode(ThemeMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeModeKey, mode.name);
  }
}
```

In `mobile/lib/providers/settings_provider.dart` (change 1 of 2), find:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/bs_calendar.dart';
```

Replace it with:

```dart
import 'package:flutter/material.dart' show ThemeMode;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/bs_calendar.dart';
```

In `mobile/lib/providers/settings_provider.dart` (change 2 of 2), find:

```dart
  (ref) => DateFormatNotifier(ref.watch(settingsServiceProvider)),
);
```

Replace it with:

```dart
  (ref) => DateFormatNotifier(ref.watch(settingsServiceProvider)),
);

class ThemeModeNotifier extends StateNotifier<ThemeMode> {
  final SettingsService _service;

  // Light until the stored choice loads — the same default the website uses.
  ThemeModeNotifier(this._service) : super(ThemeMode.light) {
    _load();
  }

  Future<void> _load() async {
    state = await _service.readThemeMode();
  }

  Future<void> setMode(ThemeMode mode) async {
    state = mode;
    await _service.writeThemeMode(mode);
  }
}

final themeModeProvider = StateNotifierProvider<ThemeModeNotifier, ThemeMode>(
  (ref) => ThemeModeNotifier(ref.watch(settingsServiceProvider)),
);
```

In `mobile/lib/main.dart` (change 1 of 2), find:

```dart
import 'providers/auth_provider.dart';
import 'providers/calendar_provider.dart';
import 'services/bs_calendar.dart';
import 'screens/login_screen.dart';
```

Replace it with:

```dart
import 'providers/auth_provider.dart';
import 'providers/calendar_provider.dart';
import 'providers/settings_provider.dart';
import 'services/bs_calendar.dart';
import 'screens/login_screen.dart';
```

In `mobile/lib/main.dart` (change 2 of 2), find:

```dart
      navigatorKey: navigatorKey,
      title: 'Piko',
      theme: AppTheme.theme,
      home: const SplashScreen(),
      debugShowCheckedModeBanner: false,
```

Replace it with:

```dart
      navigatorKey: navigatorKey,
      title: 'Piko',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ref.watch(themeModeProvider),
      home: const SplashScreen(),
      debugShowCheckedModeBanner: false,
```

- [ ] **Step 7: Run the checks**

Run:

```bash
cd mobile; flutter test; cd ..
cd mobile; flutter analyze; cd ..
```

Expected: 52 tests pass; analyze reports only the 3 existing `deprecated_member_use` issues. (The screens still look half old, half new until Task 8. That's expected.)

- [ ] **Step 8: Commit**

The `git rm` in Step 3 already staged the removed fonts.

```bash
git add mobile/assets/fonts/HostGrotesk-Regular.ttf mobile/assets/fonts/HostGrotesk-SemiBold.ttf mobile/assets/fonts/HostGrotesk-ExtraBold.ttf mobile/assets/fonts/HostGrotesk-OFL.txt mobile/pubspec.yaml mobile/lib/theme/piko_colors.dart mobile/lib/theme/app_theme.dart mobile/lib/services/settings_service.dart mobile/lib/providers/settings_provider.dart mobile/lib/main.dart mobile/test/services/settings_service_test.dart mobile/test/theme/app_theme_test.dart
git commit -m "feat(mobile): Host Grotesk, the web's palette, and light/dark themes"
```

### Task 3: Shared pieces from the website's design

These are small, focused building blocks the screens use: the money helpers ported from `src/lib/money.ts`, the category icon lookup ported from the website's icon files, and eight widgets. Nothing uses them yet.

**Files:**
- Create: `mobile/lib/services/money.dart`, `mobile/lib/theme/category_icons.dart`
- Create: `mobile/lib/widgets/money_text.dart`, `monogram.dart`, `segmented.dart`, `labeled_field.dart`, `amount_field.dart`, `category_icon.dart`, `brand_mark.dart`, `sheet_frame.dart`
- Test: `mobile/test/services/money_test.dart`, `mobile/test/theme/category_icons_test.dart`, `mobile/test/widgets/shared_widgets_test.dart`

**Interfaces:**
- Consumes: `context.piko` (Task 2).
- Produces:
  - `splitAmount(double)` → `({String integer, String decimals, bool negative})`, `sanitizeAmountInput(String)` → `String`, and `AmountInputFormatter` (a `TextInputFormatter`).
  - `categoryIconFor(String name, String? iconKey)` → `IconData`.
  - `MoneyText(double value, {TextStyle? style})`.
  - `typedef MonogramPerson = ({String name, bool isMe})` and `Monogram({required List<MonogramPerson> people})`.
  - `Segmented<T>({required List<(T, String)> options, required T value, required ValueChanged<T> onChanged})`.
  - `LabeledField({required String label, required Widget child})`.
  - `AmountField({required TextEditingController controller, bool autofocus = false, ValueChanged<String>? onChanged})`.
  - `CategoryIcon({required String name, String? iconKey})`.
  - `BrandMark({double size = 28})`.
  - `SheetFrame({required String title, required Widget child, Widget? footer})`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/test/services/money_test.dart` with:

```dart
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/services/money.dart';

void main() {
  group('splitAmount', () {
    test('groups rupees with commas and keeps two-digit paisa', () {
      expect(splitAmount(179291.88), (integer: '179,291', decimals: '.88', negative: false));
    });

    test('pads whole amounts with .00', () {
      expect(splitAmount(512), (integer: '512', decimals: '.00', negative: false));
    });

    test('rounds to the nearest paisa', () {
      expect(splitAmount(2974.199), (integer: '2,974', decimals: '.20', negative: false));
    });

    test('flags negatives and keeps the sign out of the digits', () {
      expect(splitAmount(-23691.88), (integer: '23,691', decimals: '.88', negative: true));
    });

    test('never shows a negative zero', () {
      expect(splitAmount(-0.004), (integer: '0', decimals: '.00', negative: false));
    });

    test('shows zero for non-finite input', () {
      expect(splitAmount(double.nan), (integer: '0', decimals: '.00', negative: false));
      expect(splitAmount(double.infinity), (integer: '0', decimals: '.00', negative: false));
    });

    test('groups millions', () {
      expect(splitAmount(1234567).integer, '1,234,567');
    });
  });

  group('sanitizeAmountInput', () {
    test('drops currency text and thousands separators from pasted amounts', () {
      expect(sanitizeAmountInput('Rs 1,500.50'), '1500.50');
      expect(sanitizeAmountInput('Rs.1500'), '1500');
      expect(sanitizeAmountInput('रु 200'), '200');
    });

    test('keeps only the first decimal point', () {
      expect(sanitizeAmountInput('1.2.3'), '1.23');
    });

    test('limits paisa to two places', () {
      expect(sanitizeAmountInput('12.345'), '12.34');
    });

    test('drops a minus sign', () {
      expect(sanitizeAmountInput('-5'), '5');
    });

    test('lets a point be typed first or last', () {
      expect(sanitizeAmountInput('.5'), '.5');
      expect(sanitizeAmountInput('12.'), '12.');
    });

    test('returns empty when there is no number', () {
      expect(sanitizeAmountInput('abc'), '');
    });
  });

  test('AmountInputFormatter applies sanitizeAmountInput and moves the caret to the end', () {
    final result = AmountInputFormatter().formatEditUpdate(
      TextEditingValue.empty,
      const TextEditingValue(text: '1.2.3', selection: TextSelection.collapsed(offset: 5)),
    );

    expect(result.text, '1.23');
    expect(result.selection, const TextSelection.collapsed(offset: 4));
  });
}
```

Create `mobile/test/theme/category_icons_test.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/theme/category_icons.dart';

void main() {
  group('categoryIconFor', () {
    test("uses the category's own icon key over its name", () {
      expect(categoryIconFor('Lunch', 'wifi'), Icons.wifi);
    });

    test('falls back to a receipt for an icon key it does not know', () {
      expect(categoryIconFor('Lunch', 'rocket'), Icons.receipt_long_outlined);
    });

    test('guesses from the name, case-insensitively, when there is no key', () {
      expect(categoryIconFor('Lunch & Tea', null), Icons.restaurant_outlined);
      expect(categoryIconFor('PETROL', null), Icons.local_gas_station_outlined);
    });

    test('checks keywords in order, so clothes win over shopping', () {
      expect(categoryIconFor('Clothes shopping', null), Icons.checkroom_outlined);
      expect(categoryIconFor('Shopping', null), Icons.shopping_bag_outlined);
    });

    test('falls back to a tag for an unmatched name', () {
      expect(categoryIconFor('Miscellaneous', null), Icons.sell_outlined);
    });
  });
}
```

Create `mobile/test/widgets/shared_widgets_test.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:piko/widgets/amount_field.dart';
import 'package:piko/widgets/money_text.dart';
import 'package:piko/widgets/monogram.dart';
import 'package:piko/widgets/segmented.dart';

void main() {
  Future<void> pump(WidgetTester tester, Widget child) {
    return tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(body: Center(child: child)),
      ),
    );
  }

  testWidgets('MoneyText shows grouped rupees with the paisa in lighter grey', (tester) async {
    await pump(tester, const MoneyText(1234.5));

    final amount = find.text('1,234.50', findRichText: true);
    expect(amount, findsOneWidget);
    final paisa = <TextSpan>[];
    tester.widget<RichText>(amount).text.visitChildren((span) {
      if (span is TextSpan && span.text == '.50') paisa.add(span);
      return true;
    });
    expect(paisa.single.style!.color, PikoColors.light.n500);
  });

  testWidgets('MoneyText puts a minus sign before a negative amount', (tester) async {
    await pump(tester, const MoneyText(-80));

    expect(find.text('−80.00', findRichText: true), findsOneWidget);
  });

  testWidgets('Segmented reports the tapped option', (tester) async {
    String? picked;
    await pump(
      tester,
      Segmented<String>(
        options: const [('a', 'Me'), ('b', 'Karuna'), ('c', 'Shared')],
        value: 'a',
        onChanged: (value) => picked = value,
      ),
    );

    await tester.tap(find.text('Shared'));

    expect(picked, 'c');
  });

  testWidgets('Monogram shows each initial, upper-cased', (tester) async {
    await pump(tester, const Monogram(people: [(name: 'nirjal', isMe: true), (name: 'Karuna', isMe: false)]));

    expect(find.text('N'), findsOneWidget);
    expect(find.text('K'), findsOneWidget);
  });

  testWidgets('AmountField only accepts an amount', (tester) async {
    final controller = TextEditingController();
    await pump(tester, AmountField(controller: controller));

    await tester.enterText(find.byType(TextField), 'Rs 1,500.505');

    expect(controller.text, '1500.50');
  });
}
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd mobile; flutter test test/services/money_test.dart test/theme/category_icons_test.dart test/widgets/shared_widgets_test.dart; cd ..`

Expected: FAIL. None of the three files compile, because the code they test doesn't exist yet:

```text
Error: Error when reading 'lib/services/money.dart': The system cannot find the file specified
Error: Error when reading 'lib/theme/category_icons.dart': The system cannot find the file specified
Error: Error when reading 'lib/widgets/amount_field.dart': The system cannot find the file specified
```

- [ ] **Step 3: Port the money helpers and the category icons**

Create `mobile/lib/services/money.dart` with:

```dart
import 'package:flutter/services.dart';

// Dart port of the website's money helpers (src/lib/money.ts).

typedef AmountParts = ({String integer, String decimals, bool negative});

// Grouped rupees and two-digit paisa, e.g. 1234.5 -> ("1,234", ".50").
AmountParts splitAmount(double value) {
  // Work in whole paisa so -0.004 rounds to 0 (not "-0.00") and NaN/Infinity
  // from bad data show as 0.00 instead of leaking into the UI.
  final paisa = value.isFinite ? (value * 100).round() : 0;
  final fixed = (paisa.abs() / 100).toStringAsFixed(2).split('.');
  return (integer: _group(fixed[0]), decimals: '.${fixed[1]}', negative: paisa < 0);
}

String _group(String digits) => digits.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');

// "Rs", "NPR", "रु"/"रू" with an optional abbreviation dot — removed before
// cleaning so that dot is never read as the decimal point ("Rs.1500").
final _currencyToken = RegExp(r'(?:rs|npr|रु|रू)\.?', caseSensitive: false, unicode: true);

// Keeps what someone types or pastes into an amount field to digits and one
// decimal point with at most two places; everything else is dropped.
String sanitizeAmountInput(String raw) {
  final withoutCurrency = raw.replaceAll(_currencyToken, '');
  final start = withoutCurrency.indexOf(RegExp(r'\d|\.(?=\d|$)'));
  if (start == -1) return '';
  final cleaned = withoutCurrency.substring(start).replaceAll(RegExp(r'[^\d.]'), '');
  final dot = cleaned.indexOf('.');
  if (dot == -1) return cleaned;
  final fraction = cleaned.substring(dot + 1).replaceAll('.', '');
  return '${cleaned.substring(0, dot)}.${fraction.length > 2 ? fraction.substring(0, 2) : fraction}';
}

class AmountInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final text = sanitizeAmountInput(newValue.text);
    if (text == newValue.text) return newValue;
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}
```

Create `mobile/lib/theme/category_icons.dart` with:

```dart
import 'package:flutter/material.dart';

// The website's category icons as Material icons: a category's own icon key
// (src/modules/recurring/lib/recurring-icons.ts) when it has one, otherwise a
// guess from its name (src/modules/categories/lib/guess-category-icon.ts).

const _iconsByKey = <String, IconData>{
  'building': Icons.apartment_outlined,
  'car': Icons.directions_car_outlined,
  'creditCard': Icons.credit_card_outlined,
  'dumbbell': Icons.fitness_center_outlined,
  'gift': Icons.card_giftcard_outlined,
  'heartPulse': Icons.monitor_heart_outlined,
  'home': Icons.home_outlined,
  'landmark': Icons.account_balance_outlined,
  'music': Icons.music_note_outlined,
  'phone': Icons.smartphone_outlined,
  'receipt': Icons.receipt_long_outlined,
  'shield': Icons.shield_outlined,
  'tv': Icons.tv_outlined,
  'users': Icons.group_outlined,
  'wifi': Icons.wifi,
  'zap': Icons.bolt_outlined,
};

// Checked in order, so "Clothes shopping" is clothes, not shopping.
final _keywordIcons = <(RegExp, IconData)>[
  (RegExp('lunch|dinner|breakfast|food|restaurant|dining|momo|snack|tea|coffee|cafe'), Icons.restaurant_outlined),
  (RegExp('grocer|bhatbhateni|vegetable|market'), Icons.shopping_basket_outlined),
  (RegExp('petrol|fuel|diesel|gas station'), Icons.local_gas_station_outlined),
  (RegExp('cloth|shirt|shoe'), Icons.checkroom_outlined),
  (RegExp('shop'), Icons.shopping_bag_outlined),
  (RegExp('mobile|phone|telephone|top ?up|recharge'), Icons.smartphone_outlined),
  (RegExp('internet|wifi|wi-fi|wlink|broadband'), Icons.wifi),
  (RegExp('medic|pharma|hospital|health|doctor|clinic'), Icons.medication_outlined),
  (RegExp('rent|house|home'), Icons.home_outlined),
  (RegExp('loan|emi|obligation|bank|tax|insurance'), Icons.account_balance_outlined),
  (RegExp('bus|taxi|transport|travel'), Icons.directions_bus_outlined),
  (RegExp('parking|vehicle|bike|car'), Icons.directions_car_outlined),
  (RegExp('electric|water|utility|utilities|bill'), Icons.bolt_outlined),
  (RegExp('gift'), Icons.card_giftcard_outlined),
  (RegExp('school|tuition|course|education|book'), Icons.school_outlined),
  (RegExp('saving'), Icons.savings_outlined),
  (RegExp('movie|netflix|entertainment|subscription'), Icons.tv_outlined),
  (RegExp('skin|cosmetic|beauty|salon'), Icons.auto_awesome_outlined),
  (RegExp('date|romance'), Icons.favorite_border),
];

IconData categoryIconFor(String name, String? iconKey) {
  if (iconKey != null) return _iconsByKey[iconKey] ?? Icons.receipt_long_outlined;
  final lower = name.toLowerCase();
  for (final (pattern, icon) in _keywordIcons) {
    if (pattern.hasMatch(lower)) return icon;
  }
  return Icons.sell_outlined;
}
```

- [ ] **Step 4: Add the shared widgets**

Create `mobile/lib/widgets/money_text.dart` with:

```dart
import 'package:flutter/material.dart';

import '../services/money.dart';
import '../theme/app_theme.dart';

// An amount set the website's way (its Money component): grouped rupees in
// the given style, then smaller, lighter paisa. Digits are tabular so
// amounts line up down a list.
class MoneyText extends StatelessWidget {
  const MoneyText(this.value, {super.key, this.style});

  final double value;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final parts = splitAmount(value);
    final base = (style ?? DefaultTextStyle.of(context).style).copyWith(
      fontFeatures: const [FontFeature.tabularFigures()],
    );

    return Text.rich(
      TextSpan(
        style: base,
        children: [
          TextSpan(text: '${parts.negative ? '−' : ''}${parts.integer}'),
          TextSpan(
            text: parts.decimals,
            style: TextStyle(color: c.n500, fontWeight: FontWeight.w400),
          ),
        ],
      ),
      maxLines: 1,
      softWrap: false,
    );
  }
}
```

Create `mobile/lib/widgets/monogram.dart` with:

```dart
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

typedef MonogramPerson = ({String name, bool isMe});

// Square initial badges, like the website's Monogram: you in ink, the other
// person in grey. Shared expenses pass both, and the second badge overlaps
// the first behind a paper ring.
class Monogram extends StatelessWidget {
  const Monogram({super.key, required this.people});

  final List<MonogramPerson> people;

  static const _size = 20.0;
  static const _overlap = 4.0;
  static const _ring = 2.0;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final step = _size - _overlap;

    Widget badge(MonogramPerson person) {
      final name = person.name.trim();
      return Container(
        width: _size,
        height: _size,
        alignment: Alignment.center,
        color: person.isMe ? c.ink : c.n600,
        child: Text(
          name.isEmpty ? '?' : name[0].toUpperCase(),
          style: TextStyle(fontSize: 11, height: 1, fontWeight: FontWeight.w600, color: c.paper),
        ),
      );
    }

    return SizedBox(
      width: people.isEmpty ? 0 : _size + step * (people.length - 1),
      height: _size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          for (final (i, person) in people.indexed)
            if (i == 0)
              Positioned(left: 0, top: 0, child: badge(person))
            else
              Positioned(
                left: step * i - _ring,
                top: -_ring,
                child: Container(padding: const EdgeInsets.all(_ring), color: c.paper, child: badge(person)),
              ),
        ],
      ),
    );
  }
}
```

Create `mobile/lib/widgets/segmented.dart` with:

```dart
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

// One-of-n choice drawn as joined square buttons, like the website's
// Segmented. The chosen option is filled with ink.
class Segmented<T> extends StatelessWidget {
  const Segmented({super.key, required this.options, required this.value, required this.onChanged});

  final List<(T, String)> options;
  final T value;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final textStyle = Theme.of(context).textTheme.bodyMedium!;

    return Container(
      height: 46,
      decoration: BoxDecoration(border: Border.all(color: c.n400)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, (option, label)) in options.indexed) ...[
            if (i > 0) VerticalDivider(width: 1, thickness: 1, color: c.n400),
            Expanded(
              child: Semantics(
                button: true,
                inMutuallyExclusiveGroup: true,
                selected: option == value,
                child: Material(
                  color: option == value ? c.ink : Colors.transparent,
                  child: InkWell(
                    onTap: () => onChanged(option),
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        child: Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: textStyle.copyWith(
                            color: option == value ? c.paper : c.n800,
                            fontWeight: option == value ? FontWeight.w600 : FontWeight.w400,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
```

Create `mobile/lib/widgets/labeled_field.dart` with:

```dart
import 'package:flutter/material.dart';

// A small label over a field, as on the website's forms.
class LabeledField extends StatelessWidget {
  const LabeledField({super.key, required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelMedium),
        const SizedBox(height: 6),
        child,
      ],
    );
  }
}
```

Create `mobile/lib/widgets/amount_field.dart` with:

```dart
import 'package:flutter/material.dart';

import '../services/money.dart';
import '../theme/app_theme.dart';
import 'labeled_field.dart';

// The big "Rs ____" field the expense sheet leads with, like the website's
// AmountInput: 40px digits over a 2px ink underline. Only digits and one
// decimal point with two places can be typed.
class AmountField extends StatelessWidget {
  const AmountField({super.key, required this.controller, this.autofocus = false, this.onChanged});

  final TextEditingController controller;
  final bool autofocus;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;

    return LabeledField(
      label: 'Amount',
      child: Container(
        padding: const EdgeInsets.only(bottom: 6),
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.ink, width: 2))),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text('Rs', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: c.n600)),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: controller,
                autofocus: autofocus,
                onChanged: onChanged,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [AmountInputFormatter()],
                style: TextStyle(
                  fontSize: 40,
                  height: 1.1,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.8,
                  color: c.ink,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
                decoration: InputDecoration(
                  isCollapsed: true,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  hintText: '0.00',
                  hintStyle: TextStyle(color: c.n400),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

Create `mobile/lib/widgets/category_icon.dart` with:

```dart
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/category_icons.dart';

// A square surface tile with the category's icon, like the website's
// CategoryIcon: its own icon when it has one, else a guess from its name.
class CategoryIcon extends StatelessWidget {
  const CategoryIcon({super.key, required this.name, this.iconKey});

  final String name;
  final String? iconKey;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      color: c.surface,
      child: Icon(categoryIconFor(name, iconKey), size: 18, color: c.ink),
    );
  }
}
```

Create `mobile/lib/widgets/brand_mark.dart` with:

```dart
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

// The ink "P" square and "Piko" wordmark from the website's sidebar.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 28});

  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          color: c.ink,
          child: Text(
            'P',
            style: TextStyle(fontSize: size * 0.5, height: 1, fontWeight: FontWeight.w800, color: c.paper),
          ),
        ),
        const SizedBox(width: 10),
        Text('Piko', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.ink)),
      ],
    );
  }
}
```

Create `mobile/lib/widgets/sheet_frame.dart` with:

```dart
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

// The website's dialog layout (its Modal) for bottom sheets: the title and a
// close button over a 2px rule, a scrolling body, and an optional footer
// above a 1px rule with the main action first.
class SheetFrame extends StatelessWidget {
  const SheetFrame({super.key, required this.title, required this.child, this.footer});

  final String title;
  final Widget child;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;

    return SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 8, 8, 8),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.rule, width: 2))),
            child: Row(
              children: [
                Expanded(child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
                IconButton(
                  tooltip: 'Close',
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).maybePop(),
                ),
              ],
            ),
          ),
          Flexible(
            child: SingleChildScrollView(padding: const EdgeInsets.all(20), child: child),
          ),
          if (footer != null)
            Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: c.n300))),
              child: footer,
            ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 5: Run the checks**

Run:

```bash
cd mobile; flutter test; cd ..
cd mobile; flutter analyze; cd ..
```

Expected: 76 tests pass; analyze reports only the 3 existing `deprecated_member_use` issues.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/services/money.dart mobile/lib/theme/category_icons.dart mobile/lib/widgets/money_text.dart mobile/lib/widgets/monogram.dart mobile/lib/widgets/segmented.dart mobile/lib/widgets/labeled_field.dart mobile/lib/widgets/amount_field.dart mobile/lib/widgets/category_icon.dart mobile/lib/widgets/brand_mark.dart mobile/lib/widgets/sheet_frame.dart mobile/test/services/money_test.dart mobile/test/theme/category_icons_test.dart mobile/test/widgets/shared_widgets_test.dart
git commit -m "feat(mobile): shared pieces from the web's design"
```

### Task 4: Sign-in and start screens

This is the website's sign-in page at phone width. The sign-in logic (`_submit`) is unchanged.

**Files:**
- Replace: `mobile/lib/screens/login_screen.dart`
- Modify: `mobile/lib/screens/splash_screen.dart`

**Interfaces:**
- Consumes: `BrandMark`, `LabeledField` (Task 3); `context.piko` (Task 2).

- [ ] **Step 1: Rewrite the sign-in screen**

Replace the whole of `mobile/lib/screens/login_screen.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/api_client_provider.dart';
import '../providers/auth_provider.dart';
import '../providers/settings_provider.dart';
import '../services/api_client.dart';
import '../theme/app_theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/labeled_field.dart';
import 'home_screen.dart';
import 'settings_screen.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final baseUrl = ref.read(serverUrlProvider).value!;
      final client = ref.read(apiClientProvider);
      final token = await client.login(baseUrl, _emailController.text.trim(), _passwordController.text);
      await ref.read(authProvider.notifier).setToken(token);
      if (mounted) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const HomeScreen()));
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Could not reach the server. Check your connection or the server URL.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;

    // The website's sign-in page at phone width: the brand over a 2px rule,
    // then a big "Sign in" and the form.
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 24,
        title: const BrandMark(size: 32),
        actions: [
          IconButton(
            tooltip: 'Settings',
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
          const SizedBox(width: 8),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(2),
          child: Container(height: 2, color: c.rule),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 40, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Sign in', style: text.displaySmall),
              const SizedBox(height: 28),
              LabeledField(
                label: 'Email',
                child: TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                ),
              ),
              const SizedBox(height: 20),
              LabeledField(
                label: 'Password',
                child: TextField(
                  controller: _passwordController,
                  obscureText: true,
                  onSubmitted: (_) => _submitting ? null : _submit(),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: text.bodyMedium!.copyWith(color: c.signalInk)),
              ],
              const SizedBox(height: 28),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting ? 'Signing in...' : 'Sign in'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Show the brand while starting**

In `mobile/lib/screens/splash_screen.dart` (change 1 of 2), find:

```dart
import '../providers/auth_provider.dart';
import '../providers/settings_provider.dart';
import 'home_screen.dart';
import 'login_screen.dart';
```

Replace it with:

```dart
import '../providers/auth_provider.dart';
import '../providers/settings_provider.dart';
import '../widgets/brand_mark.dart';
import 'home_screen.dart';
import 'login_screen.dart';
```

In `mobile/lib/screens/splash_screen.dart` (change 2 of 2), find:

```dart
    final auth = ref.watch(authProvider);

    if (serverUrl.isLoading || auth.isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (serverUrl.hasError || auth.hasError) {
```

Replace it with:

```dart
    final auth = ref.watch(authProvider);

    if (serverUrl.isLoading || auth.isLoading) {
      return const Scaffold(body: Center(child: BrandMark(size: 40)));
    }

    if (serverUrl.hasError || auth.hasError) {
```

- [ ] **Step 3: Run the checks**

Run:

```bash
cd mobile; flutter test; cd ..
cd mobile; flutter analyze; cd ..
```

Expected: 76 tests pass; analyze reports only the 3 existing `deprecated_member_use` issues.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/screens/login_screen.dart mobile/lib/screens/splash_screen.dart
git commit -m "feat(mobile): sign-in and start screens in the new design"
```

### Task 5: The Add expense sheet

The confirm sheet becomes the website's Add expense dialog: a big amount, a category with chips, For and Paid by as segments, "Me", and the footer. Two new optional inputs (`currentMemberId`, `quickCategoryIds`) default to "unknown" and "no chips", so Home keeps compiling until Task 6 passes them. The BS date picker gets the square look.

**Files:**
- Create: `mobile/lib/services/people.dart`
- Replace: `mobile/lib/widgets/expense_confirm_sheet.dart`, `mobile/lib/widgets/bs_date_picker.dart`
- Test: `mobile/test/services/people_test.dart`, `mobile/test/widgets/expense_confirm_sheet_test.dart`

**Interfaces:**
- Consumes: `AmountField`, `LabeledField`, `Segmented`, `SheetFrame` (Task 3); `MemberOption`, `Expense` (existing models).
- Produces:
  - `meFirst(List<MemberOption> members, String? currentMemberId)` → `List<MemberOption>`.
  - `personLabel(MemberOption member, String? currentMemberId)` → `'Me'` or the name.
  - `expenseWho(Expense, List<MemberOption>, String? currentMemberId)` → `({List<({String name, bool isMe})> people, String label})`.
  - `ExpenseConfirmSheet` gains `String? currentMemberId` and `List<String> quickCategoryIds = const []`.
  - Widget keys stay `amount-field`, `category-field`, `owner-field`, `paid-by-field`, `note-field` and `save-button`, plus a new `quick-category-<id>` key on each chip.

- [ ] **Step 1: Write the failing tests**

Create `mobile/test/services/people_test.dart` with:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/expense.dart';
import 'package:piko/models/member_option.dart';
import 'package:piko/services/people.dart';

void main() {
  final nirjal = MemberOption(id: 'mem-1', name: 'Nirjal');
  final karuna = MemberOption(id: 'mem-2', name: 'Karuna');
  final members = [nirjal, karuna];

  Expense expense({String? owner, required String paidBy}) => Expense(
        id: 'exp-1',
        amount: 100,
        categoryId: 'cat-1',
        ownerMemberId: owner,
        paidByMemberId: paidBy,
        date: '2026-10-14',
        note: null,
      );

  test('meFirst puts the signed-in person first', () {
    expect(meFirst(members, 'mem-2').map((m) => m.id), ['mem-2', 'mem-1']);
  });

  test('meFirst keeps the server order when it does not know who is signed in', () {
    expect(meFirst(members, null).map((m) => m.id), ['mem-1', 'mem-2']);
  });

  test('personLabel says Me for the signed-in person and the name otherwise', () {
    expect(personLabel(karuna, 'mem-2'), 'Me');
    expect(personLabel(nirjal, 'mem-2'), 'Nirjal');
  });

  group('expenseWho', () {
    test("leaves out who paid when it was the person's own expense", () {
      final who = expenseWho(expense(owner: 'mem-1', paidBy: 'mem-1'), members, 'mem-1');

      expect(who.label, 'Me');
      expect(who.people, [(name: 'Nirjal', isMe: true)]);
    });

    test('says who paid when someone paid for the other person', () {
      final who = expenseWho(expense(owner: 'mem-2', paidBy: 'mem-1'), members, 'mem-1');

      expect(who.label, 'Karuna · paid by Me');
      expect(who.people, [(name: 'Karuna', isMe: false)]);
    });

    test('shows both people, signed-in first, for a shared expense', () {
      final who = expenseWho(expense(paidBy: 'mem-2'), members, 'mem-1');

      expect(who.label, 'Shared · paid by Karuna');
      expect(who.people, [(name: 'Nirjal', isMe: true), (name: 'Karuna', isMe: false)]);
    });

    test('uses names when the server does not say who is signed in', () {
      final who = expenseWho(expense(paidBy: 'mem-1'), members, null);

      expect(who.label, 'Shared · paid by Nirjal');
      expect(who.people.every((p) => !p.isMe), isTrue);
    });
  });
}
```

Replace the whole of `mobile/test/widgets/expense_confirm_sheet_test.dart` with:

```dart
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/category_option.dart';
import 'package:piko/models/expense_draft.dart';
import 'package:piko/models/member_option.dart';
import 'package:piko/services/bs_calendar.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:piko/widgets/expense_confirm_sheet.dart';

void main() {
  final categories = [CategoryOption(id: 'cat-1', name: 'Groceries'), CategoryOption(id: 'cat-2', name: 'Transport')];
  final calendar = BsCalendar.fromJson(
    jsonDecode(File('assets/bs_calendar.json').readAsStringSync()) as Map<String, dynamic>,
  );
  final members = [MemberOption(id: 'mem-1', name: 'Nirjal'), MemberOption(id: 'mem-2', name: 'Karuna')];

  ExpenseDraft draft({double amount = 500}) => ExpenseDraft(
        amount: amount,
        categoryId: 'cat-1',
        ownerMemberId: 'mem-1',
        paidByMemberId: 'mem-1',
        date: '2026-09-03',
        note: 'groceries',
      );

  Future<void> pumpSheet(
    WidgetTester tester, {
    required ExpenseDraft initialDraft,
    required void Function(ExpenseDraft) onSave,
    AppDateFormat dateFormat = AppDateFormat.nepali,
    String? currentMemberId = 'mem-1',
    List<String> quickCategoryIds = const [],
  }) async {
    // Tall enough that every field is on screen without scrolling.
    tester.view.physicalSize = const Size(800, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: ExpenseConfirmSheet(
            initialDraft: initialDraft,
            categories: categories,
            members: members,
            currentMemberId: currentMemberId,
            quickCategoryIds: quickCategoryIds,
            dateFormat: dateFormat,
            calendar: calendar,
            onSave: (d) async => onSave(d),
          ),
        ),
      ),
    );
  }

  Finder inField(String key, String text) => find.descendant(of: find.byKey(Key(key)), matching: find.text(text));

  testWidgets('shows the prefilled amount and note', (tester) async {
    await pumpSheet(tester, initialDraft: draft(), onSave: (_) {});

    expect(find.text('500'), findsOneWidget);
    expect(find.text('groceries'), findsOneWidget);
  });

  testWidgets('Save is disabled when amount is zero or empty', (tester) async {
    await pumpSheet(tester, initialDraft: draft(amount: 0), onSave: (_) {});

    final saveButton = tester.widget<FilledButton>(find.byKey(const Key('save-button')));
    expect(saveButton.onPressed, isNull);
  });

  testWidgets('Save is enabled and calls onSave with the edited amount', (tester) async {
    ExpenseDraft? saved;
    await pumpSheet(tester, initialDraft: draft(), onSave: (d) => saved = d);

    await tester.enterText(find.byKey(const Key('amount-field')), '750');
    await tester.pump();

    final saveButton = tester.widget<FilledButton>(find.byKey(const Key('save-button')));
    expect(saveButton.onPressed, isNotNull);

    await tester.tap(find.byKey(const Key('save-button')));
    await tester.pump();

    expect(saved, isNotNull);
    expect(saved!.amount, 750);
  });

  testWidgets("a minus sign can't be typed into the amount", (tester) async {
    await pumpSheet(tester, initialDraft: draft(), onSave: (_) {});

    await tester.enterText(find.byKey(const Key('amount-field')), '-5');
    await tester.pump();

    expect(find.text('5'), findsOneWidget);
    expect(find.text('-5'), findsNothing);
  });

  testWidgets('Save is disabled when categoryId does not match any available category', (tester) async {
    await pumpSheet(
      tester,
      initialDraft: ExpenseDraft(
        amount: 500,
        categoryId: 'not-a-real-category',
        ownerMemberId: 'mem-1',
        paidByMemberId: 'mem-1',
        date: '2026-09-03',
        note: 'groceries',
      ),
      onSave: (_) {},
    );

    final saveButton = tester.widget<FilledButton>(find.byKey(const Key('save-button')));
    expect(saveButton.onPressed, isNull);
  });

  testWidgets('For and Paid by say Me for the signed-in person, listed first', (tester) async {
    await pumpSheet(tester, initialDraft: draft(), onSave: (_) {}, currentMemberId: 'mem-2');

    expect(inField('owner-field', 'Me'), findsOneWidget);
    expect(inField('owner-field', 'Nirjal'), findsOneWidget);
    expect(inField('owner-field', 'Shared'), findsOneWidget);
    expect(inField('paid-by-field', 'Me'), findsOneWidget);
    expect(
      tester.getTopLeft(inField('owner-field', 'Me')).dx,
      lessThan(tester.getTopLeft(inField('owner-field', 'Nirjal')).dx),
    );
  });

  testWidgets('choosing someone under For makes them the payer too', (tester) async {
    ExpenseDraft? saved;
    await pumpSheet(tester, initialDraft: draft(), onSave: (d) => saved = d);

    await tester.tap(inField('owner-field', 'Karuna'));
    await tester.pump();
    await tester.tap(find.byKey(const Key('save-button')));
    await tester.pump();

    expect(saved!.ownerMemberId, 'mem-2');
    expect(saved!.paidByMemberId, 'mem-2');
  });

  testWidgets('choosing Shared keeps whoever paid', (tester) async {
    ExpenseDraft? saved;
    await pumpSheet(tester, initialDraft: draft(), onSave: (d) => saved = d);

    await tester.tap(inField('owner-field', 'Shared'));
    await tester.pump();
    await tester.tap(find.byKey(const Key('save-button')));
    await tester.pump();

    expect(saved!.ownerMemberId, isNull);
    expect(saved!.paidByMemberId, 'mem-1');
  });

  testWidgets('a quick category chip picks that category', (tester) async {
    ExpenseDraft? saved;
    await pumpSheet(tester, initialDraft: draft(), onSave: (d) => saved = d, quickCategoryIds: ['cat-2', 'cat-1']);

    await tester.tap(find.byKey(const Key('quick-category-cat-2')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('save-button')));
    await tester.pump();

    expect(saved!.categoryId, 'cat-2');
  });

  testWidgets('shows the draft date in BS by default', (tester) async {
    await pumpSheet(tester, initialDraft: draft(), onSave: (_) {});

    expect(find.text('18 Bhadra 2083'), findsOneWidget);
  });

  testWidgets('shows the draft date in AD when the app is set to AD', (tester) async {
    await pumpSheet(tester, initialDraft: draft(), onSave: (_) {}, dateFormat: AppDateFormat.english);

    expect(find.text('3 Sep 2026'), findsOneWidget);
  });

  testWidgets('picking a BS day saves the matching AD date', (tester) async {
    ExpenseDraft? saved;
    await pumpSheet(tester, initialDraft: draft(), onSave: (d) => saved = d);

    await tester.ensureVisible(find.text('18 Bhadra 2083'));
    await tester.tap(find.text('18 Bhadra 2083'));
    await tester.pumpAndSettle();
    expect(find.text('Bhadra 2083'), findsOneWidget);

    await tester.tap(find.byKey(const Key('bs-next-month')));
    await tester.pumpAndSettle();
    expect(find.text('Ashwin 2083'), findsOneWidget);

    await tester.tap(find.text('19'));
    await tester.pumpAndSettle();
    expect(find.text('19 Ashwin 2083'), findsOneWidget);

    await tester.ensureVisible(find.byKey(const Key('save-button')));
    await tester.tap(find.byKey(const Key('save-button')));
    await tester.pump();

    expect(saved!.date, '2026-10-05');
  });
}
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd mobile; flutter test test/services/people_test.dart test/widgets/expense_confirm_sheet_test.dart; cd ..`

Expected: FAIL. Neither file compiles; among the errors:

```text
Error: Error when reading 'lib/services/people.dart': The system cannot find the file specified
Error: No named parameter with the name 'currentMemberId'.
```

- [ ] **Step 3: Add the people helpers**

Create `mobile/lib/services/people.dart` with:

```dart
import '../models/expense.dart';
import '../models/member_option.dart';

// The signed-in person first, then the other, as the website lists people.
List<MemberOption> meFirst(List<MemberOption> members, String? currentMemberId) => [
      ...members.where((m) => m.id == currentMemberId),
      ...members.where((m) => m.id != currentMemberId),
    ];

String personLabel(MemberOption member, String? currentMemberId) =>
    member.id == currentMemberId ? 'Me' : member.name;

// Who an expense was for and who paid it, for a list row: the monogram badges
// and a line like "Me", "Karuna · paid by Me" or "Shared · paid by Karuna".
// "paid by" only shows when it isn't the person the expense was for.
({List<({String name, bool isMe})> people, String label}) expenseWho(
  Expense expense,
  List<MemberOption> members,
  String? currentMemberId,
) {
  MemberOption? find(String? id) => members.where((m) => m.id == id).firstOrNull;
  final owner = find(expense.ownerMemberId);
  final payer = find(expense.paidByMemberId);
  final forWhom = expense.ownerMemberId == null ? meFirst(members, currentMemberId) : [?owner];

  final parts = [
    if (expense.ownerMemberId == null) 'Shared' else if (owner != null) personLabel(owner, currentMemberId),
    if (payer != null && payer.id != expense.ownerMemberId) 'paid by ${personLabel(payer, currentMemberId)}',
  ];
  return (
    people: [for (final m in forWhom) (name: m.name, isMe: m.id == currentMemberId)],
    label: parts.join(' · '),
  );
}
```

- [ ] **Step 4: Rewrite the sheet and the date picker**

Replace the whole of `mobile/lib/widgets/expense_confirm_sheet.dart` with:

```dart
import 'package:flutter/material.dart';

import '../models/category_option.dart';
import '../models/expense_draft.dart';
import '../models/member_option.dart';
import '../services/bs_calendar.dart';
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
                  onChanged: (value) => setState(() => _categoryId = value!),
                ),
              ),
            ),
          ),
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
                    onTap: () => setState(() => _categoryId = category.id),
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
```

Replace the whole of `mobile/lib/widgets/bs_date_picker.dart` with:

```dart
import 'package:flutter/material.dart';

import '../services/bs_calendar.dart';
import '../theme/app_theme.dart';

const _weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Bikram Sambat counterpart of showDatePicker. Takes and returns "YYYY-MM-DD"
// AD strings — the API only ever sees AD — so BS is purely what the user sees.
Future<String?> showBsDatePicker(
  BuildContext context, {
  required BsCalendar calendar,
  required String initialAd,
  required String todayAd,
}) {
  return showDialog<String>(
    context: context,
    // Width capped so the square day cells stay phone-sized and the grid fits
    // vertically; scrollable for landscape.
    builder: (_) => Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: SingleChildScrollView(
          child: _BsDatePicker(calendar: calendar, initialAd: initialAd, todayAd: todayAd),
        ),
      ),
    ),
  );
}

class _BsDatePicker extends StatefulWidget {
  final BsCalendar calendar;
  final String initialAd;
  final String todayAd;

  const _BsDatePicker({required this.calendar, required this.initialAd, required this.todayAd});

  @override
  State<_BsDatePicker> createState() => _BsDatePickerState();
}

class _BsDatePickerState extends State<_BsDatePicker> {
  late BsDate _selected;
  late int _year;
  late int _month;

  @override
  void initState() {
    super.initState();
    _selected = widget.calendar.adToBs(widget.initialAd);
    _year = _selected.year;
    _month = _selected.month;
  }

  bool get _canGoBack => _year > widget.calendar.firstYear || _month > 1;
  bool get _canGoForward => _year < widget.calendar.lastYear || _month < 12;

  void _shiftMonth(int delta) {
    setState(() {
      final index = _year * 12 + (_month - 1) + delta;
      _year = index ~/ 12;
      _month = index % 12 + 1;
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;
    final calendar = widget.calendar;
    final today = calendar.adToBs(widget.todayAd);
    final firstAd = calendar.bsToAd(BsDate(_year, _month, 1)).split('-').map(int.parse).toList();
    // DateTime.weekday is 1 (Mon)..7 (Sun); the grid starts on Sunday.
    final leadingBlanks = DateTime.utc(firstAd[0], firstAd[1], firstAd[2]).weekday % 7;
    final dayCount = calendar.daysInMonth(_year, _month);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.rule, width: 2))),
            child: Row(
              children: [
                IconButton(
                  key: const Key('bs-prev-month'),
                  tooltip: 'Previous month',
                  onPressed: _canGoBack ? () => _shiftMonth(-1) : null,
                  icon: const Icon(Icons.chevron_left),
                ),
                Expanded(
                  child: Text('${nepaliMonths[_month - 1]} $_year', textAlign: TextAlign.center, style: text.titleMedium),
                ),
                IconButton(
                  key: const Key('bs-next-month'),
                  tooltip: 'Next month',
                  onPressed: _canGoForward ? () => _shiftMonth(1) : null,
                  icon: const Icon(Icons.chevron_right),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 7,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              for (final d in _weekdays) Center(child: Text(d.toUpperCase(), style: text.labelSmall)),
              for (var i = 0; i < leadingBlanks; i++) const SizedBox.shrink(),
              for (var day = 1; day <= dayCount; day++) _dayCell(BsDate(_year, _month, day), today),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(widget.todayAd),
                child: const Text('Today'),
              ),
              TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
            ],
          ),
        ],
      ),
    );
  }

  // Square cells: the chosen day filled with ink, today outlined in red.
  Widget _dayCell(BsDate date, BsDate today) {
    final c = context.piko;
    final isSelected = date == _selected;
    final isToday = date == today;
    return Padding(
      padding: const EdgeInsets.all(2),
      child: Material(
        color: isSelected ? c.ink : Colors.transparent,
        shape: isToday && !isSelected ? RoundedRectangleBorder(side: BorderSide(color: c.signal, width: 1.5)) : null,
        child: InkWell(
          onTap: () => Navigator.of(context).pop(widget.calendar.bsToAd(date)),
          child: Center(
            child: Text(
              '${date.day}',
              style: TextStyle(
                fontFeatures: const [FontFeature.tabularFigures()],
                color: isSelected ? c.paper : c.ink,
                fontWeight: isToday || isSelected ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 5: Run the checks**

Run:

```bash
cd mobile; flutter test; cd ..
cd mobile; flutter analyze; cd ..
```

Expected: 87 tests pass; analyze now says `No issues found!` (the old `deprecated_member_use` issues were in the file you replaced).

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/services/people.dart mobile/lib/widgets/expense_confirm_sheet.dart mobile/lib/widgets/bs_date_picker.dart mobile/test/services/people_test.dart mobile/test/widgets/expense_confirm_sheet_test.dart
git commit -m "feat(mobile): the expense sheet follows the web's Add expense dialog"
```

### Task 6: Home lists recent expenses by day

Home becomes the website's Expenses list in miniature, with the capture bar pinned at the bottom. A typed-in expense now starts as for and paid by the signed-in person (`ExpenseDraft.blank`), and the sheet gets "Me" and the quick chips. The old pastel category styles go.

**Files:**
- Create: `mobile/lib/services/expense_list.dart`
- Modify: `mobile/lib/models/expense_draft.dart`, `mobile/lib/providers/expenses_provider.dart`
- Replace: `mobile/lib/widgets/expense_list_tile.dart`, `mobile/lib/screens/home_screen.dart`
- Delete: `mobile/lib/theme/category_style.dart`, `mobile/test/theme/category_style_test.dart`
- Test: `mobile/test/services/expense_list_test.dart`, `mobile/test/models/expense_test.dart`

**Interfaces:**
- Consumes: `expenseWho` (Task 5); `MoneyText`, `Monogram`, `CategoryIcon`, `BrandMark` (Task 3); `ExpenseConfirmSheet(currentMemberId:, quickCategoryIds:)` (Task 5).
- Produces:
  - `DayGroup` (`date`, `expenses`, `complete`, and `double? total`, which is null when incomplete).
  - `groupByDay(List<Expense>, {required int limit})` → `List<DayGroup>`.
  - `dayLabel(String ad, String todayAd)` → `String`.
  - `quickCategoryIds(List<Expense> recent, List<CategoryOption> categories, {int count = 5})` → `List<String>`.
  - `ExpenseDraft.blank(CategoriesResult? options, {required String today})`.
  - `const recentExpensesLimit = 20` in `expenses_provider.dart`.
  - `ExpenseListTile({required Expense expense, required CategoryOption? category, required List<MemberOption> members, required String? currentMemberId})`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/test/services/expense_list_test.dart` with:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/category_option.dart';
import 'package:piko/models/expense.dart';
import 'package:piko/services/expense_list.dart';

void main() {
  Expense expense(String date, double amount, {String categoryId = 'cat-1'}) => Expense(
        id: '$date-$amount-$categoryId',
        amount: amount,
        categoryId: categoryId,
        ownerMemberId: null,
        paidByMemberId: 'mem-1',
        date: date,
        note: null,
      );

  group('groupByDay', () {
    test('groups consecutive expenses by date, newest first, with day totals', () {
      final groups = groupByDay(
        [expense('2026-10-14', 100), expense('2026-10-14', 50.5), expense('2026-10-12', 20)],
        limit: 20,
      );

      expect(groups.map((g) => g.date), ['2026-10-14', '2026-10-12']);
      expect(groups.first.expenses, hasLength(2));
      expect(groups.first.total, 150.5);
      expect(groups.last.total, 20);
    });

    test('leaves the total off the oldest day when the list is full, as it may be cut short', () {
      final groups = groupByDay([expense('2026-10-14', 100), expense('2026-10-13', 50)], limit: 2);

      expect(groups.first.total, 100);
      expect(groups.last.total, isNull);
      expect(groups.last.expenses, hasLength(1));
    });

    test('returns nothing for no expenses', () {
      expect(groupByDay([], limit: 20), isEmpty);
    });
  });

  group('dayLabel', () {
    test('says Today and Yesterday', () {
      expect(dayLabel('2026-10-14', '2026-10-14'), 'Today');
      expect(dayLabel('2026-10-13', '2026-10-14'), 'Yesterday');
    });

    test('gives the weekday for older days', () {
      expect(dayLabel('2026-10-11', '2026-10-14'), 'Sunday');
    });

    test('counts across a month end', () {
      expect(dayLabel('2026-09-30', '2026-10-01'), 'Yesterday');
    });
  });

  group('quickCategoryIds', () {
    final categories = [
      CategoryOption(id: 'a', name: 'A'),
      CategoryOption(id: 'b', name: 'B'),
      CategoryOption(id: 'c', name: 'C'),
      CategoryOption(id: 'd', name: 'D'),
    ];

    test('puts the most used first, a tie going to the more recent', () {
      final recent = [
        expense('2026-10-14', 1, categoryId: 'c'),
        expense('2026-10-14', 1, categoryId: 'b'),
        expense('2026-10-13', 1, categoryId: 'b'),
        expense('2026-10-12', 1, categoryId: 'a'),
      ];

      expect(quickCategoryIds(recent, categories, count: 3), ['b', 'c', 'a']);
    });

    test('fills up with the remaining categories in the server order', () {
      expect(quickCategoryIds([expense('2026-10-14', 1, categoryId: 'c')], categories), ['c', 'a', 'b', 'd']);
    });

    test('skips categories that no longer exist', () {
      expect(quickCategoryIds([expense('2026-10-14', 1, categoryId: 'gone')], categories, count: 2), ['a', 'b']);
    });
  });
}
```

In `mobile/test/models/expense_test.dart` (change 1 of 2), find:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/expense.dart';
import 'package:piko/models/expense_draft.dart';

void main() {
```

Replace it with:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/categories_result.dart';
import 'package:piko/models/category_option.dart';
import 'package:piko/models/expense.dart';
import 'package:piko/models/expense_draft.dart';
import 'package:piko/models/member_option.dart';

void main() {
```

In `mobile/test/models/expense_test.dart` (change 2 of 2), find:

```dart
    });
  });
}
```

Replace it with:

```dart
    });
  });

  group('ExpenseDraft.blank', () {
    final members = [MemberOption(id: 'mem-1', name: 'Nirjal'), MemberOption(id: 'mem-2', name: 'Karuna')];
    final categories = [CategoryOption(id: 'cat-1', name: 'Groceries')];

    test('is for and paid by the signed-in person, dated today', () {
      final draft = ExpenseDraft.blank(
        CategoriesResult(categories: categories, members: members, currentMemberId: 'mem-2'),
        today: '2026-10-14',
      );

      expect(draft.amount, 0);
      expect(draft.categoryId, 'cat-1');
      expect(draft.ownerMemberId, 'mem-2');
      expect(draft.paidByMemberId, 'mem-2');
      expect(draft.date, '2026-10-14');
      expect(draft.note, isNull);
    });

    test('is shared and paid by the first member when the server does not say who is signed in', () {
      final draft = ExpenseDraft.blank(CategoriesResult(categories: categories, members: members), today: '2026-10-14');

      expect(draft.ownerMemberId, isNull);
      expect(draft.paidByMemberId, 'mem-1');
    });

    test('still works before categories have loaded', () {
      final draft = ExpenseDraft.blank(null, today: '2026-10-14');

      expect(draft.categoryId, '');
      expect(draft.paidByMemberId, '');
    });
  });
}
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd mobile; flutter test test/services/expense_list_test.dart test/models/expense_test.dart; cd ..`

Expected: FAIL. Neither file compiles; among the errors:

```text
Error: Member not found: 'ExpenseDraft.blank'.
Error: Error when reading 'lib/services/expense_list.dart': The system cannot find the file specified
```

- [ ] **Step 3: Add the list helpers and the blank draft**

Create `mobile/lib/services/expense_list.dart` with:

```dart
import '../models/category_option.dart';
import '../models/expense.dart';

class DayGroup {
  DayGroup(this.date, this.expenses, {this.complete = true});

  // "YYYY-MM-DD" (AD), as the API sends it.
  final String date;
  final List<Expense> expenses;
  // False when the list may have cut this day short, so its total would be wrong.
  final bool complete;

  double? get total => complete ? expenses.fold<double>(0, (sum, e) => sum + e.amount) : null;
}

// Groups the recent list by day, newest first, as the website's Expenses list
// does. The API sends at most [limit] expenses, newest first, so when the list
// is full the oldest day may be missing some and is marked incomplete.
List<DayGroup> groupByDay(List<Expense> expenses, {required int limit}) {
  final groups = <DayGroup>[];
  for (final expense in expenses) {
    if (groups.isNotEmpty && groups.last.date == expense.date) {
      groups.last.expenses.add(expense);
    } else {
      groups.add(DayGroup(expense.date, [expense]));
    }
  }
  if (groups.isNotEmpty && expenses.length >= limit) {
    groups.add(DayGroup(groups.last.date, groups.removeLast().expenses, complete: false));
  }
  return groups;
}

const _weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// "Today", "Yesterday", else the weekday — the date itself sits next to it.
String dayLabel(String ad, String todayAd) {
  final day = _utcDay(ad);
  final daysAgo = _utcDay(todayAd).difference(day).inDays;
  if (daysAgo == 0) return 'Today';
  if (daysAgo == 1) return 'Yesterday';
  return _weekdays[day.weekday - 1];
}

DateTime _utcDay(String ad) {
  final parts = ad.split('-').map(int.parse).toList();
  return DateTime.utc(parts[0], parts[1], parts[2]);
}

// Up to [count] categories for the expense sheet's one-tap chips: the most
// used in the recent list (a tie goes to the more recent), then the rest in
// the server's order.
List<String> quickCategoryIds(List<Expense> recent, List<CategoryOption> categories, {int count = 5}) {
  final known = {for (final category in categories) category.id};
  final uses = <String, int>{};
  for (final expense in recent) {
    if (known.contains(expense.categoryId)) uses[expense.categoryId] = (uses[expense.categoryId] ?? 0) + 1;
  }
  // Map keys keep first-seen order, which is most recent first.
  final firstSeen = uses.keys.toList();
  final used = [...firstSeen]..sort((a, b) {
      final byUses = uses[b]!.compareTo(uses[a]!);
      return byUses != 0 ? byUses : firstSeen.indexOf(a).compareTo(firstSeen.indexOf(b));
    });
  return [...used, ...categories.map((c) => c.id).where((id) => !uses.containsKey(id))].take(count).toList();
}
```

In `mobile/lib/models/expense_draft.dart` (change 1 of 2), find:

```dart
class ExpenseDraft {
  final double amount;
```

Replace it with:

```dart
import 'categories_result.dart';

class ExpenseDraft {
  final double amount;
```

In `mobile/lib/models/expense_draft.dart` (change 2 of 2), find:

```dart
    this.note,
  });

  Map<String, dynamic> toJson() => {
```

Replace it with:

```dart
    this.note,
  });

  // A new expense typed by hand on [today]: for and paid by the signed-in
  // person, as on the website. A server too old to say who that is gives a
  // shared expense paid by the first member instead.
  factory ExpenseDraft.blank(CategoriesResult? options, {required String today}) {
    final me = options?.currentMemberId;
    return ExpenseDraft(
      amount: 0,
      categoryId: options?.categories.firstOrNull?.id ?? '',
      ownerMemberId: me,
      paidByMemberId: me ?? options?.members.firstOrNull?.id ?? '',
      date: today,
    );
  }

  Map<String, dynamic> toJson() => {
```

In `mobile/lib/providers/expenses_provider.dart`, find:

```dart
import 'api_client_provider.dart';

final recentExpensesProvider = FutureProvider.autoDispose<List<Expense>>((ref) async {
  final client = ref.watch(apiClientProvider);
  return client.fetchRecentExpenses();
});
```

Replace it with:

```dart
import 'api_client_provider.dart';

// Home shows this many of the latest expenses.
const recentExpensesLimit = 20;

final recentExpensesProvider = FutureProvider.autoDispose<List<Expense>>((ref) async {
  final client = ref.watch(apiClientProvider);
  return client.fetchRecentExpenses(limit: recentExpensesLimit);
});
```

- [ ] **Step 4: Rewrite the row and Home**

Replace the whole of `mobile/lib/widgets/expense_list_tile.dart` with:

```dart
import 'package:flutter/material.dart';

import '../models/category_option.dart';
import '../models/expense.dart';
import '../models/member_option.dart';
import '../services/people.dart';
import '../theme/app_theme.dart';
import 'category_icon.dart';
import 'money_text.dart';
import 'monogram.dart';

// One row of the recent list, like a row in the website's Expenses list: the
// category's icon and name, who it was for (and who paid) with the note, and
// the amount, over a 1px rule.
class ExpenseListTile extends StatelessWidget {
  const ExpenseListTile({
    super.key,
    required this.expense,
    required this.category,
    required this.members,
    required this.currentMemberId,
  });

  final Expense expense;
  final CategoryOption? category;
  final List<MemberOption> members;
  final String? currentMemberId;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;
    final name = category?.name ?? 'Uncategorized';
    final who = expenseWho(expense, members, currentMemberId);
    final note = expense.note?.trim() ?? '';
    // A note that only repeats the category adds nothing.
    final details = [
      if (who.label.isNotEmpty) who.label,
      if (note.isNotEmpty && note.toLowerCase() != name.toLowerCase()) note,
    ].join(' · ');

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.n300))),
      child: Row(
        children: [
          CategoryIcon(name: name, iconKey: category?.icon),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.titleMedium),
                const SizedBox(height: 4),
                Row(
                  children: [
                    if (who.people.isNotEmpty) ...[Monogram(people: who.people), const SizedBox(width: 6)],
                    Expanded(
                      child: Text(details, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.bodySmall),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          MoneyText(expense.amount, style: text.titleMedium),
        ],
      ),
    );
  }
}
```

Replace the whole of `mobile/lib/screens/home_screen.dart` with:

```dart
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
```

- [ ] **Step 5: Remove the old category styles**

Nothing uses them any more; `CategoryIcon` replaces them.

```bash
git rm mobile/lib/theme/category_style.dart mobile/test/theme/category_style_test.dart
```

- [ ] **Step 6: Run the checks**

Run:

```bash
cd mobile; flutter test; cd ..
cd mobile; flutter analyze; cd ..
```

Expected: 95 tests pass; `No issues found!`.

- [ ] **Step 7: Commit**

The `git rm` in Step 5 already staged the deletions.

```bash
git add mobile/lib/services/expense_list.dart mobile/lib/models/expense_draft.dart mobile/lib/providers/expenses_provider.dart mobile/lib/widgets/expense_list_tile.dart mobile/lib/screens/home_screen.dart mobile/test/services/expense_list_test.dart mobile/test/models/expense_test.dart
git commit -m "feat(mobile): Home lists recent expenses by day, the web's way"
```

### Task 7: Voice capture in the new design

The look changes and the behaviour doesn't. Listening, the hands-free parse after a pause, the `mounted` guards and the error messages all stay. Two small changes:

- "Type it instead" now hands back `ExpenseDraft.blank(...)`, so it starts as for and paid by the signed-in person, like Home's **Type it**.
- The one message that said "add it manually" now says "type it instead", to match the button.

**Files:**
- Replace: `mobile/lib/screens/voice_capture_screen.dart`

**Interfaces:**
- Consumes: `ExpenseDraft.blank` (Task 6); `formatAd` (existing, `services/bs_calendar.dart`); `context.piko` (Task 2).

- [ ] **Step 1: Rewrite the voice screen**

Replace the whole of `mobile/lib/screens/voice_capture_screen.dart` with:

```dart
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
    // This screen opens on launch and covers the home banner, so surface updates here too.
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
```

- [ ] **Step 2: Run the checks**

Run:

```bash
cd mobile; flutter test; cd ..
cd mobile; flutter analyze; cd ..
```

Expected: 95 tests pass; `No issues found!`.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/screens/voice_capture_screen.dart
git commit -m "feat(mobile): voice capture in the new design"
```

### Task 8: Settings with a theme choice, and the update sheet

Settings gains the Theme choice (Task 2's `themeModeProvider`) and the website's section layout. The BS / AD toggle keeps its key `date-format-toggle`. The update strip and sheet get the new look; the download and install logic is unchanged.

**Files:**
- Replace: `mobile/lib/screens/settings_screen.dart`, `mobile/lib/widgets/app_update_sheet.dart`

**Interfaces:**
- Consumes: `themeModeProvider` (Task 2); `Segmented`, `SheetFrame` (Task 3).

- [ ] **Step 1: Rewrite Settings**

Replace the whole of `mobile/lib/screens/settings_screen.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/auth_provider.dart';
import '../providers/settings_provider.dart';
import '../services/bs_calendar.dart';
import '../theme/app_theme.dart';
import '../widgets/segmented.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late final TextEditingController _urlController;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController();
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final serverUrl = ref.watch(serverUrlProvider);
    final isLoggedIn = ref.watch(authProvider).value != null;

    if (!_initialized && serverUrl.hasValue) {
      _urlController.text = serverUrl.value!;
      _initialized = true;
    }

    // The website's Settings page: sections under 20px headings, each row a
    // label and a line of description over its control.
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            const _SectionHeading('Appearance'),
            _SettingRow(
              title: 'Theme',
              description: 'Light, dark, or the same as the phone.',
              child: Segmented<ThemeMode>(
                key: const Key('theme-mode-toggle'),
                options: const [(ThemeMode.light, 'Light'), (ThemeMode.dark, 'Dark'), (ThemeMode.system, 'System')],
                value: ref.watch(themeModeProvider),
                onChanged: (mode) => ref.read(themeModeProvider.notifier).setMode(mode),
              ),
            ),
            const SizedBox(height: 36),
            const _SectionHeading('Dates'),
            _SettingRow(
              title: 'Calendar',
              description: 'How dates show on this phone. The website has its own setting.',
              child: Segmented<AppDateFormat>(
                key: const Key('date-format-toggle'),
                options: const [(AppDateFormat.nepali, 'BS (Nepali)'), (AppDateFormat.english, 'AD (English)')],
                value: ref.watch(dateFormatProvider),
                onChanged: (format) => ref.read(dateFormatProvider.notifier).setFormat(format),
              ),
            ),
            const SizedBox(height: 36),
            const _SectionHeading('Server'),
            _SettingRow(
              title: 'Server URL',
              description: 'The Piko website this app talks to.',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(controller: _urlController, keyboardType: TextInputType.url),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () async {
                      final url = _urlController.text.trim();
                      if (url.isEmpty) return;
                      await ref.read(serverUrlProvider.notifier).setUrl(url);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Server URL saved')),
                        );
                      }
                    },
                    child: const Text('Save'),
                  ),
                ],
              ),
            ),
            if (isLoggedIn) ...[
              const SizedBox(height: 36),
              const _SectionHeading('Account'),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  // Flush left with the headings, in the red used for destructive text.
                  style: TextButton.styleFrom(foregroundColor: c.signalInk, padding: EdgeInsets.zero),
                  onPressed: () async {
                    await ref.read(authProvider.notifier).logout();
                    if (context.mounted) Navigator.of(context).popUntil((route) => route.isFirst);
                  },
                  child: const Text('Log out'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// A 20px heading over a 2px rule.
class _SectionHeading extends StatelessWidget {
  const _SectionHeading(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(top: 16, bottom: 8),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: context.piko.rule, width: 2))),
      child: Text(title, style: Theme.of(context).textTheme.titleLarge),
    );
  }
}

class _SettingRow extends StatelessWidget {
  const _SettingRow({required this.title, required this.description, required this.child});

  final String title;
  final String description;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: text.titleMedium),
          const SizedBox(height: 2),
          Text(description, style: text.bodySmall),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Rewrite the update strip and sheet**

Replace the whole of `mobile/lib/widgets/app_update_sheet.dart` with:

```dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:ota_update/ota_update.dart';

import '../models/app_release.dart';
import '../theme/app_theme.dart';
import 'sheet_frame.dart';

Future<void> showAppUpdateSheet(BuildContext context, AppRelease release) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => AppUpdateSheet(release: release),
  );
}

/// Tappable strip telling the user a newer build is available.
class AppUpdateBanner extends StatelessWidget {
  const AppUpdateBanner({super.key, required this.release});

  final AppRelease release;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;

    return Material(
      color: c.surface,
      child: InkWell(
        onTap: () => showAppUpdateSheet(context, release),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 4, 4, 4),
          child: Row(
            children: [
              // The red square the website uses for anything unread.
              Container(width: 8, height: 8, color: c.signal),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Update available — v${release.versionName}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              TextButton(
                onPressed: () => showAppUpdateSheet(context, release),
                child: const Text('Update'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AppUpdateSheet extends StatefulWidget {
  const AppUpdateSheet({super.key, required this.release});

  final AppRelease release;

  @override
  State<AppUpdateSheet> createState() => _AppUpdateSheetState();
}

class _AppUpdateSheetState extends State<AppUpdateSheet> {
  StreamSubscription<OtaEvent>? _subscription;
  double? _progress;
  bool _installing = false;
  String? _error;

  bool get _busy => _progress != null && _error == null;

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  void _startUpdate() {
    setState(() {
      _progress = 0;
      _installing = false;
      _error = null;
    });

    try {
      _subscription = OtaUpdate()
          .execute(
            widget.release.apkUrl,
            destinationFilename: 'piko-${widget.release.versionName}.apk',
            sha256checksum: widget.release.sha256,
          )
          .listen(_onEvent, onError: (Object e) => _fail('Update failed: $e'));
    } catch (e) {
      _fail('Update failed: $e');
    }
  }

  void _onEvent(OtaEvent event) {
    if (!mounted) return;
    switch (event.status) {
      case OtaStatus.DOWNLOADING:
        setState(() => _progress = (double.tryParse(event.value ?? '') ?? 0) / 100);
      case OtaStatus.INSTALLING:
      case OtaStatus.INSTALLATION_DONE:
        setState(() {
          _progress = 1;
          _installing = true;
        });
      case OtaStatus.PERMISSION_NOT_GRANTED_ERROR:
        _fail('Allow Piko to install apps (Settings → Install unknown apps), then try again.');
      case OtaStatus.CHECKSUM_ERROR:
        _fail('The download was corrupted — please try again.');
      case OtaStatus.ALREADY_RUNNING_ERROR:
        _fail('An update is already downloading.');
      default:
        _fail('Update failed${event.value == null ? '' : ': ${event.value}'}');
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    setState(() => _error = message);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;
    final release = widget.release;
    final sizeMb = (release.sizeBytes / (1024 * 1024)).toStringAsFixed(1);

    return SheetFrame(
      title: 'Piko v${release.versionName}',
      footer: _busy
          // The installer is a separate system screen; if it's dismissed there's no event, so offer a way out.
          ? (_installing
              ? Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
                )
              : null)
          : Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: _startUpdate,
                    child: Text(_error == null ? 'Update now' : 'Try again'),
                  ),
                ),
                const SizedBox(width: 12),
                OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Later')),
              ],
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('UPDATE AVAILABLE · $sizeMb MB', style: text.labelSmall),
          if (release.notes != null && release.notes!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(release.notes!, style: text.bodyMedium),
          ],
          if (_busy) ...[
            const SizedBox(height: 20),
            LinearProgressIndicator(value: _installing ? null : _progress),
            const SizedBox(height: 8),
            Text(
              _installing ? 'Follow the prompt to install the update.' : 'Downloading… ${((_progress ?? 0) * 100).round()}%',
              style: text.bodySmall,
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: text.bodyMedium!.copyWith(color: c.signalInk)),
          ],
        ],
      ),
    );
  }
}
```

- [ ] **Step 3: Run the checks**

Run:

```bash
cd mobile; flutter test; cd ..
cd mobile; flutter analyze; cd ..
```

Expected: 95 tests pass; `No issues found!`.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/screens/settings_screen.dart mobile/lib/widgets/app_update_sheet.dart
git commit -m "feat(mobile): Settings with a theme choice, and the update sheet in the new design"
```

### Task 9: Drop the old theme, document the design, release 1.2.0+3

**Files:**
- Modify: `mobile/lib/theme/app_theme.dart`, `mobile/pubspec.yaml`, `mobile/README.md`, `docs/architecture.md`

- [ ] **Step 1: Check nothing reads the old theme any more**

Run: `git grep -n -E "AppColors|AppTheme\.(eyebrow|headline|wordmark|sectionHeading|subtitle)|SpaceGrotesk" -- mobile/lib mobile/test`

Expected: only lines in `mobile/lib/theme/app_theme.dart` itself. If any other file shows up, an earlier task was missed. Stop and report.

- [ ] **Step 2: Remove the old purple palette and text styles**

In `mobile/lib/theme/app_theme.dart`, find:

```dart
export 'piko_colors.dart';

// Legacy purple palette, still read by screens that haven't moved to
// `context.piko` yet. Removed once the last one has.
class AppColors {
  AppColors._();

  static const background = Color(0xFFF5F1FA);
  static const surface = Color(0xFFFFFFFF);
  static const primary = Color(0xFF5B3FA6);
  static const textPrimary = Color(0xFF1A1625);
  static const textMuted = Color(0xFF8A8398);
  static const accentLight = Color(0xFFF3E8FF);
  static const accentLightForeground = Color(0xFF7C3AED);
}

class AppTheme {
  AppTheme._();

  static const font = 'HostGrotesk';

  // Legacy text styles, removed with AppColors.
  static const eyebrow = TextStyle(fontWeight: FontWeight.w600, fontSize: 12, letterSpacing: 1.5, color: AppColors.textMuted);
  static const headline = TextStyle(fontWeight: FontWeight.w800, fontSize: 32, color: AppColors.textPrimary, height: 1.15);
  static const wordmark = TextStyle(fontWeight: FontWeight.w800, fontSize: 32, color: AppColors.textPrimary);
  static const sectionHeading = TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: AppColors.textPrimary);
  static const subtitle = TextStyle(fontSize: 15, color: AppColors.textMuted);

  static ThemeData get light => _build(PikoColors.light, Brightness.light);
```

Replace it with:

```dart
export 'piko_colors.dart';

class AppTheme {
  AppTheme._();

  static const font = 'HostGrotesk';

  static ThemeData get light => _build(PikoColors.light, Brightness.light);
```

- [ ] **Step 3: Bump the version**

In `mobile/pubspec.yaml`, find:

```yaml
# In Windows, build-name is used as the major, minor, and patch parts
# of the product and file versions while build-number is used as the build suffix.
version: 1.1.0+2

environment:
```

Replace it with:

```yaml
# In Windows, build-name is used as the major, minor, and patch parts
# of the product and file versions while build-number is used as the build suffix.
version: 1.2.0+3

environment:
```

- [ ] **Step 4: Document the design**

In `mobile/README.md`, find:

```markdown
# piko

Flutter companion app for Piko: capture expenses by voice on the go.

## Publishing an update
```

Replace it with:

```markdown
# piko

Flutter companion app for Piko: capture expenses by voice on the go.

## Design

The app follows the website's modernist design
(`docs/superpowers/specs/2026-10-07-modernist-redesign-design.md`): warm paper
and ink, one red accent, square corners, rules instead of cards, Host Grotesk.

- Colours: `lib/theme/piko_colors.dart`, a light and a dark palette copied from
  the website's `src/app/globals.css`. Read them with `context.piko`; never
  hard-code a colour in a screen.
- Type scale and Material component styles: `lib/theme/app_theme.dart`. Use the
  theme's text styles (`headlineLarge` page titles, `titleLarge` headings,
  `titleMedium` row titles, `bodySmall` meta, `labelSmall` micro-labels).
- Shared pieces in `lib/widgets/`, each the counterpart of a website component:
  `MoneyText` (Money), `Monogram`, `Segmented`, `AmountField` (AmountInput),
  `CategoryIcon`, `SheetFrame` (Modal), `LabeledField`, `BrandMark`.
- Light, Dark or System is chosen in Settings and stored on the phone; the app
  opens in Light, like the website.

## Publishing an update
```

In `docs/architecture.md`, find:

```markdown
  pots, paybacks, dhukus, recurring bills, reports, notifications.
- **Mobile app** (`mobile/`) — Flutter companion for capturing expenses by voice.
  Talks to the same Next.js backend over a small JSON API. See `mobile/README.md`.

Domain conventions that shape everything:
```

Replace it with:

```markdown
  pots, paybacks, dhukus, recurring bills, reports, notifications.
- **Mobile app** (`mobile/`) — Flutter companion for capturing expenses by voice.
  Talks to the same Next.js backend over a small JSON API. Its look follows the
  web's modernist design (palette in `mobile/lib/theme/piko_colors.dart`). See
  `mobile/README.md`.

Domain conventions that shape everything:
```

- [ ] **Step 5: Run the checks and build the APK**

Run:

```bash
cd mobile; flutter test; cd ..
cd mobile; flutter analyze; cd ..
cd mobile; flutter build apk --release --split-per-abi; cd ..
```

Expected: 95 tests pass; `No issues found!`. The build takes about 4–5 minutes and ends with three `√ Built build\app\outputs\flutter-apk\app-…-release.apk` lines, including `app-arm64-v8a-release.apk` (about 18 MB). The Gradle warnings about "Built-in Kotlin" and "SDK XML version" were there before and are fine. Don't commit anything under `mobile/build/`; it's ignored.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/theme/app_theme.dart mobile/pubspec.yaml mobile/README.md docs/architecture.md
git commit -m "chore(mobile): drop the old purple theme; document the design; release 1.2.0+3"
```

- [ ] **Step 7: Refresh the knowledge graph**

If the `graphify` command exists, run `graphify update .` from the repo root. It only changes `graphify-out/`, which is ignored; don't commit anything from it. If the command isn't found, skip this step and say so in your report.

### Final checkpoint: STOP

Stop here and send the owner a report with:

- The branch name (`feat/mobile-revamp`) and the nine commit hashes and subjects (`git log --oneline main..HEAD`).
- The last `flutter test` result line, the `flutter analyze` result, and the APK path from Step 5 of Task 9.
- Every place where a "find" block didn't match exactly and how you resolved it, and anything else you did that this plan didn't say.

Then the owner:

1. Reviews the branch and merges it to `main`. The push deploys the website change (`currentMemberId`) on Vercel. The app works without it, but shows names instead of "Me" until it's live.
2. Installs `mobile/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk` on a phone and checks each screen in Light and Dark, using the "worth a reviewer's eye" list in Review Focus.
3. Publishes it on the website under **Settings → App updates** as version `1.2.0`, build `3` (see `mobile/README.md`).
