import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveCurrentUser, AppwriteService, appwriteDatabases } from '@/lib/appwrite';
import { Query } from 'appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

type AIChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const generateAIResponse = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    prompt: string;
    history?: AIChatMessage[];
    systemInstruction?: string;
    apiKey?: string;
  }) => data)
  .handler(async ({ data }) => {
    const request = getRequest();
    const user = await resolveCurrentUser(request as any);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const apiKey = data.apiKey || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('AI service not configured');
    }

    if (!data.apiKey) {
      const plan = (user as any).prefs?.subscriptionTier || 'FREE';
      const isPro = ['PRO', 'ORG', 'LIFETIME'].includes(plan);
      if (!isPro) {
        throw new Error('AI features require a Pro account. Upgrade to continue or provide your own API key in settings.');
      }
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash',
      systemInstruction: data.systemInstruction || 'You are Kylrixbot, a secure vault assistant focused on privacy and practical help.',
    });

    if (data.history && data.history.length > 0) {
      const chat = model.startChat({
        history: data.history.map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
      });
      const result = await chat.sendMessage(data.prompt);
      return result.response.text();
    }

    const result = await model.generateContent(data.prompt);
    return result.response.text();
  });

export const purgeTier2Data = createServerFn({ method: 'POST' }).handler(async () => {
  const request = getRequest();
  const user = await resolveCurrentUser(request as any);
  if (!user) {
    throw new Error('Unauthorized');
  }

  const userId = user.$id;
  const creds = await AppwriteService.listAllCredentials(userId);
  const totps = await AppwriteService.listTOTPSecrets(userId);
  await Promise.all([
    ...creds.map(c => AppwriteService.deleteCredential(c.$id)),
    ...totps.map(t => AppwriteService.deleteTOTPSecret(t.$id)),
  ]);

  const CHAT_DB = APPWRITE_CONFIG.DATABASES.CHAT;
  const CONV_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
  const CONV_MEMBERS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATION_MEMBERS || 'conversationMembers';
  const MSG_TABLE = APPWRITE_CONFIG.TABLES.CHAT.MESSAGES;

  const memberRows = await appwriteDatabases.listDocuments(CHAT_DB, CONV_MEMBERS_TABLE, [
    Query.equal('userId', userId),
    Query.limit(1000),
  ]);
  const conversationIds = Array.from(new Set((memberRows.documents || []).map((row: any) => row.conversationId).filter(Boolean)));
  const convsRes = conversationIds.length ? await appwriteDatabases.listDocuments(CHAT_DB, CONV_TABLE, [
    Query.equal('$id', conversationIds),
    Query.equal('type', 'direct'),
  ]) : { documents: [] as any[], total: 0 };

  for (const conv of convsRes.documents) {
    const isSelfChat = conv.participants.every((p: string) => p === userId);
    const msgsRes = await appwriteDatabases.listDocuments(CHAT_DB, MSG_TABLE, [
      Query.equal('conversationId', conv.$id),
      Query.equal('senderId', userId),
      Query.limit(1000),
    ]);
    await Promise.all(msgsRes.documents.map(m => appwriteDatabases.deleteDocument(CHAT_DB, MSG_TABLE, m.$id)));
    if (isSelfChat) {
      await appwriteDatabases.deleteDocument(CHAT_DB, CONV_TABLE, conv.$id);
    }
  }

  const keychainEntries = await AppwriteService.listKeychainEntries(userId);
  await Promise.all(keychainEntries.map(e => AppwriteService.deleteKeychainEntry(e.$id)));

  const identityRows = await appwriteDatabases.listDocuments(
    APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
    APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES,
    [Query.equal('userId', userId)],
  );
  await Promise.all(identityRows.documents.map(row => appwriteDatabases.deleteDocument(
    APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
    APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES,
    row.$id,
  )));

  const keyMappings = await appwriteDatabases.listDocuments(
    APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
    'key_mapping',
    [
      Query.or([
        Query.equal('grantee', userId),
        Query.contains('metadata', userId),
        Query.equal('resourceId', userId),
      ]),
    ],
  );
  await Promise.all(keyMappings.documents.map(row => appwriteDatabases.deleteDocument(
    APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
    'key_mapping',
    row.$id,
  )));

  const CHAT_USERS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.USERS;
  const NOTE_USERS_TABLE = APPWRITE_CONFIG.TABLES.NOTE.USERS;
  await Promise.all([
    appwriteDatabases.updateDocument(CHAT_DB, CHAT_USERS_TABLE, userId, {
      publicKey: null,
      updatedAt: new Date().toISOString(),
    }).catch(() => null),
    appwriteDatabases.updateDocument(APPWRITE_CONFIG.DATABASES.NOTE, NOTE_USERS_TABLE, userId, {
      publicKey: null,
      updatedAt: new Date().toISOString(),
    }).catch(() => null),
  ]);

  const userDoc = await AppwriteService.getUserDoc(userId);
  if (userDoc) {
    await AppwriteService.updateUserDoc(userDoc.$id, {
      masterpass: false,
      isPasskey: false,
    });
  }

  return { success: true };
});
