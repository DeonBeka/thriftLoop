import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * React Native's Alert.alert does nothing in the browser, so every "Are you sure?" dialog was silently
 * skipped on web. On web only, show them with the browser's own dialogs. iOS keeps the native alerts.
 */
export function installWebAlert(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
    const cancel = (buttons ?? []).find((b) => b.style === 'cancel');
    if (actions.length <= 1 && !cancel) {
      window.alert(text);
      actions[0]?.onPress?.();
      return;
    }
    if (actions.length === 1) {
      if (window.confirm(text)) actions[0].onPress?.();
      else cancel?.onPress?.();
      return;
    }
    // Several choices: number them in a prompt.
    const list = actions.map((b, i) => `${i + 1}. ${b.text}`).join('\n');
    const answer = window.prompt(`${text}\n\n${list}\n\nType a number:`);
    const picked = actions[Number(answer) - 1];
    if (picked) picked.onPress?.();
    else cancel?.onPress?.();
  };
}
