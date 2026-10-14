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
