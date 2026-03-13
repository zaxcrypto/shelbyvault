import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DB = path.join(process.cwd(), "data", "assets.json");

export async function DELETE(req: NextRequest) {
  try {
    const { id, owner } = await req.json();
    const raw = fs.readFileSync(DB, "utf-8");
    const assets = JSON.parse(raw);
    const asset = assets.find((a: any) => a.id === id);
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (asset.owner !== owner) return NextResponse.json({ error: "Not owner" }, { status: 403 });
    const updated = assets.filter((a: any) => a.id !== id);
    fs.writeFileSync(DB, JSON.stringify(updated, null, 2));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}