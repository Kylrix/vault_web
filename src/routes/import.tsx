import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/import/page';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

export const Route = createFileRoute('/import')({ errorComponent: RouteErrorBoundary, component: Page });
