"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import type { SessionUser } from "@/lib/session";

type AuthContextValue = {
  ready: boolean;
  authenticated: boolean;
  syncing: boolean;
  user: SessionUser | null;
  login: () => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function SessionBridge({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: React.ReactNode;
}) {
  const {
    ready: privyReady,
    authenticated: privyAuthenticated,
    login,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();
  const [user, setUser] = useState(initialUser);
  const [syncing, setSyncing] = useState(false);

  const refreshSession = useCallback(async () => {
    if (!privyAuthenticated) {
      setUser(null);
      return;
    }
    setSyncing(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Privy did not return an access token");
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await response.json()) as {
        user?: SessionUser;
        error?: string;
      };
      if (!response.ok || !data.user) {
        throw new Error(data.error || "Could not start a Wordrena session");
      }
      setUser(data.user);
    } finally {
      setSyncing(false);
    }
  }, [getAccessToken, privyAuthenticated]);

  useEffect(() => {
    if (!privyReady) return;
    if (privyAuthenticated && !user) {
      void refreshSession();
    }
    if (!privyAuthenticated && user) {
      void fetch("/api/auth/session", { method: "DELETE" }).finally(() =>
        setUser(null)
      );
    }
  }, [privyAuthenticated, privyReady, refreshSession, user]);

  const logout = useCallback(async () => {
    setSyncing(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await privyLogout();
      setUser(null);
    } finally {
      setSyncing(false);
    }
  }, [privyLogout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready: privyReady,
      authenticated: Boolean(user),
      syncing,
      user,
      login,
      logout,
      refreshSession,
    }),
    [login, logout, privyReady, refreshSession, syncing, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: React.ReactNode;
}) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not configured");

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email"],
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
          showWalletUIs: false,
        },
        appearance: {
          theme: "dark",
          accentColor: "#ffb638",
        },
      }}
    >
      <SessionBridge initialUser={initialUser}>{children}</SessionBridge>
    </PrivyProvider>
  );
}

export function useWordrenaAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useWordrenaAuth must be used inside AuthProvider");
  }
  return value;
}
