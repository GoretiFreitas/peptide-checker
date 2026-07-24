import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1400px] px-6 py-10 md:px-10 md:py-14">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="font-serif text-xl tracking-tight text-foreground">
              PeptidesCheck<span className="text-muted-foreground">.</span>
            </div>
            <p className="mt-3 max-w-[32ch] text-xs leading-relaxed text-muted-foreground">
              Independent and community-supported. Certificate review and authenticity, plus a community board that funds independent laboratory testing.
            </p>
          </div>

          <div>
            <div className="text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
              Documentation
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/" className="text-foreground hover:text-muted-foreground">
                  Certificate checker
                </Link>
              </li>
              <li>
                <Link to="/verify" search={{}} className="text-foreground hover:text-muted-foreground">
                  Verify a batch
                </Link>
              </li>
              <li>
                <Link to="/board" className="text-foreground hover:text-muted-foreground">
                  Community testing board
                </Link>
              </li>
              <li>
                <Link to="/support" search={{}} className="text-foreground hover:text-muted-foreground">
                  Support the work
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
              Community
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href="https://www.reddit.com/r/DecentralizedSciences"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-muted-foreground"
                >
                  Reddit
                </a>
              </li>
              <li>
                <a
                  href="https://x.com/desciers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-muted-foreground"
                >
                  X, at desciers
                </a>
              </li>
              <li>
                <a
                  href="mailto:peptides@descier.science"
                  className="text-foreground hover:text-muted-foreground"
                >
                  Email
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
              Contact
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href="mailto:peptides@descier.science"
                  className="text-foreground hover:text-muted-foreground"
                >
                  peptides@descier.science
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Disclaimer.</span> All results, analyses, and
            certificates shown on this site are provided for molecular-biology-grade research use
            only. Nothing here is a medical claim, a statement of safety for human or animal
            consumption, or an approval by any regulator. Not for diagnostic or therapeutic use.
          </p>
          <p className="mt-4 text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
            PeptidesCheck, by Descier Science. Copyright 2026.
          </p>
        </div>
      </div>
    </footer>
  );
}
