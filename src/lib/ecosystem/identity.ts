import { appwriteDatabases } from '../appwrite';
import { Query } from 'appwrite';

const CONNECT_DATABASE_ID = 'chat';
const CONNECT_COLLECTION_ID_USERS = 'users';

const PROFILE_SYNC_KEY = 'kylrix_ecosystem_identity_synced';
const SESSION_SYNC_KEY = 'kylrix_ecosystem_session_synced';

/**
 * Ensures the user has a record in the global Kylrix Connect Directory.
 * Uses a multi-layered cache check (session + local) to minimize DB calls.
 */
export async function ensureGlobalIdentity(user: any, force = false) {
    if (!user?.$id) return;

    if (typeof window !== 'undefined' && !force) {
        // Step 1: Session skip
        if (sessionStorage.getItem(SESSION_SYNC_KEY)) return;

        // Step 2: Global skip
        const lastSync = localStorage.getItem(PROFILE_SYNC_KEY);
        if (lastSync && (Date.now() - parseInt(lastSync)) < 24 * 60 * 60 * 1000) {
            sessionStorage.setItem(SESSION_SYNC_KEY, '1');
            return;
        }
    }

    try {
        let profile;
        try {
            profile = await appwriteDatabases.getDocument(
                CONNECT_DATABASE_ID,
                CONNECT_COLLECTION_ID_USERS,
                user.$id
            );
        } catch (e: any) {
            if (e.code === 404) {
                const username = user.prefs?.username || `user${user.$id.slice(0, 6)}`;
                const avatar = user.prefs?.profilePicId || user.avatar || null;

                const baseData = {
                    username,
                    displayName: user.name || username,
                    appsActive: ['vault'],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    bio: user.prefs?.bio || '',
                    avatar,
                    privacySettings: JSON.stringify({ public: true, searchable: true })
                };

                const permissions = [
                    'read("any")',
                    `update("user:${user.$id}")`,
                    `delete("user:${user.$id}")`
                ];

                try {
                    profile = await appwriteDatabases.createDocument(
                        CONNECT_DATABASE_ID,
                        CONNECT_COLLECTION_ID_USERS,
                        user.$id,
                        baseData,
                        permissions
                    );
                } catch (e: any) {
                    console.error('[Identity] Global profile creation failed:', e);
                    throw e;
                }
            } else {
                throw e;
            }
        }

        // Add 'vault' to appsActive if not present
        if (profile && Array.isArray(profile.appsActive) && !profile.appsActive.includes('vault')) {
            await appwriteDatabases.updateDocument(
                CONNECT_DATABASE_ID,
                CONNECT_COLLECTION_ID_USERS,
                user.$id,
                {
                    appsActive: [...profile.appsActive, 'vault'],
                    updatedAt: new Date().toISOString()
                }
            );
        }

        if (typeof window !== 'undefined') {
            localStorage.setItem(PROFILE_SYNC_KEY, Date.now().toString());
            sessionStorage.setItem(SESSION_SYNC_KEY, '1');
        }
    } catch (error: unknown) {
        console.warn('[Identity] Global identity sync failed:', error);
    }
}

/**
 * Searches for users across the entire ecosystem.
 * Only returns users who have active discovery for 'vault'.
 */
export async function searchGlobalUsers(query: string, limit = 10) {
    if (!query || query.length < 2) return [];

    try {
        const res = await appwriteDatabases.listDocuments(
            CONNECT_DATABASE_ID,
            CONNECT_COLLECTION_ID_USERS,
            [
                Query.or([
                    Query.startsWith('username', query.toLowerCase()),
                    Query.startsWith('displayName', query)
                ]),
                Query.contains('appsActive', 'vault'),
                Query.limit(limit)
            ]
        );

        return res.documents.map((doc: any) => ({
            id: doc.$id,
            title: doc.displayName || doc.username,
            subtitle: `@${doc.username}`,
            avatar: doc.avatar,
            createdAt: doc.$createdAt || doc.createdAt || null,
            lastUsernameEdit: doc.last_username_edit || null,
            username: doc.username || null,
            bio: doc.bio || null,
            tier: doc.tier || null,
            publicKey: doc.publicKey || null,
            apps: doc.appsActive || []
        }));
    } catch (error: unknown) {
        console.error('[Identity] Global search failed:', error);
        return [];
    }
}
