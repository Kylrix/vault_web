import { createFileRoute, redirect } from '@tanstack/react-router';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

export const Route = createFileRoute('/')({
  errorComponent: RouteErrorBoundary,
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' });
  },
  component: () => null,
});
