import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/totp/page';

export const Route = createFileRoute('/totp')({ component: Page });
