"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import { Button } from "@/components/ui/button";

interface SignaturePadModalProps {
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

export function SignaturePadModal({ onSave, onClose }: SignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Fill canvas white on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    // Use device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#0D1117";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    lastPos.current = getPos(e, canvas);
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setIsEmpty(false);
    }
    lastPos.current = pos;
  }, []);

  const stopDraw = useCallback(() => {
    drawing.current = false;
    lastPos.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDraw);
    canvas.addEventListener("mouseleave", stopDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDraw);
    return () => {
      canvas.removeEventListener("mousedown", startDraw);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDraw);
      canvas.removeEventListener("mouseleave", stopDraw);
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDraw);
    };
  }, [startDraw, draw, stopDraw]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setIsEmpty(true);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;
    onSave(canvas.toDataURL("image/png"));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Signature Pad"
    >
      <div className="w-full max-w-lg bg-cream border-2 border-navy shadow-brutal-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-navy">
          <div>
            <h2 className="font-display text-xl uppercase tracking-wide text-navy">Draw Your Signature</h2>
            <p className="text-xs text-navy/60 mt-0.5">Use your mouse or finger to sign below</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 border-2 border-navy bg-white hover:bg-navy hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Canvas area */}
        <div className="p-5">
          <div className="relative border-2 border-navy bg-white" style={{ cursor: "crosshair" }}>
            <canvas
              ref={canvasRef}
              className="w-full block"
              style={{ height: "180px", touchAction: "none" }}
            />
            {/* Guide line */}
            <div className="absolute bottom-8 left-6 right-6 border-b border-dashed border-navy/20 pointer-events-none" />
            {/* Placeholder text */}
            {isEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-sm text-navy/25 font-medium select-none">Sign here</span>
              </div>
            )}
          </div>

          {/* Legal note */}
          <p className="mt-2 text-xs text-navy/50 uppercase tracking-wide">
            By signing, you confirm this is your authorized signature for the dissolution document.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            Clear
          </Button>
          <Button onClick={handleSave} disabled={isEmpty} className="flex-1">
            Use This Signature →
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return ReactDOM.createPortal(modal, document.body);
}
