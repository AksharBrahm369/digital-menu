"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { createRestaurant } from "@/lib/firebase/db";
import { db, storage, isFirebaseConfigured } from "@/lib/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, collection } from "firebase/firestore";
import { 
  ArrowLeft, 
  ChefHat, 
  Loader2, 
  Upload, 
  Globe, 
  Phone, 
  MapPin, 
  DollarSign,
  AlertTriangle
} from "lucide-react";

async function readApiPayload(response: Response) {
  const text = await response.text();
  let payload: any = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    if (payload.error) {
      throw new Error(payload.details ? `${payload.error}: ${payload.details}` : payload.error);
    }

    const isHtmlError = /^\s*</.test(text);
    throw new Error(
      isHtmlError
        ? `Server returned ${response.status}. The restaurant API returned an HTML error page. Check Vercel Function Logs for /api/restaurants.`
        : `Server returned ${response.status} ${response.statusText || "error"}.`
    );
  }

  return payload;
}

async function createRestaurantViaServer(
  user: { getIdToken?: () => Promise<string> },
  data: Record<string, string>
) {
  const token = await user.getIdToken?.();
  const response = await fetch("/api/restaurants", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
  const payload = await readApiPayload(response);

  return payload.data;
}

export default function NewRestaurant() {
  const { user, loading } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Handle Slug Auto Generation
  useEffect(() => {
    const formattedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // remove special characters
      .replace(/[\s_-]+/g, "-") // replace spaces and double hyphens with single hyphen
      .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
    setSlug(formattedSlug);
  }, [name]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError("");
    setSubmitting(true);

    try {
      // 1. Generate a new document reference in Firestore to get the ID beforehand
      const newRestRef = doc(collection(db, "restaurants"));
      const restaurantId = newRestRef.id;

      let logoUrl = "";
      // 2. Upload Logo File if selected
      if (logoFile) {
        if (isFirebaseConfigured()) {
          try {
            const logoStoragePath = `restaurants/${restaurantId}/logo_${Date.now()}_${logoFile.name}`;
            const logoRef = ref(storage, logoStoragePath);
            
            const uploadResult = await uploadBytes(logoRef, logoFile);
            logoUrl = await getDownloadURL(uploadResult.ref);
          } catch (uploadError) {
            console.warn("Logo upload failed; continuing without a logo.", uploadError);
          }
        } else {
          // Bypass Storage upload and use local Object URL
          logoUrl = URL.createObjectURL(logoFile);
        }
      }

      // 3. Save restaurant with generated ID using our Firestore helper logic
      // Note: we write the restaurant details and the owner membership record
      const restaurantPayload = {
        id: restaurantId,
        name,
        slug,
        logoUrl,
        cuisine,
        currency,
        phone,
        whatsapp,
        address,
      };
      const createdRestaurant = isFirebaseConfigured()
        ? await createRestaurantViaServer(user, restaurantPayload)
        : await createRestaurant(user.uid, restaurantPayload);

      // 4. Redirect straight into the created workspace so the owner can continue setup.
      router.push(`/dashboard/restaurants/${createdRestaurant?.id || restaurantId}`);
    } catch (err: any) {
      console.error("Error creating restaurant:", err);
      const message = err.message || "";
      if (message.toLowerCase().includes("firebase admin") || message.toLowerCase().includes("firestore client")) {
        setError("Failed to create restaurant. Vercel is missing Firebase Admin environment variables. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY, then redeploy.");
      } else if (message.toLowerCase().includes("private_key") || message.toLowerCase().includes("private key")) {
        setError("Failed to create restaurant. FIREBASE_PRIVATE_KEY is not formatted correctly in Vercel. Use the full private_key from your Firebase service account JSON with \\n newline escapes.");
      } else if (message.toLowerCase().includes("firebase_project_id") || message.toLowerCase().includes("firebase_client_email")) {
        setError("Failed to create restaurant. Vercel is missing Firebase Admin environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.");
      } else if (message.toLowerCase().includes("mock database")) {
        setError("Failed to create restaurant. Your Vercel deployment is using the local mock database, which cannot persist data. Set NEXT_PUBLIC_MOCK_DATABASE=false and configure Firebase environment variables in Vercel.");
      } else if (message.toLowerCase().includes("permission")) {
        setError("Failed to create restaurant. Restaurant access was denied. Sign out and sign in again, or verify Firebase Admin environment variables in Vercel.");
      } else if (message.toLowerCase().startsWith("could not create restaurant")) {
        setError(message);
      } else {
        setError("Failed to create restaurant. " + message);
      }
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white px-6 py-12 flex flex-col items-center">
      
      {/* Back button */}
      <div className="w-full max-w-2xl mb-8">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>

      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-900 rounded-3xl p-8 shadow-2xl space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-black">
            <ChefHat className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Restaurant Profile</h1>
            <p className="text-zinc-500 text-xs mt-1">Specify your restaurant credentials and branding.</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Logo Upload Section */}
          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-zinc-900/35 border border-zinc-900">
            <div className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-zinc-800 bg-black flex items-center justify-center overflow-hidden shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
              ) : (
                <ChefHat className="w-8 h-8 text-zinc-650" />
              )}
            </div>
            <div className="space-y-2 text-center sm:text-left">
              <h3 className="text-sm font-semibold">Restaurant Logo</h3>
              <p className="text-[11px] text-zinc-500">Supports PNG, JPG, or SVG up to 2MB.</p>
              <label className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs px-4 py-2 rounded-lg cursor-pointer border border-zinc-800 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Upload File
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Restaurant Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Luigi's Ristorante"
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Public URL Slug</label>
              <div className="relative">
                <div className="absolute left-4 top-3 text-sm text-zinc-500 select-none">/m/</div>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                  placeholder="luigis-ristorante"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Cuisine Type</label>
              <input
                type="text"
                required
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                placeholder="Italian, Bistro, Sushi Bar"
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Pricing Currency</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-3.5 w-4 h-4 text-zinc-555" />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all appearance-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AED">AED (د.إ)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Phone Contact</label>
              <div className="relative">
                <Phone className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">WhatsApp (For customer orders/chat)</label>
              <div className="relative">
                <Phone className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Street Address</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Culinary Boulevard, New York, NY"
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-amber-500/10 transition-all flex items-center justify-center gap-2 mt-6 cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-75"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                Initializing Restaurant Profile...
              </>
            ) : (
              <>
                Create Restaurant
                <Globe className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
