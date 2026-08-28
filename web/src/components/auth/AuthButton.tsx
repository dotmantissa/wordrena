"use client";

import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useWordrenaAuth } from "./AuthProvider";

export function AuthButton({ compact = false }: { compact?: boolean }) {
  const { ready, authenticated, syncing, user, login, logout } =
    useWordrenaAuth();

  if (!ready || syncing) {
    return (
      <Button variant="secondary" disabled aria-label="Checking your session">
        <Spinner />
        {compact ? null : "Checking the gate"}
      </Button>
    );
  }

  if (authenticated && user) {
    return (
      <Button
        variant="quiet"
        onClick={() => void logout()}
        title={`Signed in as ${user.email}`}
      >
        <LogOut className="size-4" />
        {compact ? null : "Sign out"}
      </Button>
    );
  }

  return (
    <Button onClick={login}>
      <LogIn className="size-4" />
      Sign in with email
    </Button>
  );
}
