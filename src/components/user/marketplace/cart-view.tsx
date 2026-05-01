"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Trash2,
  Loader2,
  Plus,
  Minus,
  CreditCard,
  ChevronLeft,
} from "lucide-react";
import { ListSkeleton } from "@/components/user/primitives/skeleton";
import { EmptyState } from "@/components/user/primitives/empty-state";
import { toast } from "sonner";

interface CartItem {
  id: string;
  listingId: string;
  title: string;
  price: number;
  currency: string;
  thumbnail: string | null;
  quantity: number;
  available: boolean;
  sellerId: string;
}

export function CartView() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cart");
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      setItems(d.items ?? []);
    } catch (err) {
      toast.error("Couldn't load cart", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateQty = async (item: CartItem, next: number) => {
    if (next < 1 || next > 99) return;
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/cart/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: next }),
      });
      if (!res.ok) throw new Error("Failed");
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, quantity: next } : i))
      );
    } catch {
      toast.error("Couldn't update quantity");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: CartItem) => {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/cart/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Removed from cart");
    } catch {
      toast.error("Couldn't remove item");
    } finally {
      setBusyId(null);
    }
  };

  const checkout = async () => {
    setCheckingOut(true);
    try {
      const res = await fetch("/api/cart/checkout", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success(`Checkout complete · $${data.total.toFixed(2)} charged`);
      setItems([]);
      router.push("/marketplace/orders");
      router.refresh();
    } catch (err) {
      toast.error("Checkout failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setCheckingOut(false);
    }
  };

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const fees = subtotal * 0.05;
  const total = subtotal;
  const hasUnavailable = items.some((i) => !i.available);

  return (
    <div className="space-y-3">
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to marketplace
      </Link>

      <h1 className="text-xl font-bold text-white inline-flex items-center gap-2">
        <ShoppingCart className="w-5 h-5 text-indigo-400" />
        Your Cart
      </h1>

      {loading && <ListSkeleton rows={3} />}

      {!loading && items.length === 0 && (
        <EmptyState
          icon={ShoppingCart}
          title="Cart is empty"
          description="Add listings from the marketplace to check out together."
          action={{ label: "Browse marketplace", href: "/marketplace" }}
        />
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="space-y-2">
            {items.map((i) => (
              <div
                key={i.id}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  i.available
                    ? "bg-gray-900 border-gray-800"
                    : "bg-red-500/5 border-red-500/30"
                }`}
              >
                <div className="w-14 h-14 rounded-lg bg-gray-800 overflow-hidden shrink-0">
                  {i.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={i.thumbnail}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/marketplace/${i.listingId}`}
                    className="text-sm font-semibold text-white truncate hover:underline block"
                  >
                    {i.title}
                  </Link>
                  <p className="text-xs text-gray-500 tabular-nums">
                    ${i.price.toFixed(2)} each
                  </p>
                  {!i.available && (
                    <p className="text-[11px] text-red-400 mt-0.5">
                      No longer available · remove to continue
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    disabled={busyId === i.id || i.quantity <= 1}
                    onClick={() => updateQty(i, i.quantity - 1)}
                    className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
                  >
                    <Minus className="w-3 h-3 text-white" />
                  </button>
                  <span className="text-sm font-bold text-white tabular-nums w-6 text-center">
                    {i.quantity}
                  </span>
                  <button
                    disabled={busyId === i.id || i.quantity >= 99}
                    onClick={() => updateQty(i, i.quantity + 1)}
                    className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3 text-white" />
                  </button>
                </div>
                <button
                  disabled={busyId === i.id}
                  onClick={() => remove(i)}
                  className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-gray-800 disabled:opacity-50"
                >
                  {busyId === i.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Subtotal</span>
              <span className="tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Platform fee (5% deducted from each seller)</span>
              <span className="tabular-nums">${fees.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-800 pt-2 flex justify-between text-base font-bold text-white">
              <span>You pay</span>
              <span className="tabular-nums">${total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={checkout}
            disabled={checkingOut || hasUnavailable}
            className="w-full py-3 rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {checkingOut ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            {hasUnavailable ? "Remove unavailable items first" : `Checkout · $${total.toFixed(2)}`}
          </button>
        </>
      )}
    </div>
  );
}
