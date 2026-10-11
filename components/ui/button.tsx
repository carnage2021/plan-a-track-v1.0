import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 ease-out disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-hover",
        secondary: "border border-border bg-surface text-text hover:bg-surface-muted",
        ghost: "text-text hover:bg-surface-muted",
        danger: "bg-danger/10 text-danger hover:bg-danger/15",
      },
      size: {
        md: "h-9 px-3 text-sm",
        lg: "h-11 px-4 text-sm",
        icon: "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({ className, variant, size, asChild, loading, children, disabled, type = "button", ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...(asChild ? {} : { type })} {...props}>
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" strokeWidth={1.75} />}
          {children}
        </>
      )}
    </Comp>
  );
}

export { buttonVariants };
