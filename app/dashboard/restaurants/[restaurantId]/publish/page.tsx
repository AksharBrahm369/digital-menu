"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "../layout";
import { getMenus, getRestaurantQrs, createQrCode, publishMenu, Menu, QrCode } from "@/lib/firebase/db";
import QRCode from "qrcode";
import { 
  QrCode as QrIcon, 
  Loader2, 
  Globe, 
  Plus, 
  Download, 
  Printer, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  ChefHat
} from "lucide-react";

export default function PublishPage() {
  const { restaurant, refreshRestaurant } = useWorkspace();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string>("");
  const [qrs, setQrs] = useState<QrCode[]>([]);
  const [newTableName, setNewTableName] = useState("");
  
  // UI status states
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [creatingQr, setCreatingQr] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [error, setError] = useState("");
  const [selectedPrintQr, setSelectedPrintQr] = useState<QrCode | null>(null);

  // QR rendering refs
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (!restaurant) return null;

  const loadPublishDetails = async () => {
    try {
      const [menuList, qrList] = await Promise.all([
        getMenus(restaurant.id!),
        getRestaurantQrs(restaurant.id!)
      ]);
      setMenus(menuList);
      setQrs(qrList);
      
      // Default select the active menu or the one with categories, or the first menu
      const activeMenu = menuList.find(m => m.id === restaurant.activeMenuId);
      const defaultMenu = activeMenu && activeMenu.categories && activeMenu.categories.length > 0
        ? activeMenu
        : menuList.find(m => m.categories && m.categories.length > 0) || menuList[0];
      
      setSelectedMenuId(defaultMenu ? defaultMenu.id! : "");
      
      if (qrList.length > 0 && !selectedPrintQr) {
        setSelectedPrintQr(qrList[0]);
      }
    } catch (err) {
      console.error("Publish load details error:", err);
      setError("Failed to load publishing configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublishDetails();
  }, [restaurant.id]);

  // Callback Ref: executes immediately when canvas mounts in the DOM
  const canvasRefCallback = useCallback((canvas: HTMLCanvasElement | null) => {
    // Populate raw ref for print & download actions
    // @ts-ignore
    canvasRef.current = canvas;
    
    if (!canvas) return;
    
    // Fallback to customer menu URL if no table QR is selected
    const qrUrl = selectedPrintQr 
      ? `${window.location.origin}/qr/${selectedPrintQr.id}`
      : `${window.location.origin}/m/${restaurant.slug}`;
    
    QRCode.toCanvas(
      canvas,
      qrUrl,
      {
        width: 160,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      },
      (error) => {
        if (error) console.error("Error generating QR Canvas:", error);
      }
    );
  }, [selectedPrintQr, restaurant.slug]);

  const handlePublish = async () => {
    if (!selectedMenuId) return;
    setPublishing(true);
    setError("");
    setPublishSuccess(false);

    try {
      await publishMenu(restaurant.id!, selectedMenuId);
      await refreshRestaurant();
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 4000);
    } catch (err) {
      console.error("Publish error:", err);
      setError("Failed to publish the selected menu.");
    } finally {
      setPublishing(false);
    }
  };

  const handleCreateQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) return;
    setCreatingQr(true);
    setError("");

    try {
      const newQr = await createQrCode(restaurant.id!, newTableName.trim());
      setQrs([newQr, ...qrs]);
      setSelectedPrintQr(newQr);
      setNewTableName("");
    } catch (err) {
      console.error("Create QR error:", err);
      setError("Failed to register new table QR code.");
    } finally {
      setCreatingQr(false);
    }
  };

  const downloadQrPng = () => {
    if (!canvasRef.current || !selectedPrintQr) return;
    
    const link = document.createElement("a");
    link.download = `${restaurant.slug}_qr_${selectedPrintQr.name.replace(/\s+/g, "_")}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const printTablePlacard = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow || !selectedPrintQr || !canvasRef.current) return;

    const qrImageSrc = canvasRef.current.toDataURL("image/png");
    const logoHtml = restaurant.logoUrl 
      ? `<img src="${restaurant.logoUrl}" style="width: 70px; height: 70px; border-radius: 12px; object-fit: cover; margin-bottom: 12px;" />`
      : `<div style="font-size: 32px; margin-bottom: 12px;">🍴</div>`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Placard - ${selectedPrintQr.name}</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background-color: #ffffff;
            }
            .card {
              border: 3px solid #1c1917;
              border-radius: 24px;
              width: 320px;
              padding: 40px 30px;
              text-align: center;
              box-shadow: 0 10px 30px rgba(0,0,0,0.05);
            }
            .rest-name {
              font-size: 24px;
              font-weight: 800;
              margin: 0 0 4px 0;
              color: #1c1917;
            }
            .cuisine {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              color: #d97706;
              margin-bottom: 24px;
            }
            .qr-container {
              display: inline-block;
              padding: 12px;
              border: 1px solid #e7e5e4;
              border-radius: 16px;
              background: #fafaf9;
              margin-bottom: 20px;
            }
            .table-tag {
              font-size: 14px;
              font-weight: 700;
              background-color: #1c1917;
              color: #ffffff;
              padding: 6px 14px;
              border-radius: 99px;
              display: inline-block;
              margin-bottom: 16px;
            }
            .scan-callout {
              font-size: 12px;
              color: #57534e;
              line-height: 1.6;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="card">
            ${logoHtml}
            <h1 class="rest-name">${restaurant.name}</h1>
            <div class="cuisine">${restaurant.cuisine || "Digital Menu"}</div>
            
            <div class="table-tag">${selectedPrintQr.name}</div>
            
            <br />
            <div class="qr-container">
              <img src="${qrImageSrc}" style="width: 160px; height: 160px; display: block;" />
            </div>
            
            <p class="scan-callout">
              Scan the QR Code to browse our <br />
              <strong>Interactive 3D Digital Menu</strong> <br />
              and place your order directly.
            </p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="p-10 flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const liveMenuUrl = `${window.location.origin}/m/${restaurant.slug}`;

  return (
    <div className="p-6 md:p-10 space-y-10 max-w-5xl">
      
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">4. Publish & QR Generation</h1>
        <p className="text-zinc-400 text-sm mt-1">Make your menu active and create custom table QR codes with instant redirect tracking.</p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {publishSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs py-3.5 px-4 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
          <div>
            <h4 className="font-bold">Menu Published Successfully!</h4>
            <p className="text-[10px] text-emerald-400/80 mt-0.5">Your digital menu is now live at: <a href={liveMenuUrl} target="_blank" className="underline font-semibold text-white">{liveMenuUrl}</a></p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Publish & Add Tables */}
        <div className="md:col-span-7 space-y-6">
          
          {/* Menu Publishing Panel */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-5">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              Menu Deployment
            </h3>

            {menus.length === 0 ? (
              <p className="text-xs text-zinc-500 leading-relaxed">
                You have not created any menus yet. Head over to the <a href={`/dashboard/restaurants/${restaurant.id}/builder`} className="text-amber-500 underline font-semibold">Menu Builder</a> to create one.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Select Menu to Deploy</label>
                  <select
                    value={selectedMenuId}
                    onChange={(e) => setSelectedMenuId(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-amber-500 transition-all"
                  >
                    {menus.map((m) => {
                      const itemCount = m.categories?.reduce((acc, cat) => acc + (cat.items?.length || 0), 0) || 0;
                      const isActive = m.id === restaurant.activeMenuId;
                      return (
                        <option key={m.id} value={m.id}>
                          {m.name} ({itemCount} {itemCount === 1 ? "item" : "items"}) ({m.status.toUpperCase()} • v{m.version}){isActive ? " [ACTIVE]" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-zinc-900/20 border border-zinc-900 rounded-xl text-xs">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-zinc-300">Live Customer Link</p>
                    <a 
                      href={liveMenuUrl} 
                      target="_blank" 
                      className="text-[10px] text-amber-500 hover:underline flex items-center gap-1 mt-0.5"
                    >
                      /m/{restaurant.slug}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Deploy Live"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table QR list registration */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-6">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <QrIcon className="w-4 h-4 text-amber-500" />
              Configure Tables / Spots
            </h3>

            {/* Create new spot form */}
            <form onSubmit={handleCreateQr} className="flex gap-3">
              <input
                type="text"
                required
                placeholder="Table 1, Bar, Poolside"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                className="flex-grow bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-white placeholder-zinc-550 focus:outline-none focus:border-amber-500 transition-all font-sans"
              />
              <button
                type="submit"
                disabled={creatingQr}
                className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-750 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5"
              >
                {creatingQr ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Add Spot
              </button>
            </form>

            {/* List registered QRs */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {qrs.length === 0 ? (
                <p className="text-center py-6 text-zinc-500 text-xs">No tables registered yet. Type a name above to add.</p>
              ) : (
                qrs.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedPrintQr(item)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all select-none ${
                      selectedPrintQr?.id === item.id 
                        ? "bg-amber-500/5 border-amber-500/25 text-amber-500" 
                        : "bg-zinc-900/20 border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:text-white"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold">{item.name}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Scan count: {item.scanCount}</p>
                    </div>
                    <span className="text-[10px] bg-zinc-950 border border-zinc-900 px-2 py-0.5 rounded font-mono text-zinc-500">
                      ID: {item.id}
                    </span>
                  </div>
                ))
              )}
            </div>

          </div>

        </div>

        {/* Right Column: Branded Table Card Placard Designer */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div className="sticky top-6 w-full max-w-[320px]">
            <p className="text-zinc-550 text-xs font-bold text-center mb-4 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <Printer className="w-4 h-4 text-amber-500" />
              Table Placard Print Preview
            </p>

            {/* Printable placard container */}
            <div className="bg-white border-2 border-stone-800 rounded-3xl p-6 text-black flex flex-col items-center text-center shadow-xl relative min-h-[420px] justify-between">
              
              {/* Restaurant Branding header */}
              <div className="space-y-1.5">
                {restaurant.logoUrl ? (
                  <img src={restaurant.logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-cover border mx-auto" />
                ) : (
                  <ChefHat className="w-10 h-10 text-stone-700 mx-auto" />
                )}
                <h3 className="font-extrabold text-lg text-stone-900 leading-tight truncate max-w-[240px]">{restaurant.name}</h3>
                <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">{restaurant.cuisine || "Digital Menu"}</p>
              </div>

              {/* Table Spot Tag */}
              <div className="bg-stone-900 text-white text-[11px] font-extrabold px-3 py-1 rounded-full uppercase mt-2 select-none tracking-wider">
                {selectedPrintQr ? selectedPrintQr.name : "Sample Table"}
              </div>

              {/* QR Code Canvas */}
              <div className="bg-stone-50 border border-stone-200 p-2.5 rounded-2xl my-3">
                <canvas ref={canvasRefCallback} className="w-40 h-40" />
              </div>

              {/* Scan instructions footer */}
              <div className="space-y-1">
                <p className="text-[10px] text-stone-500 leading-relaxed font-semibold">
                  Scan QR with your phone to view our <br />
                  <span className="text-stone-800 font-bold">Interactive 3D Digital Menu</span>
                </p>
              </div>
            </div>

            {/* Quick action buttons */}
            {selectedPrintQr && (
              <div className="grid grid-cols-2 gap-3 mt-4 w-full">
                <button
                  onClick={downloadQrPng}
                  className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-750 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  PNG Download
                </button>
                <button
                  onClick={printTablePlacard}
                  className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Placard
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
