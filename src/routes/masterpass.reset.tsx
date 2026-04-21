import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/masterpass/reset/page';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

export const Route = createFileRoute('/masterpass/reset')({ errorComponent: RouteErrorBoundary, component: Page });
