export function SupporterBadge({
  variant,
}: {
  variant: "supporter" | "registry_member" | "admin";
}) {
  const label =
    variant === "supporter" ? "Supporter" : variant === "registry_member" ? "Registry" : "Admin";
  const styles: Record<typeof variant, string> = {
    supporter: "bg-[#E7F1EA] text-[#1E5637] border-[#1E5637]/30 shadow-2xs",
    registry_member: "bg-[#EDEBE3] text-[#4A4842] border-[#4A4842]/30 shadow-2xs",
    admin: "bg-[#F7E4E1] text-[#7C271E] border-[#7C271E]/30 shadow-2xs",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-bold tracking-[0.18em] uppercase ${styles[variant]}`}
    >
      {label}
    </span>
  );
}
