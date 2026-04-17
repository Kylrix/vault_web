import { Route as rootRoute } from './__root';
import { Route as r1 } from './index';
import { Route as r2 } from './vault-dashboard';
import { Route as r3 } from './vault-import';
import { Route as r4 } from './vault-masterpass';
import { Route as r5 } from './vault-masterpass-reset';
import { Route as r6 } from './vault-overview';
import { Route as r7 } from './vault-settings';
import { Route as r8 } from './vault-sharing';
import { Route as r9 } from './vault-totp';
import { Route as r10 } from './vault-credentials-new';

export const routeTree = rootRoute.addChildren([r1, r2, r3, r4, r5, r6, r7, r8, r9, r10]);
