function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const variants = {
  default:
    "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:shadow-[0_0_28px_rgba(139,92,246,0.5)]",
  outline:
    "border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:border-white/20",
  ghost:
    "text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]",
  danger:
    "border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40",
};

export function Button({ className = "", variant = "default", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:pointer-events-none disabled:opacity-40",
        variants[variant] ?? variants.default,
        className,
      )}
      {...props}
    />
  );
}
