"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";

interface InvoiceData {
  invoice_number: string;
  recipient_name: string | null;
  recipient_email: string;
  amount: number;
  sent_at: string;
}

export default function InvoiceViewPage() {
  const { invoiceNumber } = useParams<{ invoiceNumber: string }>();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/public/invoice?invoice_number=${encodeURIComponent(invoiceNumber)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setInvoice(d.invoice);
      })
      .catch(() => setError("Failed to load invoice"))
      .finally(() => setLoading(false));
  }, [invoiceNumber]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Invoice Not Found</h1>
          <p className="text-gray-400">{error || "This invoice does not exist."}</p>
        </div>
      </div>
    );
  }

  const date = new Date(invoice.sent_at).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const formattedAmount = Number(invoice.amount).toLocaleString("en-IN");

  return (
    <>
      <style jsx global>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-area { background: white !important; padding: 40px !important; }
          .print-area * { color: #1a1a1a !important; }
          .print-area .gold-text { color: #B8860B !important; }
        }
      `}</style>
      <div className="min-h-screen bg-black">
        {/* Download / Print bar */}
        <div className="no-print sticky top-0 z-10 bg-[#111] border-b border-[#d4af37]/20 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span style={{ fontFamily: "Georgia, serif" }} className="text-[#d4af37] text-lg font-bold tracking-wide">
              Apex
            </span>
            <span className="text-white text-lg font-light">Fashion Lab</span>
          </div>
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-[#d4af37] text-black font-semibold rounded-lg hover:bg-[#c9a030] transition-colors text-sm"
          >
            Download / Print Invoice
          </button>
        </div>

        {/* Invoice content */}
        <div className="flex justify-center py-12 px-4">
          <div ref={printRef} className="print-area w-full max-w-[640px] bg-[#0a0a0a] border border-[#d4af37]/20 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="bg-black px-10 py-8 text-center border-b border-[#d4af37]/30">
              <h1 className="m-0">
                <span style={{ fontFamily: "Georgia, serif" }} className="text-[#d4af37] text-[28px] font-bold tracking-[2px]">
                  Apex
                </span>
                <span className="text-white text-[28px] font-light tracking-[2px] ml-2">Fashion Lab</span>
              </h1>
              <div className="mt-3 flex items-center justify-center gap-4">
                <div className="h-px w-16 bg-[#d4af37]/40" />
                <p className="text-[#d4af37]/70 text-xs uppercase tracking-[3px] m-0">Invoice</p>
                <div className="h-px w-16 bg-[#d4af37]/40" />
              </div>
            </div>

            {/* Invoice Meta */}
            <div className="px-10 pt-8">
              <div className="flex justify-between">
                <div>
                  <p className="text-[#d4af37]/60 text-[10px] uppercase tracking-[2px] m-0 mb-1">Billed To</p>
                  <p className="text-white text-base font-semibold m-0">{invoice.recipient_name || "Customer"}</p>
                  <p className="text-gray-500 text-xs mt-1 m-0">{invoice.recipient_email}</p>
                </div>
                <div className="text-right">
                  <p className="text-[#d4af37]/60 text-[10px] uppercase tracking-[2px] m-0 mb-1">Invoice No.</p>
                  <p className="text-[#d4af37] text-base font-bold m-0 gold-text">{invoice.invoice_number}</p>
                  <p className="text-gray-500 text-xs mt-2 m-0">Date: {date}</p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="px-10 pt-6">
              <div className="h-px bg-[#d4af37]/20" />
            </div>

            {/* Line Items */}
            <div className="px-10 py-6">
              <div className="rounded-lg overflow-hidden border border-[#d4af37]/10">
                <div className="flex bg-[#111] border-b border-[#d4af37]/10">
                  <div className="flex-1 px-4 py-3">
                    <span className="text-[#d4af37]/50 text-[10px] uppercase tracking-[2px]">Description</span>
                  </div>
                  <div className="w-32 px-4 py-3 text-right">
                    <span className="text-[#d4af37]/50 text-[10px] uppercase tracking-[2px]">Amount</span>
                  </div>
                </div>
                <div className="flex">
                  <div className="flex-1 px-4 py-4">
                    <span className="text-white text-sm">Professional services — Apex Fashion Lab</span>
                  </div>
                  <div className="w-32 px-4 py-4 text-right">
                    <span className="text-white text-sm font-semibold">₹{formattedAmount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="px-10 pb-8">
              <div className="bg-black rounded-lg border border-[#d4af37]/30 flex items-center justify-between px-6 py-5">
                <p className="text-[#d4af37]/60 text-xs uppercase tracking-[2px] m-0">Total Amount Due</p>
                <p className="text-[#d4af37] text-2xl font-bold m-0 gold-text">₹{formattedAmount}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-black border-t border-[#d4af37]/20 px-10 py-6 text-center">
              <p className="text-[#d4af37] text-sm font-semibold m-0 mb-1">Thank you for choosing Apex Fashion Lab</p>
              <p className="text-gray-500 text-xs m-0">connect@apexfashionlab.com · +91 93193 36498</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
