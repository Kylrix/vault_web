import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/totp/page';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

export const Route = createFileRoute('/totp')({ errorComponent: RouteErrorBoundary, component: Page });
