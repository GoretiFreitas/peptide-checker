export function SupporterBadge({
  variant,
}: {
  variant: "supporter" | "registry_member" | "admin";
}) {
  const label =
    variant === "supporter" ? "Supporter" : variant === "registry_member" ? "Registry" : "Admin";
  const styles: Record<typeof variant, string> = {
    supporter: "bg-[#E7F1EA] text-[#1E5637] border-[#1E5637]/20",
    registry_member: "bg-[#EDEBE3] text-[#4A4842] border-[#4A4842]/20",
    admin: "bg-[#F7E4E1] text-[#7C271E] border-[#7C271E]/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[9px] font-medium tracking-[0.18em] uppercase ${styles[variant]}`}
    >
      {label}
    </span>
  );
}
