import { messagesApi } from '@/services/api';

import { useApi } from './useApi';

/** Total unread messages across conversations; refreshes whenever the screen regains focus. */
export function useUnreadCount(): number {
  const { data } = useApi(() => messagesApi.conversations(), [], { refetchOnFocus: true });
  return (data ?? []).reduce((sum, c) => sum + c.unread_count, 0);
}
