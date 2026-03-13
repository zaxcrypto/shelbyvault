import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "assets.json");

const read = () => {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, "utf-8"));
};

const write = (data: any) => {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
};

// GET — all assets or listed only
export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all");
  const data = read();
  if (all === "true") return NextResponse.json(data);
  return NextResponse.json(data.filter((a: any) => a.listed));
}

// POST — list asset with price + supply + name + description + txHash
export async function POST(req: NextRequest) {
  const { id, price, supply, txHash, name, description } = await req.json();
  const data = read();
  const idx = data.findIndex((a: any) => a.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  data[idx].listed       = true;
  data[idx].price        = price;
  data[idx].supply       = supply ?? 1;
  data[idx].sold         = 0;          // reset on new listing
  data[idx].buyers       = [];         // reset buyers
  data[idx].listTxHash   = txHash ?? "";
  data[idx].listedAt     = new Date().toISOString(); // track exact list time

  // Save name/description if provided
  if (name)        data[idx].name        = name;
  if (description !== undefined) data[idx].description = description;

  write(data);
  return NextResponse.json(data[idx]);
}

// PATCH — delist asset (requires owner check)
export async function PATCH(req: NextRequest) {
  const { id, owner, txHash } = await req.json();
  const data = read();
  const idx = data.findIndex((a: any) => a.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (data[idx].owner !== owner) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  data[idx].listed       = false;
  data[idx].delistTxHash = txHash ?? "";

  write(data);
  return NextResponse.json(data[idx]);
}