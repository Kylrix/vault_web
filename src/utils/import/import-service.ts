import { createCredential, createFolder, createTotpSecret } from "@/lib/appwrite";
import type { CredentialsCreate, TotpSecretsCreate } from "@/lib/appwrite/types";
import { analyzeBitwardenExport, validateBitwardenExport } from "@/utils/import/bitwarden-mapper";
import type { ImportItem } from "@/lib/import/deduplication";

export type ImportProgress = {
  stage: string;
  currentStep: number;
  totalSteps: number;
  message: string;
  itemsProcessed: number;
  itemsTotal: number;
  errors: string[];
};

export type ImportResult = {
  success: boolean;
  summary: {
    foldersCreated: number;
    credentialsCreated: number;
    totpSecretsCreated: number;
    errors: number;
    skipped: number;
    skippedExisting: number;
  };
  errors: string[];
  folderMapping: Map<string, string>;
};

type Payload = {
  version?: number;
  credentials?: ImportItem[];
  folders?: Array<{ id?: string; name?: string; parentFolderId?: string | null }>;
  totpSecrets?: Array<Record<string, unknown>>;
};

const isoNow = () => new Date().toISOString();

export class ImportService {
  constructor(private readonly onProgress?: (progress: ImportProgress) => void) {}

  private emit(progress: ImportProgress) {
    this.onProgress?.(progress);
  }

  private parsePayload(raw: string): Payload | { items?: unknown[]; folders?: unknown[] } {
    const parsed = JSON.parse(raw) as Payload | { items?: unknown[]; folders?: unknown[] };
    return parsed;
  }

  private async importCredentials(items: ImportItem[], userId: string, folderMap: Map<string, string>): Promise<{ count: number; skipped: number; errors: string[] }> {
    let count = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const itemType = item.itemType ?? (item.password ? "login" : "note");
      const folderId = item.folderId ? folderMap.get(String(item.folderId)) ?? null : null;
      const name = String(item.name || "").trim();

      if (!name) {
        skipped += 1;
        continue;
      }

      const credential: CredentialsCreate = {
        userId,
        itemType,
        name,
        url: item.url ?? null,
        username: item.username ?? null,
        password: item.password ?? null,
        notes: item.notes ?? null,
        totpId: null,
        cardNumber: item.cardNumber ?? null,
        cardholderName: item.cardholderName ?? null,
        cardExpiry: item.cardExpiry ?? null,
        cardCVV: item.cardCVV ?? null,
        cardPIN: item.cardPIN ?? null,
        cardType: item.cardType ?? null,
        folderId,
        tags: Array.isArray(item.tags) ? item.tags as string[] : null,
        customFields: typeof item.customFields === "string" ? item.customFields : null,
        faviconUrl: item.faviconUrl ?? null,
        isFavorite: Boolean(item.isFavorite),
        isDeleted: false,
        deletedAt: null,
        lastAccessedAt: null,
        passwordChangedAt: null,
        createdAt: isoNow(),
        updatedAt: isoNow(),
      };

      try {
        await createCredential(credential);
        count += 1;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Failed to import credential ${index + 1}`);
      }

      this.emit({
        stage: "credentials",
        currentStep: index + 1,
        totalSteps: items.length,
        message: `Importing credentials (${index + 1}/${items.length})`,
        itemsProcessed: index + 1,
        itemsTotal: items.length,
        errors,
      });
    }

    return { count, skipped, errors };
  }

  private async importFolders(folders: Payload["folders"], userId: string): Promise<Map<string, string>> {
    const folderMap = new Map<string, string>();
    if (!folders?.length) return folderMap;

    for (const folder of folders) {
      if (!folder || typeof folder !== "object") continue;
      const folderId = typeof folder.id === "string" ? folder.id : null;
      const name = typeof folder.name === "string" ? folder.name.trim() : "";
      if (!folderId || !name) continue;

      const created = await createFolder({
        userId,
        name,
        parentFolderId: typeof folder.parentFolderId === "string" ? folder.parentFolderId : null,
      });
      folderMap.set(folderId, created.$id);
    }

    return folderMap;
  }

  private async importTotpSecrets(totpSecrets: Payload["totpSecrets"], userId: string): Promise<{ count: number; errors: string[] }> {
    if (!totpSecrets?.length) return { count: 0, errors: [] };
    let count = 0;
    const errors: string[] = [];

    for (const secret of totpSecrets) {
      try {
        const payload = {
          userId,
          issuer: String(secret.issuer ?? secret["issuer"] ?? ""),
          accountName: String(secret.accountName ?? secret["accountName"] ?? ""),
          secretKey: String(secret.secretKey ?? secret["secretKey"] ?? ""),
          algorithm: (secret.algorithm as string) || "SHA1",
          digits: Number(secret.digits ?? 6),
          period: Number(secret.period ?? 30),
          url: typeof secret.url === "string" ? secret.url : null,
          folderId: typeof secret.folderId === "string" ? secret.folderId : null,
          tags: Array.isArray(secret.tags) ? secret.tags : null,
          isFavorite: Boolean(secret.isFavorite),
          isDeleted: false,
          deletedAt: null,
          lastUsedAt: null,
          createdAt: isoNow(),
          updatedAt: isoNow(),
        } as TotpSecretsCreate;
        await createTotpSecret(payload);
        count += 1;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Failed to import TOTP secret");
      }
    }

    return { count, errors };
  }

  async importBitwardenData(raw: string, userId: string): Promise<ImportResult> {
    const parsed = this.parsePayload(raw);
    if (!validateBitwardenExport(parsed)) {
      throw new Error("Invalid Bitwarden export");
    }

    const folders = await this.importFolders(parsed.folders as Payload["folders"], userId);
    const mappedItems = analyzeBitwardenExport(parsed, userId);
    this.emit({
      stage: "credentials",
      currentStep: 1,
      totalSteps: Math.max(mappedItems.length, 1),
      message: "Preparing Bitwarden import",
      itemsProcessed: 0,
      itemsTotal: mappedItems.length,
      errors: [],
    });

    const credentialResult = await this.importCredentials(mappedItems, userId, folders);
    return {
      success: credentialResult.errors.length === 0,
      summary: {
        foldersCreated: folders.size,
        credentialsCreated: credentialResult.count,
        totpSecretsCreated: 0,
        errors: credentialResult.errors.length,
        skipped: credentialResult.skipped,
        skippedExisting: 0,
      },
      errors: credentialResult.errors,
      folderMapping: folders,
    };
  }

  async importKylrixVaultData(raw: string, userId: string): Promise<ImportResult> {
    const parsed = this.parsePayload(raw);
    const payload = parsed as Payload;
    const folders = await this.importFolders(payload.folders, userId);
    const items = Array.isArray(payload.credentials) ? payload.credentials : [];

    this.emit({
      stage: "credentials",
      currentStep: 1,
      totalSteps: Math.max(items.length, 1),
      message: "Preparing Kylrix Vault import",
      itemsProcessed: 0,
      itemsTotal: items.length,
      errors: [],
    });

    const credentialResult = await this.importCredentials(items, userId, folders);
    const totpResult = await this.importTotpSecrets(payload.totpSecrets, userId);

    return {
      success: credentialResult.errors.length === 0 && totpResult.errors.length === 0,
      summary: {
        foldersCreated: folders.size,
        credentialsCreated: credentialResult.count,
        totpSecretsCreated: totpResult.count,
        errors: credentialResult.errors.length + totpResult.errors.length,
        skipped: credentialResult.skipped,
        skippedExisting: 0,
      },
      errors: [...credentialResult.errors, ...totpResult.errors],
      folderMapping: folders,
    };
  }
}
