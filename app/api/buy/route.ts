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

export async function POST(req: NextRequest) {
  const { id, buyer, txHash } = await req.json();

  if (!id || !buyer || !txHash) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const data = read();
  const idx = data.findIndex((a: any) => a.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const asset = data[idx];

  // Can't buy your own asset
  if (asset.owner === buyer) {
    return NextResponse.json({ error: "You own this asset" }, { status: 400 });
  }

  // Must be listed
  if (!asset.listed) {
    return NextResponse.json({ error: "Not listed" }, { status: 400 });
  }

  const supply = asset.supply ?? 1;
  const sold   = asset.sold   ?? 0;

  // Check sold out
  if (sold >= supply) {
    return NextResponse.json({ error: "Sold out" }, { status: 400 });
  }

  const newSold = sold + 1;
  const allSoldOut = newSold >= supply;

  // Track buyers list (multiple buyers possible for supply > 1)
  const buyers: string[] = asset.buyers ?? [];
  buyers.push(buyer);

  // Update asset — owner stays as ORIGINAL seller, only track buyers separately
  data[idx].sold      = newSold;
  data[idx].listed    = !allSoldOut; // delist only when fully sold out
  data[idx].buyers    = buyers;
  data[idx].buyTxHash = txHash;

  // Only transfer ownership if supply is 1 (1/1 NFT)
  if (supply === 1) {
    data[idx].owner = buyer;
  }

  write(data);
  return NextResponse.json(data[idx]);
}