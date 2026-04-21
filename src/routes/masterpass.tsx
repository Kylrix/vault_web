import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/masterpass/page';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

export const Route = createFileRoute('/masterpass')({ errorComponent: RouteErrorBoundary, component: Page });
