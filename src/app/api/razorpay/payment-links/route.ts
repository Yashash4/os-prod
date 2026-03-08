import { NextRequest, NextResponse } from "next/server";
import { createPaymentLink } from "@/lib/razorpay";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      amount,
      currency,
      description,
      customerName,
      customerEmail,
      customerPhone,
      notifySms,
      notifyEmail,
      expireByUnix,
      notes,
    } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (!customerEmail && !customerPhone) {
      return NextResponse.json(
        { error: "At least one of email or phone is required" },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const result = await createPaymentLink({
      amountInRupees: amount,
      currency: currency || "INR",
      description,
      customerName: customerName || "",
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      notifySms: !!notifySms,
      notifyEmail: !!notifyEmail,
      expireByUnix: expireByUnix || undefined,
      notes: notes || undefined,
    });

    return NextResponse.json({
      success: true,
      paymentLink: {
        id: result.id,
        short_url: result.short_url,
        amount: result.amount,
        status: result.status,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create payment link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
