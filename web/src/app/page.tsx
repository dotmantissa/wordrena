import { AuthButton } from "@/components/auth/AuthButton";
import { Logo } from "@/components/brand/Logo";

export default function Home() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6">
      <div className="arena-grid pointer-events-none absolute inset-0" />
      <section className="relative max-w-xl text-center">
        <p className="font-mono text-xs uppercase text-gold">StudioNet is listening</p>
        <h1 className="mt-5">
          <Logo
            animated
            className="justify-center"
            markClass="size-16 sm:size-20"
            textClass="text-5xl sm:text-7xl"
          />
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-ink-soft">
          The gates are opening. Try not to teach your first creature anything
          embarrassing.
        </p>
        <div className="mt-7 flex justify-center">
          <AuthButton />
        </div>
      </section>
    </main>
  );
}
