function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className = "", glow = false, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-xl",
        glow && "border-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.08)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({ className = "", ...props }) {
  return <div className={cn("p-5", className)} {...props} />;
}
