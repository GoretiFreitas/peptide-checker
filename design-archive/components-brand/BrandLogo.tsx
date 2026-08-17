interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "hero";
  showText?: boolean;
  className?: string;
}

export function BrandLogo({ size = "md", showText = true, className = "" }: BrandLogoProps) {
  const iconSizes = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-12 w-12",
    hero: "h-16 w-16 sm:h-20 sm:w-20",
  };

  const textSizes = {
    sm: "text-base",
    md: "text-lg sm:text-xl",
    lg: "text-2xl",
    hero: "text-3xl sm:text-4xl",
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Brand Icon: 3D Vial Artwork in Frosted Gold Trim Badge */}
      <div
        className={`relative shrink-0 overflow-hidden rounded-xl border border-[rgba(200,165,125,0.35)] bg-white/90 p-1 shadow-[0_4px_16px_-4px_rgba(50,40,30,0.08)] ${iconSizes[size]} transition-transform duration-200 hover:scale-105`}
      >
        {/* Square icon crop of the brand mark. The full lockup
            (/brand/logo.webp) already contains the wordmark, so using it here
            would squeeze the words into the badge and duplicate the text
            rendered alongside it. */}
        <img
          src="/brand/mark.webp"
          alt={showText ? "" : "PeptidesCheck"}
          width={512}
          height={512}
          decoding="async"
          className="h-full w-full object-contain"
        />
      </div>

      {showText && (
        <div className={`flex items-baseline font-sans leading-none ${textSizes[size]}`}>
          <span className="font-bold tracking-tight text-foreground">peptides</span>
          <span className="ml-1 font-light tracking-wide text-[#B88B60]">check</span>
          <span className="ml-0.5 text-[#C59B6D] font-bold">.</span>
        </div>
      )}
    </div>
  );
}
