"use client";

import React, { useEffect, useState } from "react";
import { useWorkspace } from "../layout";
import { getScanLogs, getRestaurantQrs, ScanLog, QrCode } from "@/lib/firebase/db";
import { 
  TrendingUp, 
  Loader2, 
  Clock, 
  Smartphone, 
  QrCode as QrIcon, 
  Activity, 
  ArrowUpRight,
  Globe,
  Monitor,
  Laptop
} from "lucide-react";

export default function AnalyticsPage() {
  const { restaurant } = useWorkspace();
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [qrs, setQrs] = useState<QrCode[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const restaurantId = restaurant?.id;

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!restaurantId) return;

      try {
        const [scanLogs, qrList] = await Promise.all([
          getScanLogs(restaurantId, 100),
          getRestaurantQrs(restaurantId)
        ]);
        setLogs(scanLogs);
        setQrs(qrList);
      } catch (err) {
        console.error("Error loading analytics:", err);
        setError("Failed to load scan analytics.");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [restaurantId]);

  if (!restaurant || !restaurantId) return null;

  // Aggregate device metrics
  let iosCount = 0;
  let androidCount = 0;
  let desktopCount = 0;
  
  logs.forEach(log => {
    const ua = log.userAgent.toLowerCase();
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("cfnetwork")) {
      iosCount++;
    } else if (ua.includes("android")) {
      androidCount++;
    } else {
      desktopCount++;
    }
  });

  const totalScans = logs.length;
  const iosPercent = totalScans > 0 ? Math.round((iosCount / totalScans) * 100) : 0;
  const androidPercent = totalScans > 0 ? Math.round((androidCount / totalScans) * 100) : 0;
  const desktopPercent = totalScans > 0 ? Math.round((desktopCount / totalScans) * 100) : 0;

  // Retrieve table name for a QR ID
  const getTableName = (qrId: string) => {
    const match = qrs.find(q => q.id === qrId);
    return match ? match.name : "General / Main QR";
  };

  if (loading) {
    return (
      <div className="p-10 flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-10 max-w-5xl">
      
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Scan Analytics</h1>
        <p className="text-zinc-400 text-sm mt-1">Monitor guest traffic, popular tables, and active device configurations.</p>
      </div>

      {/* Aggregate Cards */}
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
        
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-2">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-500" />
            Total Scans Logged
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-white">{totalScans}</p>
            <span className="text-[10px] text-emerald-400 font-bold flex items-center">
              +100%
              <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
          <p className="text-[9px] text-zinc-550">Active scan window history</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-2">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <QrIcon className="w-3.5 h-3.5 text-blue-500" />
            Active Table Targets
          </p>
          <p className="text-2xl font-black text-white">{qrs.length}</p>
          <p className="text-[9px] text-zinc-550">Tracked placard nodes</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-2">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            Latest Scan Event
          </p>
          <p className="text-sm font-extrabold text-white truncate">
            {logs.length > 0 && logs[0].timestamp
              ? new Date(logs[0].timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : "No scan yet"}
          </p>
          <p className="text-[9px] text-zinc-550">
            {logs.length > 0 && logs[0].timestamp
              ? new Date(logs[0].timestamp.seconds * 1000).toLocaleDateString()
              : "Awaiting customer scans"}
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-2">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-purple-500" />
            Mobile Scan Rate
          </p>
          <p className="text-2xl font-black text-white">{iosPercent + androidPercent}%</p>
          <p className="text-[9px] text-zinc-550">iOS and Android distribution</p>
        </div>

      </div>

      {/* Device Chart & Popular Tables Grid */}
      <div className="grid md:grid-cols-2 gap-8">
        
        {/* Device Types Bar Chart representation */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-5">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-purple-500" />
            Device Breakdowns
          </h3>
          
          <div className="space-y-4">
            {/* Visual stacked Bar */}
            <div className="h-6 w-full rounded-lg bg-zinc-900 overflow-hidden flex">
              <div style={{ width: `${iosPercent}%` }} className="bg-amber-500 h-full hover:opacity-90" title={`iOS: ${iosPercent}%`} />
              <div style={{ width: `${androidPercent}%` }} className="bg-purple-500 h-full hover:opacity-90" title={`Android: ${androidPercent}%`} />
              <div style={{ width: `${desktopPercent}%` }} className="bg-zinc-700 h-full hover:opacity-90" title={`Desktop: ${desktopPercent}%`} />
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="font-semibold text-zinc-300">iOS</span>
                </div>
                <p className="text-[11px] font-bold text-white pl-4">{iosPercent}%</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span className="font-semibold text-zinc-300">Android</span>
                </div>
                <p className="text-[11px] font-bold text-white pl-4">{androidPercent}%</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                  <span className="font-semibold text-zinc-300">Other / Desk</span>
                </div>
                <p className="text-[11px] font-bold text-white pl-4">{desktopPercent}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Popular Spots Rankings */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Top Scanning Spot Placards
          </h3>
          
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {qrs.length === 0 ? (
              <p className="text-xs text-zinc-500">No data. Add QR codes to start ranking.</p>
            ) : (
              [...qrs]
                .sort((a, b) => b.scanCount - a.scanCount)
                .slice(0, 5)
                .map((item, idx) => (
                  <div key={item.id} className="flex justify-between items-center bg-zinc-900/20 p-2.5 rounded-xl border border-zinc-900/60">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-5 h-5 rounded-full bg-zinc-900 text-zinc-550 border border-zinc-800 flex items-center justify-center font-bold font-mono">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-white">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-amber-500">{item.scanCount} scans</span>
                  </div>
                ))
            )}
          </div>
        </div>

      </div>

      {/* Real-time scan logs feed */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          Recent Scan Logs
        </h3>

        <div className="border border-zinc-900 rounded-xl overflow-hidden text-xs">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-zinc-900 border-b border-zinc-900 text-zinc-500 font-semibold select-none">
                <th className="p-3">Placard Spot</th>
                <th className="p-3">Scan Date & Time</th>
                <th className="p-3">Visitor Device Type</th>
                <th className="p-3">Origin URL</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-zinc-550">Awaiting customer scans at your tables.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/10 text-zinc-300">
                    <td className="p-3 font-semibold text-white">{getTableName(log.qrId)}</td>
                    <td className="p-3">
                      {log.timestamp 
                        ? new Date(log.timestamp.seconds * 1000).toLocaleString() 
                        : "Processing..."}
                    </td>
                    <td className="p-3 truncate max-w-xs" title={log.userAgent}>{log.userAgent}</td>
                    <td className="p-3 text-zinc-500 font-mono truncate max-w-xs" title={log.referer}>{log.referer}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
