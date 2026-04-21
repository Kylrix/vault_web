import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/page';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

export const Route = createFileRoute('/')({ errorComponent: RouteErrorBoundary, component: Page });
