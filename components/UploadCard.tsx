"use client";

import { useState, useRef } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useRouter } from "next/navigation";

type Step = "idle" | "uploading" | "done" | "error";

// ─── Network / Currency helpers ───────────────────────────────────────────────
const SHELBY_COIN_TYPE = "0x1::shelby_usd::ShelbyUSD";
const APT_COIN_TYPE    = "0x1::aptos_coin::AptosCoin";

// Gas-fee recipient (just needs to be a valid address — using sender itself is fine
// for a "listing fee" simulation; replace with your treasury address if you have one)
const GAS_RECIPIENT = "0x1"; // replace with your treasury / marketplace address

/** Returns true when connected to Shelbynet (any non-standard Aptos network) */
const detectShelby = (networkName: string) =>
  networkName.includes("shelby") ||
  (!!networkName &&
    !["testnet", "mainnet", "devnet", "localnet"].includes(networkName));

export default function UploadCard() {
  const { account, connected, network, signAndSubmitTransaction } = useWallet();
  const router = useRouter();

  const [file, setFile]         = useState<File | null>(null);
  const [step, setStep]         = useState<Step>("idle");
  const [error, setError]       = useState("");
  const [assetId, setAssetId]   = useState("");
  const [showList, setShowList] = useState(false);
  const [price, setPrice]       = useState("");
  const [supply, setSupply]     = useState("");
  const [listing, setListing]   = useState(false);
  const [listed, setListed]     = useState(false);
  const [preview, setPreview]   = useState<string>("");
  const [listTx, setListTx]     = useState("");
  const [name, setName]         = useState("");
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Derived network state ──────────────────────────────────────────────────
  const networkName = network?.name?.toLowerCase() ?? "";
  const isShelby    = detectShelby(networkName);
  const currency    = isShelby ? "ShelbyUSD" : "APT";
  const coinType    = isShelby ? SHELBY_COIN_TYPE : APT_COIN_TYPE;

  // ── File select ────────────────────────────────────────────────────────────
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setStep("idle");
    setError("");
    setShowList(false);
    setListed(false);
    setAssetId("");
    setListTx("");
    setName(f?.name ?? "");
    setDescription("");
    if (f) setPreview(URL.createObjectURL(f));
  };

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file || !account) return;
    setError("");
    setStep("uploading");
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:      file.name,
          owner:     account.address.toString(),
          uploader:  account.address.toString(),
          fileType:  file.type,
          shelbyUrl: base64,
        }),
      });
      const saved = await res.json();
      setAssetId(saved.id);
      setName(saved.name ?? file.name);
      setStep("done");
    } catch (err: any) {
      setStep("error");
      setError(err?.message || "Something went wrong. Try again.");
    }
  };

  // ── List ───────────────────────────────────────────────────────────────────
  const handleList = async () => {
    if (!price || !assetId || !supply || !account) return;
    setListing(true);

    try {
      // 1. Small on-chain gas-fee confirmation using the CORRECT coin for the network
      //    Amount = 1 octa (smallest unit) — just to trigger wallet signature
      const tx = await signAndSubmitTransaction({
        data: {
          function:          "0x1::coin::transfer",
          typeArguments:     [coinType],           // ✅ ShelbyUSD on Shelbynet, APT on Testnet
          functionArguments: [
            GAS_RECIPIENT,                         // recipient address
            "1",                                   // 1 octa — tiny gas confirmation fee
          ],
        },
      });

      setListTx(tx.hash);

      // 2. Save listing to backend with full metadata
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:          assetId,
          price:       parseFloat(price),
          supply:      parseInt(supply),
          txHash:      tx.hash,
          name:        name || file?.name,
          description: description,
          currency:    currency,     // ✅ store which currency was used
          network:     networkName,  // ✅ store which network
        }),
      });

      if (!res.ok) throw new Error("Failed to save listing");

      setListed(true);
      setShowList(false);
    } catch (err: any) {
      const msg = err?.message || "User rejected";
      // If wallet is on wrong network, give a clear message
      if (msg.toLowerCase().includes("coin") || msg.toLowerCase().includes("type")) {
        alert(
          `❌ Wrong coin type for this network.\n\nMake sure your wallet is on ${isShelby ? "Shelbynet" : "Aptos Testnet"} and try again.`
        );
      } else {
        alert("Listing failed: " + msg);
      }
    }

    setListing(false);
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setFile(null);
    setStep("idle");
    setError("");
    setShowList(false);
    setListed(false);
    setPrice("");
    setSupply("");
    setAssetId("");
    setPreview("");
    setListTx("");
    setName("");
    setDescription("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const isWorking = step === "uploading";

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin-anim { animation: spin 0.8s linear infinite; }
        .shimmer-btn {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          color: white;
          background: linear-gradient(135deg, #ec4899, #a855f7, #6366f1);
          border: none;
          cursor: pointer;
          letter-spacing: 0.01em;
        }
        .shimmer-btn:hover:not(:disabled) { filter: brightness(1.1); }
        .shimmer-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .glass-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 10px 14px;
          color: white;
          font-size: 14px;
          font-family: 'Space Grotesk', sans-serif;
          outline: none;
          box-sizing: border-box;
        }
        .glass-input:focus { border-color: rgba(168,85,247,0.5); }
        .glass-input::placeholder { color: rgba(255,255,255,0.2); }
        .upload-drop {
          width: 100%;
          border-radius: 16px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 28px 20px;
          gap: 8px;
          border: 1.5px dashed rgba(236,72,153,0.3);
          background: rgba(255,255,255,0.025);
          transition: border-color 0.2s, background 0.2s;
          box-sizing: border-box;
        }
        .upload-drop:hover { border-color: rgba(236,72,153,0.6); background: rgba(236,72,153,0.04); }
        .network-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          font-family: 'Space Grotesk', sans-serif;
          letter-spacing: 0.04em;
        }
        .network-badge.shelby {
          background: rgba(168,85,247,0.15);
          border: 1px solid rgba(168,85,247,0.3);
          color: rgba(196,130,252,0.9);
        }
        .network-badge.aptos {
          background: rgba(52,211,153,0.1);
          border: 1px solid rgba(52,211,153,0.25);
          color: rgba(52,211,153,0.9);
        }
      `}</style>

      <div style={{width:"100%",padding:"32px 32px 28px",display:"flex",flexDirection:"column",alignItems:"center",gap:"18px"}}>

        {/* Header */}
        <div style={{textAlign:"center"}}>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"2rem",fontWeight:800,background:"linear-gradient(135deg,rgba(255,255,255,0.9),rgba(196,130,252,0.8))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",margin:0,letterSpacing:"-0.02em"}}>ShelbyVault</h1>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",marginTop:"6px"}}>
            {connected ? (
              <span className={`network-badge ${isShelby ? "shelby" : "aptos"}`}>
                <span style={{width:"5px",height:"5px",borderRadius:"50%",background:isShelby?"rgba(196,130,252,0.9)":"rgba(52,211,153,0.9)",display:"inline-block"}}/>
                {isShelby ? "Shelbynet · ShelbyUSD" : "Aptos Testnet · APT"}
              </span>
            ) : (
              <p style={{fontSize:"12px",color:"rgba(255,255,255,0.3)",margin:0,fontFamily:"'Space Grotesk',sans-serif"}}>Connect wallet to upload</p>
            )}
          </div>
        </div>

        {/* Not connected */}
        {!connected && (
          <div style={{width:"100%",padding:"28px 20px",textAlign:"center",border:"1.5px dashed rgba(255,255,255,0.08)",borderRadius:"16px",color:"rgba(255,255,255,0.25)",fontSize:"13px",fontFamily:"'Space Grotesk',sans-serif"}}>
            Connect your wallet to upload files
          </div>
        )}

        {/* Upload state */}
        {connected && step !== "done" && (
          <>
            <div className="upload-drop" onClick={() => !isWorking && fileRef.current?.click()}>
              {preview && file?.type.startsWith("image/") ? (
                <img src={preview} alt="preview" style={{width:"72px",height:"72px",objectFit:"cover",borderRadius:"12px",marginBottom:"4px"}}/>
              ) : preview && file?.type.startsWith("audio/") ? (
                <div style={{width:"56px",height:"56px",borderRadius:"12px",background:"rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"4px"}}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(236,72,153,0.7)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="rgba(236,72,153,0.7)" stroke="none"/></svg>
                </div>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(236,72,153,0.45)" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              )}
              <p style={{fontSize:"13px",fontWeight:600,color:"rgba(255,255,255,0.7)",margin:0,fontFamily:"'Space Grotesk',sans-serif",textAlign:"center"}}>
                {file ? file.name : "Drop file here or click to browse"}
              </p>
              <p style={{fontSize:"11px",color:"rgba(255,255,255,0.25)",margin:0,fontFamily:"'Space Grotesk',sans-serif"}}>Images · Audio · Max 50MB</p>
              <input ref={fileRef} type="file" accept="image/*,audio/*" style={{display:"none"}} onChange={onFileChange}/>
            </div>

            {isWorking && (
              <div style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color:"rgba(255,255,255,0.5)",fontFamily:"'Space Grotesk',sans-serif"}}>
                <span className="spin-anim" style={{width:"14px",height:"14px",border:"2px solid rgba(236,72,153,0.6)",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block"}}/>
                Saving to vault...
              </div>
            )}

            {step === "error" && (
              <div style={{width:"100%",padding:"10px 14px",borderRadius:"12px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",color:"#f87171",fontSize:"12px",textAlign:"center",fontFamily:"'Space Grotesk',sans-serif"}}>
                {error}
                <button onClick={handleReset} style={{display:"block",marginTop:"4px",color:"rgba(255,255,255,0.35)",fontSize:"11px",background:"none",border:"none",cursor:"pointer",fontFamily:"'Space Grotesk',sans-serif"}}>Try again</button>
              </div>
            )}

            <button onClick={handleUpload} disabled={!file||isWorking} className="shimmer-btn" style={{width:"100%",padding:"14px",borderRadius:"16px",fontSize:"14px"}}>
              {isWorking ? "Saving..." : "Upload to Vault"}
            </button>
            <p style={{fontSize:"10px",color:"rgba(255,255,255,0.15)",margin:0,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"'Space Grotesk',sans-serif"}}>Secured by Aptos · Your keys, your assets</p>
          </>
        )}

        {/* Done state */}
        {connected && step === "done" && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"stretch",gap:"10px",width:"100%"}}>

            {/* Upload success row */}
            <div style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 14px",borderRadius:"14px",background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)"}}>
              <div style={{width:"28px",height:"28px",borderRadius:"50%",background:"rgba(52,211,153,0.15)",border:"1px solid rgba(52,211,153,0.35)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:"12px",fontWeight:700,color:"#34d399",margin:0,fontFamily:"'Space Grotesk',sans-serif"}}>Upload Complete!</p>
                <p style={{fontSize:"11px",color:"rgba(255,255,255,0.35)",margin:0,fontFamily:"'Space Grotesk',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file?.name}</p>
              </div>
              {preview && file?.type.startsWith("image/") && (
                <img src={preview} alt="thumb" style={{width:"38px",height:"38px",objectFit:"cover",borderRadius:"8px",flexShrink:0}}/>
              )}
            </div>

            {/* Listed success row */}
            {listed && (
              <div style={{padding:"12px 14px",borderRadius:"14px",background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.2)"}}>
                <p style={{fontSize:"12px",fontWeight:700,color:"#c084fc",margin:"0 0 2px",fontFamily:"'Space Grotesk',sans-serif"}}>🎉 Listed on Marketplace</p>
                <p style={{fontSize:"11px",color:"rgba(255,255,255,0.35)",margin:0,fontFamily:"'Space Grotesk',sans-serif"}}>{price} {currency} × {supply === "1" ? "01" : supply.padStart(2,"0")} editions</p>
                {listTx && <p style={{fontSize:"10px",color:"rgba(255,255,255,0.2)",margin:"4px 0 0",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Tx: {listTx.slice(0,28)}...</p>}
              </div>
            )}

            {/* List form */}
            {!listed && showList && (
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>

                {/* Network indicator inside form */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:"10px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
                  <span style={{fontSize:"11px",color:"rgba(255,255,255,0.35)",fontFamily:"'Space Grotesk',sans-serif"}}>Listing currency</span>
                  <span className={`network-badge ${isShelby ? "shelby" : "aptos"}`}>
                    {currency}
                  </span>
                </div>

                {/* Name */}
                <div>
                  <label style={{fontSize:"10px",color:"rgba(255,255,255,0.35)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"0.06em",textTransform:"uppercase",display:"block",marginBottom:"5px"}}>Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="My Asset"
                    className="glass-input"
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={{fontSize:"10px",color:"rgba(255,255,255,0.35)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"0.06em",textTransform:"uppercase",display:"block",marginBottom:"5px"}}>Description <span style={{opacity:0.5}}>(optional)</span></label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe your asset..."
                    rows={2}
                    className="glass-input"
                    style={{resize:"none"}}
                  />
                </div>

                {/* Price + Supply */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                  <div>
                    <label style={{fontSize:"10px",color:"rgba(255,255,255,0.35)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"0.06em",textTransform:"uppercase",display:"block",marginBottom:"5px"}}>Price ({currency})</label>
                    <input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="1.5" className="glass-input"/>
                  </div>
                  <div>
                    <label style={{fontSize:"10px",color:"rgba(255,255,255,0.35)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"0.06em",textTransform:"uppercase",display:"block",marginBottom:"5px"}}>Supply</label>
                    <input type="number" min="1" step="1" value={supply} onChange={e=>setSupply(e.target.value)} placeholder="10" className="glass-input"/>
                  </div>
                </div>

                <button onClick={handleList} disabled={listing||!price||!supply} className="shimmer-btn" style={{width:"100%",padding:"12px",borderRadius:"14px",fontSize:"13px"}}>
                  {listing ? (
                    <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px"}}>
                      <span className="spin-anim" style={{width:"12px",height:"12px",border:"2px solid rgba(255,255,255,0.5)",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block"}}/>
                      Confirming...
                    </span>
                  ) : `List on Marketplace (${currency})`}
                </button>
                <p style={{fontSize:"10px",color:"rgba(255,255,255,0.2)",textAlign:"center",margin:0,fontFamily:"'Space Grotesk',sans-serif"}}>A small gas fee confirms listing on-chain</p>
                <button onClick={()=>setShowList(false)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.28)",fontSize:"11px",cursor:"pointer",fontFamily:"'Space Grotesk',sans-serif",padding:"2px"}}>Cancel</button>
              </div>
            )}

            {/* CTA buttons */}
            {!showList && (
              <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"2px"}}>
                {!listed && (
                  <button onClick={()=>setShowList(true)} className="shimmer-btn" style={{width:"100%",padding:"13px",borderRadius:"14px",fontSize:"13px"}}>
                    List on Marketplace ({currency})
                  </button>
                )}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                  <button onClick={handleReset}
                    style={{padding:"11px",borderRadius:"12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.6)",fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:"'Space Grotesk',sans-serif",transition:"border-color 0.2s"}}
                    onMouseOver={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.22)")}
                    onMouseOut={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.1)")}>
                    + Upload Another
                  </button>
                  <button onClick={()=>router.push("/vault")}
                    style={{padding:"11px",borderRadius:"12px",background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.25)",color:"rgba(196,130,252,0.9)",fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:"'Space Grotesk',sans-serif",transition:"border-color 0.2s"}}
                    onMouseOver={e=>(e.currentTarget.style.borderColor="rgba(168,85,247,0.5)")}
                    onMouseOut={e=>(e.currentTarget.style.borderColor="rgba(168,85,247,0.25)")}>
                    Go to Vault →
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </>
  );
}