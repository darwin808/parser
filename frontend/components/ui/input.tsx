import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground h-11 w-full min-w-0 border-[3px] border-black bg-white px-4 py-2 text-base outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm font-medium",
        "focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_#10B981]",
        "aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_#EF4444]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
