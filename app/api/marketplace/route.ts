export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

// in-memory storage instead of filesystem
let assets: any[] = [];

const read = () => assets;
const write = (data: any[]) => {
  assets = data;
};

// GET — all assets or listed only
export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all");
  const data = read();
  if (all === "true") return NextResponse.json(data);
  return NextResponse.json(data.filter((a: any) => a.listed));
}

// POST — list asset
export async function POST(req: NextRequest) {
  const { id, price, supply, txHash, name, description } = await req.json();

  const data = read();
  const idx = data.findIndex((a: any) => a.id === id);

  if (idx === -1)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  data[idx].listed = true;
  data[idx].price = price;
  data[idx].supply = supply ?? 1;
  data[idx].sold = 0;
  data[idx].buyers = [];
  data[idx].listTxHash = txHash ?? "";
  data[idx].listedAt = new Date().toISOString();

  if (name) data[idx].name = name;
  if (description !== undefined) data[idx].description = description;

  write(data);
  return NextResponse.json(data[idx]);
}

// PATCH — delist asset
export async function PATCH(req: NextRequest) {
  const { id, owner, txHash } = await req.json();

  const data = read();
  const idx = data.findIndex((a: any) => a.id === id);

  if (idx === -1)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (data[idx].owner !== owner)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  data[idx].listed = false;
  data[idx].delistTxHash = txHash ?? "";

  write(data);
  return NextResponse.json(data[idx]);
}