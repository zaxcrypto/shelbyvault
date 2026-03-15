"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Navbar from "@/components/Navbar";

// ── Token types ───────────────────────────────────────────────────────────────
const SHELBY_COIN_TYPE = "0x1::shelby_usd::ShelbyUSD";
const APT_COIN_TYPE    = "0x1::aptos_coin::AptosCoin";

interface Asset {
  id:string; name:string; owner:string; price:number; supply:number; sold:number;
  fileType:string; shelbyUrl:string; listed:boolean; uploadedAt:string; likes:string[];
  listTxHash?:string; description?:string; listedAt?:string; buyers?:string[]; uploader?:string;
  currency?:string; // ← stored currency when listed
  buyHistory?:{buyer:string;txHash:string;price:number;currency:string;boughtAt:string}[];
}
interface LiveToken { symbol:string; name:string; price:number; change24h:number; icon:string; }
type SortOption = "default"|"price_low"|"price_high"|"most_liked";

export default function MarketplacePage() {
  const { account, connected, signAndSubmitTransaction, network } = useWallet();
  const [assets,      setAssets]      = useState<Asset[]>([]);
  const [allAssets,   setAllAssets]   = useState<Asset[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [buying,      setBuying]      = useState<string|null>(null);
  const [delisting,   setDelisting]   = useState<string|null>(null);
  const [liking,      setLiking]      = useState<string|null>(null);
  const [success,     setSuccess]     = useState<string|null>(null);
  const [sort,        setSort]        = useState<SortOption>("default");
  const [previewAsset,setPreviewAsset]= useState<Asset|null>(null);
  const [detailAsset, setDetailAsset] = useState<Asset|null>(null);
  const [liveTokens,  setLiveTokens]  = useState<LiveToken[]>([]);
  const [aptPrice,    setAptPrice]    = useState<number|null>(null);
  const [aptChange,   setAptChange]   = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied,      setCopied]      = useState<string|null>(null);
  const tickerRef = useRef<HTMLDivElement>(null);

  // ── Network detection ─────────────────────────────────────────────────────
  const networkName = network?.name?.toLowerCase() ?? "";
  const isShelby    = networkName.includes("shelby") ||
    (!!networkName && !["testnet","mainnet","devnet","localnet"].includes(networkName));
  const currency    = isShelby ? "ShelbyUSD" : "$APT";
  const coinType    = isShelby ? SHELBY_COIN_TYPE : APT_COIN_TYPE;

  // ── Get coin type for a specific asset (use stored currency if available) ──
  const getCoinTypeForAsset = (asset: Asset) => {
    if (asset.currency === "ShelbyUSD") return SHELBY_COIN_TYPE;
    if (asset.currency === "$APT" || asset.currency === "APT") return APT_COIN_TYPE;
    return coinType; // fallback to current network
  };

  const getDisplayCurrency = (asset: Asset) =>
    asset.currency ?? currency;

  useEffect(()=>{
    const fetchPrices=async()=>{
      try{
        const res=await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=aptos,bitcoin,ethereum,solana,sui,dogecoin,pepe,shiba-inu&order=market_cap_desc&sparkline=false&price_change_percentage=24h",{cache:"no-store"});
        const data=await res.json();
        if(!Array.isArray(data)) return;
        const tokens:LiveToken[]=data.map((c:any)=>({symbol:c.symbol.toUpperCase(),name:c.name,price:c.current_price,change24h:c.price_change_percentage_24h??0,icon:c.image}));
        setLiveTokens(tokens);
        const apt=tokens.find(t=>t.symbol==="APT");
        if(apt){setAptPrice(apt.price);setAptChange(apt.change24h);}
      }catch{}
    };
    fetchPrices();
    const iv=setInterval(fetchPrices,20000);
    return()=>clearInterval(iv);
  },[]);

  useEffect(()=>{
    if(liveTokens.length===0) return;
    let frame:number,pos=0;
    const tick=()=>{
      pos-=0.55;
      const el=tickerRef.current;
      if(el){const half=el.scrollWidth/2;if(Math.abs(pos)>=half)pos=0;el.style.transform=`translateX(${pos}px)`;}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(frame);
  },[liveTokens]);

  useEffect(()=>{fetchAssets();},[]);

  const fetchAssets=async()=>{
    setLoading(true);
    try{
      const [lr,ar]=await Promise.all([fetch("/api/marketplace"),fetch("/api/marketplace?all=true")]);
      setAssets(await lr.json());
      setAllAssets(await ar.json());
    }catch{}
    setLoading(false);
  };

  // ── BUY — uses the coin type the asset was listed with ───────────────────
  const handleBuy=async(asset:Asset)=>{
    if(!connected||!account) return alert("Connect wallet first!");
    if(asset.owner===account.address.toString()) return alert("You own this asset!");
    if(isSoldOut(asset)) return alert("Sold out!");

    const assetCoinType = getCoinTypeForAsset(asset);
    const assetCurrency = getDisplayCurrency(asset);

    // Warn if wallet network doesn't match asset's listed currency
    if(assetCurrency==="ShelbyUSD" && !isShelby){
      return alert("⚠️ This asset is listed in ShelbyUSD.\nPlease switch your wallet to Shelbynet and try again.");
    }
    if((assetCurrency==="$APT"||assetCurrency==="APT") && isShelby){
      return alert("⚠️ This asset is listed in APT.\nPlease switch your wallet to Aptos Testnet and try again.");
    }

    setBuying(asset.id);
    try{
      const octas=Math.floor(asset.price*100_000_000);
      const tx=await signAndSubmitTransaction({
        data:{
          function:"0x1::coin::transfer",
          typeArguments:[assetCoinType], // ✅ correct coin for this asset
          functionArguments:[asset.owner, octas.toString()]
        }
      });
      await fetch("/api/buy",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          id:asset.id,
          owner:account.address.toString(),
          txHash:tx.hash,
          currency:assetCurrency, // ✅ pass currency to backend
        })
      });
      setSuccess(asset.id);
      setTimeout(()=>setSuccess(null),3000);
      await fetchAssets();
    }catch(err:any){
      alert("Purchase failed: "+(err?.message||"User rejected"));
    }
    setBuying(null);
  };

  // ── DELIST — uses current network coin ───────────────────────────────────
  const handleDelist=async(asset:Asset)=>{
    if(!connected||!account) return;
    setDelisting(asset.id);
    try{
      const tx=await signAndSubmitTransaction({
        data:{
          function:"0x1::coin::transfer",
          typeArguments:[coinType], // ✅ current network coin
          functionArguments:[account.address.toString(),"1"] // 1 octa gas fee
        }
      });
      await fetch("/api/marketplace",{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id:asset.id,owner:account.address.toString(),txHash:tx.hash})
      });
      await fetchAssets();
    }catch(err:any){
      alert("Delist failed: "+(err?.message||"User rejected"));
    }
    setDelisting(null);
  };

  // ── LIKE — uses current network coin ─────────────────────────────────────
  const handleLike=async(asset:Asset,e:React.MouseEvent)=>{
    e.stopPropagation();
    if(!account) return alert("Connect wallet first!");
    setLiking(asset.id);
    try{
      const tx=await signAndSubmitTransaction({
        data:{
          function:"0x1::coin::transfer",
          typeArguments:[coinType], // ✅ current network coin
          functionArguments:[account.address.toString(),"1"] // 1 octa gas fee
        }
      });
      const res=await fetch("/api/likes",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id:asset.id,wallet:account.address.toString(),txHash:tx.hash})
      });
      const data=await res.json();
      setAssets(prev=>prev.map(a=>a.id===asset.id?{...a,likes:data.likes}:a));
    }catch(err:any){
      alert("Like failed: "+(err?.message||"User rejected"));
    }
    setLiking(null);
  };

  const copy=(text:string,key:string)=>{navigator.clipboard.writeText(text);setCopied(key);setTimeout(()=>setCopied(null),2000);};
  const isOwner  =(a:Asset)=>connected&&account?.address.toString()===a.owner;
  const isSoldOut=(a:Asset)=>(a.sold??0)>=(a.supply??1);
  const remaining=(a:Asset)=>(a.supply??1)-(a.sold??0);
  const isLiked  =(a:Asset)=>(a.likes??[]).includes(account?.address.toString()??"");
  const likeCount=(a:Asset)=>(a.likes??[]).length;
  const fmtUSD   =(n:number)=>n>=1000?`$${(n/1000).toFixed(1)}k`:`$${n<1?n.toFixed(4):n.toFixed(2)}`;
  const fmtTime  =(d:string)=>new Date(d).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  const short    =(a:string)=>`${a.slice(0,8)}...${a.slice(-6)}`;

  const detailAssetCurrency = detailAsset ? getDisplayCurrency(detailAsset) : "";

  const filtered=[...assets]
    .filter(a=>!searchQuery||a.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a,b)=>{
      if(sort==="price_low") return a.price-b.price;
      if(sort==="price_high") return b.price-a.price;
      if(sort==="most_liked") return (b.likes?.length??0)-(a.likes?.length??0);
      return 0;
    });

  const totalVol  =allAssets.reduce((s,a)=>s+(a.price??0)*(a.sold??0),0);
  const floorPrice=assets.length?Math.min(...assets.map(a=>a.price)):0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        @keyframes spin    {to{transform:rotate(360deg)}}
        @keyframes fadeUp  {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn  {from{opacity:0}to{opacity:1}}
        @keyframes slideUp {from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse   {0%,100%{opacity:1}50%{opacity:0.4}}

        .mp-root{font-family:'Outfit',sans-serif;background:#06050f;min-height:100vh;color:#fff;overflow-x:hidden;}

        .mp-ticker{background:rgba(255,255,255,0.018);border-bottom:1px solid rgba(255,255,255,0.055);height:38px;overflow:hidden;display:flex;align-items:center;}
        .mp-ticker-label{flex-shrink:0;padding:0 14px;border-right:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:6px;height:100%;}

        .mp-stat{background:rgba(255,255,255,0.026);border:1px solid rgba(255,255,255,0.055);border-radius:14px;padding:18px 22px;display:flex;flex-direction:column;gap:4px;flex:1;min-width:120px;transition:border-color 0.2s;}
        .mp-stat:hover{border-color:rgba(108,56,255,0.3);}
        .mp-stat-val{font-size:1.3rem;font-weight:800;color:#fff;line-height:1;letter-spacing:-0.02em;}
        .mp-stat-lbl{font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.22);}

        .mp-sort{padding:7px 16px;border-radius:999px;font-size:12px;font-weight:600;font-family:'Outfit',sans-serif;border:1px solid rgba(255,255,255,0.08);background:transparent;color:rgba(255,255,255,0.35);cursor:pointer;transition:all 0.18s;white-space:nowrap;letter-spacing:0.01em;}
        .mp-sort:hover{color:rgba(255,255,255,0.7);border-color:rgba(255,255,255,0.18);}
        .mp-sort.on{background:rgba(108,56,255,0.14);border-color:rgba(108,56,255,0.45);color:rgba(180,150,255,0.95);}

        .mp-search{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:9px 14px 9px 36px;color:#fff;font-size:12px;font-family:'Outfit',sans-serif;outline:none;width:210px;transition:all 0.2s;}
        .mp-search:focus{border-color:rgba(108,56,255,0.45);background:rgba(108,56,255,0.04);}
        .mp-search::placeholder{color:rgba(255,255,255,0.2);}

        .mp-card{background:rgba(255,255,255,0.028);border:1px solid rgba(255,255,255,0.07);border-radius:18px;overflow:hidden;cursor:pointer;transition:all 0.22s cubic-bezier(0.4,0,0.2,1);animation:fadeUp 0.35s ease both;}
        .mp-card:hover{border-color:rgba(108,56,255,0.45);transform:translateY(-6px);box-shadow:0 28px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(108,56,255,0.12),0 0 40px rgba(108,56,255,0.06);}

        .mp-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;backdrop-filter:blur(8px);}

        .mp-drow{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.045);}
        .mp-drow:last-child{border-bottom:none;}

        .mp-copy{padding:3px 9px;border-radius:6px;background:rgba(108,56,255,0.1);border:1px solid rgba(108,56,255,0.25);color:rgba(180,150,255,0.9);font-size:10px;font-weight:700;cursor:pointer;transition:all 0.15s;white-space:nowrap;font-family:'Outfit',sans-serif;}
        .mp-copy:hover{background:rgba(108,56,255,0.22);}

        .mp-buy{width:100%;padding:14px;border-radius:13px;font-weight:700;font-size:14px;color:#fff;border:none;cursor:pointer;transition:all 0.2s;letter-spacing:0.01em;font-family:'Outfit',sans-serif;background:linear-gradient(135deg,#6c38ff,#a855f7,#ec4899);box-shadow:0 4px 22px rgba(108,56,255,0.35);}
        .mp-buy:hover:not(:disabled){box-shadow:0 6px 30px rgba(108,56,255,0.55);transform:translateY(-1px);}
        .mp-buy:disabled{opacity:0.35;cursor:not-allowed;transform:none;}

        .mp-overlay{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.84);backdrop-filter:blur(18px);display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn 0.18s ease;}
        .mp-modal{width:100%;max-width:700px;background:#0e0c1f;border:1px solid rgba(255,255,255,0.07);border-radius:22px;overflow:hidden;box-shadow:0 40px 80px rgba(0,0,0,0.7),0 0 60px rgba(108,56,255,0.08);animation:slideUp 0.22s ease;max-height:90vh;overflow-y:auto;}

        .spin{animation:spin 0.8s linear infinite;}
        .lbl{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.22);}

        .network-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:0.04em;}
        .network-pill.shelby{background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.35);color:rgba(196,130,252,0.95);}
        .network-pill.aptos{background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:rgba(52,211,153,0.9);}
      `}</style>

      <main className="mp-root">
        <Navbar/>

        {/* ── LIVE TICKER ── */}
        {liveTokens.length>0&&(
          <div className="mp-ticker">
            <div className="mp-ticker-label">
              <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 6px #4ade80",animation:"pulse 2s infinite"}}/>
              <span style={{fontSize:"9px",fontWeight:700,color:"rgba(255,255,255,0.3)",letterSpacing:"0.12em"}}>LIVE</span>
            </div>
            <div style={{overflow:"hidden",flex:1}}>
              <div ref={tickerRef} style={{display:"flex",willChange:"transform"}}>
                {[...liveTokens,...liveTokens].map((t,i)=>(
                  <div key={i} style={{display:"inline-flex",alignItems:"center",gap:"7px",padding:"0 18px",borderRight:"1px solid rgba(255,255,255,0.04)",flexShrink:0,height:"38px"}}>
                    <img src={t.icon} alt={t.symbol} style={{width:"15px",height:"15px",borderRadius:"50%"}}/>
                    <span style={{fontSize:"11px",fontWeight:600,color:"rgba(255,255,255,0.6)"}}>{t.symbol}</span>
                    <span style={{fontSize:"11px",color:"rgba(255,255,255,0.38)"}}>{fmtUSD(t.price)}</span>
                    <span style={{fontSize:"10px",fontWeight:700,color:t.change24h>=0?"#34d399":"#f87171"}}>{t.change24h>=0?"▲":"▼"}{Math.abs(t.change24h).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── BG ORBS ── */}
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
          <div style={{position:"absolute",top:"-80px",left:"-80px",width:"480px",height:"480px",borderRadius:"50%",background:"radial-gradient(circle,rgba(108,56,255,0.1) 0%,transparent 70%)",filter:"blur(55px)"}}/>
          <div style={{position:"absolute",bottom:"-80px",right:"-80px",width:"440px",height:"440px",borderRadius:"50%",background:"radial-gradient(circle,rgba(212,100,180,0.07) 0%,transparent 70%)",filter:"blur(60px)"}}/>
        </div>

        <div style={{position:"relative",zIndex:10,maxWidth:"1400px",margin:"0 auto",padding:"0 40px 80px"}}>

          {/* ── HEADER ── */}
          <div style={{padding:"36px 0 28px"}}>
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:"24px"}}>
              <div>
                <p style={{fontSize:"11px",fontWeight:600,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(108,56,255,0.7)",marginBottom:"8px",fontFamily:"'Outfit',sans-serif"}}>ShelbyVault</p>
                <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"2.2rem",fontWeight:800,color:"#fff",letterSpacing:"-0.02em",margin:0}}>Marketplace</h1>
                {/* ✅ Dynamic network label */}
                <div style={{display:"flex",alignItems:"center",gap:"10px",marginTop:"9px",flexWrap:"wrap"}}>
                  <span style={{fontSize:"13px",color:"rgba(255,255,255,0.28)",fontFamily:"'Outfit',sans-serif"}}>
                    Buy & sell using{" "}
                    <span style={{color:isShelby?"rgba(196,130,252,0.85)":"rgba(52,211,153,0.85)",fontWeight:600}}>
                      {isShelby?"ShelbyUSD":"$APT"}
                    </span>{" "}
                    on {isShelby?"Shelbynet":"Aptos Testnet"}
                  </span>
                  {/* Network badge */}
                  <span className={`network-pill ${isShelby?"shelby":"aptos"}`}>
                    <span style={{width:"5px",height:"5px",borderRadius:"50%",background:isShelby?"rgba(196,130,252,0.9)":"rgba(52,211,153,0.9)",display:"inline-block"}}/>
                    {isShelby?"Shelbynet":"Aptos Testnet"}
                  </span>
                  {/* APT price (only on Aptos) */}
                  {aptPrice&&!isShelby&&(
                    <div style={{display:"inline-flex",alignItems:"center",gap:"6px",padding:"3px 11px",borderRadius:"999px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
                      <span style={{fontSize:"11px",fontWeight:700,color:"rgba(255,255,255,0.9)"}}>$APT</span>
                      <span style={{fontSize:"12px",fontWeight:700,color:"#fff"}}>${aptPrice.toFixed(2)}</span>
                      <span style={{fontSize:"10px",fontWeight:700,color:aptChange>=0?"#34d399":"#f87171"}}>{aptChange>=0?"▲":"▼"}{Math.abs(aptChange).toFixed(2)}%</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
                {[
                  {label:"Total Items",  value:allAssets.length.toString()},
                  {label:"Volume",       value:totalVol.toFixed(2)+" "+currency},
                  {label:"Floor Price",  value:assets.length?floorPrice.toFixed(2)+" "+currency:"—"},
                  {label:"Total Likes",  value:allAssets.reduce((s,a)=>s+likeCount(a),0).toString()},
                ].map((s,i)=>(
                  <div key={i} className="mp-stat">
                    <span className="mp-stat-val">{s.value}</span>
                    <span className="mp-stat-lbl">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{height:"1px",background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.07) 20%,rgba(255,255,255,0.07) 80%,transparent)",marginBottom:"24px"}}/>

          {/* ── FILTERS ── */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",marginBottom:"24px",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
              {([["default","✦ Latest"],["price_low","↑ Price"],["price_high","↓ Price"],["most_liked","♥ Most Liked"]] as [SortOption,string][]).map(([v,l])=>(
                <button key={v} className={`mp-sort${sort===v?" on":""}`} onClick={()=>setSort(v)}>{l}</button>
              ))}
            </div>
            <div style={{position:"relative",display:"flex",alignItems:"center"}}>
              <svg style={{position:"absolute",left:"11px",pointerEvents:"none"}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="mp-search" placeholder="Search assets..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
              {searchQuery&&<button onClick={()=>setSearchQuery("")} style={{position:"absolute",right:"10px",background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:"14px"}}>✕</button>}
            </div>
          </div>

          {!loading&&<p style={{fontSize:"11px",color:"rgba(255,255,255,0.2)",marginBottom:"20px",fontWeight:500,fontFamily:"'Outfit',sans-serif"}}>{filtered.length} item{filtered.length!==1?"s":""}{searchQuery?` for "${searchQuery}"`:""}</p>}

          {/* ── LOADING ── */}
          {loading&&(
            <div style={{display:"flex",justifyContent:"center",padding:"120px 0"}}>
              <span className="spin" style={{width:"34px",height:"34px",border:"2px solid rgba(108,56,255,0.2)",borderTopColor:"#6c38ff",borderRadius:"50%",display:"inline-block"}}/>
            </div>
          )}

          {/* ── EMPTY ── */}
          {!loading&&filtered.length===0&&(
            <div style={{textAlign:"center",padding:"100px 0",border:"1px solid rgba(255,255,255,0.055)",borderRadius:"20px",background:"rgba(255,255,255,0.018)"}}>
              <div style={{fontSize:"42px",marginBottom:"14px"}}>🏪</div>
              <p style={{color:"rgba(255,255,255,0.4)",fontSize:"15px",fontWeight:700,marginBottom:"6px",fontFamily:"'Playfair Display',serif"}}>{searchQuery?"No results found":"No listings yet"}</p>
              <p style={{color:"rgba(255,255,255,0.2)",fontSize:"12px",fontFamily:"'Outfit',sans-serif"}}>{searchQuery?`No assets match "${searchQuery}"`:"Upload and list an asset to see it here"}</p>
            </div>
          )}

          {/* ── GRID ── */}
          {!loading&&filtered.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"16px"}}>
              {filtered.map((asset,idx)=>{
                const soldOut=isSoldOut(asset);
                const owner=isOwner(asset);
                const assetCurrency=getDisplayCurrency(asset);
                return (
                  <div key={asset.id} className="mp-card" style={{animationDelay:`${idx*0.04}s`}} onClick={()=>setDetailAsset(asset)}>
                    <div style={{position:"relative",aspectRatio:"1",background:"rgba(255,255,255,0.02)",overflow:"hidden"}}>
                      {asset.fileType?.startsWith("image/")
                        ? <img src={asset.shelbyUrl} alt={asset.name} style={{width:"100%",height:"100%",objectFit:"cover",transition:"transform 0.4s cubic-bezier(0.4,0,0.2,1)"}} onMouseOver={e=>e.currentTarget.style.transform="scale(1.07)"} onMouseOut={e=>e.currentTarget.style.transform="scale(1)"}/>
                        : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"36px"}}>🎵</div>}
                      {soldOut&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)"}}/>}
                      <div style={{position:"absolute",top:"10px",left:"10px"}}>
                        {soldOut
                          ? <div className="mp-tag" style={{background:"rgba(0,0,0,0.65)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.38)"}}>Sold Out</div>
                          : owner
                            ? <div className="mp-tag" style={{background:"rgba(108,56,255,0.2)",border:"1px solid rgba(108,56,255,0.4)",color:"rgba(180,150,255,0.9)"}}>Yours</div>
                            : <div className="mp-tag" style={{background:"rgba(16,185,129,0.14)",border:"1px solid rgba(16,185,129,0.32)",color:"#34d399"}}>● Live</div>}
                      </div>
                      <button onClick={e=>handleLike(asset,e)} disabled={liking===asset.id} style={{position:"absolute",top:"10px",right:"10px",display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",borderRadius:"999px",background:isLiked(asset)?"rgba(236,72,153,0.28)":"rgba(0,0,0,0.5)",border:isLiked(asset)?"1px solid rgba(236,72,153,0.55)":"1px solid rgba(255,255,255,0.1)",backdropFilter:"blur(8px)",cursor:"pointer",transition:"all 0.2s"}}>
                        <span style={{fontSize:"11px"}}>{isLiked(asset)?"❤️":"🤍"}</span>
                        <span style={{fontSize:"11px",fontWeight:700,color:"rgba(255,255,255,0.7)",fontFamily:"'Outfit',sans-serif"}}>{likeCount(asset)}</span>
                      </button>
                      {/* ✅ Currency badge shows asset's actual currency */}
                      {!soldOut&&<div style={{position:"absolute",bottom:"10px",right:"10px",padding:"4px 10px",borderRadius:"8px",background:"rgba(6,5,15,0.88)",backdropFilter:"blur(8px)",border:"1px solid rgba(108,56,255,0.3)",fontSize:"11px",fontWeight:700,color:"rgba(180,150,255,0.9)",fontFamily:"'Outfit',sans-serif"}}>{asset.price} {assetCurrency}</div>}
                    </div>
                    <div style={{padding:"14px 16px 16px",display:"flex",flexDirection:"column",gap:"11px"}}>
                      <div>
                        <p style={{fontWeight:600,fontSize:"13px",color:"rgba(255,255,255,0.88)",margin:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontFamily:"'Outfit',sans-serif",letterSpacing:"0.005em"}}>{asset.name}</p>
                        <p style={{fontSize:"11px",color:"rgba(255,255,255,0.22)",margin:"3px 0 0",fontFamily:"'Outfit',sans-serif"}}>{new Date(asset.uploadedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</p>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <p className="lbl" style={{marginBottom:"3px"}}>Price</p>
                          <p style={{fontSize:"15px",fontWeight:800,color:soldOut?"rgba(255,255,255,0.22)":"rgba(160,130,255,0.95)",fontFamily:"'Outfit',sans-serif",letterSpacing:"-0.01em"}}>{soldOut?"—":`${asset.price} ${assetCurrency}`}</p>
                          {aptPrice&&!soldOut&&assetCurrency!=="ShelbyUSD"&&<p style={{fontSize:"10px",color:"rgba(255,255,255,0.2)",fontFamily:"'Outfit',sans-serif"}}>≈ ${(asset.price*aptPrice).toFixed(2)}</p>}
                        </div>
                        <div style={{textAlign:"right"}}>
                          <p className="lbl" style={{marginBottom:"3px"}}>Supply</p>
                          <p style={{fontSize:"13px",fontWeight:700,color:soldOut?"#f87171":"rgba(255,255,255,0.55)",fontFamily:"'Outfit',sans-serif"}}>{soldOut?"Sold Out":`${remaining(asset)} / ${asset.supply??1}`}</p>
                        </div>
                      </div>
                      <div style={{height:"3px",borderRadius:"999px",background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:"999px",transition:"width 0.4s",width:`${Math.min(100,((asset.sold??0)/(asset.supply??1))*100)}%`,background:soldOut?"#ef4444":"linear-gradient(90deg,#6c38ff,#a855f7)"}}/>
                      </div>
                      {success===asset.id&&<p style={{fontSize:"11px",color:"#4ade80",fontWeight:700,textAlign:"center",fontFamily:"'Outfit',sans-serif"}}>✓ Purchased!</p>}
                      {owner
                        ? <button onClick={e=>{e.stopPropagation();handleDelist(asset);}} disabled={!!delisting} style={{width:"100%",padding:"10px",borderRadius:"11px",fontSize:"12px",fontWeight:600,background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.24)",color:"rgba(248,113,113,0.8)",cursor:"pointer",fontFamily:"'Outfit',sans-serif",transition:"all 0.18s"}} onMouseOver={e=>e.currentTarget.style.background="rgba(239,68,68,0.14)"} onMouseOut={e=>e.currentTarget.style.background="rgba(239,68,68,0.07)"}>
                            {delisting===asset.id?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}><span className="spin" style={{width:"11px",height:"11px",border:"1.5px solid #f87171",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block"}}/>Delisting...</span>:"Delist"}
                          </button>
                        : soldOut
                          ? <button disabled style={{width:"100%",padding:"10px",borderRadius:"11px",fontSize:"12px",fontWeight:600,opacity:0.28,cursor:"not-allowed",background:"rgba(80,80,80,0.08)",border:"1px solid rgba(80,80,80,0.2)",color:"rgba(255,255,255,0.28)",fontFamily:"'Outfit',sans-serif"}}>Sold Out</button>
                          : <button className="mp-buy" onClick={e=>{e.stopPropagation();handleBuy(asset);}} disabled={!!buying}>
                              {buying===asset.id?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px"}}><span className="spin" style={{width:"13px",height:"13px",border:"2px solid rgba(255,255,255,0.35)",borderTopColor:"white",borderRadius:"50%",display:"inline-block"}}/>Confirming...</span>:`Buy · ${asset.price} ${assetCurrency}`}
                            </button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── FULLSCREEN PREVIEW ── */}
        {previewAsset&&(
          <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.94)",backdropFilter:"blur(22px)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setPreviewAsset(null)}>
            <button onClick={()=>setPreviewAsset(null)} style={{position:"absolute",top:"22px",right:"22px",width:"38px",height:"38px",borderRadius:"50%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.6)",fontSize:"15px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            <div onClick={e=>e.stopPropagation()} style={{maxWidth:"80vw",maxHeight:"85vh",borderRadius:"18px",overflow:"hidden",boxShadow:"0 0 80px rgba(108,56,255,0.25)",border:"1px solid rgba(255,255,255,0.07)"}}>
              <img src={previewAsset.shelbyUrl} alt={previewAsset.name} style={{display:"block",maxWidth:"80vw",maxHeight:"85vh",objectFit:"contain"}}/>
            </div>
          </div>
        )}

        {/* ── DETAIL MODAL ── */}
        {detailAsset&&(
          <div className="mp-overlay" onClick={e=>{if(e.target===e.currentTarget)setDetailAsset(null);}}>
            <div className="mp-modal">
              {detailAsset.fileType?.startsWith("image/")&&(
                <div style={{position:"relative",aspectRatio:"16/7",overflow:"hidden",cursor:"pointer"}} onClick={()=>{setPreviewAsset(detailAsset);setDetailAsset(null);}}>
                  <img src={detailAsset.shelbyUrl} alt={detailAsset.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(14,12,31,1) 0%,transparent 55%)"}}/>
                  <div style={{position:"absolute",bottom:"14px",right:"14px",padding:"5px 11px",borderRadius:"7px",background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,0.1)",fontSize:"10px",fontWeight:600,color:"rgba(255,255,255,0.55)",fontFamily:"'Outfit',sans-serif"}}>Click to expand ↗</div>
                </div>
              )}
              <div style={{padding:"28px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"22px",gap:"12px"}}>
                  <div>
                    <h2 style={{fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:"1.4rem",color:"#fff",margin:0,letterSpacing:"-0.02em"}}>{detailAsset.name}</h2>
                    {detailAsset.description&&<p style={{fontSize:"13px",color:"rgba(255,255,255,0.32)",marginTop:"6px",lineHeight:1.7,maxWidth:"420px",fontFamily:"'Outfit',sans-serif"}}>{detailAsset.description}</p>}
                    {/* ✅ Currency badge in modal */}
                    <span className={`network-pill ${detailAssetCurrency==="ShelbyUSD"?"shelby":"aptos"}`} style={{marginTop:"8px",display:"inline-flex"}}>
                      {detailAssetCurrency==="ShelbyUSD"?"🟣 ShelbyUSD":"🟢 APT"}
                    </span>
                  </div>
                  <button onClick={()=>setDetailAsset(null)} style={{flexShrink:0,width:"34px",height:"34px",borderRadius:"50%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",color:"rgba(255,255,255,0.45)",cursor:"pointer",fontSize:"13px"}}>✕</button>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px",marginBottom:"22px"}}>
                  {[
                    {label:"Price",     value:`${detailAsset.price} ${detailAssetCurrency}`, sub:aptPrice&&detailAssetCurrency!=="ShelbyUSD"?`≈ $${(detailAsset.price*aptPrice).toFixed(2)}`:"", color:"rgba(160,130,255,0.95)"},
                    {label:"Supply",    value:`${detailAsset.sold??0} / ${detailAsset.supply??1}`, sub:"sold / total", color:"rgba(244,114,182,0.9)"},
                    {label:"Remaining", value:isSoldOut(detailAsset)?"0":remaining(detailAsset).toString(), sub:"editions left", color:isSoldOut(detailAsset)?"#f87171":"#34d399"},
                  ].map((s,i)=>(
                    <div key={i} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"12px",padding:"14px 16px"}}>
                      <p className="lbl" style={{marginBottom:"5px"}}>{s.label}</p>
                      <p style={{fontSize:"1.05rem",fontWeight:800,color:s.color,margin:0,fontFamily:"'Outfit',sans-serif",letterSpacing:"-0.01em"}}>{s.value}</p>
                      {s.sub&&<p style={{fontSize:"10px",color:"rgba(255,255,255,0.2)",margin:"3px 0 0",fontFamily:"'Outfit',sans-serif"}}>{s.sub}</p>}
                    </div>
                  ))}
                </div>

                <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.055)",borderRadius:"14px",padding:"4px 16px",marginBottom:"14px"}}>
                  <div className="mp-drow">
                    <span style={{fontSize:"12px",color:"rgba(255,255,255,0.28)",fontWeight:500,fontFamily:"'Outfit',sans-serif"}}>Seller</span>
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <a href={`/profile/${detailAsset.owner}`} style={{fontSize:"12px",color:"rgba(160,130,255,0.85)",fontFamily:"monospace",textDecoration:"none",letterSpacing:"0.02em"}}
                        onMouseOver={e=>e.currentTarget.style.color="rgba(196,181,253,1)"} onMouseOut={e=>e.currentTarget.style.color="rgba(160,130,255,0.85)"}>
                        {detailAsset.owner.slice(0,10)}...{detailAsset.owner.slice(-8)}
                      </a>
                      <button className="mp-copy" onClick={()=>copy(detailAsset.owner,"owner")}>{copied==="owner"?"✓ Copied":"Copy"}</button>
                    </div>
                  </div>
                  {[
                    {label:"Listed", value:detailAsset.listedAt?new Date(detailAsset.listedAt).toLocaleString():new Date(detailAsset.uploadedAt).toLocaleString()},
                    {label:"Likes",  value:`❤️ ${likeCount(detailAsset)}`},
                    ...(detailAsset.listTxHash?[{label:"Tx Hash",value:`${detailAsset.listTxHash.slice(0,14)}...`,copyKey:"tx",copyVal:detailAsset.listTxHash}]:[]),
                  ].map((row,i)=>(
                    <div key={i} className="mp-drow">
                      <span style={{fontSize:"12px",color:"rgba(255,255,255,0.28)",fontWeight:500,fontFamily:"'Outfit',sans-serif"}}>{row.label}</span>
                      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                        <span style={{fontSize:"12px",color:"rgba(255,255,255,0.6)",fontFamily:row.copyKey?"monospace":"'Outfit',sans-serif"}}>{row.value}</span>
                        {row.copyKey&&row.copyVal&&<button className="mp-copy" onClick={()=>copy(row.copyVal!,row.copyKey!)}>{copied===row.copyKey?"✓ Copied":"Copy"}</button>}
                      </div>
                    </div>
                  ))}
                </div>

                {detailAsset.buyHistory&&detailAsset.buyHistory.length>0&&(
                  <div style={{marginBottom:"14px"}}>
                    <p className="lbl" style={{marginBottom:"10px"}}>Purchase History</p>
                    <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                      {detailAsset.buyHistory.map((bh,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 13px",borderRadius:"11px",background:"rgba(255,255,255,0.022)",border:"1px solid rgba(255,255,255,0.055)"}}>
                          <div style={{display:"flex",alignItems:"center",gap:"9px"}}>
                            <a href={`/profile/${bh.buyer}`} style={{fontSize:"11px",color:"rgba(160,130,255,0.8)",fontFamily:"monospace",textDecoration:"none"}}
                              onMouseOver={e=>e.currentTarget.style.color="rgba(196,181,253,1)"} onMouseOut={e=>e.currentTarget.style.color="rgba(160,130,255,0.8)"}>
                              {short(bh.buyer)}
                            </a>
                            <span style={{fontSize:"10px",color:"rgba(255,255,255,0.2)",fontFamily:"'Outfit',sans-serif"}}>{fmtTime(bh.boughtAt)}</span>
                          </div>
                          <span style={{fontSize:"12px",fontWeight:700,color:"rgba(160,130,255,0.95)",fontFamily:"'Outfit',sans-serif"}}>{bh.price} {bh.currency}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailAsset.listTxHash&&(
                  <a href={`https://explorer.aptoslabs.com/txn/${detailAsset.listTxHash}?network=${isShelby?"shelbynet":"testnet"}`} target="_blank" rel="noopener noreferrer"
                    style={{display:"block",textAlign:"center",padding:"10px",borderRadius:"10px",fontSize:"11px",fontWeight:600,color:"rgba(160,130,255,0.6)",border:"1px solid rgba(108,56,255,0.15)",background:"rgba(108,56,255,0.04)",textDecoration:"none",marginBottom:"16px",transition:"all 0.18s",fontFamily:"'Outfit',sans-serif"}}
                    onMouseOver={e=>{e.currentTarget.style.borderColor="rgba(108,56,255,0.35)";e.currentTarget.style.color="rgba(180,150,255,0.9)";}}
                    onMouseOut={e=>{e.currentTarget.style.borderColor="rgba(108,56,255,0.15)";e.currentTarget.style.color="rgba(160,130,255,0.6)";}}>
                    View on Explorer ↗
                  </a>
                )}

                {!isOwner(detailAsset)&&!isSoldOut(detailAsset)&&(
                  <button className="mp-buy" onClick={()=>{setDetailAsset(null);handleBuy(detailAsset);}} disabled={!!buying}>
                    {buying===detailAsset.id?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}><span className="spin" style={{width:"14px",height:"14px",border:"2px solid rgba(255,255,255,0.35)",borderTopColor:"white",borderRadius:"50%",display:"inline-block"}}/>Confirming...</span>:`Buy Now · ${detailAsset.price} ${detailAssetCurrency}`}
                  </button>
                )}
                {isOwner(detailAsset)&&(
                  <button onClick={()=>{setDetailAsset(null);handleDelist(detailAsset);}} style={{width:"100%",padding:"13px",borderRadius:"12px",fontSize:"13px",fontWeight:700,background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.28)",color:"rgba(248,113,113,0.85)",cursor:"pointer",fontFamily:"'Outfit',sans-serif",transition:"all 0.18s"}} onMouseOver={e=>e.currentTarget.style.background="rgba(239,68,68,0.14)"} onMouseOut={e=>e.currentTarget.style.background="rgba(239,68,68,0.07)"}>
                    Delist from Marketplace
                  </button>
                )}
                {isSoldOut(detailAsset)&&(
                  <div style={{textAlign:"center",padding:"13px",borderRadius:"12px",background:"rgba(80,80,80,0.07)",border:"1px solid rgba(80,80,80,0.14)",fontSize:"13px",fontWeight:700,color:"rgba(255,255,255,0.22)",fontFamily:"'Outfit',sans-serif"}}>Sold Out</div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}