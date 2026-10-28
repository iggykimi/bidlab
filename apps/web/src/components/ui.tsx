// Shared primitives (cva + clsx). One definition per pattern; pages compose
// these instead of copying card/button/alert class strings.

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

const buttonVariants = cva(
  "pressable inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-5 py-3 text-base font-bold disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-hover",
        secondary: "border border-primary bg-white text-primary hover:bg-primary-soft",
        subtle: "border border-border bg-white text-ink hover:bg-surface",
        chip: "min-h-[48px] min-w-[48px] rounded-lg border border-primary px-2 py-1 text-sm font-medium text-primary hover:bg-primary-soft",
      },
    },
    defaultVariants: { variant: "primary" },
  }
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant, className, type = "button", ref, ...rest }: ButtonProps) {
  return <button ref={ref} type={type} className={clsx(buttonVariants({ variant }), className)} {...rest} />;
}

const cardVariants = cva("rounded-xl bg-white", {
  variants: {
    pad: {
      md: "p-4 sm:p-6",
      sm: "p-4",
      none: "",
    },
  },
  defaultVariants: { pad: "md" },
});

interface CardProps extends HTMLAttributes<HTMLElement>, VariantProps<typeof cardVariants> {
  as?: "section" | "div";
  children: ReactNode;
}

export function Card({ as = "section", pad, className, children, ...rest }: CardProps) {
  const Tag = as;
  return (
    <Tag className={clsx(cardVariants({ pad }), className)} {...rest}>
      {children}
    </Tag>
  );
}

const alertVariants = cva("rounded-lg border-l-4 px-4 py-3 text-base text-ink", {
  variants: {
    tone: {
      error: "border-error bg-redbg",
      warn: "border-alert bg-warn-bg",
      info: "border-primary bg-primary-soft",
    },
  },
  defaultVariants: { tone: "error" },
});

interface AlertProps extends HTMLAttributes<HTMLParagraphElement>, VariantProps<typeof alertVariants> {
  children: ReactNode;
}

export function Alert({ tone, className, children, role = "alert", ...rest }: AlertProps) {
  return (
    <p role={role} className={clsx(alertVariants({ tone }), className)} {...rest}>
      {children}
    </p>
  );
}

const badgeVariants = cva("inline-block rounded-lg px-2.5 py-1 text-sm font-bold", {
  variants: {
    tone: {
      demo: "bg-warn-bg text-warn-ink",
      live: "bg-primary-soft text-primary-ink",
      neutral: "bg-primary-soft text-primary",
    },
  },
  defaultVariants: { tone: "neutral" },
});

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  children: ReactNode;
}

export function Badge({ tone, className, children, ...rest }: BadgeProps) {
  return (
    <span className={clsx(badgeVariants({ tone }), className)} {...rest}>
      {children}
    </span>
  );
}

/**
 * Value wrapper with a 150ms crossfade on change (O3; still under reduced
 * motion). Callers pass `key={value}` so a new value remounts the span.
 */
export function Crossfade({ children }: { children: ReactNode }) {
  return <span className="kpi-crossfade">{children}</span>;
}
