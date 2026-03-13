"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Navbar from "@/components/Navbar";

interface Asset {
  id: string;
  name: string;
  owner: string;
  price: number;
  supply: number;
  sold: number;
  fileType: string;
  shelbyUrl: string;
  listed: boolean;
  uploadedAt: string;
  likes: string[];
  listTxHash?: string;
  description?: string;
  listedAt?: string;
  buyers?: string[];
}

interface LiveToken {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  icon: string;
}

type SortOption = "default" | "price_low" | "price_high" | "most_liked";

export default function MarketplacePage() {
  const { account, connected, signAndSubmitTransaction, network } = useWallet();
  const [assets, setAssets]             = useState<Asset[]>([]);
  const [loading, setLoading]           = useState(true);
  const [buying, setBuying]             = useState<string | null>(null);
  const [delisting, setDelisting]       = useState<string | null>(null);
  const [liking, setLiking]             = useState<string | null>(null);
  const [success, setSuccess]           = useState<string | null>(null);
  const [sort, setSort]                 = useState<SortOption>("default");
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [detailAsset, setDetailAsset]   = useState<Asset | null>(null);
  const [hoveredId, setHoveredId]       = useState<string | null>(null);
  const [liveTokens, setLiveTokens]     = useState<LiveToken[]>([]);
  const [aptPrice, setAptPrice]         = useState<number | null>(null);
  const [aptChange, setAptChange]       = useState<number>(0);
  const [searchQuery, setSearchQuery]   = useState("");
  const [copied, setCopied]             = useState<string | null>(null);
  const tickerRef                       = useRef<HTMLDivElement>(null);

  const networkName = network?.name?.toLowerCase() ?? "";
  const isShelby = networkName.includes("shelby") ||
    (!!networkName && !["testnet","mainnet","devnet","localnet"].includes(networkName));
  const currency = isShelby ? "ShelbyUSD" : "APT";

  // ── Live prices from CoinGecko (free, no key needed) ──
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=aptos,bitcoin,ethereum,solana,sui,dogecoin,pepe,shiba-inu&order=market_cap_desc&sparkline=false&price_change_percentage=24h",
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const tokens: LiveToken[] = data.map((c: any) => ({
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          price: c.current_price,
          change24h: c.price_change_percentage_24h ?? 0,
          icon: c.image,
        }));
        setLiveTokens(tokens);
        const apt = tokens.find(t => t.symbol === "APT");
        if (apt) { setAptPrice(apt.price); setAptChange(apt.change24h); }
      } catch {}
    };
    fetchPrices();
    const iv = setInterval(fetchPrices, 20000);
    return () => clearInterval(iv);
  }, []);

  // ── Ticker scroll ──
  useEffect(() => {
    if (liveTokens.length === 0) return;
    let frame: number;
    let pos = 0;
    const tick = () => {
      pos -= 0.55;
      const el = tickerRef.current;
      if (el) {
        const half = el.scrollWidth / 2;
        if (Math.abs(pos) >= half) pos = 0;
        el.style.transform = `translateX(${pos}px)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [liveTokens]);

  useEffect(() => { fetchAssets(); }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/marketplace");
      const data = await res.json();
      setAssets(data);
    } catch {}
    setLoading(false);
  };

  const handleBuy = async (asset: Asset) => {
    if (!connected || !account) return alert("Connect wallet first!");
    if (asset.owner === account.address.toString()) return alert("You own this asset!");
    if (isSoldOut(asset)) return alert("Sold out!");
    setBuying(asset.id);
    try {
      const octas = Math.floor(asset.price * 100_000_000);
      const tx = await signAndSubmitTransaction({
        data: {
          function: "0x1::coin::transfer",
          typeArguments: ["0x1::aptos_coin::AptosCoin"],
          functionArguments: [asset.owner, octas.toString()],
        },
      });
      await fetch("/api/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: asset.id, buyer: account.address.toString(), txHash: tx.hash }),
      });
      setSuccess(asset.id);
      setTimeout(() => setSuccess(null), 3000);
      await fetchAssets();
    } catch (err: any) {
      alert("Purchase failed: " + (err?.message || "User rejected"));
    }
    setBuying(null);
  };

  const handleDelist = async (asset: Asset) => {
    if (!connected || !account) return;
    setDelisting(asset.id);
    try {
      const tx = await signAndSubmitTransaction({
        data: {
          function: "0x1::coin::transfer",
          typeArguments: ["0x1::aptos_coin::AptosCoin"],
          functionArguments: [account.address.toString(), "1000"],
        },
      });
      await fetch("/api/marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: asset.id, owner: account.address.toString(), txHash: tx.hash }),
      });
      await fetchAssets();
    } catch (err: any) {
      alert("Delist failed: " + (err?.message || "User rejected"));
    }
    setDelisting(null);
  };

  const handleLike = async (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!account) return alert("Connect wallet first!");
    setLiking(asset.id);
    try {
      const tx = await signAndSubmitTransaction({
        data: {
          function: "0x1::coin::transfer",
          typeArguments: ["0x1::aptos_coin::AptosCoin"],
          functionArguments: [account.address.toString(), "1000"],
        },
      });
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: asset.id, wallet: account.address.toString(), txHash: tx.hash }),
      });
      const data = await res.json();
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, likes: data.likes } : a));
    } catch (err: any) {
      alert("Like failed: " + (err?.message || "User rejected"));
    }
    setLiking(null);
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const isOwner   = (a: Asset) => connected && account?.address.toString() === a.owner;
  const isSoldOut = (a: Asset) => (a.sold ?? 0) >= (a.supply ?? 1);
  const remaining = (a: Asset) => (a.supply ?? 1) - (a.sold ?? 0);
  const isLiked   = (a: Asset) => (a.likes ?? []).includes(account?.address.toString() ?? "");
  const likeCount = (a: Asset) => (a.likes ?? []).length;
  const fmtUSD    = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(1)}k` : `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;

  const filtered = [...assets]
    .filter(a => !searchQuery || a.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sort === "price_low")  return a.price - b.price;
      if (sort === "price_high") return b.price - a.price;
      if (sort === "most_liked") return (b.likes?.length ?? 0) - (a.likes?.length ?? 0);
      return 0;
    });

  const totalVol  = assets.reduce((s, a) => s + a.price * (a.sold ?? 0), 0);
  const floorPrice = assets.length ? Math.min(...assets.map(a => a.price)) : 0;

  return (
    <main style={{ background:"#07041a", minHeight:"100vh", fontFamily:"'Inter',sans-serif", overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}

        .nft-card{
          background:rgba(255,255,255,0.025);
          border:1px solid rgba(255,255,255,0.07);
          border-radius:18px; overflow:hidden;
          transition:all 0.25s ease; cursor:pointer;
          animation:fadeIn 0.35s ease both;
        }
        .nft-card:hover{
          border-color:rgba(168,85,247,0.45);
          transform:translateY(-6px);
          box-shadow:0 28px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(168,85,247,0.18), 0 0 40px rgba(168,85,247,0.08);
          background:rgba(168,85,247,0.04);
        }

        .sort-pill{
          padding:7px 16px; border-radius:999px;
          font-size:12px; font-weight:600;
          border:1px solid rgba(255,255,255,0.08);
          background:transparent; color:rgba(255,255,255,0.38);
          cursor:pointer; transition:all 0.2s; white-space:nowrap;
        }
        .sort-pill:hover{color:rgba(255,255,255,0.75);border-color:rgba(255,255,255,0.18);}
        .sort-pill.active{background:rgba(168,85,247,0.15);border-color:rgba(168,85,247,0.5);color:#c084fc;}

        .stat-card{
          background:rgba(255,255,255,0.03);
          border:1px solid rgba(255,255,255,0.06);
          border-radius:16px; padding:20px 24px;
          display:flex; flex-direction:column; gap:5px;
          flex:1; min-width:130px;
        }

        .search-box{
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
          border-radius:10px; padding:9px 14px 9px 36px;
          color:white; font-size:13px;
          font-family:'Inter',sans-serif; outline:none; width:220px;
          transition:all 0.2s;
        }
        .search-box:focus{border-color:rgba(168,85,247,0.45);background:rgba(168,85,247,0.04);}
        .search-box::placeholder{color:rgba(255,255,255,0.2);}

        .tag{
          display:inline-flex;align-items:center;gap:4px;
          padding:3px 9px;border-radius:999px;
          font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;
        }

        .detail-row{
          display:flex;justify-content:space-between;align-items:center;
          padding:9px 0; border-bottom:1px solid rgba(255,255,255,0.04);
        }
        .copy-pill{
          padding:3px 9px;border-radius:6px;
          background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.25);
          color:#c084fc;font-size:10px;font-weight:700;cursor:pointer;transition:all 0.15s;
          white-space:nowrap;
        }
        .copy-pill:hover{background:rgba(168,85,247,0.22);}

        .buy-btn{
          width:100%;padding:13px;border-radius:12px;
          font-weight:700;font-size:14px;color:white;border:none;
          cursor:pointer;transition:all 0.2s;letter-spacing:0.01em;
          background:linear-gradient(135deg,#ec4899,#a855f7);
          box-shadow:0 4px 20px rgba(236,72,153,0.3);
        }
        .buy-btn:hover:not(:disabled){box-shadow:0 6px 28px rgba(236,72,153,0.55);transform:translateY(-1px);}
        .buy-btn:disabled{opacity:0.38;cursor:not-allowed;transform:none;}
      `}</style>

      {/* BG orbs */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        <div style={{position:"absolute",top:"-80px",left:"-80px",width:"500px",height:"500px",borderRadius:"50%",background:"radial-gradient(circle,rgba(139,92,246,0.1) 0%,transparent 70%)",filter:"blur(60px)"}}/>
        <div style={{position:"absolute",bottom:"-80px",right:"-80px",width:"450px",height:"450px",borderRadius:"50%",background:"radial-gradient(circle,rgba(236,72,153,0.07) 0%,transparent 70%)",filter:"blur(60px)"}}/>
        <div style={{position:"absolute",top:"40%",left:"55%",width:"300px",height:"300px",borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)",filter:"blur(50px)"}}/>
      </div>

      <div style={{position:"relative",zIndex:10}}>
        <Navbar/>

        {/* ── LIVE PRICE TICKER ── */}
        {liveTokens.length > 0 && (
          <div style={{background:"rgba(255,255,255,0.018)",borderBottom:"1px solid rgba(255,255,255,0.05)",height:"40px",overflow:"hidden",display:"flex",alignItems:"center"}}>
            {/* Label */}
            <div style={{flexShrink:0,padding:"0 16px",borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:"6px",height:"100%"}}>
              <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 6px #4ade80",animation:"pulse 2s infinite"}}/>
              <span style={{fontSize:"10px",fontWeight:700,color:"rgba(255,255,255,0.35)",letterSpacing:"0.1em",whiteSpace:"nowrap"}}>LIVE</span>
            </div>
            <div style={{overflow:"hidden",flex:1}}>
              <div ref={tickerRef} style={{display:"flex",willChange:"transform"}}>
                {[...liveTokens,...liveTokens].map((t,i) => (
                  <div key={i} style={{display:"inline-flex",alignItems:"center",gap:"7px",padding:"0 20px",borderRight:"1px solid rgba(255,255,255,0.04)",flexShrink:0,height:"40px"}}>
                    <img src={t.icon} alt={t.symbol} style={{width:"16px",height:"16px",borderRadius:"50%"}}/>
                    <span style={{fontSize:"12px",fontWeight:600,color:"rgba(255,255,255,0.65)"}}>{t.symbol}</span>
                    <span style={{fontSize:"12px",color:"rgba(255,255,255,0.45)"}}>{fmtUSD(t.price)}</span>
                    <span style={{fontSize:"11px",fontWeight:700,color:t.change24h>=0?"#34d399":"#f87171"}}>
                      {t.change24h>=0?"▲":"▼"} {Math.abs(t.change24h).toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{maxWidth:"1400px",margin:"0 auto",padding:"0 40px 60px"}}>

          {/* ── PAGE HEADER ── */}
          <div style={{padding:"36px 0 28px"}}>
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:"24px"}}>
              <div>
                <p style={{fontSize:"11px",fontWeight:600,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(168,85,247,0.6)",marginBottom:"8px"}}>ShelbyVault</p>
                <h1 style={{fontSize:"2rem",fontWeight:800,color:"white",letterSpacing:"-0.03em",margin:0}}>Marketplace</h1>
                <div style={{display:"flex",alignItems:"center",gap:"10px",marginTop:"8px",flexWrap:"wrap"}}>
                  <span style={{fontSize:"13px",color:"rgba(255,255,255,0.28)"}}>Buy &amp; sell on Aptos Testnet</span>
                  {aptPrice && (
                    <div style={{display:"flex",alignItems:"center",gap:"6px",padding:"3px 10px",borderRadius:"999px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
                      <span style={{fontSize:"11px",fontWeight:700,color:"white"}}>APT</span>
                      <span style={{fontSize:"12px",fontWeight:700,color:"white"}}>${aptPrice.toFixed(2)}</span>
                      <span style={{fontSize:"11px",fontWeight:700,color:aptChange>=0?"#34d399":"#f87171"}}>
                        {aptChange>=0?"▲":"▼"}{Math.abs(aptChange).toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
                {[
                  {label:"Total Items",   value: assets.length.toString()},
                  {label:"Volume",        value: totalVol.toFixed(1)+" APT"},
                  {label:"Floor Price",   value: assets.length ? floorPrice.toFixed(2)+" APT" : "—"},
                  {label:"Total Likes",   value: assets.reduce((s,a)=>s+likeCount(a),0).toString()},
                ].map((s,i) => (
                  <div key={i} className="stat-card">
                    <span style={{fontSize:"18px",fontWeight:800,color:"white",lineHeight:1}}>{s.value}</span>
                    <span style={{fontSize:"11px",color:"rgba(255,255,255,0.3)",fontWeight:500}}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{height:"1px",background:"rgba(255,255,255,0.05)",marginBottom:"24px"}}/>

          {/* ── FILTER + SEARCH BAR ── */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",marginBottom:"28px",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
              {([
                ["default",  "✦ Latest"],
                ["price_low","↑ Price"],
                ["price_high","↓ Price"],
                ["most_liked","♥ Most Liked"],
              ] as [SortOption,string][]).map(([v,l]) => (
                <button key={v} className={`sort-pill ${sort===v?"active":""}`} onClick={()=>setSort(v)}>{l}</button>
              ))}
            </div>
            <div style={{position:"relative",display:"flex",alignItems:"center"}}>
              <span style={{position:"absolute",left:"11px",fontSize:"13px",color:"rgba(255,255,255,0.28)",pointerEvents:"none"}}>🔍</span>
              <input className="search-box" placeholder="Search assets..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
              {searchQuery && (
                <button onClick={()=>setSearchQuery("")} style={{position:"absolute",right:"10px",background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:"14px"}}>✕</button>
              )}
            </div>
          </div>

          {/* Results count */}
          {!loading && (
            <p style={{fontSize:"12px",color:"rgba(255,255,255,0.2)",marginBottom:"20px",fontWeight:500}}>
              {filtered.length} item{filtered.length!==1?"s":""} {searchQuery?`for "${searchQuery}"`:""}
            </p>
          )}

          {/* ── LOADING ── */}
          {loading && (
            <div style={{display:"flex",justifyContent:"center",padding:"120px 0"}}>
              <span style={{width:"36px",height:"36px",border:"2px solid rgba(168,85,247,0.25)",borderTopColor:"#a855f7",borderRadius:"50%",display:"inline-block",animation:"spin 0.8s linear infinite"}}/>
            </div>
          )}

          {/* ── EMPTY ── */}
          {!loading && filtered.length === 0 && (
            <div style={{textAlign:"center",padding:"100px 0",border:"1px solid rgba(255,255,255,0.05)",borderRadius:"20px",background:"rgba(255,255,255,0.02)"}}>
              <div style={{fontSize:"44px",marginBottom:"16px"}}>🏪</div>
              <p style={{color:"rgba(255,255,255,0.4)",fontSize:"16px",fontWeight:700,marginBottom:"8px"}}>
                {searchQuery ? "No results found" : "No listings yet"}
              </p>
              <p style={{color:"rgba(255,255,255,0.2)",fontSize:"13px"}}>
                {searchQuery ? `No assets match "${searchQuery}"` : "Upload and list an asset to see it here"}
              </p>
            </div>
          )}

          {/* ── NFT GRID ── */}
          {!loading && filtered.length > 0 && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"16px"}}>
              {filtered.map((asset,idx) => {
                const hov = hoveredId === asset.id;
                const soldOut = isSoldOut(asset);
                const owner = isOwner(asset);
                return (
                  <div
                    key={asset.id}
                    className="nft-card"
                    style={{animationDelay:`${idx*0.04}s`}}
                    onMouseEnter={()=>setHoveredId(asset.id)}
                    onMouseLeave={()=>setHoveredId(null)}
                    onClick={()=>setDetailAsset(asset)}
                  >
                    {/* Image */}
                    <div style={{position:"relative",aspectRatio:"1/1",background:"rgba(255,255,255,0.03)",overflow:"hidden"}}>
                      {asset.fileType?.startsWith("image/") ? (
                        <img src={asset.shelbyUrl} alt={asset.name}
                          style={{width:"100%",height:"100%",objectFit:"cover",transition:"transform 0.45s ease",transform:hov?"scale(1.07)":"scale(1)"}}/>
                      ) : (
                        <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"38px"}}>🎵</div>
                      )}

                      {/* Dim overlay if sold out */}
                      {soldOut && <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)"}}/>}

                      {/* Hover gradient */}
                      <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(7,4,26,0.88) 0%,transparent 55%)",opacity:hov?1:0,transition:"opacity 0.25s",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <div style={{padding:"7px 18px",borderRadius:"999px",background:"rgba(255,255,255,0.14)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.18)",color:"white",fontSize:"12px",fontWeight:600}}>
                          View Details
                        </div>
                      </div>

                      {/* Status tag */}
                      <div style={{position:"absolute",top:"10px",left:"10px"}}>
                        {soldOut ? (
                          <div className="tag" style={{background:"rgba(0,0,0,0.7)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.4)",backdropFilter:"blur(8px)"}}>Sold Out</div>
                        ) : owner ? (
                          <div className="tag" style={{background:"rgba(99,102,241,0.2)",border:"1px solid rgba(99,102,241,0.4)",color:"#818cf8",backdropFilter:"blur(8px)"}}>Yours</div>
                        ) : (
                          <div className="tag" style={{background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.35)",color:"#34d399",backdropFilter:"blur(8px)"}}>● Live</div>
                        )}
                      </div>

                      {/* Like */}
                      <button
                        onClick={e=>handleLike(asset,e)}
                        disabled={liking===asset.id}
                        style={{position:"absolute",top:"10px",right:"10px",display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",borderRadius:"999px",background:isLiked(asset)?"rgba(236,72,153,0.3)":"rgba(0,0,0,0.55)",border:isLiked(asset)?"1px solid rgba(236,72,153,0.6)":"1px solid rgba(255,255,255,0.1)",backdropFilter:"blur(8px)",cursor:"pointer",transition:"all 0.2s"}}
                      >
                        <span style={{fontSize:"11px"}}>{isLiked(asset)?"❤️":"🤍"}</span>
                        <span style={{fontSize:"11px",fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{likeCount(asset)}</span>
                      </button>

                      {/* Price bottom */}
                      {!soldOut && (
                        <div style={{position:"absolute",bottom:"10px",right:"10px",padding:"4px 10px",borderRadius:"8px",background:"rgba(7,4,26,0.85)",backdropFilter:"blur(8px)",border:"1px solid rgba(236,72,153,0.28)",fontSize:"11px",fontWeight:700,color:"#f472b6"}}>
                          {asset.price} {currency}
                        </div>
                      )}
                    </div>

                    {/* Card body */}
                    <div style={{padding:"14px 16px 16px",display:"flex",flexDirection:"column",gap:"12px"}}>
                      {/* Name */}
                      <div>
                        <p style={{fontWeight:700,fontSize:"13px",color:"white",margin:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",letterSpacing:"-0.01em"}}>{asset.name}</p>
                        <p style={{fontSize:"11px",color:"rgba(255,255,255,0.22)",margin:"3px 0 0 0"}}>
                          {new Date(asset.uploadedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                        </p>
                      </div>

                      {/* Price + supply row */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{display:"flex",flexDirection:"column",gap:"2px"}}>
                          <span style={{fontSize:"10px",fontWeight:600,color:"rgba(255,255,255,0.22)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Price</span>
                          <span style={{fontSize:"14px",fontWeight:800,color:soldOut?"rgba(255,255,255,0.25)":"#a78bfa"}}>
                            {soldOut ? "—" : `${asset.price} ${currency}`}
                          </span>
                          {aptPrice && !soldOut && (
                            <span style={{fontSize:"10px",color:"rgba(255,255,255,0.2)"}}>≈ ${(asset.price * aptPrice).toFixed(2)}</span>
                          )}
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:"2px",alignItems:"flex-end"}}>
                          <span style={{fontSize:"10px",fontWeight:600,color:"rgba(255,255,255,0.22)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Supply</span>
                          <span style={{fontSize:"13px",fontWeight:700,color:soldOut?"#f87171":"rgba(255,255,255,0.6)"}}>
                            {soldOut?"Sold Out":`${remaining(asset)} / ${asset.supply??1}`}
                          </span>
                        </div>
                      </div>

                      {/* Supply bar */}
                      <div style={{height:"3px",borderRadius:"999px",background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:"999px",transition:"width 0.4s",width:`${Math.min(100,((asset.sold??0)/(asset.supply??1))*100)}%`,background:soldOut?"#ef4444":"linear-gradient(90deg,#ec4899,#a855f7)"}}/>
                      </div>

                      {/* Success */}
                      {success===asset.id && (
                        <div style={{fontSize:"11px",color:"#4ade80",fontWeight:700,textAlign:"center"}}>✓ Purchased successfully!</div>
                      )}

                      {/* Action button */}
                      {owner ? (
                        <button onClick={e=>{e.stopPropagation();handleDelist(asset);}} disabled={!!delisting}
                          style={{width:"100%",padding:"10px",borderRadius:"11px",fontSize:"12px",fontWeight:700,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.28)",color:"#f87171",cursor:"pointer",opacity:delisting?0.4:1,transition:"all 0.2s"}}
                          onMouseOver={e=>{e.currentTarget.style.background="rgba(239,68,68,0.16)";}}
                          onMouseOut={e=>{e.currentTarget.style.background="rgba(239,68,68,0.08)";}}>
                          {delisting===asset.id?(
                            <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>
                              <span style={{width:"11px",height:"11px",border:"1.5px solid #f87171",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>
                              Delisting...
                            </span>
                          ):"Delist"}
                        </button>
                      ) : soldOut ? (
                        <button disabled style={{width:"100%",padding:"10px",borderRadius:"11px",fontSize:"12px",fontWeight:700,opacity:0.3,cursor:"not-allowed",background:"rgba(100,100,100,0.1)",border:"1px solid rgba(100,100,100,0.2)",color:"rgba(255,255,255,0.3)"}}>Sold Out</button>
                      ) : (
                        <button className="buy-btn" onClick={e=>{e.stopPropagation();handleBuy(asset);}} disabled={!!buying}>
                          {buying===asset.id?(
                            <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px"}}>
                              <span style={{width:"13px",height:"13px",border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"white",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>
                              Confirming...
                            </span>
                          ):`Buy · ${asset.price} ${currency}`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── FULL SCREEN PREVIEW ── */}
      {previewAsset && (
        <div style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(20px)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setPreviewAsset(null)}>
          <button onClick={()=>setPreviewAsset(null)} style={{position:"absolute",top:"24px",right:"24px",width:"40px",height:"40px",borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.14)",color:"white",fontSize:"16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          <div onClick={e=>e.stopPropagation()} style={{maxWidth:"80vw",maxHeight:"85vh",borderRadius:"20px",overflow:"hidden",boxShadow:"0 0 80px rgba(168,85,247,0.3)",border:"1px solid rgba(255,255,255,0.08)",position:"relative"}}>
            <img src={previewAsset.shelbyUrl} alt={previewAsset.name} style={{display:"block",maxWidth:"80vw",maxHeight:"85vh",objectFit:"contain"}}/>
            <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"20px 24px",background:"linear-gradient(to top,rgba(7,4,26,0.95),transparent)"}}>
              <p style={{color:"white",fontWeight:700,fontSize:"14px",margin:0}}>{previewAsset.name}</p>
              <p style={{color:"rgba(255,255,255,0.35)",fontSize:"12px",margin:"4px 0 0 0"}}>{previewAsset.price} {currency}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {detailAsset && (
        <div style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(18px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",animation:"fadeIn 0.2s ease"}}
          onClick={e=>{if(e.target===e.currentTarget)setDetailAsset(null);}}>
          <div style={{width:"100%",maxWidth:"680px",background:"#0d0820",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"24px",overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,0.7),0 0 60px rgba(168,85,247,0.1)",animation:"slideUp 0.25s ease",maxHeight:"90vh",overflowY:"auto"}}>

            {/* Image header */}
            {detailAsset.fileType?.startsWith("image/") && (
              <div style={{position:"relative",aspectRatio:"16/7",overflow:"hidden",cursor:"pointer"}} onClick={()=>{setPreviewAsset(detailAsset);setDetailAsset(null);}}>
                <img src={detailAsset.shelbyUrl} alt={detailAsset.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(13,8,32,1) 0%,transparent 60%)"}}/>
                <div style={{position:"absolute",bottom:"16px",right:"16px",padding:"6px 12px",borderRadius:"8px",background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,0.1)",fontSize:"11px",fontWeight:600,color:"rgba(255,255,255,0.6)"}}>
                  Click to expand ↗
                </div>
              </div>
            )}

            <div style={{padding:"28px"}}>
              {/* Title row */}
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"20px",gap:"12px"}}>
                <div>
                  <h2 style={{fontWeight:800,fontSize:"1.3rem",color:"white",margin:0,letterSpacing:"-0.02em"}}>{detailAsset.name}</h2>
                  {detailAsset.description && (
                    <p style={{fontSize:"13px",color:"rgba(255,255,255,0.35)",marginTop:"6px",lineHeight:1.7,maxWidth:"400px"}}>{detailAsset.description}</p>
                  )}
                </div>
                <button onClick={()=>setDetailAsset(null)} style={{flexShrink:0,width:"34px",height:"34px",borderRadius:"50%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:"14px"}}>✕</button>
              </div>

              {/* Price + Supply highlight */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px",marginBottom:"24px"}}>
                {[
                  {label:"Price", value:`${detailAsset.price} ${currency}`, sub: aptPrice ? `≈ $${(detailAsset.price*aptPrice).toFixed(2)}` : "", color:"#a78bfa"},
                  {label:"Supply", value:`${detailAsset.sold??0} / ${detailAsset.supply??1}`, sub:"sold / total", color:"#f472b6"},
                  {label:"Remaining", value: isSoldOut(detailAsset)?"0":remaining(detailAsset).toString(), sub:"editions left", color: isSoldOut(detailAsset)?"#f87171":"#34d399"},
                ].map((s,i) => (
                  <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"12px",padding:"14px 16px"}}>
                    <p style={{fontSize:"10px",fontWeight:600,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 5px 0"}}>{s.label}</p>
                    <p style={{fontSize:"16px",fontWeight:800,color:s.color,margin:0,letterSpacing:"-0.01em"}}>{s.value}</p>
                    {s.sub && <p style={{fontSize:"10px",color:"rgba(255,255,255,0.22)",margin:"3px 0 0 0"}}>{s.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Details table */}
              <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:"14px",padding:"4px 16px",marginBottom:"20px"}}>
                {[
                  {label:"Seller", value: `${detailAsset.owner.slice(0,10)}...${detailAsset.owner.slice(-8)}`, copyKey:"owner", copyVal: detailAsset.owner},
                  {label:"Listed", value: detailAsset.listedAt ? new Date(detailAsset.listedAt).toLocaleString() : new Date(detailAsset.uploadedAt).toLocaleString()},
                  {label:"Likes", value: `❤️ ${likeCount(detailAsset)}`},
                  ...(detailAsset.listTxHash ? [{label:"Tx Hash", value:`${detailAsset.listTxHash.slice(0,14)}...`, copyKey:"tx", copyVal:detailAsset.listTxHash}] : []),
                ].map((row,i) => (
                  <div key={i} className="detail-row">
                    <span style={{fontSize:"12px",color:"rgba(255,255,255,0.3)",fontWeight:500}}>{row.label}</span>
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <span style={{fontSize:"12px",color:"rgba(255,255,255,0.65)",fontFamily:row.copyKey?"monospace":"inherit"}}>{row.value}</span>
                      {row.copyKey && row.copyVal && (
                        <button className="copy-pill" onClick={()=>copy(row.copyVal!,row.copyKey!)}>
                          {copied===row.copyKey ? "✓ Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Explorer link */}
              {detailAsset.listTxHash && (
                <a href={`https://explorer.aptoslabs.com/txn/${detailAsset.listTxHash}?network=testnet`}
                  target="_blank" rel="noopener noreferrer"
                  style={{display:"block",textAlign:"center",padding:"10px",borderRadius:"10px",fontSize:"12px",fontWeight:600,color:"rgba(167,139,250,0.7)",border:"1px solid rgba(167,139,250,0.15)",background:"rgba(167,139,250,0.05)",textDecoration:"none",marginBottom:"16px",transition:"all 0.2s"}}
                  onMouseOver={e=>{e.currentTarget.style.borderColor="rgba(167,139,250,0.35)";e.currentTarget.style.color="#a78bfa";}}
                  onMouseOut={e=>{e.currentTarget.style.borderColor="rgba(167,139,250,0.15)";e.currentTarget.style.color="rgba(167,139,250,0.7)";}}>
                  View on Aptos Explorer ↗
                </a>
              )}

              {/* CTA */}
              {!isOwner(detailAsset) && !isSoldOut(detailAsset) && (
                <button className="buy-btn" onClick={()=>{setDetailAsset(null);handleBuy(detailAsset);}} disabled={!!buying}>
                  {buying===detailAsset.id?(
                    <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                      <span style={{width:"14px",height:"14px",border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"white",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>
                      Confirming in Wallet...
                    </span>
                  ):`Buy Now · ${detailAsset.price} ${currency}`}
                </button>
              )}
              {isOwner(detailAsset) && (
                <button onClick={()=>{setDetailAsset(null);handleDelist(detailAsset);}} style={{width:"100%",padding:"13px",borderRadius:"12px",fontSize:"14px",fontWeight:700,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",color:"#f87171",cursor:"pointer"}}>
                  Delist from Marketplace
                </button>
              )}
              {isSoldOut(detailAsset) && (
                <div style={{textAlign:"center",padding:"13px",borderRadius:"12px",background:"rgba(100,100,100,0.08)",border:"1px solid rgba(100,100,100,0.15)",fontSize:"14px",fontWeight:700,color:"rgba(255,255,255,0.25)"}}>Sold Out</div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}