import Image from "next/image";

type BrandLogoMarkProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogoMark({
  className = "h-auto max-h-[3.2rem] w-auto object-contain drop-shadow-[0_0_12px_rgba(22,119,255,0.22)]",
  priority = false,
}: BrandLogoMarkProps) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={className}
      height={51}
      priority={priority}
      src="/parable-logo-mark.png"
      style={{ width: "auto", height: "auto" }}
      unoptimized
      width={42}
    />
  );
}
