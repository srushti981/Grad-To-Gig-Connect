import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Session-awareness for public pages. Runs client-side only so SSR never
 * tries to read localStorage or attach tokens.
 */
export function useSession() {
  const [state, setState] = React.useState<{ loading: boolean; signedIn: boolean }>({
    loading: true,
    signedIn: false,
  });

  React.useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ loading: false, signedIn: !!data.session });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ loading: false, signedIn: !!session });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
