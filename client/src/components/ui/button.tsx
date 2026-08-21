import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-medium shadow-[inset_0_1px_0_rgb(255_255_255_/_0.14),0_10px_28px_rgb(3_8_20_/_0.12)] transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] active:scale-[0.97] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "border-white/20 bg-[linear-gradient(135deg,rgba(131,145,255,0.98),rgba(80,93,225,0.94))] text-primary-foreground hover:-translate-y-px hover:brightness-110",
        destructive:
          "border-rose-200/20 bg-[linear-gradient(135deg,rgba(244,80,112,0.92),rgba(190,42,72,0.94))] text-white hover:-translate-y-px hover:brightness-110 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border-white/14 bg-white/[0.055] shadow-none backdrop-blur-xl hover:-translate-y-px hover:border-white/24 hover:bg-white/[0.11] dark:bg-white/[0.055] dark:border-white/14 dark:hover:bg-white/[0.11]",
        secondary:
          "border-white/10 bg-white/[0.075] text-secondary-foreground backdrop-blur-xl hover:-translate-y-px hover:bg-white/[0.13]",
        ghost:
          "border-transparent bg-transparent shadow-none hover:bg-white/[0.09] dark:hover:bg-white/[0.09]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
