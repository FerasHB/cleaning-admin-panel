import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "info" | "warning"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          // --- existing variants (untouched) ---
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80": variant === "default",
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80": variant === "secondary",
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80": variant === "destructive",
          "text-foreground": variant === "outline",
          // --- semantic status variants (light-mode) ---
          "bg-emerald-50 text-emerald-700 border-emerald-200": variant === "success",  // completed
          "bg-blue-50 text-blue-700 border-blue-200":          variant === "info",     // in_progress
          "bg-yellow-50 text-yellow-700 border-yellow-200":    variant === "warning",  // open
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
