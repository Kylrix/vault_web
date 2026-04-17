import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/credentials/new/page';

export const Route = createFileRoute('/credentials/new')({ component: Page });
