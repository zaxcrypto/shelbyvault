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

// POST — toggle like
export async function POST(req: NextRequest) {
  const { id, wallet } = await req.json();
  if (!id || !wallet) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const data = read();
  const idx  = data.findIndex((a: any) => a.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!data[idx].likes) data[idx].likes = [];

  const already = data[idx].likes.includes(wallet);
  if (already) {
    data[idx].likes = data[idx].likes.filter((w: string) => w !== wallet);
  } else {
    data[idx].likes.push(wallet);
  }

  write(data);
  return NextResponse.json({
    liked:      !already,
    likeCount:  data[idx].likes.length,
    likes:      data[idx].likes,
  });
}