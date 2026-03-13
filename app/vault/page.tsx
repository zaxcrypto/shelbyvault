"use client";

import { useState, useEffect } from "react";
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
}

export default function VaultPage() {
  const { account, connected, network, signAndSubmitTransaction } = useWallet();
  const [assets, setAssets]               = useState<Asset[]>([]);
  const [loading, setLoading]             = useState(false);
  const [liking, setLiking]               = useState<string | null>(null);
  const [removing, setRemoving]           = useState<string | null>(null);
  const [showListModal, setShowListModal] = useState<Asset | null>(null);
  const [previewAsset, setPreviewAsset]   = useState<Asset | null>(null);
  const [listName, setListName]           = useState("");
  const [listDesc, setListDesc]           = useState("");
  const [price, setPrice]                 = useState("");
  const [supply, setSupply]               = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [filter, setFilter]               = useState<"all"|"listed"|"unlisted">("all");
  const [hoveredId, setHoveredId]         = useState<string | null>(null);

  const networkName = network?.name?.toLowerCase() ?? "";
  const isShelby = networkName.includes("shelby") ||
    (!!networkName && !["testnet","mainnet","devnet","localnet"].includes(networkName));
  const currency = isShelby ? "ShelbyUSD" : "APT";

  useEffect(() => {
    if (connected && account) fetchMyAssets();
    else setAssets([]);
  }, [connected, account]);

  const fetchMyAssets = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/marketplace?all=true");
      const data = await res.json();
      setAssets(data.filter((a: Asset) => a.owner === account?.address.toString()));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleLike = async (asset: Asset) => {
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
      setAssets((prev) => prev.map((a) => a.id === asset.id ? { ...a, likes: data.likes } : a));
    } catch (err: any) {
      alert("Failed: " + (err?.message || "User rejected"));
    }
    setLiking(null);
  };

  const handleRemove = async (asset: Asset) => {
    if (!account) return;
    if (!confirm(`Delete "${asset.name}"?`)) return;
    setRemoving(asset.id);
    try {
      await fetch("/api/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: asset.id, owner: account.address.toString() }),
      });
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (err: any) {
      alert("Remove failed: " + (err?.message || "Error"));
    }
    setRemoving(null);
  };

  const openListModal = (asset: Asset) => {
    setShowListModal(asset);
    setListName(asset.name);
    setListDesc("");
    setPrice("");
    setSupply("");
  };

  const handleListSubmit = async () => {
    if (!price || !supply || !showListModal || !account) return;
    const supplyInt = parseInt(supply);
    if (isNaN(supplyInt) || supplyInt < 1) return alert("Supply must be at least 1!");
    const priceFloat = parseFloat(price);
    if (isNaN(priceFloat) || priceFloat <= 0) return alert("Price must be greater than 0!");
    setSubmitting(true);
    try {
      const tx = await signAndSubmitTransaction({
        data: {
          function: "0x1::coin::transfer",
          typeArguments: ["0x1::aptos_coin::AptosCoin"],
          functionArguments: [account.address.toString(), "1000"],
        },
      });
      await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: showListModal.id,
          name: listName || showListModal.name,
          description: listDesc,
          price: priceFloat,
          supply: supplyInt,
          txHash: tx.hash,
        }),
      });
      setShowListModal(null);
      setListName(""); setListDesc(""); setPrice(""); setSupply("");
      await fetchMyAssets();
    } catch (err: any) {
      alert("Listing failed: " + (err?.message || "User rejected"));
    }
    setSubmitting(false);
  };

  const isLiked   = (a: Asset) => (a.likes ?? []).includes(account?.address.toString() ?? "");
  const likeCount = (a: Asset) => (a.likes ?? []).length;
  const remaining = (a: Asset) => (a.supply ?? 1) - (a.sold ?? 0);
  const isSoldOut = (a: Asset) => a.listed && remaining(a) <= 0;

  const filtered = assets.filter(a =>
    filter === "all" ? true : filter === "listed" ? a.listed : !a.listed
  );

  const totalLikes = assets.reduce((sum, a) => sum + likeCount(a), 0);

  return (
    <main style={{ background: "#07041a", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 0 0 rgba(168,85,247,0); }
          50% { box-shadow: 0 0 0 4px rgba(168,85,247,0.15); }
        }

        .vault-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.25s ease;
          animation: fadeIn 0.4s ease both;
          cursor: pointer;
        }
        .vault-card:hover {
          border-color: rgba(168,85,247,0.35);
          background: rgba(168,85,247,0.04);
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(168,85,247,0.15);
        }
        .vault-card.listed {
          border-color: rgba(236,72,153,0.2);
        }
        .vault-card.listed:hover {
          border-color: rgba(236,72,153,0.45);
          box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(236,72,153,0.2);
        }

        .filter-btn {
          padding: 7px 18px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid rgba(255,255,255,0.08);
          background: transparent;
          color: rgba(255,255,255,0.4);
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.02em;
        }
        .filter-btn:hover { color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.2); }
        .filter-btn.active {
          background: rgba(168,85,247,0.15);
          border-color: rgba(168,85,247,0.4);
          color: #c084fc;
        }

        .action-btn {
          flex: 1;
          padding: 9px 8px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.01em;
        }

        .modal-input {
          width: 100%;
          padding: 11px 14px;
          border-radius: 10px;
          font-size: 13px;
          color: white;
          outline: none;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(139,92,246,0.2);
          transition: border 0.2s;
          font-family: 'Inter', sans-serif;
        }
        .modal-input:focus { border-color: rgba(168,85,247,0.5); background: rgba(168,85,247,0.05); }
        .modal-input::placeholder { color: rgba(255,255,255,0.18); }

        .stat-box {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 18px 24px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 120px;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
      `}</style>

      {/* Background */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"-100px", left:"-100px", width:"500px", height:"500px", borderRadius:"50%", background:"radial-gradient(circle,rgba(139,92,246,0.1) 0%,transparent 70%)", filter:"blur(60px)" }} />
        <div style={{ position:"absolute", bottom:"-80px", right:"-80px", width:"450px", height:"450px", borderRadius:"50%", background:"radial-gradient(circle,rgba(236,72,153,0.08) 0%,transparent 70%)", filter:"blur(60px)" }} />
      </div>

      <div style={{ position:"relative", zIndex:10 }}>
        <Navbar />

        <div style={{ maxWidth:"1400px", margin:"0 auto", padding:"0 40px 60px" }}>

          {/* ── Page Header ── */}
          <div style={{ padding:"40px 0 32px", display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:"24px" }}>
            <div>
              <p style={{ fontSize:"11px", fontWeight:600, letterSpacing:"0.14em", textTransform:"uppercase", color:"rgba(168,85,247,0.6)", marginBottom:"8px" }}>
                My Collection
              </p>
              <h1 style={{ fontSize:"2rem", fontWeight:800, color:"white", margin:0, letterSpacing:"-0.03em" }}>
                My Vault
              </h1>
              {connected && account && (
                <p style={{ fontSize:"12px", color:"rgba(255,255,255,0.25)", marginTop:"6px", fontFamily:"monospace" }}>
                  {account.address.toString().slice(0,8)}...{account.address.toString().slice(-6)}
                </p>
              )}
            </div>

            {/* Stats row */}
            {connected && assets.length > 0 && (
              <div style={{ display:"flex", gap:"12px", flexWrap:"wrap" }}>
                {[
                  { label:"Items", value: assets.length },
                  { label:"Listed", value: assets.filter(a=>a.listed).length },
                  { label:"Total Likes", value: totalLikes },
                ].map((s,i) => (
                  <div key={i} className="stat-box">
                    <span style={{ fontSize:"20px", fontWeight:800, color:"white", lineHeight:1 }}>{s.value}</span>
                    <span style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", fontWeight:500 }}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height:"1px", background:"rgba(255,255,255,0.05)", marginBottom:"28px" }} />

          {/* ── Filter tabs ── */}
          {connected && assets.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"28px" }}>
              {(["all","listed","unlisted"] as const).map(f => (
                <button key={f} className={`filter-btn ${filter===f?"active":""}`} onClick={()=>setFilter(f)}>
                  {f === "all" ? `All (${assets.length})` : f === "listed" ? `Listed (${assets.filter(a=>a.listed).length})` : `Not Listed (${assets.filter(a=>!a.listed).length})`}
                </button>
              ))}
            </div>
          )}

          {/* ── States ── */}
          {!connected && (
            <div style={{ textAlign:"center", padding:"100px 0", border:"1px solid rgba(255,255,255,0.05)", borderRadius:"20px", background:"rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize:"40px", marginBottom:"16px" }}>🔒</div>
              <p style={{ color:"rgba(255,255,255,0.4)", fontSize:"16px", fontWeight:600, marginBottom:"8px" }}>Wallet not connected</p>
              <p style={{ color:"rgba(255,255,255,0.2)", fontSize:"13px" }}>Connect your wallet to view your vault</p>
            </div>
          )}

          {connected && loading && (
            <div style={{ display:"flex", justifyContent:"center", padding:"100px 0" }}>
              <span style={{ width:"32px", height:"32px", border:"2px solid rgba(168,85,247,0.5)", borderTopColor:"#a855f7", borderRadius:"50%", display:"inline-block", animation:"spin 0.8s linear infinite" }} />
            </div>
          )}

          {connected && !loading && assets.length === 0 && (
            <div style={{ textAlign:"center", padding:"100px 0", border:"1px solid rgba(255,255,255,0.05)", borderRadius:"20px", background:"rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize:"40px", marginBottom:"16px" }}>📭</div>
              <p style={{ color:"rgba(255,255,255,0.4)", fontSize:"16px", fontWeight:600, marginBottom:"8px" }}>No assets yet</p>
              <p style={{ color:"rgba(255,255,255,0.2)", fontSize:"13px" }}>Upload files from the home page to get started</p>
            </div>
          )}

          {/* ── Grid ── */}
          {connected && !loading && filtered.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:"16px" }}>
              {filtered.map((asset, idx) => (
                <div
                  key={asset.id}
                  className={`vault-card ${asset.listed ? "listed" : ""}`}
                  style={{ animationDelay:`${idx*0.04}s` }}
                  onMouseEnter={() => setHoveredId(asset.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Image area */}
                  <div
                    style={{ position:"relative", aspectRatio:"1/1", background:"rgba(255,255,255,0.03)", overflow:"hidden" }}
                    onClick={() => asset.fileType.startsWith("image/") && setPreviewAsset(asset)}
                  >
                    {asset.fileType.startsWith("image/") ? (
                      <img src={asset.shelbyUrl} alt={asset.name} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", transition:"transform 0.4s ease" }}
                        onMouseOver={e=>(e.currentTarget.style.transform="scale(1.06)")}
                        onMouseOut={e=>(e.currentTarget.style.transform="scale(1)")}
                      />
                    ) : (
                      <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"32px" }}>🎵</div>
                    )}

                    {/* Overlay on hover */}
                    <div style={{
                      position:"absolute", inset:0,
                      background:"linear-gradient(to top, rgba(7,4,26,0.85) 0%, transparent 50%)",
                      opacity: hoveredId === asset.id ? 1 : 0,
                      transition:"opacity 0.25s",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      {asset.fileType.startsWith("image/") && (
                        <div style={{ padding:"8px 18px", borderRadius:"999px", background:"rgba(255,255,255,0.15)", backdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,0.2)", color:"white", fontSize:"12px", fontWeight:600 }}>
                          View Full
                        </div>
                      )}
                    </div>

                    {/* Status tag */}
                    <div style={{ position:"absolute", top:"10px", left:"10px" }}>
                      {asset.listed ? (
                        isSoldOut(asset) ? (
                          <div className="tag" style={{ background:"rgba(100,100,100,0.8)", color:"rgba(255,255,255,0.6)", backdropFilter:"blur(8px)" }}>
                            Sold Out
                          </div>
                        ) : (
                          <div className="tag" style={{ background:"rgba(16,185,129,0.2)", border:"1px solid rgba(16,185,129,0.4)", color:"#34d399", backdropFilter:"blur(8px)" }}>
                            ● Listed
                          </div>
                        )
                      ) : (
                        <div className="tag" style={{ background:"rgba(0,0,0,0.5)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)", backdropFilter:"blur(8px)" }}>
                          Not Listed
                        </div>
                      )}
                    </div>

                    {/* Like button */}
                    <button
                      onClick={e => { e.stopPropagation(); handleLike(asset); }}
                      disabled={liking === asset.id}
                      style={{
                        position:"absolute", top:"10px", right:"10px",
                        display:"flex", alignItems:"center", gap:"5px",
                        padding:"5px 10px", borderRadius:"999px",
                        background: isLiked(asset) ? "rgba(236,72,153,0.3)" : "rgba(0,0,0,0.55)",
                        border: isLiked(asset) ? "1px solid rgba(236,72,153,0.6)" : "1px solid rgba(255,255,255,0.12)",
                        backdropFilter:"blur(8px)", cursor:"pointer", transition:"all 0.2s",
                      }}
                    >
                      <span style={{ fontSize:"11px" }}>{isLiked(asset) ? "❤️" : "🤍"}</span>
                      <span style={{ fontSize:"11px", fontWeight:700, color:"rgba(255,255,255,0.75)" }}>{likeCount(asset)}</span>
                    </button>

                    {/* Price tag if listed */}
                    {asset.listed && !isSoldOut(asset) && (
                      <div style={{
                        position:"absolute", bottom:"10px", right:"10px",
                        padding:"4px 10px", borderRadius:"8px",
                        background:"rgba(7,4,26,0.85)", backdropFilter:"blur(8px)",
                        border:"1px solid rgba(236,72,153,0.3)",
                        fontSize:"11px", fontWeight:700, color:"#f472b6",
                      }}>
                        {asset.price} {currency}
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div style={{ padding:"14px 16px 16px", display:"flex", flexDirection:"column", gap:"12px" }}>

                    {/* Name + date */}
                    <div>
                      <p style={{ fontWeight:700, fontSize:"13px", color:"white", margin:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", letterSpacing:"-0.01em" }}>
                        {asset.name}
                      </p>
                      <p style={{ fontSize:"11px", color:"rgba(255,255,255,0.22)", margin:"3px 0 0 0" }}>
                        {new Date(asset.uploadedAt).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}
                      </p>
                    </div>

                    {/* Supply bar if listed */}
                    {asset.listed && !isSoldOut(asset) && (
                      <div>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
                          <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.25)", fontWeight:500 }}>Supply</span>
                          <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.45)", fontWeight:600 }}>
                            {remaining(asset)} / {asset.supply ?? 1} left
                          </span>
                        </div>
                        <div style={{ height:"3px", borderRadius:"999px", background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                          <div style={{
                            height:"100%", borderRadius:"999px",
                            width:`${(remaining(asset)/(asset.supply??1))*100}%`,
                            background:"linear-gradient(90deg,#ec4899,#a855f7)",
                            transition:"width 0.4s ease",
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display:"flex", gap:"8px" }}>
                      {!asset.listed && (
                        <button
                          className="action-btn"
                          onClick={e=>{ e.stopPropagation(); openListModal(asset); }}
                          style={{ background:"linear-gradient(135deg,#ec4899,#a855f7)", color:"white", boxShadow:"0 4px 15px rgba(236,72,153,0.3)" }}
                          onMouseOver={e=>(e.currentTarget.style.boxShadow="0 4px 20px rgba(236,72,153,0.5)")}
                          onMouseOut={e=>(e.currentTarget.style.boxShadow="0 4px 15px rgba(236,72,153,0.3)")}
                        >
                          List on Market
                        </button>
                      )}

                      {asset.listed && !isSoldOut(asset) && (
                        <div className="action-btn" style={{ background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.25)", color:"#34d399", display:"flex", alignItems:"center", justifyContent:"center", gap:"4px", cursor:"default" }}>
                          <span>✓</span> Listed
                        </div>
                      )}

                      <button
                        className="action-btn"
                        onClick={e=>{ e.stopPropagation(); handleRemove(asset); }}
                        disabled={removing === asset.id}
                        style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#f87171", maxWidth: asset.listed ? "100%" : "44px", padding:"9px" }}
                        onMouseOver={e=>{ e.currentTarget.style.background="rgba(239,68,68,0.15)"; e.currentTarget.style.borderColor="rgba(239,68,68,0.4)"; }}
                        onMouseOut={e=>{ e.currentTarget.style.background="rgba(239,68,68,0.08)"; e.currentTarget.style.borderColor="rgba(239,68,68,0.25)"; }}
                      >
                        {removing === asset.id ? (
                          <span style={{ width:"12px", height:"12px", border:"1.5px solid #f87171", borderTopColor:"transparent", borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite" }} />
                        ) : "🗑"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty filtered state */}
          {connected && !loading && assets.length > 0 && filtered.length === 0 && (
            <div style={{ textAlign:"center", padding:"80px 0", color:"rgba(255,255,255,0.25)", fontSize:"14px" }}>
              No {filter} assets found
            </div>
          )}

        </div>
      </div>

      {/* ── Full Screen Preview ── */}
      {previewAsset && (
        <div
          style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.92)", backdropFilter:"blur(20px)", display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={() => setPreviewAsset(null)}
        >
          <button onClick={()=>setPreviewAsset(null)}
            style={{ position:"absolute", top:"24px", right:"24px", width:"40px", height:"40px", borderRadius:"50%", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", color:"white", fontSize:"16px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)", transition:"all 0.2s" }}
            onMouseOver={e=>(e.currentTarget.style.background="rgba(255,255,255,0.15)")}
            onMouseOut={e=>(e.currentTarget.style.background="rgba(255,255,255,0.08)")}
          >✕</button>
          <div onClick={e=>e.stopPropagation()} style={{ maxWidth:"80vw", maxHeight:"85vh", borderRadius:"20px", overflow:"hidden", boxShadow:"0 0 80px rgba(168,85,247,0.3)", border:"1px solid rgba(255,255,255,0.08)", position:"relative" }}>
            <img src={previewAsset.shelbyUrl} alt={previewAsset.name} style={{ display:"block", maxWidth:"80vw", maxHeight:"85vh", objectFit:"contain" }} />
            <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"20px 24px", background:"linear-gradient(to top, rgba(7,4,26,0.95), transparent)" }}>
              <p style={{ color:"white", fontWeight:700, fontSize:"14px", margin:0 }}>{previewAsset.name}</p>
              <p style={{ color:"rgba(255,255,255,0.35)", fontSize:"12px", margin:"4px 0 0 0" }}>{new Date(previewAsset.uploadedAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── List Modal ── */}
      {showListModal && (
        <div
          style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(12px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}
          onClick={e=>{ if(e.target===e.currentTarget) setShowListModal(null); }}
        >
          <div style={{ width:"100%", maxWidth:"440px", borderRadius:"24px", padding:"2px", background:"linear-gradient(135deg,rgba(236,72,153,0.6),rgba(168,85,247,0.4),rgba(99,102,241,0.4))", boxShadow:"0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(168,85,247,0.15)" }}>
            <div style={{ background:"#0d0820", borderRadius:"22px", padding:"32px 28px", display:"flex", flexDirection:"column", gap:"20px" }}>

              {/* Modal header */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"white", margin:0, letterSpacing:"-0.02em" }}>
                    List on Marketplace
                  </h2>
                  <p style={{ fontSize:"12px", color:"rgba(255,255,255,0.3)", margin:"4px 0 0 0" }}>Fill in the details below</p>
                </div>
                <button onClick={()=>setShowListModal(null)} style={{ width:"32px", height:"32px", borderRadius:"50%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.5)", cursor:"pointer", fontSize:"14px" }}>✕</button>
              </div>

              {/* Preview thumbnail */}
              {showListModal.fileType.startsWith("image/") && (
                <div style={{ borderRadius:"12px", overflow:"hidden", height:"100px", background:"rgba(255,255,255,0.03)" }}>
                  <img src={showListModal.shelbyUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                </div>
              )}

              {/* Fields */}
              {[
                { label:"Name", required:true, node:
                  <input className="modal-input" type="text" value={listName} onChange={e=>setListName(e.target.value)} placeholder="Asset name" />
                },
                { label:"Description", required:false, node:
                  <textarea className="modal-input" value={listDesc} onChange={e=>setListDesc(e.target.value)} placeholder="Describe your asset... (optional)" rows={2}
                    style={{ resize:"none", fontFamily:"inherit", padding:"11px 14px", borderRadius:"10px", fontSize:"13px", color:"white", outline:"none", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(139,92,246,0.2)", width:"100%" }} />
                },
              ].map((f,i) => (
                <div key={i} style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                  <label style={{ fontSize:"11px", fontWeight:600, color:"rgba(255,255,255,0.35)", letterSpacing:"0.05em", textTransform:"uppercase" }}>
                    {f.label} {f.required && <span style={{ color:"rgba(236,72,153,0.7)" }}>*</span>}
                  </label>
                  {f.node}
                </div>
              ))}

              {/* Price + Supply row */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                  <label style={{ fontSize:"11px", fontWeight:600, color:"rgba(255,255,255,0.35)", letterSpacing:"0.05em", textTransform:"uppercase" }}>
                    Price <span style={{ color:"rgba(236,72,153,0.7)" }}>*</span>
                  </label>
                  <div style={{ position:"relative" }}>
                    <input className="modal-input" type="number" min="0.01" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="0.00" style={{ paddingRight:"50px" }} />
                    <span style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", fontSize:"11px", fontWeight:700, color: isShelby?"#f472b6":"#60a5fa" }}>{currency}</span>
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                  <label style={{ fontSize:"11px", fontWeight:600, color:"rgba(255,255,255,0.35)", letterSpacing:"0.05em", textTransform:"uppercase" }}>
                    Supply <span style={{ color:"rgba(236,72,153,0.7)" }}>*</span>
                  </label>
                  <input className="modal-input" type="number" min="1" step="1" value={supply}
                    onChange={e=>setSupply(e.target.value.replace(/\D/g,""))} placeholder="e.g. 10" />
                </div>
              </div>

              <p style={{ fontSize:"11px", color:"rgba(255,255,255,0.18)", textAlign:"center", margin:0 }}>
                A small gas fee confirms listing on-chain
              </p>

              <button
                onClick={handleListSubmit}
                disabled={submitting||!price||!supply||!listName}
                style={{
                  width:"100%", padding:"13px", borderRadius:"12px",
                  fontWeight:700, fontSize:"14px", color:"white", border:"none",
                  cursor: submitting||!price||!supply||!listName ? "not-allowed" : "pointer",
                  opacity: submitting||!price||!supply||!listName ? 0.4 : 1,
                  background:"linear-gradient(135deg,#ec4899,#a855f7)",
                  boxShadow:"0 4px 20px rgba(236,72,153,0.35)",
                  transition:"all 0.2s", letterSpacing:"0.01em",
                }}
                onMouseOver={e=>{ if(!submitting&&price&&supply&&listName) e.currentTarget.style.boxShadow="0 4px 30px rgba(236,72,153,0.55)"; }}
                onMouseOut={e=>{ e.currentTarget.style.boxShadow="0 4px 20px rgba(236,72,153,0.35)"; }}
              >
                {submitting ? (
                  <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                    <span style={{ width:"13px", height:"13px", border:"2px solid rgba(255,255,255,0.4)", borderTopColor:"white", borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite" }} />
                    Confirming...
                  </span>
                ) : "Confirm & List →"}
              </button>

              <button onClick={()=>setShowListModal(null)}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:"12px", color:"rgba(255,255,255,0.25)", textAlign:"center" }}
                onMouseOver={e=>(e.currentTarget.style.color="rgba(255,255,255,0.55)")}
                onMouseOut={e=>(e.currentTarget.style.color="rgba(255,255,255,0.25)")}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}