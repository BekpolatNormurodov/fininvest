import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:iconsax/iconsax.dart';

import '../../../core/widgets/app_logo.dart';
import '../../../core/widgets/server_dialog.dart';
import 'cubit/auth_cubit.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _loginController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _loginController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    context.read<AuthCubit>().login(_loginController.text, _passwordController.text);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            Align(
              alignment: Alignment.topRight,
              child: IconButton(
                tooltip: 'Server manzili',
                icon: const Icon(Iconsax.setting_2, size: 20),
                onPressed: () => showServerDialog(context),
              ),
            ),
            _form(context),
          ],
        ),
      ),
    );
  }

  Widget _form(BuildContext context) {
    return Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 24),
                    const AppLogo(size: 76),
                    const SizedBox(height: 8),
                    Text(
                      'Undiruvchi kabinetiga kirish',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.outline,
                          ),
                    ),
                    const SizedBox(height: 36),
                    TextFormField(
                      controller: _loginController,
                      textInputAction: TextInputAction.next,
                      autocorrect: false,
                      decoration: const InputDecoration(
                        labelText: 'Login',
                        prefixIcon: Icon(Iconsax.user, size: 20),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Loginni kiriting' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: 'Parol',
                        prefixIcon: const Icon(Iconsax.lock, size: 20),
                        suffixIcon: IconButton(
                          icon: Icon(_obscure ? Iconsax.eye_slash : Iconsax.eye, size: 20),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (v) => (v == null || v.isEmpty) ? 'Parolni kiriting' : null,
                    ),
                    const SizedBox(height: 24),
                    BlocConsumer<AuthCubit, AuthState>(
                      listenWhen: (prev, cur) => prev.error != cur.error && cur.error != null,
                      listener: (context, state) {
                        ScaffoldMessenger.of(context)
                          ..hideCurrentSnackBar()
                          ..showSnackBar(SnackBar(content: Text(state.error!)));
                      },
                      builder: (context, state) {
                        return FilledButton(
                          onPressed: state.submitting ? null : _submit,
                          child: state.submitting
                              ? const SizedBox(
                                  width: 22, height: 22,
                                  child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                                )
                              : const Text('Kirish'),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
  }
}
