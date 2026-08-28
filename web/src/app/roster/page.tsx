import type { Metadata } from "next";
import { RosterDashboard } from "@/components/roster/RosterDashboard";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "My roster",
  description: "Manage your creatures, moves, levels, wallet, and relayed actions.",
};

export default function RosterPage() {
  return (
    <main className="mx-auto max-w-[1380px] px-4 py-10 sm:px-6 lg:py-14">
      <header className="max-w-3xl">
        <Badge className="border-gale/30 text-gale">Trainer account</Badge>
        <h1 className="mt-4 font-display text-4xl font-bold text-parch sm:text-5xl">
          My roster
        </h1>
        <p className="mt-4 text-base leading-7 text-ink-soft">
          Your creatures, their active kits, experience, and every transaction
          Wordrena has relayed for you. No wallet ceremony required.
        </p>
      </header>
      <div className="mt-10">
        <RosterDashboard />
      </div>
    </main>
  );
}
