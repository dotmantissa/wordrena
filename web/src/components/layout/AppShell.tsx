"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CircleUserRound,
  FlaskConical,
  Gavel,
  Home,
  Library,
  Menu,
  Swords,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { AuthButton } from "@/components/auth/AuthButton";
import { useWordrenaAuth } from "@/components/auth/AuthProvider";
import { Logo } from "@/components/brand/Logo";
import { shortAddress } from "@/lib/format";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/forge", label: "Forge", icon: FlaskConical },
  { href: "/bestiary", label: "Bestiary", icon: Library },
  { href: "/arena", label: "Arena", icon: Swords },
  { href: "/tribunal", label: "Tribunal", icon: Gavel },
  { href: "/how-to-play", label: "How to play", icon: BookOpen },
  { href: "/roster", label: "My roster", icon: CircleUserRound },
];

function NavLink({
  href,
  label,
  icon: Icon,
  onClick,
}: (typeof links)[number] & { onClick?: () => void }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      onClick={onClick}
      className={clsx(
        "ring-focus flex min-h-10 items-center gap-2 border-b-2 px-2 text-sm font-semibold",
        active
          ? "border-gold text-gold"
          : "border-transparent text-ink-soft hover:border-line-strong hover:text-ink"
      )}
    >
      <Icon className="size-4" strokeWidth={active ? 2.4 : 1.8} />
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useWordrenaAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-50 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex min-h-[76px] max-w-[1280px] items-center gap-5 px-4 sm:px-6">
          <Link href="/" className="ring-focus shrink-0">
            <Logo animated markClass="size-10" textClass="text-xl" />
          </Link>

          <div className="hidden border-l border-line pl-5 text-xs leading-5 text-ink-faint lg:block">
            <span className="block font-semibold text-ink">Creature league</span>
            <span>Field notes from StudioNet</span>
          </div>

          <nav className="ml-3 hidden flex-1 items-center justify-center gap-5 xl:flex">
            {links.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Link
                href="/roster"
                className="hidden border border-line bg-surface px-3 py-2 font-mono text-[11px] text-ink-soft hover:border-line-strong hover:text-ink sm:block"
              >
                {shortAddress(user.wallet)}
              </Link>
            ) : null}
            <div className="hidden sm:block">
              <AuthButton compact />
            </div>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="ring-focus grid size-10 place-items-center border border-line text-ink-soft hover:bg-surface-2 hover:text-ink xl:hidden"
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open ? (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-line bg-surface xl:hidden"
            >
              <div className="mx-auto grid max-w-[1280px] gap-1 px-4 py-4 sm:grid-cols-2 sm:px-6">
                {links.map((item) => (
                  <NavLink
                    key={item.href}
                    {...item}
                    onClick={() => setOpen(false)}
                  />
                ))}
                <div className="pt-2 sm:hidden">
                  <AuthButton />
                </div>
              </div>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </header>

      <motion.div
        key={pathname}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        {children}
      </motion.div>

      <footer className="border-t border-line px-4 py-10 text-center text-xs text-ink-faint">
        Wordrena keeps the field notes public. Creatures, moves, fights, and
        appeals come from GenLayer StudioNet.
      </footer>
    </div>
  );
}
