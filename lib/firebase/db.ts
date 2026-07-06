import { supabase, getSupabaseAdmin } from "@/lib/supabase";
import { auth, isFirebaseConfigured, isMockDatabaseEnabled } from "./config";

// --- TypeScript Interfaces ---

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  photoURL?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Restaurant {
  id?: string;
  ownerId: string;
  name: string;
  slug: string;
  logoUrl?: string;
  cuisine?: string;
  currency: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  status: "active" | "inactive" | "published";
  createdAt: any;
  updatedAt: any;
  activeMenuId?: string;
  currentPublishedMenuId?: string;
  openStatus?: "open" | "closed";
  isOpen?: boolean;
}

export interface RestaurantMember {
  uid: string;
  role: "owner" | "admin" | "editor" | "viewer";
  invitedAt: any;
  joinedAt: any;
}

export interface MenuUpload {
  id?: string;
  fileUrl: string;
  storagePath: string;
  fileType: string;
  originalFileName: string;
  extractionStatus: "pending" | "processing" | "completed" | "failed";
  extractedJson?: string;
  createdAt: any;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  priceLabel?: string;
  priceOptions?: Array<{ size?: string | null; amount: number | null }>;
  variants?: string[];
  confidence?: "high" | "medium" | "low";
  subcategory?: string | null;
  dietaryTag?: "veg" | "non-veg" | "egg" | "vegan" | null;
  specialTag?: string | null;
  image?: string;
  imageUrl?: string;
  allergens: string[];
  tags: string[];
  isAvailable: boolean;
  isActive?: boolean;
  isFeatured?: boolean;
  isPopular?: boolean;
  type: "veg" | "non-veg" | "egg" | "vegan" | "unknown";
  spiceLevel: number | null;
  sortOrder?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  items: MenuItem[];
  isActive?: boolean;
  sortOrder?: number;
}

export interface MenuTheme {
  theme: "classic" | "modern" | "minimal" | "glassmorphism" | "neon";
  primaryColor: string;
  accentColor?: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  layoutStyle?: string;
  cardStyle: "flat" | "elevated" | "3d-tilt" | "3d-flip";
  animationStyle?: string;
}

export interface Menu {
  id?: string;
  name: string;
  status: "draft" | "published";
  version: number;
  categories: MenuCategory[];
  theme: MenuTheme;
  sourceFileUrl?: string;
  sourceFileType?: string;
  sourceFileName?: string;
  sourceUploadId?: string;
  rawExtractedText?: string;
  rawDigitizedJson?: string;
  structuredItemsVerified?: boolean;
  digitizationMetadata?: {
    totalItemsDetected?: number;
    totalCategoriesDetected?: number;
    confidenceNotes?: string;
  };
  publishedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface QrCode {
  id?: string;
  restaurantId: string;
  name: string;
  scanCount: number;
  createdAt: any;
}

export interface ScanLog {
  id: string;
  qrId: string;
  timestamp: any;
  userAgent: string;
  referer: string;
}

// --- Dynamic Query Router Helper ---

const normalizeSlug = (value: string) => {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `restaurant-${Date.now()}`;
};

const timestampToMillis = (value: any) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return new Date(value).getTime();
  return 0;
};

const sortMenusByPublishDate = (menus: Menu[]) => {
  return [...menus].sort((a, b) => {
    const publishedDiff = timestampToMillis(b.publishedAt) - timestampToMillis(a.publishedAt);
    if (publishedDiff !== 0) return publishedDiff;
    return timestampToMillis(b.updatedAt) - timestampToMillis(a.updatedAt);
  });
};

const sortRestaurantsByUpdatedDate = (restaurants: Restaurant[]) => {
  return [...restaurants].sort((a, b) => timestampToMillis(b.updatedAt) - timestampToMillis(a.updatedAt));
};

const parseMockResponse = async (res: Response) => {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Local mock database request failed.");
  }
  return payload;
};

const fetchMock = async (action: string, collectionName: string, id?: string, data?: any, extra: Record<string, any> = {}) => {
  if (typeof window === "undefined") {
    return { data: id ? null : [] };
  }
  
  if (action === "GET_DOC") {
    const res = await fetch(`/api/mock-db?action=getDoc&collection=${collectionName}&id=${id}`);
    return parseMockResponse(res);
  }
  if (action === "GET_DOCS") {
    let queryStr = `/api/mock-db?action=getDocs&collection=${collectionName}`;
    Object.entries(extra).forEach(([k, v]) => {
      queryStr += `&${k}=${encodeURIComponent(v)}`;
    });
    const res = await fetch(queryStr);
    return parseMockResponse(res);
  }
  
  const res = await fetch("/api/mock-db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, collection: collectionName, id, data, ...extra })
  });
  return parseMockResponse(res);
};

async function parseApiResponse(res: Response) {
  const text = await res.text();
  let payload: any = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!res.ok) {
    if (payload.error) {
      throw new Error(payload.details ? `${payload.error}: ${payload.details}` : payload.error);
    }

    const isHtmlError = /^\s*</.test(text);
    throw new Error(
      isHtmlError
        ? `Server returned ${res.status}. The dashboard data API returned an HTML error page. Check Vercel Function Logs for /api/dashboard-data.`
        : `Server returned ${res.status} ${res.statusText || "error"}.`
    );
  }

  return payload;
}

async function dashboardDataRequest<T>(action: string, data: Record<string, any> = {}): Promise<T> {
  if (typeof window === "undefined") {
    throw new Error("Dashboard data API is only available in the browser.");
  }

  // Get session token
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("You are not signed in. Please sign in again.");
  }

  const response = await fetch("/api/dashboard-data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...data }),
  });
  const payload = await parseApiResponse(response);
  return payload.data as T;
}

function shouldUseDashboardApi() {
  return typeof window !== "undefined" && isFirebaseConfigured();
}

function getDbClient() {
  if (typeof window === "undefined") {
    return getSupabaseAdmin();
  }
  return supabase;
}

async function getUniqueRestaurantSlug(desiredSlug: string, currentRestaurantId?: string) {
  const baseSlug = normalizeSlug(desiredSlug);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    let matches: Restaurant[] = [];

    if (isMockDatabaseEnabled()) {
      const res = await fetchMock("GET_DOCS", "restaurants", undefined, undefined, { slug: candidate });
      matches = res.data || [];
    } else {
      const dbClient = getDbClient();
      const { data, error } = await dbClient
        .from("restaurants")
        .select("id, slug")
        .eq("slug", candidate)
        .limit(10);
      matches = (data || []).map((r: any) => ({ id: r.id, slug: r.slug } as Restaurant));
    }

    const hasConflict = matches.some((rest: any) => rest.id !== currentRestaurantId);
    if (!hasConflict) return candidate;

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

// --- Supabase Database CRUD Operations ---

// User Profile
export async function createUserProfile(uid: string, data: Partial<UserProfile>) {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("setDoc", "users", uid, data);
    return res.data;
  }

  const dbClient = getDbClient();
  const profilePayload = {
    uid,
    full_name: data.fullName || "",
    email: data.email || "",
    photo_url: data.photoURL || "",
    updated_at: new Date().toISOString()
  };

  const { data: inserted, error } = await dbClient
    .from("profiles")
    .upsert(profilePayload)
    .select()
    .single();

  if (error) throw error;
  return {
    uid: inserted.uid,
    fullName: inserted.full_name,
    email: inserted.email,
    photoURL: inserted.photo_url || "",
    createdAt: inserted.created_at,
    updatedAt: inserted.updated_at
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOC", "users", uid);
    return res.data;
  }

  const dbClient = getDbClient();
  const { data, error } = await dbClient
    .from("profiles")
    .select("*")
    .eq("uid", uid)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    uid: data.uid,
    fullName: data.full_name,
    email: data.email,
    photoURL: data.photo_url || "",
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

// Restaurants
export async function createRestaurant(ownerId: string, data: Omit<Restaurant, "ownerId" | "createdAt" | "updatedAt" | "status">) {
  const uniqueSlug = await getUniqueRestaurantSlug(data.slug || data.name, data.id);

  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("createRestaurant", "restaurants", undefined, { ...data, slug: uniqueSlug }, { uid: ownerId });
    return res.data;
  }

  const dbClient = getDbClient();
  const restaurantPayload = {
    id: data.id || undefined,
    owner_id: ownerId,
    name: data.name,
    slug: uniqueSlug,
    logo_url: data.logoUrl || null,
    cuisine: data.cuisine || null,
    currency: data.currency || "USD",
    phone: data.phone || null,
    whatsapp: data.whatsapp || null,
    address: data.address || null,
    status: "active",
    updated_at: new Date().toISOString()
  };

  const { data: rest, error } = await dbClient
    .from("restaurants")
    .insert(restaurantPayload)
    .select()
    .single();

  if (error) throw error;

  // Add membership record for the owner
  const { error: memberError } = await dbClient
    .from("restaurant_members")
    .insert({
      restaurant_id: rest.id,
      uid: ownerId,
      role: "owner"
    });

  if (memberError) throw memberError;

  return {
    id: rest.id,
    ownerId: rest.owner_id,
    name: rest.name,
    slug: rest.slug,
    logoUrl: rest.logo_url || "",
    cuisine: rest.cuisine || "",
    currency: rest.currency,
    phone: rest.phone || "",
    whatsapp: rest.whatsapp || "",
    address: rest.address || "",
    status: rest.status as any,
    createdAt: rest.created_at,
    updatedAt: rest.updated_at
  };
}

export async function getRestaurant(restaurantId: string): Promise<Restaurant | null> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOC", "restaurants", restaurantId);
    return res.data;
  }

  const dbClient = getDbClient();
  const { data, error } = await dbClient
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    ownerId: data.owner_id,
    name: data.name,
    slug: data.slug,
    logoUrl: data.logo_url || "",
    cuisine: data.cuisine || "",
    currency: data.currency,
    phone: data.phone || "",
    whatsapp: data.whatsapp || "",
    address: data.address || "",
    status: data.status as any,
    activeMenuId: data.active_menu_id || undefined,
    currentPublishedMenuId: data.current_published_menu_id || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

export async function getRestaurants(ownerId: string): Promise<Restaurant[]> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOCS", "restaurants", undefined, undefined, { ownerId });
    return sortRestaurantsByUpdatedDate((res.data || []) as Restaurant[]);
  }

  const dbClient = getDbClient();
  const { data, error } = await dbClient
    .from("restaurants")
    .select("*")
    .eq("owner_id", ownerId);

  if (error) throw error;

  const mapped = (data || []).map((r: any) => ({
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    slug: r.slug,
    logoUrl: r.logo_url || "",
    cuisine: r.cuisine || "",
    currency: r.currency,
    phone: r.phone || "",
    whatsapp: r.whatsapp || "",
    address: r.address || "",
    status: r.status as any,
    activeMenuId: r.active_menu_id || undefined,
    currentPublishedMenuId: r.current_published_menu_id || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));

  return sortRestaurantsByUpdatedDate(mapped);
}

export async function getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOCS", "restaurants", undefined, undefined, { slug });
    const restaurants = sortRestaurantsByUpdatedDate((res.data || []) as Restaurant[]);
    return restaurants[0] || null;
  }

  const dbClient = getDbClient();
  const { data, error } = await dbClient
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    ownerId: data.owner_id,
    name: data.name,
    slug: data.slug,
    logoUrl: data.logo_url || "",
    cuisine: data.cuisine || "",
    currency: data.currency,
    phone: data.phone || "",
    whatsapp: data.whatsapp || "",
    address: data.address || "",
    status: data.status as any,
    activeMenuId: data.active_menu_id || undefined,
    currentPublishedMenuId: data.current_published_menu_id || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

export async function updateRestaurant(restaurantId: string, data: Partial<Restaurant>) {
  if (isMockDatabaseEnabled()) {
    await fetchMock("updateDoc", "restaurants", restaurantId, data);
    return;
  }

  const dbClient = getDbClient();
  const dbPayload: any = {};
  if (data.name !== undefined) dbPayload.name = data.name;
  if (data.slug !== undefined) dbPayload.slug = data.slug;
  if (data.logoUrl !== undefined) dbPayload.logo_url = data.logoUrl;
  if (data.cuisine !== undefined) dbPayload.cuisine = data.cuisine;
  if (data.currency !== undefined) dbPayload.currency = data.currency;
  if (data.phone !== undefined) dbPayload.phone = data.phone;
  if (data.whatsapp !== undefined) dbPayload.whatsapp = data.whatsapp;
  if (data.address !== undefined) dbPayload.address = data.address;
  if (data.status !== undefined) dbPayload.status = data.status;
  if (data.activeMenuId !== undefined) dbPayload.active_menu_id = data.activeMenuId;
  if (data.currentPublishedMenuId !== undefined) dbPayload.current_published_menu_id = data.currentPublishedMenuId;
  dbPayload.updated_at = new Date().toISOString();

  const { error } = await dbClient
    .from("restaurants")
    .update(dbPayload)
    .eq("id", restaurantId);

  if (error) throw error;
}

// Uploads
export async function addUpload(restaurantId: string, uploadData: Omit<MenuUpload, "createdAt" | "extractionStatus">) {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("addDoc", "uploads", undefined, {
      ...uploadData,
      restaurantId,
      extractionStatus: "pending"
    });
    return res.data;
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<MenuUpload & { id: string }>("addUpload", { restaurantId, uploadData });
  }

  const dbClient = getDbClient();
  const { data, error } = await dbClient
    .from("menu_uploads")
    .insert({
      restaurant_id: restaurantId,
      file_url: uploadData.fileUrl,
      storage_path: uploadData.storagePath,
      file_type: uploadData.fileType,
      original_file_name: uploadData.originalFileName,
      extraction_status: "pending"
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    fileUrl: data.file_url,
    storagePath: data.storage_path,
    fileType: data.file_type,
    originalFileName: data.original_file_name,
    extractionStatus: data.extraction_status as any,
    createdAt: data.created_at
  };
}

export async function getUploads(restaurantId: string): Promise<MenuUpload[]> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOCS", "uploads", undefined, undefined, { restaurantId });
    return res.data || [];
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<MenuUpload[]>("getUploads", { restaurantId });
  }

  const dbClient = getDbClient();
  const { data, error } = await dbClient
    .from("menu_uploads")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((u: any) => ({
    id: u.id,
    fileUrl: u.file_url,
    storagePath: u.storage_path,
    fileType: u.file_type,
    originalFileName: u.original_file_name,
    extractionStatus: u.extraction_status as any,
    extractedJson: u.extracted_json || undefined,
    createdAt: u.created_at
  }));
}

export async function updateUploadStatus(
  restaurantId: string,
  uploadId: string,
  status: MenuUpload["extractionStatus"],
  extractedJson?: string
) {
  if (isMockDatabaseEnabled()) {
    await fetchMock("updateDoc", "uploads", uploadId, { extractionStatus: status, extractedJson });
    return;
  }

  if (shouldUseDashboardApi()) {
    await dashboardDataRequest("updateUploadStatus", { restaurantId, uploadId, status, extractedJson });
    return;
  }

  const dbClient = getDbClient();
  const payload: any = { extraction_status: status };
  if (extractedJson !== undefined) {
    payload.extracted_json = extractedJson;
  }

  const { error } = await dbClient
    .from("menu_uploads")
    .update(payload)
    .eq("id", uploadId);

  if (error) throw error;
}

// Menus
export async function saveMenu(restaurantId: string, menuId: string, menuData: Partial<Menu>) {
  if (isMockDatabaseEnabled()) {
    await fetchMock("setDoc", "menus", menuId, { ...menuData, restaurantId });
    return;
  }

  if (shouldUseDashboardApi()) {
    await dashboardDataRequest("saveMenu", { restaurantId, menuId, menuData });
    return;
  }

  const dbClient = getDbClient();

  const dbMenu: any = {
    id: menuId,
    restaurant_id: restaurantId,
    updated_at: new Date().toISOString()
  };

  if (menuData.name !== undefined) dbMenu.name = menuData.name;
  if (menuData.status !== undefined) dbMenu.status = menuData.status;
  if (menuData.version !== undefined) dbMenu.version = menuData.version;
  if (menuData.theme !== undefined) dbMenu.theme = menuData.theme;
  if (menuData.sourceFileUrl !== undefined) dbMenu.source_file_url = menuData.sourceFileUrl;
  if (menuData.sourceFileType !== undefined) dbMenu.source_file_type = menuData.sourceFileType;
  if (menuData.sourceFileName !== undefined) dbMenu.source_file_name = menuData.sourceFileName;
  if (menuData.sourceUploadId !== undefined) dbMenu.source_upload_id = menuData.sourceUploadId;
  if (menuData.rawExtractedText !== undefined) dbMenu.raw_extracted_text = menuData.rawExtractedText;
  if (menuData.rawDigitizedJson !== undefined) dbMenu.raw_digitized_json = menuData.rawDigitizedJson;
  if (menuData.structuredItemsVerified !== undefined) dbMenu.structured_items_verified = menuData.structuredItemsVerified;
  if (menuData.digitizationMetadata !== undefined) dbMenu.digitization_metadata = menuData.digitizationMetadata;
  if (menuData.publishedAt !== undefined) dbMenu.published_at = menuData.publishedAt;

  const { error: menuErr } = await dbClient
    .from("menus")
    .upsert(dbMenu);

  if (menuErr) throw menuErr;

  // Sync Categories & Items
  if (menuData.categories) {
    try {
      const { error: deleteErr } = await dbClient
        .from("menu_categories")
        .delete()
        .eq("menu_id", menuId);

      if (deleteErr) throw deleteErr;

      for (let catIndex = 0; catIndex < menuData.categories.length; catIndex++) {
        const category = menuData.categories[catIndex];
        const catId = category.id && !category.id.startsWith("cat_") ? category.id : crypto.randomUUID();

        const { error: catErr } = await dbClient
          .from("menu_categories")
          .insert({
            id: catId,
            menu_id: menuId,
            name: category.name || "",
            description: category.description || null,
            sort_order: category.sortOrder ?? catIndex,
            is_active: category.isActive !== false
          });

        if (catErr) throw catErr;

        if (category.items && category.items.length > 0) {
          const itemsPayload = category.items.map((item, itemIndex) => {
            const itemId = item.id && !item.id.startsWith("item_") ? item.id : crypto.randomUUID();
            return {
              id: itemId,
              menu_id: menuId,
              category_id: catId,
              name: item.name || "",
              description: item.description || null,
              price: Number(item.price) || 0,
              price_label: item.priceLabel || null,
              price_options: item.priceOptions || [],
              variants: item.variants || [],
              confidence: item.confidence || "high",
              subcategory: item.subcategory || null,
              dietary_tag: item.dietaryTag || null,
              special_tag: item.specialTag || null,
              type: item.type || item.dietaryTag || "unknown",
              image_url: item.imageUrl || item.image || null,
              is_available: item.isAvailable !== false,
              is_veg: item.type === "veg" || item.type === "vegan" || item.dietaryTag === "veg" || item.dietaryTag === "vegan",
              is_featured: item.isFeatured || item.isPopular || false,
              is_popular: item.isPopular || false,
              spice_level: item.spiceLevel ?? null,
              allergens: item.allergens || [],
              tags: item.tags || [],
              sort_order: item.sortOrder ?? itemIndex
            };
          });

          const { error: itemsErr } = await dbClient
            .from("menu_items")
            .insert(itemsPayload);

          if (itemsErr) throw itemsErr;
        }
      }
    } catch (err) {
      console.error("Error syncing menu categories and items table:", err);
    }
  }
}

export async function createMenu(restaurantId: string, name: string) {
  const defaultTheme: MenuTheme = {
    theme: "classic",
    primaryColor: "#d97706",
    secondaryColor: "#1e293b",
    backgroundColor: "#fafaf9",
    textColor: "#1c1917",
    fontFamily: "Inter",
    cardStyle: "3d-tilt",
  };

  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("addDoc", "menus", undefined, {
      name,
      restaurantId,
      status: "draft",
      version: 1,
      categories: [],
      theme: defaultTheme
    });
    return res.id;
  }

  if (shouldUseDashboardApi()) {
    const res = await dashboardDataRequest<{ id: string }>("createMenu", { restaurantId, name });
    return res.id;
  }

  const dbClient = getDbClient();
  const { data, error } = await dbClient
    .from("menus")
    .insert({
      restaurant_id: restaurantId,
      name,
      status: "draft",
      version: 1,
      theme: defaultTheme
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function getMenus(restaurantId: string): Promise<Menu[]> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOCS", "menus", undefined, undefined, { restaurantId });
    return res.data || [];
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<Menu[]>("getMenus", { restaurantId });
  }

  const dbClient = getDbClient();
  const { data, error } = await dbClient
    .from("menus")
    .select("id, name, status, version, theme, created_at, updated_at")
    .eq("restaurant_id", restaurantId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    status: m.status as any,
    version: m.version,
    categories: [],
    theme: m.theme,
    createdAt: m.created_at,
    updatedAt: m.updated_at
  }));
}

export async function getMenu(restaurantId: string, menuId: string): Promise<Menu | null> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOC", "menus", menuId);
    return res.data;
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<Menu | null>("getMenu", { restaurantId, menuId });
  }

  const dbClient = getDbClient();
  
  const { data: menu, error } = await dbClient
    .from("menus")
    .select("*")
    .eq("id", menuId)
    .maybeSingle();

  if (error) throw error;
  if (!menu) return null;

  const { data: dbCategories, error: catErr } = await dbClient
    .from("menu_categories")
    .select("*")
    .eq("menu_id", menuId)
    .order("sort_order", { ascending: true });
  if (catErr) throw catErr;

  const { data: dbItems, error: itemsErr } = await dbClient
    .from("menu_items")
    .select("*")
    .eq("menu_id", menuId)
    .order("sort_order", { ascending: true });
  if (itemsErr) throw itemsErr;

  const itemsByCat: Record<string, MenuItem[]> = {};
  (dbItems || []).forEach((item: any) => {
    if (!itemsByCat[item.category_id]) {
      itemsByCat[item.category_id] = [];
    }
    itemsByCat[item.category_id].push({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: Number(item.price),
      priceLabel: item.price_label || undefined,
      priceOptions: item.price_options || [],
      variants: item.variants || [],
      confidence: item.confidence as any,
      subcategory: item.subcategory,
      dietaryTag: item.dietary_tag as any,
      specialTag: item.special_tag,
      imageUrl: item.image_url || undefined,
      image: item.image_url || undefined,
      allergens: item.allergens || [],
      tags: item.tags || [],
      isAvailable: item.is_available,
      isActive: item.is_available,
      isFeatured: item.is_featured,
      isPopular: item.is_popular,
      type: item.type as any,
      spiceLevel: item.spice_level,
      sortOrder: item.sort_order
    });
  });

  const categories: MenuCategory[] = (dbCategories || []).map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    description: cat.description || undefined,
    sortOrder: cat.sort_order,
    isActive: cat.is_active,
    items: itemsByCat[cat.id] || []
  }));

  return {
    id: menu.id,
    name: menu.name,
    status: menu.status as any,
    version: menu.version,
    categories,
    theme: menu.theme,
    sourceFileUrl: menu.source_file_url || undefined,
    sourceFileType: menu.source_file_type || undefined,
    sourceFileName: menu.source_file_name || undefined,
    sourceUploadId: menu.source_upload_id || undefined,
    rawExtractedText: menu.raw_extracted_text || undefined,
    rawDigitizedJson: menu.raw_digitized_json || undefined,
    structuredItemsVerified: menu.structured_items_verified,
    digitizationMetadata: menu.digitization_metadata || undefined,
    publishedAt: menu.published_at,
    createdAt: menu.created_at,
    updatedAt: menu.updated_at
  };
}

export async function getPublishedMenuForRestaurant(restaurant: Restaurant): Promise<Menu | null> {
  if (!restaurant.id) return null;

  const getPublishedMenuById = async (menuId: string) => {
    if (isMockDatabaseEnabled()) {
      const res = await fetchMock("GET_DOC", "menus", menuId);
      const menu = res.data as Menu | null;
      return menu?.status === "published" ? menu : null;
    }
    return getMenu(restaurant.id!, menuId);
  };

  if (restaurant.currentPublishedMenuId) {
    return getPublishedMenuById(restaurant.currentPublishedMenuId);
  }

  if (restaurant.activeMenuId) {
    const activeMenu = await getPublishedMenuById(restaurant.activeMenuId);
    if (activeMenu) return activeMenu;
  }

  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOCS", "menus", undefined, undefined, { restaurantId: restaurant.id });
    const publishedMenus = ((res.data || []) as Menu[]).filter(menu => menu.status === "published");
    return sortMenusByPublishDate(publishedMenus)[0] || null;
  }

  const dbClient = getDbClient();
  const { data, error } = await dbClient
    .from("menus")
    .select("id")
    .eq("restaurant_id", restaurant.id)
    .eq("status", "published")
    .limit(25);

  if (error || !data || data.length === 0) return null;

  const menus = await Promise.all(data.map((m: any) => getMenu(restaurant.id!, m.id)));
  const validMenus = menus.filter((m: any): m is Menu => m !== null);
  return sortMenusByPublishDate(validMenus)[0] || null;
}

export async function getMenuCategoriesSubcollection(restaurantId: string, menuId: string): Promise<any[]> {
  if (isMockDatabaseEnabled()) return [];
  const dbClient = getDbClient();
  const { data } = await dbClient
    .from("menu_categories")
    .select("*")
    .eq("menu_id", menuId);
  return data || [];
}

export async function getMenuItemsSubcollection(restaurantId: string, menuId: string): Promise<any[]> {
  if (isMockDatabaseEnabled()) return [];
  const dbClient = getDbClient();
  const { data } = await dbClient
    .from("menu_items")
    .select("*")
    .eq("menu_id", menuId);
  return (data || []).map((item: any) => ({
    ...item,
    categoryId: item.category_id,
    imageUrl: item.image_url,
    isAvailable: item.is_available,
    isFeatured: item.is_featured,
    isPopular: item.is_popular
  }));
}

export async function getActiveThemeForRestaurant(restaurantId: string): Promise<MenuTheme | null> {
  if (isMockDatabaseEnabled()) return null;
  
  // We store menu themes directly inside the published menu. 
  // Let's fetch the restaurant and grab its current published menu theme.
  const restaurant = await getRestaurant(restaurantId);
  if (!restaurant || !restaurant.currentPublishedMenuId) return null;
  
  const menu = await getMenu(restaurantId, restaurant.currentPublishedMenuId);
  return menu ? menu.theme : null;
}

export async function publishMenu(restaurantId: string, menuId: string) {
  if (isMockDatabaseEnabled()) {
    const restaurant = await getRestaurant(restaurantId);
    const slug = restaurant
      ? await getUniqueRestaurantSlug(restaurant.slug || restaurant.name, restaurantId)
      : undefined;
    const publishedAt = { seconds: Math.floor(Date.now() / 1000) };

    await fetchMock("updateDoc", "menus", menuId, {
      status: "published",
      publishedAt
    });
    await fetchMock("updateDoc", "restaurants", restaurantId, {
      ...(slug ? { slug } : {}),
      status: "published",
      activeMenuId: menuId,
      currentPublishedMenuId: menuId
    });
    return;
  }

  if (shouldUseDashboardApi()) {
    await dashboardDataRequest("publishMenu", { restaurantId, menuId });
    return;
  }

  const dbClient = getDbClient();
  
  const { data: rest, error: restErr } = await dbClient
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .single();

  if (restErr) throw restErr;
  const uniqueSlug = await getUniqueRestaurantSlug(rest.slug || rest.name, restaurantId);

  const { error: menuErr } = await dbClient
    .from("menus")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", menuId);

  if (menuErr) throw menuErr;

  const { error: restUpdateErr } = await dbClient
    .from("restaurants")
    .update({
      slug: uniqueSlug,
      status: "published",
      active_menu_id: menuId,
      current_published_menu_id: menuId,
      updated_at: new Date().toISOString()
    })
    .eq("id", restaurantId);

  if (restUpdateErr) throw restUpdateErr;
}

// QR Code
export async function createQrCode(restaurantId: string, name: string): Promise<QrCode & { id: string }> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("addDoc", "qrs", undefined, { restaurantId, name, scanCount: 0 });
    return res.data;
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<QrCode & { id: string }>("createQrCode", { restaurantId, name });
  }

  const dbClient = getDbClient();
  const { data, error } = await dbClient
    .from("qrs")
    .insert({
      restaurant_id: restaurantId,
      name,
      scan_count: 0
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    restaurantId: data.restaurant_id,
    name: data.name,
    scanCount: data.scan_count,
    createdAt: data.created_at
  };
}

export async function getRestaurantQrs(restaurantId: string): Promise<QrCode[]> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOCS", "qrs", undefined, undefined, { restaurantId });
    return res.data || [];
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<QrCode[]>("getRestaurantQrs", { restaurantId });
  }

  const dbClient = getDbClient();
  const { data, error } = await dbClient
    .from("qrs")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((q: any) => ({
    id: q.id,
    restaurantId: q.restaurant_id,
    name: q.name,
    scanCount: q.scan_count,
    createdAt: q.created_at
  }));
}

export async function getQrCode(qrId: string): Promise<QrCode | null> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOC", "qrs", qrId);
    return res.data;
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<QrCode | null>("getQrCode", { qrId });
  }

  const dbClient = getDbClient();
  const { data, error } = await dbClient
    .from("qrs")
    .select("*")
    .eq("id", qrId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    restaurantId: data.restaurant_id,
    name: data.name,
    scanCount: data.scan_count,
    createdAt: data.created_at
  };
}

export async function recordQrScan(qrId: string, restaurantId: string, metadata: { userAgent?: string; referer?: string }) {
  if (isMockDatabaseEnabled()) {
    await fetchMock("recordScan", "qrs", qrId, metadata, { restaurantId });
    return;
  }

  if (shouldUseDashboardApi()) {
    await dashboardDataRequest("recordQrScan", { restaurantId, qrId, metadata });
    return;
  }

  const dbClient = getDbClient();

  // Fetch current scan count
  const { data: qr, error: qrErr } = await dbClient
    .from("qrs")
    .select("scan_count")
    .eq("id", qrId)
    .single();

  if (!qrErr && qr) {
    await dbClient
      .from("qrs")
      .update({ scan_count: qr.scan_count + 1 })
      .eq("id", qrId);
  }

  // Insert scan log
  await dbClient
    .from("scans")
    .insert({
      restaurant_id: restaurantId,
      qr_id: qrId,
      user_agent: metadata.userAgent || "Unknown",
      referer: metadata.referer || "Direct"
    });
}

export async function getScanLogs(restaurantId: string, limitCount = 100): Promise<ScanLog[]> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOCS", "scans", undefined, undefined, { restaurantId });
    return res.data ? res.data.slice(0, limitCount) : [];
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<ScanLog[]>("getScanLogs", { restaurantId, limitCount });
  }

  const dbClient = getDbClient();
  const { data, error } = await dbClient
    .from("scans")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("timestamp", { ascending: false })
    .limit(limitCount);

  if (error) throw error;

  return (data || []).map((s: any) => ({
    id: s.id,
    qrId: s.qr_id,
    timestamp: s.timestamp,
    userAgent: s.user_agent || "Unknown",
    referer: s.referer || "Direct"
  }));
}
