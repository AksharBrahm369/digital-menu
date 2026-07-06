import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  writeBatch
} from "firebase/firestore";
import { auth, db, isFirebaseConfigured, isMockDatabaseEnabled } from "./config";

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

const isPublicRestaurantStatus = (status?: Restaurant["status"]) => {
  return status === "active" || status === "published";
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
    // Return empty on SSR if fetch is not available in mock mode
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
    const textSnippet = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
    throw new Error(
      payload.error ||
        `Server returned ${res.status} ${res.statusText || "error"}${textSnippet ? `: ${textSnippet}` : ""}`
    );
  }

  return payload;
}

async function dashboardDataRequest<T>(action: string, data: Record<string, any> = {}): Promise<T> {
  if (typeof window === "undefined") {
    throw new Error("Dashboard data API is only available in the browser.");
  }

  const token = await auth.currentUser?.getIdToken();
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
      const slugQuery = query(collection(db, "restaurants"), where("slug", "==", candidate), limit(10));
      const querySnapshot = await getDocs(slugQuery);
      matches = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Restaurant));
    }

    const hasConflict = matches.some(rest => rest.id !== currentRestaurantId);
    if (!hasConflict) return candidate;

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

// --- Firestore CRUD Operations with Local Mock Fallback ---

// User Profile
export async function createUserProfile(uid: string, data: Partial<UserProfile>) {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("setDoc", "users", uid, data);
    return res.data;
  }

  const userRef = doc(db, "users", uid);
  const profile = {
    uid,
    fullName: data.fullName || "",
    email: data.email || "",
    photoURL: data.photoURL || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(userRef, profile);
  return profile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOC", "users", uid);
    return res.data;
  }

  const userDoc = await getDoc(doc(db, "users", uid));
  return userDoc.exists() ? (userDoc.data() as UserProfile) : null;
}

// Restaurants
export async function createRestaurant(ownerId: string, data: Omit<Restaurant, "ownerId" | "createdAt" | "updatedAt" | "status">) {
  const uniqueSlug = await getUniqueRestaurantSlug(data.slug || data.name, data.id);

  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("createRestaurant", "restaurants", undefined, { ...data, slug: uniqueSlug }, { uid: ownerId });
    return res.data;
  }

  const restaurantsColl = collection(db, "restaurants");
  const restDocRef = data.id ? doc(db, "restaurants", data.id) : doc(restaurantsColl);
  const restaurantId = restDocRef.id;
  
  const restaurantData: Restaurant = {
    ...data,
    slug: uniqueSlug,
    ownerId,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const memberRef = doc(db, "restaurants", restaurantId, "members", ownerId);
  const memberData: RestaurantMember = {
    uid: ownerId,
    role: "owner",
    invitedAt: serverTimestamp(),
    joinedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(restDocRef, restaurantData);
  batch.set(memberRef, memberData);
  
  await batch.commit();
  return { id: restaurantId, ...restaurantData };
}

export async function getRestaurant(restaurantId: string): Promise<Restaurant | null> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOC", "restaurants", restaurantId);
    return res.data;
  }

  const restDoc = await getDoc(doc(db, "restaurants", restaurantId));
  return restDoc.exists() ? { id: restDoc.id, ...restDoc.data() } as Restaurant : null;
}

export async function getRestaurants(ownerId: string): Promise<Restaurant[]> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOCS", "restaurants", undefined, undefined, { ownerId });
    return sortRestaurantsByUpdatedDate((res.data || []) as Restaurant[]);
  }

  const q = query(collection(db, "restaurants"), where("ownerId", "==", ownerId));
  const querySnapshot = await getDocs(q);
  const restaurants = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Restaurant));
  return sortRestaurantsByUpdatedDate(restaurants);
}

export async function getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOCS", "restaurants", undefined, undefined, { slug });
    const restaurants = sortRestaurantsByUpdatedDate((res.data || []) as Restaurant[]);
    return restaurants[0] || null;
  }

  const q = query(collection(db, "restaurants"), where("slug", "==", slug), limit(1));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const docSnap = querySnapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as Restaurant;
}

export async function updateRestaurant(restaurantId: string, data: Partial<Restaurant>) {
  if (isMockDatabaseEnabled()) {
    await fetchMock("updateDoc", "restaurants", restaurantId, data);
    return;
  }

  const docRef = doc(db, "restaurants", restaurantId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
}

// Uploads (Menu PDF/Image Upload Logs)
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

  const collRef = collection(db, "restaurants", restaurantId, "uploads");
  const docRef = await addDoc(collRef, {
    ...uploadData,
    extractionStatus: "pending",
    createdAt: serverTimestamp(),
  });
  return { id: docRef.id, ...uploadData };
}

export async function getUploads(restaurantId: string): Promise<MenuUpload[]> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOCS", "uploads", undefined, undefined, { restaurantId });
    return res.data || [];
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<MenuUpload[]>("getUploads", { restaurantId });
  }

  const q = query(collection(db, "restaurants", restaurantId, "uploads"), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuUpload));
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

  const docRef = doc(db, "restaurants", restaurantId, "uploads", uploadId);
  const updateData: Partial<MenuUpload> = { extractionStatus: status };
  if (extractedJson !== undefined) {
    updateData.extractedJson = extractedJson;
  }
  await updateDoc(docRef, updateData);
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

  const docRef = doc(db, "restaurants", restaurantId, "menus", menuId);
  await setDoc(docRef, {
    ...menuData,
    updatedAt: serverTimestamp()
  }, { merge: true });

  // Sync categories and items to Firestore subcollections if updated
  if (menuData.categories) {
    try {
      const categoriesColl = collection(db, "restaurants", restaurantId, "menus", menuId, "categories");
      const itemsColl = collection(db, "restaurants", restaurantId, "menus", menuId, "items");

      // Fetch existing documents to clean them up first
      const [categoriesSnapshot, itemsSnapshot] = await Promise.all([
        getDocs(categoriesColl),
        getDocs(itemsColl)
      ]);

      const batch = writeBatch(db);

      // Add delete operations
      categoriesSnapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      itemsSnapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });

      // Add write operations for updated categories and items
      menuData.categories.forEach((category, catIndex) => {
        const catId = category.id || `cat_${catIndex}`;
        const catDocRef = doc(categoriesColl, catId);
        
        batch.set(catDocRef, {
          name: category.name || "",
          description: category.description || "",
          sortOrder: category.sortOrder ?? catIndex,
          isActive: category.isActive !== false
        });

        if (category.items) {
          category.items.forEach((item, itemIndex) => {
            const itemId = item.id || `item_${catIndex}_${itemIndex}`;
            const itemDocRef = doc(itemsColl, itemId);
            
            batch.set(itemDocRef, {
              categoryId: catId,
              name: item.name || "",
              description: item.description || "",
              price: Number(item.price) || 0,
              priceLabel: item.priceLabel || "",
              priceOptions: item.priceOptions || [],
              variants: item.variants || [],
              confidence: item.confidence || "high",
              subcategory: item.subcategory || null,
              dietaryTag: item.dietaryTag || null,
              specialTag: item.specialTag || null,
              type: item.type || item.dietaryTag || "unknown",
              imageUrl: item.imageUrl || item.image || "",
              isAvailable: item.isAvailable !== false,
              isVeg: item.type === "veg" || item.type === "vegan" || item.dietaryTag === "veg" || item.dietaryTag === "vegan",
              isFeatured: item.isFeatured || item.isPopular || false,
              isPopular: item.isPopular || false,
              spiceLevel: item.spiceLevel ?? null,
              allergens: item.allergens || [],
              tags: item.tags || [],
              sortOrder: item.sortOrder ?? itemIndex,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          });
        }
      });

      await batch.commit();
    } catch (err) {
      console.error("Error syncing menu subcollections:", err);
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

  const collRef = collection(db, "restaurants", restaurantId, "menus");
  const docRef = await addDoc(collRef, {
    name,
    status: "draft",
    version: 1,
    categories: [],
    theme: defaultTheme,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getMenus(restaurantId: string): Promise<Menu[]> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOCS", "menus", undefined, undefined, { restaurantId });
    return res.data || [];
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<Menu[]>("getMenus", { restaurantId });
  }

  const q = query(collection(db, "restaurants", restaurantId, "menus"), orderBy("updatedAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Menu));
}

export async function getMenu(restaurantId: string, menuId: string): Promise<Menu | null> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOC", "menus", menuId);
    return res.data;
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<Menu | null>("getMenu", { restaurantId, menuId });
  }

  const docRef = doc(db, "restaurants", restaurantId, "menus", menuId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Menu : null;
}

export async function getPublishedMenuForRestaurant(restaurant: Restaurant): Promise<Menu | null> {
  if (!restaurant.id) return null;

  const getPublishedMenuById = async (menuId: string) => {
    if (isMockDatabaseEnabled()) {
      const res = await fetchMock("GET_DOC", "menus", menuId);
      const menu = res.data as Menu | null;
      return menu?.status === "published" ? menu : null;
    }

    const docRef = doc(db, "restaurants", restaurant.id!, "menus", menuId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    const menu = { id: docSnap.id, ...docSnap.data() } as Menu;
    return menu.status === "published" ? menu : null;
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

  const publishedQuery = query(
    collection(db, "restaurants", restaurant.id, "menus"),
    where("status", "==", "published"),
    limit(25)
  );
  const querySnapshot = await getDocs(publishedQuery);
  const publishedMenus = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Menu));
  return sortMenusByPublishDate(publishedMenus)[0] || null;
}

export async function getMenuCategoriesSubcollection(restaurantId: string, menuId: string): Promise<any[]> {
  if (isMockDatabaseEnabled()) {
    return [];
  }
  try {
    const collRef = collection(db, "restaurants", restaurantId, "menus", menuId, "categories");
    const querySnapshot = await getDocs(collRef);
    return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.error("Error fetching categories subcollection:", err);
    return [];
  }
}

export async function getMenuItemsSubcollection(restaurantId: string, menuId: string): Promise<any[]> {
  if (isMockDatabaseEnabled()) {
    return [];
  }
  try {
    const collRef = collection(db, "restaurants", restaurantId, "menus", menuId, "items");
    const querySnapshot = await getDocs(collRef);
    return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.error("Error fetching items subcollection:", err);
    return [];
  }
}

export async function getActiveThemeForRestaurant(restaurantId: string): Promise<MenuTheme | null> {
  if (isMockDatabaseEnabled()) {
    return null;
  }
  try {
    const themesColl = collection(db, "restaurants", restaurantId, "themes");
    const q = query(themesColl, where("isActive", "==", true), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as MenuTheme;
    }
  } catch (err) {
    console.error("Error fetching active theme:", err);
  }
  return null;
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

  const menuRef = doc(db, "restaurants", restaurantId, "menus", menuId);
  const restRef = doc(db, "restaurants", restaurantId);
  const restDoc = await getDoc(restRef);
  const restData = restDoc.exists() ? ({ id: restDoc.id, ...restDoc.data() } as Restaurant) : null;
  const uniqueSlug = restData ? await getUniqueRestaurantSlug(restData.slug || restData.name, restaurantId) : undefined;

  const batch = writeBatch(db);
  batch.update(menuRef, {
    status: "published",
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  batch.update(restRef, {
    ...(uniqueSlug ? { slug: uniqueSlug } : {}),
    status: "published",
    activeMenuId: menuId,
    currentPublishedMenuId: menuId,
    updatedAt: serverTimestamp()
  });

  await batch.commit();
}

// QR Code and Table placard tags
export async function createQrCode(restaurantId: string, name: string): Promise<QrCode & { id: string }> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("addDoc", "qrs", undefined, { restaurantId, name, scanCount: 0 });
    return res.data;
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<QrCode & { id: string }>("createQrCode", { restaurantId, name });
  }

  const collRef = collection(db, "qrs");
  const docRef = await addDoc(collRef, {
    restaurantId,
    name,
    scanCount: 0,
    createdAt: serverTimestamp()
  });
  return { id: docRef.id, restaurantId, name, scanCount: 0, createdAt: new Date() };
}

export async function getRestaurantQrs(restaurantId: string): Promise<QrCode[]> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOCS", "qrs", undefined, undefined, { restaurantId });
    return res.data || [];
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<QrCode[]>("getRestaurantQrs", { restaurantId });
  }

  const q = query(collection(db, "qrs"), where("restaurantId", "==", restaurantId), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QrCode));
}

export async function getQrCode(qrId: string): Promise<QrCode | null> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOC", "qrs", qrId);
    return res.data;
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<QrCode | null>("getQrCode", { qrId });
  }

  const docRef = doc(db, "qrs", qrId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as QrCode : null;
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

  const qrRef = doc(db, "qrs", qrId);
  const scanColl = collection(db, "restaurants", restaurantId, "scans");
  const batch = writeBatch(db);
  
  batch.update(qrRef, { scanCount: increment(1) });

  const scanDocRef = doc(scanColl);
  batch.set(scanDocRef, {
    qrId,
    timestamp: serverTimestamp(),
    userAgent: metadata.userAgent || "Unknown",
    referer: metadata.referer || "Direct",
  });

  await batch.commit();
}

export async function getScanLogs(restaurantId: string, limitCount = 100): Promise<ScanLog[]> {
  if (isMockDatabaseEnabled()) {
    const res = await fetchMock("GET_DOCS", "scans", undefined, undefined, { restaurantId });
    return res.data ? res.data.slice(0, limitCount) : [];
  }

  if (shouldUseDashboardApi()) {
    return dashboardDataRequest<ScanLog[]>("getScanLogs", { restaurantId, limitCount });
  }

  const q = query(collection(db, "restaurants", restaurantId, "scans"), orderBy("timestamp", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.slice(0, limitCount).map(doc => ({ id: doc.id, ...doc.data() } as ScanLog));
}
