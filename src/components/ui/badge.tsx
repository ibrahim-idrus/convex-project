/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#dce8f8] text-[#13386f]',
        secondary: 'border-transparent bg-[#e9f8ed] text-[#0f7a3a]',
        destructive: 'border-transparent bg-[#fdeaea] text-[#cf2525]',
        outline: 'border-[#c7d5e9] text-[#486081]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
