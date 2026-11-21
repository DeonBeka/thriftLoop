import type { TextInputInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { colors, font, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/api';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const passwordRef = useRef<TextInputInstance>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      // The (auth) layout redirects to Home once the user is set.
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // Account exists but email isn't verified yet → finish verification.
        router.push({ pathname: '/verify', params: { email: email.trim().toLowerCase(), resend: '1' } });
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to keep buying and selling."
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>New to ThriftLoop?</Text>
          <Button title="Create an account" variant="ghost" size="md" onPress={() => router.replace('/register')} />
        </View>
      }
    >
      <TextField
        label="Email"
        placeholder="you@gmail.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        placeholder="Your password"
        value={password}
        onChangeText={setPassword}
        secureToggle
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Button title="Sign in" onPress={submit} loading={loading} style={{ marginTop: spacing.sm }} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', gap: 2 },
  footerText: { color: colors.textSecondary, fontSize: font.size.md },
  errorBox: { backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radius.md },
  errorText: { color: colors.danger, fontSize: font.size.sm, fontWeight: font.weight.medium },
});
