import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { AuthScreen } from '@/components/auth/AuthScreen';
import { OtpInput } from '@/components/auth/OtpInput';
import { Button } from '@/components/ui/Button';
import { colors, font, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, authApi } from '@/services/api';
import { haptic } from '@/utils/haptics';

type Feedback = { tone: 'error' | 'info' | 'success'; text: string } | null;

export default function Verify() {
  const params = useLocalSearchParams<{ email: string; cooldown?: string; resend?: string }>();
  const email = String(params.email ?? '');
  const { completeVerification } = useAuth();

  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(Number(params.cooldown ?? 60) || 0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const autoResent = useRef(false);

  // Countdown for the resend button.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const resend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setFeedback(null);
    try {
      const res = await authApi.resendCode(email);
      setCooldown(res.resend_available_in_seconds || 60);
      setCode('');
      setFeedback({ tone: 'info', text: `New code sent to ${email}.` });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const match = err.message.match(/(\d+) seconds/);
        if (match) setCooldown(Number(match[1]));
      }
      setFeedback({ tone: 'error', text: err instanceof Error ? err.message : "Couldn't resend the code." });
    } finally {
      setResending(false);
    }
  };

  // Coming from login with an unverified account → send a fresh code automatically.
  useEffect(() => {
    if (params.resend === '1' && !autoResent.current) {
      autoResent.current = true;
      setCooldown(0);
      setTimeout(() => void resend(), 0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = async (value = code) => {
    if (value.length !== 6 || verifying) return;
    setVerifying(true);
    setFeedback(null);
    try {
      await completeVerification(email, value);
      void haptic.success();
      setVerified(true);
      // AuthLayout redirects to Home once the user is set; show a brief success state meanwhile.
    } catch (err) {
      void haptic.error();
      setShakeKey((k) => k + 1);
      setCode('');
      setFeedback({ tone: 'error', text: err instanceof Error ? err.message : 'Verification failed.' });
    } finally {
      setVerifying(false);
    }
  };

  if (verified) {
    return (
      <View style={styles.success}>
        <Animated.View entering={ZoomIn.springify()} style={styles.successIcon}>
          <Ionicons name="checkmark" size={44} color={colors.white} />
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(150)} style={styles.successText}>
          Email verified
        </Animated.Text>
      </View>
    );
  }

  return (
    <AuthScreen
      title="Check your inbox"
      subtitle={
        <>
          Enter the 6-digit code we sent to <Text style={styles.email}>{email}</Text>. It expires in 5 minutes.
        </>
      }
    >
      <OtpInput
        value={code}
        onChange={(v) => {
          setCode(v);
          if (feedback?.tone === 'error') setFeedback(null);
          if (v.length === 6) void verify(v);
        }}
        error={feedback?.tone === 'error'}
        shakeKey={shakeKey}
        disabled={verifying}
      />

      {feedback && (
        <View style={[styles.feedback, feedback.tone === 'error' ? styles.feedbackError : styles.feedbackInfo]}>
          <Ionicons
            name={feedback.tone === 'error' ? 'alert-circle' : 'mail-unread-outline'}
            size={18}
            color={feedback.tone === 'error' ? colors.danger : colors.primary}
          />
          <Text style={[styles.feedbackText, { color: feedback.tone === 'error' ? colors.danger : colors.primary }]}>
            {feedback.text}
          </Text>
        </View>
      )}

      <Button title="Verify email" onPress={() => verify()} loading={verifying} disabled={code.length !== 6} />

      <View style={styles.resendRow}>
        <Text style={styles.resendText}>Didn't get it? Check spam, or</Text>
        <Pressable onPress={resend} disabled={cooldown > 0 || resending} hitSlop={8}>
          <Text style={[styles.resendLink, (cooldown > 0 || resending) && styles.resendDisabled]}>
            {resending ? 'sending…' : cooldown > 0 ? `resend in ${cooldown}s` : 'resend code'}
          </Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  email: { color: colors.text, fontWeight: font.weight.semibold },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  feedbackError: { backgroundColor: colors.dangerSoft },
  feedbackInfo: { backgroundColor: colors.secondary },
  feedbackText: { flex: 1, fontSize: font.size.sm, fontWeight: font.weight.medium },
  resendRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 4 },
  resendText: { color: colors.textSecondary, fontSize: font.size.sm },
  resendLink: { color: colors.primary, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  resendDisabled: { color: colors.textSecondary },
  success: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, backgroundColor: colors.background },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text },
});
