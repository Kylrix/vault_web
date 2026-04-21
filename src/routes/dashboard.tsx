import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/dashboard/page';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

export const Route = createFileRoute('/dashboard')({ errorComponent: RouteErrorBoundary, component: Page });
