import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/masterpass/page';

export const Route = createFileRoute('/masterpass')({ component: Page });
