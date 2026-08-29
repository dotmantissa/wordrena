import clsx from "clsx";
import { CloudRain, Sun, Wind } from "lucide-react";
import { asElement, elementSoftTone, elementTone } from "./elements";

function WeatherMark({
  conditions,
  hazard,
}: {
  conditions: string;
  hazard: number;
}) {
  const lower = conditions.toLowerCase();
  const Icon = lower.includes("wind")
    ? Wind
    : lower.includes("rain") || lower.includes("snow")
      ? CloudRain
      : Sun;
  return (
    <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-md border border-white/15 bg-void/70 px-3 py-2 text-xs text-parch backdrop-blur">
      <Icon className="size-4" aria-hidden />
      <span>Hazard {hazard}</span>
    </div>
  );
}

export function BiomeScene({
  name,
  homeElement,
  conditions,
  buffPct,
  hazard,
  source,
  className,
  children,
}: {
  name: string;
  homeElement: string;
  conditions: string;
  buffPct: number;
  hazard: number;
  source: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const element = asElement(homeElement);
  const tone = elementTone[element];
  const soft = elementSoftTone[element];

  return (
    <section
      className={clsx(
        "field-frame relative isolate min-h-72 overflow-hidden",
        className
      )}
      style={{ color: tone }}
    >
      <svg
        viewBox="0 0 1000 420"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <rect width="1000" height="420" fill="#30463c" />
        <path d="M0 315 150 180l140 104 150-175 142 156 126-121 162 151 130-98v223H0Z" fill={tone} opacity=".2" />
        <path d="M0 340 170 250l125 78 168-132 142 130 164-87 231 101v80H0Z" fill={soft} opacity=".16" />
        <path d="M0 337c180-35 318-21 463 13 151 36 316 42 537-3v73H0Z" fill="#27352f" />
        <g stroke="#fffaf0" opacity=".13">
          {Array.from({ length: 13 }).map((_, index) => (
            <path key={index} d={`M${index * 84} 420 500 255`} />
          ))}
          {Array.from({ length: 5 }).map((_, index) => (
            <path key={index} d={`M0 ${337 + index * 20}h1000`} />
          ))}
        </g>
        {hazard > 1
          ? Array.from({ length: Math.min(14, hazard * 3) }).map((_, index) => (
              <path
                key={index}
                d={`M${65 + index * 73} ${35 + (index % 4) * 34}l-28 46`}
                stroke={soft}
                strokeWidth="3"
                opacity=".32"
              />
            ))
          : null}
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-void/25" />
      <div className="absolute left-4 top-4 z-10 max-w-[65%]">
        <p className="font-mono text-[11px] uppercase" style={{ color: soft }}>
          {homeElement} habitat · {buffPct}% lift
        </p>
        <h2 className="mt-1 font-display text-xl font-bold text-parch">{name}</h2>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-soft">
          {conditions}
        </p>
        <p className="mt-1 font-mono text-[10px] uppercase text-ink-faint">
          {source === "open-meteo" ? "Live sky reading" : "StudioNet baseline"}
        </p>
      </div>
      <WeatherMark conditions={conditions} hazard={hazard} />
      <div className="absolute inset-x-0 bottom-3 z-10">{children}</div>
    </section>
  );
}
