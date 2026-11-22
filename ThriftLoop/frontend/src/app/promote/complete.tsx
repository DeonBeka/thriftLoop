import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

import { FormSkeleton } from '@/components/skeletons';

// Web: the Stripe page opens in a popup that lands here; this hands the result back to the app window.
WebBrowser.maybeCompleteAuthSession();

/** Return address after paying for a boost. In the app the in-app browser closes itself on this URL. */
export default function PromoteComplete() {
  const router = useRouter();
  const { status } = useLocalSearchParams<{ status?: string }>();
  useEffect(() => {
    const t = setTimeout(() => router.replace(status === 'active' ? '/' : '/profile'), 500);
    return () => clearTimeout(t);
  }, [router, status]);
  return <FormSkeleton />;
}
