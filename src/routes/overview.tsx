import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/overview/page';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

export const Route = createFileRoute('/overview')({ errorComponent: RouteErrorBoundary, component: Page });
