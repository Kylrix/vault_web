import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/import/page';

export const Route = createFileRoute('/import')({ component: Page });
