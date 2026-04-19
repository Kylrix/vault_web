import type { ImportItem } from "@/lib/import/deduplication";

type BitwardenUri = { uri?: string };
type BitwardenLogin = {
  username?: string;
  password?: string;
  uris?: BitwardenUri[];
};
type BitwardenCard = {
  cardholderName?: string;
  brand?: string;
  number?: string;
  expMonth?: string;
  expYear?: string;
  code?: string;
};
type BitwardenItem = {
  id?: string;
  type?: number;
  name?: string;
  notes?: string;
  folderId?: string;
  favorite?: boolean;
  login?: BitwardenLogin;
  card?: BitwardenCard;
  fields?: Array<{ name?: string; value?: string }>;
  collectionIds?: string[];
  secureNote?: Record<string, unknown>;
};
type BitwardenExport = {
  items?: BitwardenItem[];
  folders?: Array<{ id?: string; name?: string; parentId?: string }>;
};

export function validateBitwardenExport(value: unknown): value is BitwardenExport {
  if (!value || typeof value !== "object") return false;
  const items = (value as BitwardenExport).items;
  return Array.isArray(items);
}

export function analyzeBitwardenExport(data: BitwardenExport, userId: string): ImportItem[] {
  const items = Array.isArray(data.items) ? data.items : [];

  return items
    .map((item) => {
      const firstUri = item.login?.uris?.find((entry) => entry.uri)?.uri ?? null;
      const isCard = !!item.card;
      const isNote = item.type === 2 || (!item.login && !item.card);

      const mapped: ImportItem = {
        name: item.name || item.login?.username || "Untitled",
        url: firstUri,
        username: item.login?.username ?? null,
        password: item.login?.password ?? null,
        notes: item.notes ?? null,
        _status: "new",
        _originalId: item.id,
        userId,
        folderId: item.folderId ?? null,
        isFavorite: !!item.favorite,
      };

      if (isCard && item.card) {
        mapped.cardholderName = item.card.cardholderName ?? null;
        mapped.cardType = item.card.brand ?? null;
        mapped.cardNumber = item.card.number ?? null;
        mapped.cardExpiry = item.card.expMonth && item.card.expYear
          ? `${item.card.expMonth}/${item.card.expYear}`
          : null;
        mapped.cardCVV = item.card.code ?? null;
      }

      if (isNote) {
        mapped.itemType = "note";
        mapped.password = null;
      } else if (isCard) {
        mapped.itemType = "card";
      } else {
        mapped.itemType = "login";
      }

      return mapped;
    })
    .filter((item) => Boolean(item.name));
}
