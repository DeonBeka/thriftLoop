import type { TextInputInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { colors, font, radius, spacing } from '@/constants/theme';
import { authApi } from '@/services/api';

type Field = 'username' | 'email' | 'password' | 'confirm';

export default function Register() {
  const router = useRouter();
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next: Partial<Record<Field, string>> = {};
    if (!/^[a-zA-Z0-9._]{3,30}$/.test(username.trim()))
      next.username = '3–30 characters: letters, numbers, dots or underscores.';
    if (!/^[^\s@]+@gmail\.com$/i.test(email.trim())) next.email = 'Enter a valid Gmail address (…@gmail.com).';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    if (confirm !== password) next.confirm = "Passwords don't match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setServerError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.register({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirm_password: confirm,
      });
      router.push({
        pathname: '/verify',
        params: { email: res.email, cooldown: String(res.resend_available_in_seconds) },
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const clear = (field: Field) => errors[field] && setErrors((e) => ({ ...e, [field]: undefined }));

  return (
    <AuthScreen
      title="Create account"
      subtitle="Join ThriftLoop to buy and sell pre-loved clothing. We'll email you a code to verify your Gmail."
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Button title="Sign in" variant="ghost" size="md" onPress={() => router.replace('/login')} />
        </View>
      }
    >
      <TextField
        label="Username"
        placeholder="e.g. maya.vintage"
        value={username}
        onChangeText={(t) => {
          setUsername(t);
          clear('username');
        }}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
        error={errors.username}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
        label="Gmail address"
        placeholder="you@gmail.com"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          clear('email');
        }}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={errors.email}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        placeholder="At least 8 characters"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          clear('password');
        }}
        secureToggle
        textContentType="newPassword"
        autoComplete="new-password"
        error={errors.password}
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <TextField
        ref={confirmRef}
        label="Confirm password"
        placeholder="Type it again"
        value={confirm}
        onChangeText={(t) => {
          setConfirm(t);
          clear('confirm');
        }}
        secureToggle
        textContentType="newPassword"
        error={errors.confirm}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {serverError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{serverError}</Text>
        </View>
      )}
      <Button title="Continue" onPress={submit} loading={loading} style={{ marginTop: spacing.sm }} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', gap: 2 },
  footerText: { color: colors.textSecondary, fontSize: font.size.md },
  errorBox: { backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radius.md },
  errorText: { color: colors.danger, fontSize: font.size.sm, fontWeight: font.weight.medium },
});
