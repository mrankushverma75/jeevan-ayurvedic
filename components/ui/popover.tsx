import * as React from "react"
import { cn } from "@/lib/utils"

interface PopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  trigger: React.ReactNode
}

export function Popover({ open, onOpenChange, children, trigger }: PopoverProps) {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onOpenChange])

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => onOpenChange(!open)}>
        {trigger}
      </div>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
          {children}
        </div>
      )}
    </div>
  )
}

export const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-4", className)}
    {...props}
  >
    {children}
  </div>
))
PopoverContent.displayName = "PopoverContent"


