import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/credentials/new/page';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

export const Route = createFileRoute('/credentials/new')({ errorComponent: RouteErrorBoundary, component: Page });
