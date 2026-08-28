import type { Metadata } from "next";
import { ForgeWorkbench } from "@/components/forge/ForgeWorkbench";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Forge",
  description: "Craft a creature and write its moves in plain English.",
};

export default function ForgePage() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:py-14">
      <header className="max-w-2xl">
        <Badge className="border-gold/30 text-gold">The forge</Badge>
        <h1 className="mt-4 font-display text-4xl font-bold text-parch sm:text-5xl">
          Make something worth fighting
        </h1>
        <p className="mt-4 text-base leading-7 text-ink-soft">
          Pick an element, give the creature a name, then write what its moves
          should do. The validators handle the numbers. You handle the nerve.
        </p>
      </header>
      <div className="mt-10">
        <ForgeWorkbench />
      </div>
    </main>
  );
}
