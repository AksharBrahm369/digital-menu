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
import { db, isFirebaseConfigured } from "./config";

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
  image?: string;
  imageUrl?: string;
  allergens: string[];
  tags: string[];
  isAvailable: boolean;
  isActive?: boolean;
  isFeatured?: boolean;
  isPopular?: boolean;
  type: "veg" | "non-veg" | "egg";
  spiceLevel: number;
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

const isPublicRestaurantStatus = (status?: Restaurant["status"]) => {
  return status === "active" || status === "published";
};

const fetchMock = async (action: string, collectionName: string, id?: string, data?: any, extra: Record<string, any> = {}) => {
  if (typeof window === "undefined") {
    // Return empty on SSR if fetch is not available in mock mode
    return { data: id ? null : [] };
  }
  
  if (action === "GET_DOC") {
    const res = await fetch(`/api/mock-db?action=getDoc&collection=${collectionName}&id=${id}`);
    return res.json();
  }
  if (action === "GET_DOCS") {
    let queryStr = `/api/mock-db?action=getDocs&collection=${collectionName}`;
    Object.entries(extra).forEach(([k, v]) => {
      queryStr += `&${k}=${encodeURIComponent(v)}`;
    });
    const res = await fetch(queryStr);
    return res.json();
  }
  
  const res = await fetch("/api/mock-db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, collection: collectionName, id, data, ...extra })
  });
  return res.json();
};

async function getUniqueRestaurantSlug(desiredSlug: string, currentRestaurantId?: string) {
  const baseSlug = normalizeSlug(desiredSlug);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    let matches: Restaurant[] = [];

    if (!isFirebaseConfigured()) {
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
  if (!isFirebaseConfigured()) {
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
  if (!isFirebaseConfigured()) {
    const res = await fetchMock("GET_DOC", "users", uid);
    return res.data;
  }

  const userDoc = await getDoc(doc(db, "users", uid));
  return userDoc.exists() ? (userDoc.data() as UserProfile) : null;
}

// Restaurants
export async function createRestaurant(ownerId: string, data: Omit<Restaurant, "ownerId" | "createdAt" | "updatedAt" | "status">) {
  const uniqueSlug = await getUniqueRestaurantSlug(data.slug || data.name, data.id);

  if (!isFirebaseConfigured()) {
    const res = await fetchMock("createRestaurant", "restaurants", undefined, { ...data, slug: uniqueSlug }, { uid: ownerId });
    return res.data;
  }

  const restaurantsColl = collection(db, "restaurants");
  const restDocRef = doc(restaurantsColl);
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
  if (!isFirebaseConfigured()) {
    const res = await fetchMock("GET_DOC", "restaurants", restaurantId);
    return res.data;
  }

  const restDoc = await getDoc(doc(db, "restaurants", restaurantId));
  return restDoc.exists() ? { id: restDoc.id, ...restDoc.data() } as Restaurant : null;
}

export async function getRestaurants(ownerId: string): Promise<Restaurant[]> {
  if (!isFirebaseConfigured()) {
    const res = await fetchMock("GET_DOCS", "restaurants", undefined, undefined, { ownerId });
    return res.data || [];
  }

  const q = query(collection(db, "restaurants"), where("ownerId", "==", ownerId), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Restaurant));
}

export async function getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  if (!isFirebaseConfigured()) {
    const res = await fetchMock("GET_DOCS", "restaurants", undefined, undefined, { slug });
    const restaurants = (res.data || []) as Restaurant[];
    return restaurants.find(rest => isPublicRestaurantStatus(rest.status) && (rest.currentPublishedMenuId || rest.activeMenuId))
      || restaurants.find(rest => isPublicRestaurantStatus(rest.status))
      || null;
  }

  const q = query(collection(db, "restaurants"), where("slug", "==", slug), limit(10));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const restaurants = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Restaurant));
  return restaurants.find(rest => isPublicRestaurantStatus(rest.status) && (rest.currentPublishedMenuId || rest.activeMenuId))
    || restaurants.find(rest => isPublicRestaurantStatus(rest.status))
    || null;
}

export async function updateRestaurant(restaurantId: string, data: Partial<Restaurant>) {
  if (!isFirebaseConfigured()) {
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
  if (!isFirebaseConfigured()) {
    const res = await fetchMock("addDoc", "uploads", undefined, { ...uploadData, restaurantId });
    return res.data;
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
  if (!isFirebaseConfigured()) {
    const res = await fetchMock("GET_DOCS", "uploads", undefined, undefined, { restaurantId });
    return res.data || [];
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
  if (!isFirebaseConfigured()) {
    await fetchMock("updateDoc", "uploads", uploadId, { extractionStatus: status, extractedJson });
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
  if (!isFirebaseConfigured()) {
    await fetchMock("setDoc", "menus", menuId, { ...menuData, restaurantId });
    return;
  }

  const docRef = doc(db, "restaurants", restaurantId, "menus", menuId);
  await setDoc(docRef, {
    ...menuData,
    updatedAt: serverTimestamp()
  }, { merge: true });
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

  if (!isFirebaseConfigured()) {
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
  if (!isFirebaseConfigured()) {
    const res = await fetchMock("GET_DOCS", "menus", undefined, undefined, { restaurantId });
    return res.data || [];
  }

  const q = query(collection(db, "restaurants", restaurantId, "menus"), orderBy("updatedAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Menu));
}

export async function getMenu(restaurantId: string, menuId: string): Promise<Menu | null> {
  if (!isFirebaseConfigured()) {
    const res = await fetchMock("GET_DOC", "menus", menuId);
    return res.data;
  }

  const docRef = doc(db, "restaurants", restaurantId, "menus", menuId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Menu : null;
}

export async function getPublishedMenuForRestaurant(restaurant: Restaurant): Promise<Menu | null> {
  if (!restaurant.id) return null;

  const preferredMenuId = restaurant.currentPublishedMenuId || restaurant.activeMenuId;
  if (preferredMenuId) {
    const preferredMenu = await getMenu(restaurant.id, preferredMenuId);
    if (preferredMenu?.status === "published") {
      return preferredMenu;
    }
  }

  if (!isFirebaseConfigured()) {
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

export async function publishMenu(restaurantId: string, menuId: string) {
  if (!isFirebaseConfigured()) {
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
      status: "active",
      activeMenuId: menuId,
      currentPublishedMenuId: menuId
    });
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
    status: "active",
    activeMenuId: menuId,
    currentPublishedMenuId: menuId,
    updatedAt: serverTimestamp()
  });

  await batch.commit();
}

// QR Code and Table placard tags
export async function createQrCode(restaurantId: string, name: string): Promise<QrCode & { id: string }> {
  if (!isFirebaseConfigured()) {
    const res = await fetchMock("addDoc", "qrs", undefined, { restaurantId, name, scanCount: 0 });
    return res.data;
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
  if (!isFirebaseConfigured()) {
    const res = await fetchMock("GET_DOCS", "qrs", undefined, undefined, { restaurantId });
    return res.data || [];
  }

  const q = query(collection(db, "qrs"), where("restaurantId", "==", restaurantId), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QrCode));
}

export async function getQrCode(qrId: string): Promise<QrCode | null> {
  if (!isFirebaseConfigured()) {
    const res = await fetchMock("GET_DOC", "qrs", qrId);
    return res.data;
  }

  const docRef = doc(db, "qrs", qrId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as QrCode : null;
}

export async function recordQrScan(qrId: string, restaurantId: string, metadata: { userAgent?: string; referer?: string }) {
  if (!isFirebaseConfigured()) {
    await fetchMock("recordScan", "qrs", qrId, metadata, { restaurantId });
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
  if (!isFirebaseConfigured()) {
    const res = await fetchMock("GET_DOCS", "scans", undefined, undefined, { restaurantId });
    return res.data ? res.data.slice(0, limitCount) : [];
  }

  const q = query(collection(db, "restaurants", restaurantId, "scans"), orderBy("timestamp", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.slice(0, limitCount).map(doc => ({ id: doc.id, ...doc.data() } as ScanLog));
}
