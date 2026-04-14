import * as React from "react"
import { cn } from "@/lib/utils"

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  children?: React.ReactNode
}

export function PageHeader({ className, title, description, children, ...props }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col items-start justify-between sm:flex-row sm:items-center", className)} {...props}>
      <div className="grid gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="mt-4 flex gap-2 sm:mt-0">{children}</div>}
    </div>
  )
}
