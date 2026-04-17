import React from 'react'
import { Link as RouterLink } from '@tanstack/react-router'

type NextLinkProps = React.ComponentPropsWithoutRef<'a'> & {
  href: string
}

const NextLink = React.forwardRef<HTMLAnchorElement, NextLinkProps>(
  ({ href, children, ...props }, ref) => (
    <RouterLink ref={ref} to={href} {...props}>
      {children}
    </RouterLink>
  ),
)

NextLink.displayName = 'NextLink'

export default NextLink
