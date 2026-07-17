import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";

async function readAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function waitForAccessToken(timeoutMs = 1200): Promise<string | null> {
  let subscription: { unsubscribe: () => void } | undefined;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      subscription?.unsubscribe();
      resolve(token);
    };

    const timer = window.setTimeout(() => {
      void readAccessToken().then(finish).catch(() => finish(null));
    }, timeoutMs);

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) finish(session.access_token);
    });
    subscription = data.subscription;
  });
}

export const attachReadySupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = (await readAccessToken()) ?? (await waitForAccessToken());

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);