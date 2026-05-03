import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { designSystem } from "@/config/designSystem";

const colors = designSystem.colors;
const gradients = designSystem.gradients;

export const sonaraTheme = {
  background: colors.backgroundDark,
  surface: colors.surfaceDark,
  card: "#191522",
  softCard: "#211B2D",
  border: colors.borderDark,
  text: "#F9FAFB",
  secondaryText: "#C4BFD0",
  mutedText: colors.mutedText,
  primaryAccent: colors.electricViolet,
  warmAccent: colors.warmGold,
  cyanAccent: colors.signalCyan,
  pinkAccent: colors.coralAccent,
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
};

export const publicNavItems = [
  { label: "Home", href: "/" },
  { label: "Store", href: "/store" },
  { label: "Pricing", href: "/pricing" },
  { label: "Tutorial", href: "/tutorial" },
  { label: "Login", href: "/login" },
];

export const appNavItems = [
  { label: "Home", href: "/dashboard" },
  { label: "Create", href: "/create" },
  { label: "Library", href: "/library" },
  { label: "Export", href: "/export" },
  { label: "Settings", href: "/settings" },
];

export const footerItems = [
  { label: "Trust", href: "/trust" },
  { label: "Support", href: "/support" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
];

function getShellStyle(nav: "public" | "app"): CSSProperties {
  const isPublic = nav === "public";

  return {
    minHeight: "100vh",
    background: isPublic ? gradients.hero : gradients.darkHero,
    color: isPublic ? colors.inkText : "#F9FAFB",
    padding: "clamp(20px, 4vw, 48px)",
  };
}

const navStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "18px",
  flexWrap: "wrap",
  marginBottom: "clamp(36px, 7vw, 72px)",
};

function navLinkStyle(nav: "public" | "app"): CSSProperties {
  return {
    color: nav === "public" ? colors.deepPlum : "#C4BFD0",
    textDecoration: "none",
    fontWeight: 800,
  };
}

function brandStyle(nav: "public" | "app"): CSSProperties {
  return {
    color: nav === "public" ? colors.inkText : "#F9FAFB",
    textDecoration: "none",
    fontWeight: 950,
    letterSpacing: "0.03em",
  };
}

function footerStyle(nav: "public" | "app"): CSSProperties {
  return {
    borderTop: `1px solid ${nav === "public" ? colors.borderLight : colors.borderDark}`,
    marginTop: "56px",
    paddingTop: "22px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
    color: nav === "public" ? colors.softText : colors.mutedText,
  };
}

export function ButtonLink({
  children,
  href,
  variant = "primary",
}: {
  children: ReactNode;
  href: string;
  variant?: "primary" | "secondary" | "quiet";
}) {
  const isPrimary = variant === "primary";
  const isQuiet = variant === "quiet";

  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "46px",
        padding: "12px 18px",
        borderRadius: designSystem.radii.button,
        border: isPrimary ? "none" : `1px solid ${colors.borderDark}`,
        background: isPrimary
          ? gradients.brand
          : isQuiet
            ? "transparent"
            : colors.surfaceDark,
        color: isPrimary || !isQuiet ? "#F9FAFB" : colors.deepPlum,
        textDecoration: "none",
        fontWeight: 900,
      }}
    >
      {children}
    </Link>
  );
}

export function PageShell({
  eyebrow,
  title,
  subtitle,
  children,
  actions,
  nav = "public",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  nav?: "public" | "app";
}) {
  const navItems = nav === "public" ? publicNavItems : appNavItems;
  const isPublic = nav === "public";

  return (
    <main style={getShellStyle(nav)}>
      <nav style={navStyle} aria-label="Primary navigation">
        <Link href="/" style={brandStyle(nav)}>
          SONARA Industries™
        </Link>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} style={navLinkStyle(nav)}>
              {item.label}
            </Link>
          ))}
          {nav === "app" ? (
            <Link href="/" style={navLinkStyle(nav)}>
              Website
            </Link>
          ) : null}
        </div>
      </nav>

      <section
        style={{
          maxWidth: designSystem.layout.maxWidth,
          marginBottom: "36px",
        }}
      >
        {eyebrow ? (
          <p
            style={{
              color: isPublic ? colors.electricViolet : colors.warmGold,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          style={{
            fontSize: "clamp(42px, 8vw, 82px)",
            lineHeight: 0.98,
            margin: "10px 0 18px",
            letterSpacing: 0,
            maxWidth: "980px",
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            style={{
              color: isPublic ? colors.softText : "#C4BFD0",
              fontSize: "clamp(18px, 3vw, 22px)",
              lineHeight: 1.65,
              maxWidth: "820px",
            }}
          >
            {subtitle}
          </p>
        ) : null}
        {actions ? (
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "26px",
            }}
          >
            {actions}
          </div>
        ) : null}
      </section>

      {children}

      <footer style={footerStyle(nav)}>
        <span>© {new Date().getFullYear()} SONARA Industries™</span>
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
          {footerItems.map((item) => (
            <Link key={item.href} href={item.href} style={navLinkStyle(nav)}>
              {item.label}
            </Link>
          ))}
        </div>
      </footer>
    </main>
  );
}

export function Card({
  title,
  children,
  status,
}: {
  title: string;
  children: ReactNode;
  status?: string;
}) {
  return (
    <article
      style={{
        padding: "22px",
        borderRadius: designSystem.radii.card,
        border: `1px solid ${colors.borderDark}`,
        background: "rgba(21, 17, 31, 0.94)",
        color: "#F9FAFB",
        boxShadow: designSystem.shadows.dark,
      }}
    >
      {status ? <Pill>{status}</Pill> : null}
      <h2 style={{ marginTop: status ? "14px" : 0, marginBottom: "10px" }}>
        {title}
      </h2>
      <div style={{ color: "#C4BFD0", lineHeight: 1.65 }}>{children}</div>
    </article>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
        gap: "18px",
      }}
    >
      {children}
    </section>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        width: "fit-content",
        borderRadius: "999px",
        border: `1px solid ${colors.borderDark}`,
        background: colors.surfaceDark,
        color: colors.warmGold,
        padding: "6px 10px",
        fontSize: "12px",
        fontWeight: 900,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <section
      style={{
        border: `1px solid ${colors.borderLight}`,
        background: "rgba(255, 249, 240, 0.78)",
        borderRadius: designSystem.radii.card,
        padding: "20px",
        color: colors.inkText,
        lineHeight: 1.65,
        marginBottom: "22px",
        boxShadow: designSystem.shadows.soft,
      }}
    >
      {children}
    </section>
  );
}

export function ModulePlaceholder({
  title,
  description,
  cards,
  children,
}: {
  title: string;
  description: string;
  cards: Array<{ title: string; text: string; status?: string }>;
  children?: ReactNode;
}) {
  return (
    <PageShell
      nav="app"
      eyebrow="SONARA OS™"
      title={title}
      subtitle={description}
      actions={
        <>
          <ButtonLink href="/dashboard">Back to Dashboard</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Public Site
          </ButtonLink>
        </>
      }
    >
      <Notice>
        Module under development. This page is wired so navigation does not
        break while production services, auth, and storage are configured.
      </Notice>
      <Grid>
        {cards.map((card) => (
          <Card key={card.title} title={card.title} status={card.status}>
            <p>{card.text}</p>
          </Card>
        ))}
      </Grid>
      {children ? <section style={{ marginTop: "18px" }}>{children}</section> : null}
    </PageShell>
  );
}
