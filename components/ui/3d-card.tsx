"use client";

import React, { useState, useRef, MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform, type MotionStyle } from "framer-motion";

interface Card3DProps {
  frontContent: React.ReactNode;
  backContent?: React.ReactNode;
  styleType?: "flat" | "elevated" | "3d-tilt" | "3d-flip";
  className?: string;
  theme?: {
    theme: string;
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
  };
}

// Helper: Calculate if a hex color is dark
function isColorDark(color: string) {
  if (!color) return false;
  const hex = color.replace("#", "");
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }
  return false;
}

export const Card3D: React.FC<Card3DProps> = ({
  frontContent,
  backContent,
  styleType = "3d-tilt",
  className = "",
  theme,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Motion Values for Tilt Effect
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(y, [0, 1], [15, -15]), { stiffness: 150, damping: 15 });
  const rotateY = useSpring(useTransform(x, [0, 1], [-15, 15]), { stiffness: 150, damping: 15 });

  // Glare overlay positions
  const glareX = useSpring(useTransform(x, [0, 1], ["0%", "100%"]), { stiffness: 150, damping: 15 });
  const glareY = useSpring(useTransform(y, [0, 1], ["0%", "100%"]), { stiffness: 150, damping: 15 });
  const glareOpacity = useSpring(0, { stiffness: 150, damping: 15 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || styleType !== "3d-tilt") return;

    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    x.set(mouseX / width);
    y.set(mouseY / height);
    glareOpacity.set(0.4);
  };

  const handleMouseLeave = () => {
    x.set(0.5);
    y.set(0.5);
    glareOpacity.set(0);
  };

  const handleCardClick = () => {
    if (styleType === "3d-flip" && backContent) {
      setIsFlipped(!isFlipped);
    }
  };

  // Base card styling classes - dynamically strip background colors if theme styling is loaded
  const getCardClasses = () => {
    const base = "relative rounded-2xl overflow-hidden transition-all duration-300 w-full ";
    if (styleType === "flat") {
      return base + (theme ? "border" : "border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-950");
    }
    if (styleType === "elevated") {
      return base + (theme ? "shadow-md hover:shadow-xl border" : "shadow-md hover:shadow-xl border border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950");
    }
    if (styleType === "3d-tilt") {
      return base + (theme ? "cursor-pointer select-none border shadow-lg" : "cursor-pointer select-none bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 shadow-lg");
    }
    if (styleType === "3d-flip") {
      return base + "cursor-pointer perspective-1000 h-[280px] bg-transparent";
    }
    return base;
  };

  // Determine dark mode based on custom theme background color
  const isDark = theme ? isColorDark(theme.backgroundColor) : false;

  // Build inline styles to override static Tailwind dark/light classes with theme parameters
  const customCardStyle: React.CSSProperties = theme ? {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderColor: isDark ? "#292524" : "#e7e5e4",
    color: theme.textColor,
  } : {};

  if (styleType === "3d-tilt") {
    return (
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleCardClick}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
          ...customCardStyle,
        }}
        className={`${getCardClasses()} ${className}`}
      >
        {/* Shiny Glare Overlay */}
        <motion.div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "radial-gradient(circle at var(--glare-x) var(--glare-y), rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 80%)",
            opacity: glareOpacity,
            pointerEvents: "none",
            zIndex: 10,
            "--glare-x": glareX,
            "--glare-y": glareY,
          } as unknown as MotionStyle}
        />
        
        {/* Child Content */}
        <div style={{ transform: "translateZ(30px)" }} className="relative z-1">
          {frontContent}
        </div>
      </motion.div>
    );
  }

  if (styleType === "3d-flip" && backContent) {
    return (
      <div 
        className={`${getCardClasses()} ${className}`}
        onClick={handleCardClick}
      >
        <motion.div
          className="w-full h-full relative preserve-3d"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
          {/* Front Face */}
          <div 
            className={`absolute inset-0 w-full h-full backface-hidden rounded-2xl shadow-md flex flex-col ${theme ? "" : "border border-zinc-100 dark:border-zinc-850 bg-white dark:bg-zinc-950"}`}
            style={customCardStyle}
          >
            {frontContent}
          </div>

          {/* Back Face */}
          <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-2xl border border-zinc-100 dark:border-zinc-850 bg-stone-900 text-white shadow-md flex flex-col p-6 overflow-y-auto">
            {backContent}
          </div>
        </motion.div>
      </div>
    );
  }

  // Fallback for flat or elevated styles
  return (
    <div 
      className={`${getCardClasses()} ${className}`} 
      onClick={handleCardClick}
      style={customCardStyle}
    >
      {frontContent}
    </div>
  );
};
