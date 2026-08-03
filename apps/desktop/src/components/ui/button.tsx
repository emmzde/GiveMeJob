import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-8 items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 text-[12px] font-medium transition-[transform,background-color,border-color,color,opacity] duration-150 ease-[var(--ease)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
  {
    variants: {
      variant: {
        default: "bg-[var(--text)] text-[var(--bg)] hover:opacity-90",
        accent: "bg-[var(--text)] text-[var(--bg)] hover:opacity-90",
        ghost: "bg-transparent text-[var(--text)] hover:bg-[var(--bg-hover)]",
        outline:
          "border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { asChild = false, className, variant, ...props },
  ref,
) {
  const Component = asChild ? Slot : "button";

  return <Component className={cn(buttonVariants({ variant }), className)} ref={ref} {...props} />;
});

export { Button };
