import Image from "next/image";

export function Logo({
  variant = "dark",
  size = "md",
  className = "",
}: {
  variant?: "dark" | "light";
  size?: "md" | "lg";
  className?: string;
}) {
  const text = variant === "light" ? "text-white" : "text-navy";
  const isLg = size === "lg";
  return (
    <div className={`flex items-center ${isLg ? "gap-3" : "gap-2.5"} ${className}`}>
      <Image
        src="https://evolutecomsolutions.com/logo_1.png"
        alt="Evolut Ecommerce Solutions"
        width={isLg ? 48 : 36}
        height={isLg ? 48 : 36}
        className={`${isLg ? "h-12 w-12" : "h-9 w-9"} rounded-lg object-contain`}
        unoptimized
      />
      <div className="leading-tight">
        <div className={`${isLg ? "text-lg" : "text-sm"} font-bold tracking-tight ${text}`}>Evolut</div>
        <div
          className={`${isLg ? "text-xs" : "text-[10px]"} font-medium uppercase tracking-[0.18em] ${
            variant === "light" ? "text-white/60" : "text-slate-400"
          }`}
        >
          Attendance
        </div>
      </div>
    </div>
  );
}
