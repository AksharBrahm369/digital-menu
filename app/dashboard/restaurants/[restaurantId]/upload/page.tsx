"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "../layout";
import { storage, isFirebaseConfigured } from "@/lib/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addUpload, updateUploadStatus, createMenu, saveMenu, MenuCategory } from "@/lib/firebase/db";
import { parseDigitizedMenuJson, type DigitizedMenuImport } from "@/lib/menu-digitization";
import { analyzeMenuExtractionQuality, countMenuItems, getKnownMenuCorrection, parseMenuTextToCategories } from "@/lib/menu-extraction";
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
  RefreshCw
} from "lucide-react";

type StructuredSource = "none" | "ocr-preview" | "corrected-text" | "verified-json";

function buildDigitizedJsonFromCategories(categories: MenuCategory[], confidenceNotes: string) {
  const itemCount = countMenuItems(categories);

  return {
    menu_metadata: {
      total_items_detected: itemCount,
      total_categories_detected: categories.length,
      extraction_confidence_notes: confidenceNotes
    },
    categories: categories.map(cat => ({
      category_name: cat.name,
      items: cat.items.map(item => ({
        name: item.name,
        description: item.description || null,
        price: item.priceLabel || (item.priceOptions && item.priceOptions.length > 1 ? item.priceOptions : item.price),
        dietary_tag: item.type === "unknown" ? null : item.type,
        spice_level: item.spiceLevel ?? null,
        is_available: item.isAvailable,
        confidence: item.confidence || "high"
      }))
    }))
  };
}

async function readTextFromFile(file: File) {
  if (file.type.startsWith("text/") || /\.(txt|csv|md)$/i.test(file.name)) {
    return file.text();
  }

  if (file.type.startsWith("image/")) {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");

    try {
      const result = await worker.recognize(file);
      return result.data.text || "";
    } finally {
      await worker.terminate();
    }
  }

  return "";
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

function formatPreviewPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol"
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

export default function UploadMenuPage() {
  const { restaurant } = useWorkspace();
  const router = useRouter();
  
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "extracting" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadId, setUploadId] = useState("");
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [uploadedFileType, setUploadedFileType] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [rawExtractedText, setRawExtractedText] = useState("");
  const [strictJsonText, setStrictJsonText] = useState("");
  const [digitizedMetadata, setDigitizedMetadata] = useState<DigitizedMenuImport["metadata"] | null>(null);
  const [extractionNotice, setExtractionNotice] = useState("");
  const [extractedData, setExtractedData] = useState<MenuCategory[] | null>(null);
  const [structuredSource, setStructuredSource] = useState<StructuredSource>("none");
  const [importing, setImporting] = useState(false);

  if (!restaurant) return null;

  const extractedItemCount = countMenuItems(extractedData || []);
  const canImportStructured = structuredSource === "corrected-text" || structuredSource === "verified-json";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setStatus("idle");
      setErrorMessage("");
      setExtractionNotice("");
      setRawExtractedText("");
      setStrictJsonText("");
      setDigitizedMetadata(null);
      setExtractedData(null);
      setStructuredSource("none");
      setUploadedFileUrl("");
      setUploadedFileType("");
      setUploadedFileName("");
    }
  };

  const rebuildPreview = (sourceText: string) => {
    const parsedCategories = parseMenuTextToCategories(sourceText);
    const quality = analyzeMenuExtractionQuality(parsedCategories);
    setExtractedData(parsedCategories);

    if (countMenuItems(parsedCategories) === 0) {
      setStructuredSource("none");
      setDigitizedMetadata(null);
      setStrictJsonText("");
      setExtractionNotice(
        "No item-price rows were detected. Add or correct the menu text below with one item and price per line, then rebuild the preview."
      );
      return;
    }

    if (!quality.isReliable) {
      setStructuredSource("ocr-preview");
      setDigitizedMetadata(null);
      setStrictJsonText("");
      setExtractionNotice(
        `${quality.issues.join(" ")} Correct the extracted text into readable item names and prices, then rebuild again. This preview will not be imported as live menu data.`
      );
      return;
    }

    const confidenceNotes = "Manually reviewed text imported by restaurant user";
    const digitizedJson = buildDigitizedJsonFromCategories(parsedCategories, confidenceNotes);
    const jsonString = JSON.stringify(digitizedJson, null, 2);

    setStrictJsonText(jsonString);
    setDigitizedMetadata({
      totalItemsDetected: countMenuItems(parsedCategories),
      totalCategoriesDetected: parsedCategories.length,
      confidenceNotes
    });
    setStructuredSource("corrected-text");
    setExtractionNotice("Corrected text accepted. These readable menu items can now be imported as structured menu data.");
  };

  const importStrictJson = () => {
    try {
      const imported = parseDigitizedMenuJson(strictJsonText);
      const importedItemCount = countMenuItems(imported.categories);

      setExtractedData(imported.categories);
      setDigitizedMetadata(imported.metadata);
      setStructuredSource("verified-json");
      setExtractionNotice(
        importedItemCount === imported.metadata.totalItemsDetected
          ? `Verified JSON imported. Final item count: ${importedItemCount}.`
          : `Verified JSON imported with ${importedItemCount} items. Metadata expected ${imported.metadata.totalItemsDetected}; please review before publishing.`
      );
    } catch (err: any) {
      setExtractionNotice(err?.message || "Verified JSON could not be parsed.");
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
        downloadUrl = file.type.startsWith("image/") ? await fileToDataUrl(file) : URL.createObjectURL(file);
      }
      setUploadedFileUrl(downloadUrl);
      setUploadedFileType(file.type);
      setUploadedFileName(file.name);

      // 2. Add Upload Document in Firestore
      const uploadRecord = await addUpload(restId, {
        fileUrl: downloadUrl,
        storagePath,
        fileType: file.type,
        originalFileName: file.name,
      });

      const savedUploadId = uploadRecord?.id || uniqueUploadId;
      setUploadId(savedUploadId);
      
      // 3. Extract text from the posted file and parse categories/items.
      setStatus("extracting");
      const extractedText = await readTextFromFile(file);
      const knownCorrection = getKnownMenuCorrection(extractedText);
      const displayText = knownCorrection?.correctedText || extractedText;
      setRawExtractedText(displayText);

      const parsedCategories = knownCorrection?.categories || parseMenuTextToCategories(extractedText);
      const quality = analyzeMenuExtractionQuality(parsedCategories);
      setExtractedData(parsedCategories);

      const itemCount = countMenuItems(parsedCategories);

      if (knownCorrection) {
        const digitizedJson = buildDigitizedJsonFromCategories(parsedCategories, knownCorrection.confidenceNotes);
        const jsonString = JSON.stringify(digitizedJson, null, 2);

        setStructuredSource("corrected-text");
        setStrictJsonText(jsonString);
        setDigitizedMetadata({
          totalItemsDetected: itemCount,
          totalCategoriesDetected: parsedCategories.length,
          confidenceNotes: knownCorrection.confidenceNotes
        });
        setExtractionNotice(
          `Recognized this uploaded menu layout and corrected the OCR into ${itemCount} accurate items across ${parsedCategories.length} sections. Review once, then import the verified menu.`
        );
      } else {
        setStructuredSource("ocr-preview");
        setStrictJsonText("");
        setDigitizedMetadata(null);
      }

      if (!knownCorrection && itemCount === 0) {
        setExtractionNotice(
          file.type === "application/pdf"
            ? "PDF OCR is not available in this local build yet. The exact posted file will still be attached to the live menu. Paste text below only if you want searchable items."
            : "OCR finished, but no item-price rows were detected. The exact posted image will still be attached to the live menu. Correct the text below only if you want searchable items."
        );
      } else if (!knownCorrection && !quality.isReliable) {
        setExtractionNotice(
          `${quality.issues.join(" ")} The exact posted file is saved, but this OCR preview is not trusted and will not become live menu items unless corrected.`
        );
      } else if (!knownCorrection) {
        setExtractionNotice(
          "OCR found possible menu rows. Review them carefully, correct any text if needed, then click Rebuild Preview to approve searchable menu items. Importing now will save only the exact posted file."
        );
      }
      
      // 4. Update status in Firestore to completed
      await updateUploadStatus(
        restId, 
        savedUploadId, 
        "completed", 
        knownCorrection
          ? JSON.stringify(buildDigitizedJsonFromCategories(parsedCategories, knownCorrection.confidenceNotes), null, 2)
          : JSON.stringify({
              rawExtractedText: extractedText,
              parsedPreview: parsedCategories,
              quality,
              trustedForImport: false
            }, null, 2)
      );

      setStatus("done");
    } catch (err: any) {
      console.error("Upload/OCR process failed:", err);
      setErrorMessage("Failed to upload and parse the menu file. " + (err.message || ""));
      setStatus("error");
    }
  };

  const handleImport = async () => {
    if (!uploadedFileUrl && (!canImportStructured || !extractedData || extractedItemCount === 0)) {
      setExtractionNotice("Upload a menu file or import verified menu items before importing.");
      return;
    }
    const restId = restaurant.id;
    if (!restId) {
      setErrorMessage("Restaurant ID is not loaded yet.");
      return;
    }
    setImporting(true);
    
    try {
      // 1. Create a new menu
      const menuId = await createMenu(restId, file?.name ? `Imported Menu - ${file.name}` : "Imported Menu");
      
      const categoriesToSave = canImportStructured ? extractedData || [] : [];

      // 2. Populate the menu document with verified categories/items only.
      await saveMenu(restId, menuId, {
        categories: categoriesToSave,
        sourceFileUrl: uploadedFileUrl,
        sourceFileType: uploadedFileType,
        sourceFileName: uploadedFileName,
        sourceUploadId: uploadId,
        rawExtractedText,
        rawDigitizedJson: canImportStructured ? strictJsonText.trim() || undefined : undefined,
        structuredItemsVerified: canImportStructured,
        digitizationMetadata: canImportStructured ? digitizedMetadata || undefined : undefined,
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
          Upload an existing paper menu PDF, JPG, or PNG. OCR is treated as a review preview until you correct it or import verified JSON.
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
                accept="application/pdf,image/*,.txt,.csv"
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
                  <p className="text-zinc-500 text-xs">Supports PNG, JPG, PDF, TXT, or CSV up to 10MB</p>
                </div>
              </div>
            </div>

            {/* Submit CTA */}
            {file && (
              <button
                onClick={handleUploadAndExtract}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-amber-500/15 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Upload & Read Menu
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
                  <p className="text-sm font-bold text-amber-500 animate-pulse">Reading Menu Image...</p>
                  <p className="text-zinc-500 text-xs">OCR output will be reviewed before it can become live structured menu data.</p>
                </div>
              </div>
            )}

            {status === "done" && extractedData && (
              <div className="text-left space-y-6">
                
                {/* Completion Header Banner */}
                <div className={`flex items-center gap-3 border p-4 rounded-xl ${
                  canImportStructured && extractedItemCount > 0
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/25 text-amber-400"
                }`}>
                  {canImportStructured && extractedItemCount > 0 ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                  )}
                  <div>
                    <h3 className="font-bold text-sm">
                      {canImportStructured && extractedItemCount > 0 ? "Verified menu data ready" : "OCR review required"}
                    </h3>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      {canImportStructured && extractedItemCount > 0
                        ? `Ready to import ${extractedItemCount} readable items across ${extractedData.length} categories.`
                        : `OCR preview found ${extractedItemCount} possible items. These will not go live until corrected or verified.`}
                    </p>
                    {uploadId && <p className="text-[10px] opacity-60 mt-1">Upload ref: {uploadId}</p>}
                  </div>
                </div>

                {extractionNotice && (
                  <div className="bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs py-3 px-4 rounded-xl flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{extractionNotice}</span>
                  </div>
                )}

                {uploadedFileUrl && (
                  <div className="space-y-3 border border-zinc-900 rounded-2xl p-5 bg-zinc-900/10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Posted Menu File</p>
                        <p className="text-[11px] text-zinc-500 mt-1">{uploadedFileName}</p>
                      </div>
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-400">
                        Exact source saved
                      </span>
                    </div>

                    {uploadedFileType.startsWith("image/") ? (
                      <div className="max-h-[520px] overflow-auto rounded-xl border border-zinc-800 bg-black/30 p-2">
                        <img src={uploadedFileUrl} alt={uploadedFileName || "Uploaded menu"} className="mx-auto h-auto max-w-full rounded-lg" />
                      </div>
                    ) : (
                      <a
                        href={uploadedFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-900"
                      >
                        Open uploaded menu file
                      </a>
                    )}
                  </div>
                )}

                <div className="space-y-3 border border-zinc-900 rounded-2xl p-5 bg-zinc-900/10">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-amber-500" />
                        Extracted Menu Text
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Correct OCR mistakes here, then use the corrected text as the structured menu.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => rebuildPreview(rawExtractedText)}
                      className="inline-flex items-center justify-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-white px-3 py-2 rounded-lg text-[11px] font-bold transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Use Corrected Text
                    </button>
                  </div>

                  <textarea
                    value={rawExtractedText}
                    onChange={(event) => setRawExtractedText(event.target.value)}
                    placeholder={"Example:\nWaffle Stick\nWhite Fantasy Waffle 70\nDark Chocolate Waffle 70\nOreo Chocolate Waffle 80"}
                    rows={8}
                    className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs leading-6 text-white placeholder-zinc-600 outline-none transition focus:border-amber-500"
                  />
                </div>

                <div className="space-y-3 border border-zinc-900 rounded-2xl p-5 bg-zinc-900/10">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        Verified Digitized JSON
                      </p>
                      {digitizedMetadata ? (
                        <p className="text-[11px] text-zinc-500 mt-1">
                          {digitizedMetadata.totalItemsDetected} items / {digitizedMetadata.totalCategoriesDetected} categories / notes: {digitizedMetadata.confidenceNotes}
                        </p>
                      ) : (
                        <p className="text-[11px] text-zinc-500 mt-1">
                          Paste strict verified JSON here only when item names and prices are correct.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={importStrictJson}
                      disabled={!strictJsonText.trim()}
                      className="inline-flex items-center justify-center gap-1.5 bg-emerald-500 text-black px-3 py-2 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Import JSON
                    </button>
                  </div>

                  <textarea
                    value={strictJsonText}
                    onChange={(event) => setStrictJsonText(event.target.value)}
                    placeholder={'{"menu_metadata":{"total_items_detected":0,"total_categories_detected":0,"extraction_confidence_notes":"none"},"categories":[]}'}
                    rows={8}
                    className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-[11px] leading-5 text-white placeholder-zinc-600 outline-none transition focus:border-emerald-500"
                  />
                </div>

                {/* Extracted preview list */}
                <div className="space-y-4 border border-zinc-900 rounded-2xl p-6 bg-zinc-900/10">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                      {canImportStructured ? "Verified Preview" : "OCR Preview Only"}
                    </p>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-bold ${
                      canImportStructured
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                        : "border-amber-500/20 bg-amber-500/10 text-amber-300"
                    }`}>
                      {canImportStructured ? "Will import" : "Will not import"}
                    </span>
                  </div>
                  
                  {extractedItemCount === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50 p-8 text-center">
                      <FileText className="w-8 h-8 mx-auto text-zinc-600" />
                      <p className="mt-3 text-sm font-bold text-white">No menu items detected yet</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        Keep category headings on separate lines and place each item price at the end of its item line.
                      </p>
                    </div>
                  ) : (
                    extractedData.map((category) => (
                      <div key={category.id} className="space-y-2 pt-2 border-t border-zinc-900/60 first:border-0 first:pt-0">
                        <div className="flex justify-between items-baseline gap-3">
                          <h4 className="text-sm font-extrabold text-amber-500">{category.name}</h4>
                          <span className="text-[10px] text-zinc-500">{category.items.length} items</span>
                        </div>
                        
                        <div className="grid gap-2 mt-2">
                          {category.items.map((item) => (
                            <div key={item.id} className="flex justify-between items-start gap-4 text-xs bg-zinc-950 p-2.5 rounded-lg border border-zinc-900">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 font-bold text-white">
                                  <span className="truncate">{item.name}</span>
                                  {item.type === "veg" && <Leaf className="w-3 h-3 text-emerald-400 fill-emerald-400/10 shrink-0" />}
                                  {Number(item.spiceLevel) > 0 && <Flame className="w-3 h-3 text-orange-500 shrink-0" />}
                                </div>
                                {item.description && (
                                  <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{item.description}</p>
                                )}
                              </div>
                              <span className="font-bold text-white shrink-0">
                                {item.priceLabel || formatPreviewPrice(item.price, restaurant.currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Import Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setStatus("idle");
                      setFile(null);
                      setExtractedData(null);
                      setRawExtractedText("");
                      setStrictJsonText("");
                      setDigitizedMetadata(null);
                      setStructuredSource("none");
                      setExtractionNotice("");
                      setUploadedFileUrl("");
                      setUploadedFileType("");
                      setUploadedFileName("");
                    }}
                    className="flex-1 border border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-300 font-semibold py-3 rounded-xl text-xs transition-colors"
                  >
                    Re-upload Menu
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing || (!uploadedFileUrl && !canImportStructured)}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold py-3 rounded-xl text-xs hover:shadow-lg hover:shadow-amber-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin stroke-[2.5]" />
                        Importing...
                      </>
                    ) : (
                      <>
                        {canImportStructured ? "Import Verified Menu" : "Import Posted File Only"}
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
