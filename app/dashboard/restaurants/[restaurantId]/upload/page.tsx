"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useWorkspace } from "../layout";
import { storage, isFirebaseConfigured } from "@/lib/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addUpload, updateUploadStatus, createMenu, saveMenu, getMenus, MenuUpload } from "@/lib/firebase/db";
import { 
  Upload, 
  FileText, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Flame,
  Leaf,
  Plus
} from "lucide-react";

// Mock extracted categories & items matching the user's uploaded print menu images (Waffles & general foods)
const MOCK_EXTRACTED_MENU = [
  {
    id: "cat-waffles",
    name: "Waffle Stick",
    description: "Crispy, hot waffle sticks loaded with premium chocolates and sweet toppings.",
    items: [
      {
        id: "waffle-1",
        name: "White Fantasy Waffle",
        description: "Fresh hot waffle stick smothered in premium sweet white chocolate sauce and powdered sugar.",
        price: 70.00,
        allergens: ["dairy", "gluten"],
        tags: ["Sweet Tooth"],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "waffle-2",
        name: "Dark Chocolate Waffle",
        description: "Warm waffle stick loaded with rich melted dark Belgian chocolate drizzle.",
        price: 70.00,
        allergens: ["dairy", "gluten"],
        tags: ["Best Seller"],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "waffle-3",
        name: "Oreo Chocolate Waffle",
        description: "Decadent waffle stick topped with crushed Oreo cookies, white chocolate cream, and dark fudge.",
        price: 80.00,
        allergens: ["dairy", "gluten"],
        tags: ["Kids Favorite"],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "waffle-4",
        name: "Kitkat Waffle",
        description: "Golden waffle stick layered with chocolate fudge and heaps of crushed crispy Kitkat chunks.",
        price: 80.00,
        allergens: ["dairy", "gluten"],
        tags: ["Crispy Treat"],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "waffle-5",
        name: "Naughty Nutella Waffle",
        description: "Classic waffle stick generously spread with rich hazelnut Nutella paste and roasted nuts.",
        price: 80.00,
        allergens: ["dairy", "gluten", "nuts"],
        tags: ["Staff Pick"],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "waffle-6",
        name: "Black & White Waffle",
        description: "The best of both worlds: half sweet white chocolate and half rich dark chocolate glaze.",
        price: 80.00,
        allergens: ["dairy", "gluten"],
        tags: [],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "waffle-7",
        name: "Coffee Bite Waffle",
        description: "Warm waffle stick infused with mocha espresso fudge and a pinch of roasted coffee dust.",
        price: 80.00,
        allergens: ["dairy", "gluten"],
        tags: [],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      }
    ]
  },
  {
    id: "cat-1",
    name: "Menu and Prices",
    description: "Our core selection of gourmet salads, sandwiches, paninis, and mains.",
    items: [
      {
        id: "item-1",
        name: "Grilled Chicken Caesar Salad",
        description: "Crispy romaine lettuce tossed in creamy Caesar dressing, topped with fire-grilled chicken breast, garlic croutons, and shaved parmesan.",
        price: 12.99,
        allergens: ["dairy", "gluten"],
        tags: ["Healthy Option"],
        isAvailable: true,
        type: "non-veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-2",
        name: "Classic Club Sandwich",
        description: "Triple-decker sandwich layered with warm roasted turkey, crispy bacon, fresh lettuce, sliced tomatoes, and light mayo on toasted sourdough bread.",
        price: 10.99,
        allergens: ["gluten", "eggs"],
        tags: ["Best Seller"],
        isAvailable: true,
        type: "non-veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-3",
        name: "Spinach and Feta Stuffed Chicken",
        description: "Plump chicken breast stuffed with tender spinach and crumbled feta cheese, baked to a golden brown and served with pan juices.",
        price: 14.99,
        allergens: ["dairy"],
        tags: ["Chef Special"],
        isAvailable: true,
        type: "non-veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-4",
        name: "Vegetable Quinoa Bowl",
        description: "Hearty organic quinoa bed loaded with seasoned roasted seasonal vegetables, avocado slices, and zesty lemon tahini glaze.",
        price: 11.99,
        allergens: ["sesame"],
        tags: ["Vegan Option", "Gluten-Free"],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-5",
        name: "BBQ Pulled Pork Sandwich",
        description: "Slow-roasted tender pulled pork smothered in sweet hickory BBQ sauce, topped with crunchy vinegar coleslaw on toasted brioche bun.",
        price: 9.99,
        allergens: ["gluten"],
        tags: [],
        isAvailable: true,
        type: "non-veg" as const,
        spiceLevel: 1
      },
      {
        id: "item-6",
        name: "Caprese Panini",
        description: "Creamy buffalo mozzarella cheese, vine-ripe sliced tomatoes, sweet basil leaves, and tangy balsamic glaze pressed in warm artisan ciabatta bread.",
        price: 8.99,
        allergens: ["dairy", "gluten"],
        tags: ["Vegetarian Classic"],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-7",
        name: "Fish Tacos",
        description: "Three soft corn tortillas loaded with blackened mahi-mahi flakes, pickled cabbage shred, and fresh spicy chipotle crema drizzle.",
        price: 13.99,
        allergens: ["fish", "dairy"],
        tags: ["Spicy Favorite"],
        isAvailable: true,
        type: "non-veg" as const,
        spiceLevel: 1
      },
      {
        id: "item-8",
        name: "Mushroom and Swiss Burger",
        description: "Char-broiled premium beef patty topped with savory sautéed wild mushrooms and melted Swiss cheese slice on toasted sesame seed bun.",
        price: 12.99,
        allergens: ["dairy", "gluten"],
        tags: [],
        isAvailable: true,
        type: "non-veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-9",
        name: "Quiche Lorraine",
        description: "Traditional savory French custard tart baked in flaky pastry shell with smoky bacon pieces and imported Gruyère cheese.",
        price: 10.99,
        allergens: ["dairy", "gluten", "eggs"],
        tags: [],
        isAvailable: true,
        type: "non-veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-10",
        name: "Mediterranean Pasta",
        description: "Penne pasta tossed in extra virgin olive oil, sweet cherry tomatoes, sliced kalamata olives, artichoke hearts, and crumbled Greek feta cheese.",
        price: 13.99,
        allergens: ["dairy", "gluten"],
        tags: ["Vegetarian"],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-11",
        name: "Asian Chicken Salad",
        description: "Crispy napa cabbage shred, grilled chicken strips, mandarin orange segments, and crunchy wonton skins, tossed in sweet ginger-soy vinaigrette.",
        price: 11.99,
        allergens: ["soy", "gluten"],
        tags: [],
        isAvailable: true,
        type: "non-veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-12",
        name: "Beef Stir-Fry",
        description: "Tender flank steak slices stir-fried with red bell peppers, broccoli florets, and snap peas in garlic-soy glaze over jasmine rice.",
        price: 15.99,
        allergens: ["soy", "gluten"],
        tags: ["Spicy"],
        isAvailable: true,
        type: "non-veg" as const,
        spiceLevel: 1
      },
      {
        id: "item-13",
        name: "Margherita Pizza",
        description: "Classic pizza base with San Marzano tomato spread, fresh buffalo mozzarella slices, sweet basil, and extra virgin olive oil.",
        price: 14.99,
        allergens: ["dairy", "gluten"],
        tags: ["Vegetarian Classic"],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-14",
        name: "Roasted Vegetable Wrap",
        description: "Grilled zucchini strips, eggplant, roasted bell peppers, and fresh organic chickpea hummus wrapped in a warm spinach tortilla wrap.",
        price: 9.99,
        allergens: ["gluten", "sesame"],
        tags: ["Vegan Option"],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-15",
        name: "Soup of the Day",
        description: "Freshly prepared rustic house soup. Please ask your server for details on today's scratch recipe selection.",
        price: 5.99,
        allergens: [],
        tags: ["House Favorite"],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      }
    ]
  },
  {
    id: "cat-2",
    name: "Beverages",
    description: "Chilled soft drinks, iced brews, fresh juices, and warm beverages.",
    items: [
      {
        id: "item-16",
        name: "Soft Drinks",
        description: "Choice of chilled carbonated drinks: Coca-Cola, Sprite, or Orange Fanta.",
        price: 2.99,
        allergens: [],
        tags: [],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-17",
        name: "Iced Tea",
        description: "Cold-brewed pure black tea served over ice with fresh lemon wedges.",
        price: 2.99,
        allergens: [],
        tags: [],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-18",
        name: "Freshly Squeezed Lemonade",
        description: "Home-style freshly squeezed lemon juice, sweet simple syrup, and cold filtered water.",
        price: 3.99,
        allergens: [],
        tags: [],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-19",
        name: "Fruit Smoothies",
        description: "Blended organic seasonal fresh fruits with greek yogurt and organic honey drop.",
        price: 4.99,
        allergens: ["dairy"],
        tags: ["Healthy Choice"],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-20",
        name: "Coffee",
        description: "Hot drip coffee brewed from premium medium-roast Arabica coffee beans.",
        price: 2.99,
        allergens: [],
        tags: [],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-21",
        name: "Hot Tea",
        description: "Brewed hot water served with a selection of premium organic herbal and green tea bags.",
        price: 2.99,
        allergens: [],
        tags: [],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      },
      {
        id: "item-22",
        name: "Bottled Water",
        description: "Chilled mineral spring bottled water.",
        price: 1.99,
        allergens: [],
        tags: [],
        isAvailable: true,
        type: "veg" as const,
        spiceLevel: 0
      }
    ]
  }
];

export default function UploadMenuPage() {
  const { restaurant } = useWorkspace();
  const router = useRouter();
  const params = useParams() as { restaurantId: string };
  
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "extracting" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadId, setUploadId] = useState("");
  
  const [extractedData, setExtractedData] = useState<typeof MOCK_EXTRACTED_MENU | null>(null);
  const [importing, setImporting] = useState(false);

  if (!restaurant) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setStatus("idle");
      setErrorMessage("");
    }
  };

  const handleUploadAndExtract = async () => {
    if (!file) return;
    const restId = restaurant.id;
    if (!restId) {
      setErrorMessage("Restaurant ID is not loaded yet.");
      return;
    }
    setStatus("uploading");
    setUploading(true);
    setErrorMessage("");

    try {
      const uniqueUploadId = `upload_${Date.now()}`;
      const fileExtension = file.name.split(".").pop();
      const storagePath = `restaurants/${restId}/uploads/${uniqueUploadId}.${fileExtension}`;
      
      let downloadUrl = "";
      if (isFirebaseConfigured()) {
        // 1. Upload file to Firebase Storage
        const fileRef = ref(storage, storagePath);
        const uploadResult = await uploadBytes(fileRef, file);
        downloadUrl = await getDownloadURL(uploadResult.ref);
      } else {
        // Mock upload: use local Object URL
        downloadUrl = URL.createObjectURL(file);
      }

      // 2. Add Upload Document in Firestore
      await addUpload(restId, {
        fileUrl: downloadUrl,
        storagePath,
        fileType: file.type,
        originalFileName: file.name,
      });

      setUploadId(uniqueUploadId);
      
      // 3. Trigger Mock AI Extraction
      setStatus("extracting");
      
      // Simulate OCR extraction time (3 seconds)
      await new Promise((resolve) => setTimeout(resolve, 3000));
      
      // 4. Update status in Firestore to completed
      await updateUploadStatus(
        restId, 
        uniqueUploadId, 
        "completed", 
        JSON.stringify(MOCK_EXTRACTED_MENU)
      );

      setExtractedData(MOCK_EXTRACTED_MENU);
      setStatus("done");
    } catch (err: any) {
      console.error("Upload/OCR process failed:", err);
      setErrorMessage("Failed to upload and parse the menu file. " + (err.message || ""));
      setStatus("error");
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!extractedData) return;
    const restId = restaurant.id;
    if (!restId) {
      setErrorMessage("Restaurant ID is not loaded yet.");
      return;
    }
    setImporting(true);
    
    try {
      // 1. Create a new menu
      const menuId = await createMenu(restId, "AI Extracted Menu");
      
      // 2. Populate the menu document with mock categories/items
      await saveMenu(restId, menuId, {
        categories: extractedData,
      });

      // 3. Direct user to the builder to see the imported items
      router.push(`/dashboard/restaurants/${restId}/builder?menuId=${menuId}`);
    } catch (err) {
      console.error("Failed to import menu items:", err);
      setErrorMessage("Failed to import items into builder.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-10 max-w-4xl">
      
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">1. Upload Print Menu</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Upload an existing paper menu PDF, JPG, or PNG. We will parse it and auto-extract categories, dish names, descriptions, and prices.
        </p>
      </div>

      <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 space-y-8 relative overflow-hidden">
        
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        {status === "idle" || status === "error" ? (
          <div className="space-y-6">
            
            {errorMessage && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Drop Zone Box */}
            <div className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/10 rounded-2xl p-12 text-center relative transition-all">
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  {file ? (
                    <p className="text-sm font-semibold text-amber-500">{file.name}</p>
                  ) : (
                    <p className="text-sm font-semibold text-white">Click or drag print menu file here</p>
                  )}
                  <p className="text-zinc-500 text-xs">Supports PDF, PNG, JPG up to 10MB</p>
                </div>
              </div>
            </div>

            {/* Submit CTA */}
            {file && (
              <button
                onClick={handleUploadAndExtract}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-amber-500/15 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Upload & Extract with AI OCR
                <Sparkles className="w-4 h-4 fill-black" />
              </button>
            )}
          </div>
        ) : (
          <div className="py-8 text-center space-y-6">
            {status === "uploading" && (
              <div className="space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">Uploading File to Storage...</p>
                  <p className="text-zinc-500 text-xs">Saving menu PDF/Image to Firebase Cloud Storage bucket.</p>
                </div>
              </div>
            )}

            {status === "extracting" && (
              <div className="space-y-4">
                <div className="relative w-12 h-12 mx-auto">
                  <Loader2 className="w-12 h-12 animate-spin text-amber-500 absolute inset-0" />
                  <Sparkles className="w-6 h-6 text-amber-400 absolute top-3 left-3 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-amber-500 animate-pulse">Running AI OCR Extraction...</p>
                  <p className="text-zinc-500 text-xs">Reading columns, parsing prices, titles, description, and tags...</p>
                </div>
              </div>
            )}

            {status === "done" && extractedData && (
              <div className="text-left space-y-6">
                
                {/* Completion Header Banner */}
                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-xl text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm">AI Menu Extraction Completed!</h3>
                    <p className="text-[11px] text-emerald-400/80 mt-0.5">Found {extractedData.reduce((count, cat) => count + cat.items.length, 0)} menu items across {extractedData.length} categories.</p>
                  </div>
                </div>

                {/* Extracted preview list */}
                <div className="space-y-4 border border-zinc-900 rounded-2xl p-6 bg-zinc-900/10">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Extraction Preview</p>
                  
                  {extractedData.map((category) => (
                    <div key={category.id} className="space-y-2 pt-2 border-t border-zinc-900/60 first:border-0 first:pt-0">
                      <div className="flex justify-between items-baseline">
                        <h4 className="text-sm font-extrabold text-amber-500">{category.name}</h4>
                        <span className="text-[10px] text-zinc-500 italic">{category.description}</span>
                      </div>
                      
                      <div className="grid gap-2 mt-2">
                        {category.items.map((item) => (
                          <div key={item.id} className="flex justify-between items-start text-xs bg-zinc-950 p-2.5 rounded-lg border border-zinc-900">
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-white">
                                {item.name}
                                {item.type === "veg" && <Leaf className="w-3 h-3 text-emerald-400 fill-emerald-400/10" />}
                                {item.spiceLevel > 0 && <Flame className="w-3 h-3 text-orange-500" />}
                              </div>
                              <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{item.description}</p>
                            </div>
                            <span className="font-bold text-white shrink-0">${item.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Import Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setStatus("idle");
                      setFile(null);
                      setExtractedData(null);
                    }}
                    className="flex-1 border border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-300 font-semibold py-3 rounded-xl text-xs transition-colors"
                  >
                    Re-upload Menu
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold py-3 rounded-xl text-xs hover:shadow-lg hover:shadow-amber-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin stroke-[2.5]" />
                        Importing...
                      </>
                    ) : (
                      <>
                        Import into Menu Builder
                        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
