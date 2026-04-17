import React from 'react'

type DynamicOptions = {
  ssr?: boolean
}

export default function dynamic<TProps>(
  loader: () => Promise<{ default: React.ComponentType<TProps> }>,
  _options?: DynamicOptions,
) {
  const LazyComponent = React.lazy(loader)

  return function DynamicComponent(props: TProps) {
    return (
      <React.Suspense fallback={null}>
        <LazyComponent {...props} />
      </React.Suspense>
    )
  }
}
