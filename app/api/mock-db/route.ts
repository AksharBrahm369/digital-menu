import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const MOCK_DB_FILE = path.join(process.cwd(), "mock_db.json");

// Helper: Read the mock database from local file
function readDb() {
  if (!fs.existsSync(MOCK_DB_FILE)) {
    return {
      users: {},
      restaurants: {},
      members: {}, // Key: restaurantId_uid
      uploads: {}, // Key: restaurantId_uploadId
      menus: {}, // Key: restaurantId_menuId
      qrs: {}, // Key: qrId
      scans: {} // Key: restaurantId_scanId
    };
  }
  try {
    return JSON.parse(fs.readFileSync(MOCK_DB_FILE, "utf-8"));
  } catch (e) {
    return {
      users: {},
      restaurants: {},
      members: {},
      uploads: {},
      menus: {},
      qrs: {},
      scans: {}
    };
  }
}

// Helper: Write the mock database to local file
function writeDb(data: any) {
  try {
    fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write mock database file:", e);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const collection = searchParams.get("collection");
  const id = searchParams.get("id");

  const db = readDb();

  if (action === "getDoc" && collection && id) {
    // Read single document
    const colData = (db as any)[collection] || {};
    const doc = colData[id] || null;
    return NextResponse.json({ data: doc });
  }

  if (action === "getDocs" && collection) {
    const colData = (db as any)[collection] || {};
    let docs = Object.values(colData);

    // Apply filtering based on collection types
    if (collection === "restaurants") {
      const ownerId = searchParams.get("ownerId");
      const slug = searchParams.get("slug");
      if (ownerId) {
        docs = docs.filter((r: any) => r.ownerId === ownerId);
      }
      if (slug) {
        docs = docs.filter((r: any) => r.slug === slug);
      }
    } else if (collection === "uploads") {
      const restaurantId = searchParams.get("restaurantId");
      if (restaurantId) {
        docs = docs.filter((u: any) => u.restaurantId === restaurantId);
      }
    } else if (collection === "menus") {
      const restaurantId = searchParams.get("restaurantId");
      if (restaurantId) {
        docs = docs.filter((m: any) => m.restaurantId === restaurantId);
      }
    } else if (collection === "qrs") {
      const restaurantId = searchParams.get("restaurantId");
      if (restaurantId) {
        docs = docs.filter((q: any) => q.restaurantId === restaurantId);
      }
    } else if (collection === "scans") {
      const restaurantId = searchParams.get("restaurantId");
      if (restaurantId) {
        docs = docs.filter((s: any) => s.restaurantId === restaurantId);
      }
    }

    return NextResponse.json({ data: docs });
  }

  // Fetch membership details
  if (action === "getMember" && searchParams.get("restaurantId") && searchParams.get("uid")) {
    const key = `${searchParams.get("restaurantId")}_${searchParams.get("uid")}`;
    const member = db.members[key] || null;
    return NextResponse.json({ data: member });
  }

  return NextResponse.json({ error: "Invalid action or collection" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, collection, id, data, restaurantId, uid } = body;

    const db = readDb();

    if (action === "setDoc" && collection && id) {
      if (!(db as any)[collection]) {
        (db as any)[collection] = {};
      }
      // Overwrite/merge
      (db as any)[collection][id] = {
        ...((db as any)[collection][id] || {}),
        ...data,
        id,
        updatedAt: { seconds: Math.floor(Date.now() / 1000) }
      };
      if (!(db as any)[collection][id].createdAt) {
        (db as any)[collection][id].createdAt = { seconds: Math.floor(Date.now() / 1000) };
      }
      writeDb(db);
      return NextResponse.json({ status: "success", data: (db as any)[collection][id] });
    }

    if (action === "addDoc" && collection) {
      if (!(db as any)[collection]) {
        (db as any)[collection] = {};
      }
      const newId = `${collection.slice(0, -1)}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      (db as any)[collection][newId] = {
        ...data,
        id: newId,
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
        updatedAt: { seconds: Math.floor(Date.now() / 1000) }
      };
      writeDb(db);
      return NextResponse.json({ status: "success", id: newId, data: (db as any)[collection][newId] });
    }

    if (action === "updateDoc" && collection && id) {
      if ((db as any)[collection] && (db as any)[collection][id]) {
        (db as any)[collection][id] = {
          ...(db as any)[collection][id],
          ...data,
          updatedAt: { seconds: Math.floor(Date.now() / 1000) }
        };
        writeDb(db);
        return NextResponse.json({ status: "success", data: (db as any)[collection][id] });
      }
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (action === "createRestaurant" && data && uid) {
      const restId = data.id || `rest_${Date.now()}`;
      
      // Write Restaurant Document
      db.restaurants[restId] = {
        ...data,
        id: restId,
        ownerId: uid,
        status: "active",
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
        updatedAt: { seconds: Math.floor(Date.now() / 1000) }
      };

      // Write Membership Document
      const memberKey = `${restId}_${uid}`;
      db.members[memberKey] = {
        uid,
        role: "owner",
        invitedAt: { seconds: Math.floor(Date.now() / 1000) },
        joinedAt: { seconds: Math.floor(Date.now() / 1000) }
      };

      writeDb(db);
      return NextResponse.json({ status: "success", id: restId, data: db.restaurants[restId] });
    }

    // Increment QR Scan count and log scan record
    if (action === "recordScan" && id && restaurantId) {
      if (db.qrs[id]) {
        db.qrs[id].scanCount = (db.qrs[id].scanCount || 0) + 1;
      }
      
      const scanId = `scan_${Date.now()}`;
      db.scans[scanId] = {
        id: scanId,
        restaurantId,
        qrId: id,
        timestamp: { seconds: Math.floor(Date.now() / 1000) },
        userAgent: data.userAgent || "Unknown Device",
        referer: data.referer || "Direct Scan"
      };

      writeDb(db);
      return NextResponse.json({ status: "success" });
    }

    return NextResponse.json({ error: "Invalid action or collection" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server Error" }, { status: 500 });
  }
}
