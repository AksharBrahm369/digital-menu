"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useWorkspace } from "../layout";
import { getMenus, getMenu, saveMenu, createMenu, Menu, MenuCategory, MenuItem } from "@/lib/firebase/db";
import { getStructuredMenuTrustIssues } from "@/lib/menu-trust";
import { storage, isFirebaseConfigured } from "@/lib/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  Check, 
  AlertTriangle,
  FolderOpen,
  Coffee,
  Info,
  Layers,
  Leaf,
  Flame,
  Upload,
  Search,
  CheckSquare,
  Square
} from "lucide-react";

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

export default function MenuBuilder() {
  const { restaurant } = useWorkspace();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [menus, setMenus] = useState<Menu[]>([]);
  const [activeMenu, setActiveMenu] = useState<Menu | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  
  // Selection states
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingItemImage, setUploadingItemImage] = useState(false);

  // Common Allergens checklist
  const COMMON_ALLERGENS = ["gluten", "dairy", "eggs", "nuts", "soy", "fish", "shellfish"];
  const restaurantId = restaurant?.id;

  // 1. Initial Load: Retrieve menus
  const loadMenus = async () => {
    if (!restaurantId) return;

    try {
      const menuList = await getMenus(restaurantId);
      setMenus(menuList);
      
      // Determine which menu ID to load
      let targetMenuId = searchParams.get("menuId");
      if (!targetMenuId && menuList.length > 0) {
        targetMenuId = menuList[0].id!;
      }

      if (targetMenuId) {
        const menuDetails = await getMenu(restaurantId, targetMenuId);
        if (menuDetails) {
          setActiveMenu(menuDetails);
          setCategories(menuDetails.categories || []);
          
          // Select first category by default
          if (menuDetails.categories && menuDetails.categories.length > 0) {
            setSelectedCatId(menuDetails.categories[0].id);
          }
        }
      } else {
        // If no menu exists, create a default one
        const newMenuId = await createMenu(restaurantId, "Default Menu");
        router.replace(`/dashboard/restaurants/${restaurantId}/builder?menuId=${newMenuId}`);
      }
    } catch (err: any) {
      console.error("Error initializing menu builder:", err);
      setError("Failed to load menu details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenus();
  }, [restaurantId, searchParams]);

  if (!restaurant || !restaurantId) return null;

  // Handle saving the full categories structure to firestore
  const handleSaveMenu = async () => {
    if (!activeMenu || !activeMenu.id) return;
    setSaving(true);
    setError("");
    setSaveSuccess(false);

    try {
      const cameFromUpload = Boolean(activeMenu.sourceFileUrl || activeMenu.rawExtractedText || activeMenu.rawDigitizedJson);
      const trustIssues = cameFromUpload ? getStructuredMenuTrustIssues({ ...activeMenu, categories }) : [];
      const structuredItemsVerified = !cameFromUpload || trustIssues.length === 0;

      await saveMenu(restaurant.id!, activeMenu.id, {
        categories,
        structuredItemsVerified,
        version: (activeMenu.version || 1) + 1
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (!structuredItemsVerified) {
        setError(`Saved, but these imported OCR items are still not verified for the live customer menu: ${trustIssues.join(" ")}`);
      }
      
      // Refresh local active menu properties
      setActiveMenu(prev => prev ? { ...prev, categories, structuredItemsVerified, version: prev.version + 1 } : null);
    } catch (err: any) {
      console.error("Save error:", err);
      setError("Failed to save menu changes.");
    } finally {
      setSaving(false);
    }
  };

  // --- Category Handlers ---
  const handleAddCategory = () => {
    const newCatId = `cat_${Date.now()}`;
    const newCat: MenuCategory = {
      id: newCatId,
      name: "New Category",
      description: "Category description",
      items: []
    };
    
    setCategories([...categories, newCat]);
    setSelectedCatId(newCatId);
    setSelectedItemId(null);
  };

  const handleUpdateCategoryDetails = (name: string, description: string) => {
    setCategories(categories.map(cat => 
      cat.id === selectedCatId ? { ...cat, name, description } : cat
    ));
  };

  const handleDeleteCategory = (catId: string) => {
    if (!confirm("Are you sure you want to delete this category and all its items?")) return;
    setCategories(categories.filter(cat => cat.id !== catId));
    if (selectedCatId === catId) {
      setSelectedCatId(null);
      setSelectedItemId(null);
    }
  };

  // --- Item Handlers ---
  const handleAddItem = (catId: string) => {
    const newItemId = `item_${Date.now()}`;
    const newItem: MenuItem = {
      id: newItemId,
      name: "New Dish",
      description: "Dish description",
      price: 9.99,
      allergens: [],
      tags: [],
      isAvailable: true,
      type: "veg",
      spiceLevel: 0
    };

    setCategories(categories.map(cat => {
      if (cat.id === catId) {
        return { ...cat, items: [...cat.items, newItem] };
      }
      return cat;
    }));

    setSelectedCatId(catId);
    setSelectedItemId(newItemId);
  };

  const handleUpdateItemDetails = (updatedItem: Partial<MenuItem>) => {
    setCategories(categories.map(cat => {
      if (cat.id === selectedCatId) {
        return {
          ...cat,
          items: cat.items.map(item => 
            item.id === selectedItemId ? { ...item, ...updatedItem } : item
          )
        };
      }
      return cat;
    }));
  };

  const handleDeleteItem = (catId: string, itemId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    setCategories(categories.map(cat => {
      if (cat.id === catId) {
        return { ...cat, items: cat.items.filter(item => item.id !== itemId) };
      }
      return cat;
    }));
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    }
  };

  // Image upload handler
  const handleItemImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !selectedItemId) return;
    const file = e.target.files[0];
    setUploadingItemImage(true);

    try {
      let downloadUrl = "";
      if (isFirebaseConfigured()) {
        const storagePath = `restaurants/${restaurant.id}/items/${selectedItemId}_${Date.now()}_${file.name}`;
        const imageRef = ref(storage, storagePath);
        
        const uploadResult = await uploadBytes(imageRef, file);
        downloadUrl = await getDownloadURL(uploadResult.ref);
      } else {
        downloadUrl = await fileToDataUrl(file);
      }
      
      handleUpdateItemDetails({ image: downloadUrl });
    } catch (err) {
      console.error("Item image upload error:", err);
      setError("Failed to upload item image.");
    } finally {
      setUploadingItemImage(false);
    }
  };

  // Helpers to retrieve selected items
  const activeCategory = categories.find(c => c.id === selectedCatId);
  const activeItem = activeCategory?.items.find(i => i.id === selectedItemId);

  if (loading) {
    return (
      <div className="p-10 flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // Filter items matching searches
  const filteredCategories = categories.map(cat => {
    const items = cat.items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...cat, items };
  }).filter(cat => cat.items.length > 0 || cat.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-6 md:p-10 space-y-8 flex flex-col h-[calc(100vh-20px)]">
      
      {/* Top Action Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">2. Menu Builder</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Create, edit, and organize menu dishes. Changes must be saved to apply.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {error && (
            <span className="text-rose-400 text-xs flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
              <AlertTriangle className="w-4 h-4" /> {error}
            </span>
          )}
          {saveSuccess && (
            <span className="text-emerald-400 text-xs flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
              <Check className="w-4 h-4" /> Changes Saved Successfully
            </span>
          )}
          
          <button
            onClick={handleSaveMenu}
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-amber-500 text-black font-bold px-5 py-3 rounded-xl hover:bg-amber-400 transition-colors cursor-pointer disabled:opacity-75"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
            ) : (
              <Save className="w-4 h-4 stroke-[2.5]" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      {/* Main Workspace split panel */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        
        {/* Left Categories/Dishes Panel */}
        <div className="w-full lg:w-96 flex flex-col bg-zinc-950 border border-zinc-900 rounded-2xl p-4 min-h-0">
          
          {/* Search bar & Add buttons */}
          <div className="space-y-3 pb-4 border-b border-zinc-900 shrink-0">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-550" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/40 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-all"
              />
            </div>
            <button
              onClick={handleAddCategory}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-850 text-white font-semibold text-xs py-2.5 rounded-xl border border-zinc-800 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Category
            </button>
          </div>

          {/* List Scroll Area */}
          <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-4">
            {filteredCategories.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                No items or categories matching.
              </div>
            ) : (
              filteredCategories.map((cat) => (
                <div key={cat.id} className="space-y-1.5">
                  <div 
                    onClick={() => {
                      setSelectedCatId(cat.id);
                      setSelectedItemId(null);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                      selectedCatId === cat.id && !selectedItemId 
                        ? "bg-amber-500/10 border border-amber-500/30 text-amber-500" 
                        : "bg-transparent text-zinc-300 hover:bg-zinc-900/45 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs font-bold">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAddItem(cat.id); }}
                        title="Add dish to category"
                        className="p-1 rounded hover:bg-zinc-900 text-zinc-500 hover:text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                        className="p-1 rounded hover:bg-zinc-900 text-zinc-500 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Dishes inside category */}
                  <div className="pl-4 space-y-1 border-l border-zinc-900 ml-4.5">
                    {cat.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedCatId(cat.id);
                          setSelectedItemId(item.id);
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                          selectedItemId === item.id 
                            ? "bg-zinc-900 text-white font-semibold border border-zinc-800" 
                            : "bg-transparent text-zinc-400 hover:bg-zinc-900/30 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {item.type === "veg" ? (
                            <Leaf className="w-3 h-3 text-emerald-400 fill-emerald-400/10 shrink-0" />
                          ) : (
                            <Coffee className="w-3 h-3 text-zinc-500 shrink-0" />
                          )}
                          <span className="truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-semibold text-zinc-300">
                            {item.priceLabel || `${restaurant.currency} ${item.price.toFixed(2)}`}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(cat.id, item.id);
                            }}
                            className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-rose-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Form Editor Panel */}
        <div className="flex-1 bg-zinc-950 border border-zinc-900 rounded-2xl p-6 overflow-y-auto">
          {!selectedCatId ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 space-y-2 py-10">
              <FolderOpen className="w-10 h-10 text-zinc-700" />
              <p className="text-sm font-semibold">No selection active</p>
              <p className="text-xs max-w-xs leading-relaxed">Select a category or a menu dish on the left to start editing properties.</p>
            </div>
          ) : selectedItemId && activeItem ? (
            // Dish Editor Form
            <div className="space-y-6">
              <div className="flex items-start justify-between border-b border-zinc-900 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Edit Menu Item</h3>
                  <p className="text-zinc-550 text-xs">Update item details, tags, and images.</p>
                </div>
                <span className="text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-850 px-2 py-0.5 rounded-md font-mono">
                  ID: {activeItem.id}
                </span>
              </div>

              {/* Item Details Fields */}
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Item Name</label>
                  <input
                    type="text"
                    value={activeItem.name}
                    onChange={(e) => handleUpdateItemDetails({ name: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-amber-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Price (in {restaurant.currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={activeItem.price}
                    onChange={(e) => handleUpdateItemDetails({ price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-amber-500 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Price Label (optional)</label>
                  <input
                    type="text"
                    value={activeItem.priceLabel || ""}
                    onChange={(e) => handleUpdateItemDetails({ priceLabel: e.target.value })}
                    placeholder="MRP, Seasonal, Ask"
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-amber-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Description</label>
                <textarea
                  value={activeItem.description}
                  onChange={(e) => handleUpdateItemDetails({ description: e.target.value })}
                  rows={3}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-amber-500 transition-all resize-none"
                />
              </div>

              {/* Item Type & Spice Rating */}
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Diet Type</label>
                  <select
                    value={activeItem.type}
                    onChange={(e) => handleUpdateItemDetails({ type: e.target.value as any })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-amber-500 transition-all"
                  >
                    <option value="unknown">Not specified</option>
                    <option value="veg">Vegetarian (Veg)</option>
                    <option value="non-veg">Non-Vegetarian (Non-Veg)</option>
                    <option value="egg">Contains Egg</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Spice Intensity</label>
                  <select
                    value={activeItem.spiceLevel ?? 0}
                    onChange={(e) => handleUpdateItemDetails({ spiceLevel: parseInt(e.target.value) || 0 })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-amber-500 transition-all"
                  >
                    <option value="0">Mild / Not Spicy (0)</option>
                    <option value="1">Medium (1)</option>
                    <option value="2">Hot (2)</option>
                    <option value="3">Extra Spicy (3)</option>
                  </select>
                </div>
              </div>

              {/* Image upload row */}
              <div className="p-4 rounded-xl bg-zinc-900/20 border border-zinc-900 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                  {activeItem.image ? (
                    <img src={activeItem.image} alt={activeItem.name} className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-5 h-5 text-zinc-550" />
                  )}
                </div>
                <div className="space-y-1 text-center sm:text-left flex-grow">
                  <h4 className="text-xs font-bold text-white">Item Image</h4>
                  <p className="text-[10px] text-zinc-500">Add a stunning photograph for the 3D customer card view.</p>
                </div>
                <label className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 px-4 py-2 rounded-lg cursor-pointer text-[10px] font-bold text-white transition-colors shrink-0">
                  {uploadingItemImage ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleItemImageUpload}
                    disabled={uploadingItemImage}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Availability Status */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/20 border border-zinc-900">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-white">Item Availability</h4>
                  <p className="text-[10px] text-zinc-500">Toggle whether this item is currently in-stock and visible.</p>
                </div>
                <button
                  onClick={() => handleUpdateItemDetails({ isAvailable: !activeItem.isAvailable })}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeItem.isAvailable
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-zinc-900 text-zinc-550 border border-zinc-800"
                  }`}
                >
                  {activeItem.isAvailable ? "In Stock (Visible)" : "Out of Stock"}
                </button>
              </div>

              {/* Tags (comma separated) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Badges / Tags (Comma separated)</label>
                <input
                  type="text"
                  placeholder="Chef Recommended, Best Seller, New"
                  value={activeItem.tags.join(", ")}
                  onChange={(e) => handleUpdateItemDetails({ 
                    tags: e.target.value.split(",").map(t => t.trim()).filter(t => t !== "") 
                  })}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-amber-500 transition-all font-sans"
                />
              </div>

              {/* Allergens Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Allergen Declarations</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {COMMON_ALLERGENS.map((allergen) => {
                    const isChecked = activeItem.allergens.includes(allergen);
                    return (
                      <div
                        key={allergen}
                        onClick={() => {
                          const updated = isChecked
                            ? activeItem.allergens.filter(a => a !== allergen)
                            : [...activeItem.allergens, allergen];
                          handleUpdateItemDetails({ allergens: updated });
                        }}
                        className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer border text-xs capitalize transition-all select-none ${
                          isChecked 
                            ? "bg-amber-500/5 border-amber-500/20 text-amber-500 font-semibold" 
                            : "bg-zinc-900/20 border-zinc-900 text-zinc-500 hover:border-zinc-850"
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 shrink-0" />
                        )}
                        {allergen}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            // Category Editor Form
            activeCategory && (
              <div className="space-y-6">
                <div className="flex items-start justify-between border-b border-zinc-900 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Edit Category Details</h3>
                    <p className="text-zinc-550 text-xs">Update category name and descriptions.</p>
                  </div>
                  <span className="text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-850 px-2 py-0.5 rounded-md font-mono">
                    ID: {activeCategory.id}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Category Name</label>
                  <input
                    type="text"
                    value={activeCategory.name}
                    onChange={(e) => handleUpdateCategoryDetails(e.target.value, activeCategory.description || "")}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-amber-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Description / Subtitle</label>
                  <textarea
                    value={activeCategory.description}
                    onChange={(e) => handleUpdateCategoryDetails(activeCategory.name, e.target.value)}
                    rows={4}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-amber-500 transition-all resize-none"
                  />
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/10 border border-zinc-900 flex items-start gap-3 text-zinc-550">
                  <Info className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed">
                    Categories group similar items (like starters or wine list) on the customer menu. Select a specific item inside this category in the left tree menu to adjust individual pricing, veg/non-veg status, and images.
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
