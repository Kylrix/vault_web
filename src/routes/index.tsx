import { createFileRoute } from '@tanstack/react-router';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

export const Route = createFileRoute('/')({
  errorComponent: RouteErrorBoundary,
  component: () => null,
});
