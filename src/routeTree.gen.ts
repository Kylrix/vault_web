import { Route as rootRoute } from './routes/__root';
import { Route as r1 } from './routes/index';
import { Route as r2 } from './routes/dashboard';
import { Route as r3 } from './routes/import';
import { Route as r4 } from './routes/masterpass';
import { Route as r5 } from './routes/masterpass.reset';
import { Route as r6 } from './routes/overview';
import { Route as r7 } from './routes/settings';
import { Route as r8 } from './routes/sharing';
import { Route as r9 } from './routes/totp';
import { Route as r10 } from './routes/credentials.new';

export const routeTree = rootRoute.addChildren([r1, r2, r3, r4, r5, r6, r7, r8, r9, r10]);
