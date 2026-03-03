import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-2xl border border-[var(--color-border)] bg-[#eff4fb] px-4 py-2 text-base text-[#193661] placeholder:text-[#8da0bb] outline-none focus-visible:ring-2 focus-visible:ring-[#28599b]/30',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
