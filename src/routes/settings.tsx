import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/settings/page';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

export const Route = createFileRoute('/settings')({ errorComponent: RouteErrorBoundary, component: Page });
