import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/sharing/page';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

export const Route = createFileRoute('/sharing')({ errorComponent: RouteErrorBoundary, component: Page });
