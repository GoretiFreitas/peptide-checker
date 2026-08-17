import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-[rgba(212,175,135,0.25)] bg-[oklch(0.975_0.012_75/0.8)] backdrop-blur-md">
      <div className="mx-auto max-w-[1400px] px-6 py-12 md:px-10 md:py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link to="/" className="inline-block">
              <BrandLogo size="md" />
            </Link>
            <p className="mt-4 max-w-[32ch] text-xs leading-relaxed text-muted-foreground">
              Independent and community-supported. Certificate review and authenticity, plus a
              community fund that funds independent laboratory testing.
            </p>
          </div>

          <div>
            <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-foreground/70">
              Documentation
            </div>
            <ul className="mt-3.5 space-y-2.5 text-sm">
              <li>
                <Link
                  to="/"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Certificate checker
                </Link>
              </li>
              <li>
                <Link
                  to="/verify"
                  search={{}}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Verify a batch
                </Link>
              </li>
              <li>
                <Link
                  to="/fund"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Community testing fund
                </Link>
              </li>
              <li>
                <Link
                  to="/support"
                  search={{}}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Support the work
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-foreground/70">
              Community
            </div>
            <ul className="mt-3.5 space-y-2.5 text-sm">
              <li>
                <a
                  href="https://www.reddit.com/r/DecentralizedSciences"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reddit
                </a>
              </li>
              <li>
                <a
                  href="https://x.com/desciers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  X, at desciers
                </a>
              </li>
              <li>
                <a
                  href="mailto:peptides@descier.science"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Email
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-foreground/70">
              Contact
            </div>
            <ul className="mt-3.5 space-y-2.5 text-sm">
              <li>
                <a
                  href="mailto:peptides@descier.science"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  peptides@descier.science
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-[rgba(212,175,135,0.2)] pt-6">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Disclaimer.</span> All results, analyses,
            and certificates shown on this site are provided for molecular-biology-grade research
            use only. Nothing here is a medical claim, a statement of safety for human or animal
            consumption, or an approval by any regulator. Not for diagnostic or therapeutic use.
          </p>
          <p className="mt-4 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
            PeptidesCheck, by Descier Science. Copyright 2026.
          </p>
        </div>
      </div>
    </footer>
  );
}
