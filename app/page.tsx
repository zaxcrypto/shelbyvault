"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import UploadCard from "@/components/UploadCard";

interface LiveToken { symbol:string; price:number; change24h:number; icon:string; }
interface MarketAsset { id:string; name:string; price:number; sold:number; supply:number; likes:string[]; uploadedAt:string; }

export default function Home() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const cometRef   = useRef<HTMLCanvasElement>(null);
  const cardRef    = useRef<HTMLDivElement>(null);
  const tickerRef  = useRef<HTMLDivElement>(null);

  const [aptPrice, setAptPrice]   = useState<number|null>(null);
  const [aptChange, setAptChange] = useState(0);
  const [tokens, setTokens]       = useState<LiveToken[]>([]);
  const [marketStats, setMarketStats] = useState({ items:0, volume:"0", floor:"—", listed:0 });
  const [recentActivity, setRecentActivity] = useState<{name:string;price:number;type:string;time:string}[]>([]);

  // ── Live prices ──
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const r = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=aptos,bitcoin,ethereum,solana,sui,dogecoin&order=market_cap_desc&sparkline=false&price_change_percentage=24h",{cache:"no-store"});
        const d = await r.json();
        if(!Array.isArray(d)) return;
        const t:LiveToken[] = d.map((c:any)=>({symbol:c.symbol.toUpperCase(),price:c.current_price,change24h:c.price_change_percentage_24h??0,icon:c.image}));
        setTokens(t);
        const apt = t.find(x=>x.symbol==="APT");
        if(apt){setAptPrice(apt.price);setAptChange(apt.change24h);}
      } catch{}
    };
    fetch_();
    const iv = setInterval(fetch_,20000);
    return ()=>clearInterval(iv);
  },[]);

  // ── Market stats ──
  useEffect(()=>{
    const fetch_ = async()=>{
      try{
        const r = await fetch("/api/marketplace?all=true");
        const d:MarketAsset[] = await r.json();
        const listed = d.filter((a:any)=>a.listed);
        const vol = listed.reduce((s:number,a:MarketAsset)=>s+a.price*(a.sold??0),0);
        const floor = listed.length ? Math.min(...listed.map((a:MarketAsset)=>a.price)) : 0;
        setMarketStats({items:d.length,volume:vol.toFixed(1),floor:listed.length?floor.toFixed(2)+" APT":"—",listed:listed.length});
        // recent = last 4 listed sorted by date
        const recent = [...listed].sort((a,b)=>new Date(b.uploadedAt).getTime()-new Date(a.uploadedAt).getTime()).slice(0,4)
          .map(a=>({name:a.name,price:a.price,type:"Listed",time:new Date(a.uploadedAt).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}));
        setRecentActivity(recent);
      }catch{}
    };
    fetch_();
    const iv = setInterval(fetch_,30000);
    return ()=>clearInterval(iv);
  },[]);

  // ── Ticker scroll ──
  useEffect(()=>{
    if(tokens.length===0) return;
    let frame:number, pos=0;
    const tick=()=>{
      pos-=0.5;
      const el=tickerRef.current;
      if(el){const h=el.scrollWidth/2;if(Math.abs(pos)>=h)pos=0;el.style.transform=`translateX(${pos}px)`;}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(frame);
  },[tokens]);

  // ── Aurora canvas ──
  useEffect(()=>{
    const canvas=canvasRef.current!;const ctx=canvas.getContext("2d")!;let animId:number;
    type P={x:number;y:number;vx:number;vy:number;r:number;alpha:number;color:string};
    const particles:P[]=[];
    const resize=()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;};
    resize();window.addEventListener("resize",resize);
    const COLORS=["rgba(168,85,247,","rgba(236,72,153,","rgba(99,102,241,","rgba(244,114,182,"];
    for(let i=0;i<50;i++) particles.push({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,vx:(Math.random()-0.5)*0.28,vy:(Math.random()-0.5)*0.28,r:Math.random()*1.6+0.3,alpha:Math.random()*0.4+0.12,color:COLORS[Math.floor(Math.random()*COLORS.length)]});
    let t=0;
    const draw=()=>{
      const W=canvas.width,H=canvas.height;t+=0.004;ctx.clearRect(0,0,W,H);
      [{x:W*0.12+Math.sin(t*0.7)*90,y:H*0.22+Math.cos(t*0.5)*60,r:350,c:"rgba(139,92,246,"},{x:W*0.85+Math.cos(t*0.6)*70,y:H*0.60+Math.sin(t*0.8)*50,r:300,c:"rgba(236,72,153,"},{x:W*0.5+Math.sin(t*0.4)*100,y:H*0.80+Math.cos(t*0.6)*40,r:260,c:"rgba(99,102,241,"},{x:W*0.75+Math.cos(t*0.9)*60,y:H*0.15+Math.sin(t*0.7)*55,r:220,c:"rgba(168,85,247,"}].forEach(b=>{
        const g=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r);g.addColorStop(0,b.c+"0.14)");g.addColorStop(0.5,b.c+"0.07)");g.addColorStop(1,b.c+"0)");ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
      });
      particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.color+p.alpha+")";ctx.fill();});
      for(let i=0;i<particles.length;i++)for(let j=i+1;j<particles.length;j++){const dx=particles[i].x-particles[j].x,dy=particles[i].y-particles[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<110){ctx.beginPath();ctx.moveTo(particles[i].x,particles[i].y);ctx.lineTo(particles[j].x,particles[j].y);ctx.strokeStyle=`rgba(168,85,247,${0.05*(1-d/110)})`;ctx.lineWidth=0.35;ctx.stroke();}}
      const vg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.7);vg.addColorStop(0,"rgba(5,2,14,0)");vg.addColorStop(0.55,"rgba(5,2,14,0.25)");vg.addColorStop(1,"rgba(5,2,14,0.9)");ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
      animId=requestAnimationFrame(draw);
    };
    draw();return()=>{cancelAnimationFrame(animId);window.removeEventListener("resize",resize);};
  },[]);

  // ── Comet ──
  useEffect(()=>{
    const canvas=cometRef.current!;const ctx=canvas.getContext("2d")!;let animId:number,progress=0;
    const resize=()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;};
    resize();window.addEventListener("resize",resize);
    const draw=()=>{
      canvas.width=window.innerWidth;canvas.height=window.innerHeight;ctx.clearRect(0,0,canvas.width,canvas.height);
      const card=cardRef.current;if(!card){animId=requestAnimationFrame(draw);return;}
      const rect=card.getBoundingClientRect();const bx=rect.left,by=rect.top,bw=rect.width,bh=rect.height,br=26;
      if(bw<10||bh<10){animId=requestAnimationFrame(draw);return;}
      const perim=2*(bw+bh);const trailLen=perim*0.72;progress=(progress+perim/260)%perim;
      const STEPS=220;const pts:{x:number;y:number}[]=[];
      for(let s=0;s<=STEPS;s++){const t=(progress-(s/STEPS)*trailLen+perim*4)%perim;const pos=getPerimPoint(t,bx,by,bw,bh,br);if(pos)pts.push(pos);}
      if(pts.length<2){animId=requestAnimationFrame(draw);return;}
      for(let i=0;i<pts.length-1;i++){
        const frac=1-i/(pts.length-1),p1=pts[i],p2=pts[i+1];
        const xn=Math.max(0,Math.min(1,(p1.x-bx)/bw));
        const rC=Math.round(236-(236-124)*xn),gC=Math.round(72-(72-58)*xn),bC=Math.round(153+(237-153)*xn);
        if(frac>0.85){ctx.shadowColor=`rgba(${rC},${gC},${bC},${((frac-0.85)/0.15)*0.9})`;ctx.shadowBlur=((frac-0.85)/0.15)*24;}else{ctx.shadowBlur=0;}
        ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.strokeStyle=`rgba(${rC},${gC},${bC},${frac*frac*0.95})`;ctx.lineWidth=0.5+frac*frac*4;ctx.lineCap="round";ctx.stroke();
      }
      const h=pts[0],hx=Math.max(0,Math.min(1,(h.x-bx)/bw));
      const hr=Math.round(236-(236-124)*hx),hg=Math.round(72-(72-58)*hx),hb=Math.round(153+(237-153)*hx);
      ctx.shadowColor=`rgba(${hr},${hg},${hb},1)`;ctx.shadowBlur=28;ctx.beginPath();ctx.arc(h.x,h.y,3.2,0,Math.PI*2);ctx.fillStyle=`rgba(${hr},${hg},${hb},1)`;ctx.fill();ctx.shadowBlur=0;
      animId=requestAnimationFrame(draw);
    };
    draw();return()=>{cancelAnimationFrame(animId);window.removeEventListener("resize",resize);};
  },[]);

  // ── Click bubbles ──
  useEffect(()=>{
    const h=(e:MouseEvent)=>{
      const t=e.target as HTMLElement;
      if(t.closest("nav")||t.closest(".upload-card-wrapper")||t.closest("footer")||t.closest("button")||t.closest("input"))return;
      const b=document.createElement("div");const sz=55+Math.random()*35;
      b.style.cssText=`position:fixed;left:${e.clientX-sz/2}px;top:${e.clientY-sz/2}px;width:${sz}px;height:${sz}px;border-radius:50%;pointer-events:none;z-index:9999;background:radial-gradient(circle at 35% 35%,rgba(255,255,255,0.15) 0%,rgba(236,72,153,0.10) 40%,transparent 70%);border:1.5px solid rgba(236,72,153,0.65);box-shadow:0 0 10px 3px rgba(236,72,153,0.55),0 0 28px 6px rgba(168,85,247,0.3);animation:bubble-life 5s ease-out forwards;`;
      const img=document.createElement("img");img.src="/shelby-bg.png";img.style.cssText="width:62%;height:62%;object-fit:contain;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);mix-blend-mode:screen;opacity:0.88;";
      b.appendChild(img);document.body.appendChild(b);setTimeout(()=>b.remove(),5100);
    };
    window.addEventListener("click",h);return()=>window.removeEventListener("click",h);
  },[]);

  const fmtUSD=(n:number)=>n>=1000?`$${(n/1000).toFixed(1)}k`:`$${n<1?n.toFixed(4):n.toFixed(2)}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;}
        @keyframes bubble-life{0%{transform:scale(0.15) translateY(0);opacity:0;}12%{transform:scale(1.08) translateY(-6px);opacity:1;}25%{transform:scale(1) translateY(-15px);opacity:1;}65%{transform:scale(1.04) translateY(-75px);opacity:0.9;}82%{transform:scale(1.3) translateY(-105px);opacity:0.5;}94%{transform:scale(2.1) translateY(-125px);opacity:0;}100%{transform:scale(2.4) translateY(-130px);opacity:0;}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
        @keyframes shimmerText{0%{background-position:0% 50%;}50%{background-position:100% 50%;}100%{background-position:0% 50%;}}
        @keyframes floatOrb{0%,100%{transform:translate(0,0);}33%{transform:translate(18px,-22px);}66%{transform:translate(-14px,12px);}}
        @keyframes borderPulse{0%,100%{opacity:0.5;}50%{opacity:1;}}
        @keyframes badgePing{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.6);opacity:0;}}
        @keyframes countUp{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}

        .hero-title{font-family:'Syne',sans-serif;font-weight:800;font-size:2.55rem;line-height:1.08;letter-spacing:-0.03em;background:linear-gradient(135deg,#fff 0%,#f9a8d4 25%,#c084fc 55%,#818cf8 80%,#fff 100%);background-size:300% 300%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmerText 6s ease infinite,fadeUp 0.8s ease both;}
        .anim-1{animation:fadeUp 0.7s 0.05s ease both;}
        .anim-2{animation:fadeUp 0.7s 0.15s ease both;}
        .anim-3{animation:fadeUp 0.7s 0.25s ease both;}
        .anim-4{animation:fadeUp 0.7s 0.35s ease both;}
        .anim-5{animation:fadeUp 0.7s 0.45s ease both;}

        .live-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80;position:relative;flex-shrink:0;}
        .live-dot::after{content:'';position:absolute;inset:-3px;border-radius:50%;background:#4ade80;opacity:0.4;animation:badgePing 2s ease infinite;}

        .stat-pill{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:999px;padding:5px 13px;font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.03em;backdrop-filter:blur(8px);}
        .stat-pill strong{color:rgba(255,255,255,0.75);font-weight:600;}

        .live-stat{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:3px;flex:1;min-width:0;transition:border-color 0.2s;}
        .live-stat:hover{border-color:rgba(168,85,247,0.25);}

        .activity-item{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);}
        .activity-item:last-child{border-bottom:none;}

        .feature-card{transition:all 0.3s;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:18px 16px;background:rgba(255,255,255,0.02);}
        .feature-card:hover{background:rgba(168,85,247,0.06);border-color:rgba(168,85,247,0.24);transform:translateY(-2px);box-shadow:0 12px 40px rgba(139,92,246,0.1);}

        .shine-line{height:1px;background:linear-gradient(90deg,transparent,rgba(168,85,247,0.25),rgba(236,72,153,0.25),transparent);}

        .orb-a{animation:floatOrb 12s ease-in-out infinite;}
        .orb-b{animation:floatOrb 16s ease-in-out infinite 3s reverse;}
        .orb-c{animation:floatOrb 20s ease-in-out infinite 7s;}
      `}</style>

      <main style={{background:"#050211",minHeight:"100vh",fontFamily:"'Space Grotesk',sans-serif",overflowX:"hidden",position:"relative"}}>

        {/* Canvas layers */}
        <canvas ref={canvasRef} style={{position:"fixed",inset:0,zIndex:0,width:"100%",height:"100%",pointerEvents:"none"}}/>
        <canvas ref={cometRef}  style={{position:"fixed",inset:0,zIndex:4,width:"100%",height:"100%",pointerEvents:"none"}}/>

        {/* Ambient orbs */}
        <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
          <div className="orb-a" style={{position:"absolute",top:"-60px",left:"-40px",width:"380px",height:"380px",borderRadius:"50%",background:"radial-gradient(circle,rgba(139,92,246,0.14) 0%,transparent 70%)",filter:"blur(40px)"}}/>
          <div className="orb-b" style={{position:"absolute",bottom:"-80px",right:"-60px",width:"460px",height:"460px",borderRadius:"50%",background:"radial-gradient(circle,rgba(236,72,153,0.11) 0%,transparent 70%)",filter:"blur(50px)"}}/>
          <div className="orb-c" style={{position:"absolute",top:"35%",left:"58%",width:"280px",height:"280px",borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,0.09) 0%,transparent 70%)",filter:"blur(38px)"}}/>
        </div>

        {/* ── LIVE TICKER ── */}
        {tokens.length > 0 && (
          <div style={{position:"relative",zIndex:10,background:"rgba(255,255,255,0.018)",borderBottom:"1px solid rgba(255,255,255,0.05)",height:"36px",overflow:"hidden",display:"flex",alignItems:"center"}}>
            <div style={{flexShrink:0,padding:"0 14px",borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:"5px",height:"100%"}}>
              <span style={{width:"5px",height:"5px",borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 5px #4ade80",animation:"pulse 2s infinite"}}/>
              <span style={{fontSize:"9px",fontWeight:700,color:"rgba(255,255,255,0.3)",letterSpacing:"0.12em",whiteSpace:"nowrap"}}>LIVE</span>
            </div>
            <div style={{overflow:"hidden",flex:1}}>
              <div ref={tickerRef} style={{display:"flex",willChange:"transform"}}>
                {[...tokens,...tokens].map((t,i)=>(
                  <div key={i} style={{display:"inline-flex",alignItems:"center",gap:"6px",padding:"0 18px",borderRight:"1px solid rgba(255,255,255,0.04)",flexShrink:0,height:"36px"}}>
                    <img src={t.icon} alt={t.symbol} style={{width:"14px",height:"14px",borderRadius:"50%"}}/>
                    <span style={{fontSize:"11px",fontWeight:600,color:"rgba(255,255,255,0.6)"}}>{t.symbol}</span>
                    <span style={{fontSize:"11px",color:"rgba(255,255,255,0.4)"}}>{fmtUSD(t.price)}</span>
                    <span style={{fontSize:"10px",fontWeight:700,color:t.change24h>=0?"#34d399":"#f87171"}}>{t.change24h>=0?"▲":"▼"}{Math.abs(t.change24h).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{position:"relative",zIndex:5}}>
          <Navbar/>

          {/* ── HERO SECTION ── */}
          <div className="upload-card-wrapper" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"56px",width:"100%",padding:"0 80px",height:"calc(100vh - 72px - 36px)"}}>

            {/* LEFT */}
            <div style={{flex:"1 1 0",minWidth:0,display:"flex",flexDirection:"column",justifyContent:"space-between",height:"86%"}}>

              {/* Top */}
              <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
                <div className="anim-1" style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <div className="live-dot"/>
                  <span style={{fontSize:"11px",fontWeight:600,letterSpacing:"0.13em",textTransform:"uppercase",color:"rgba(255,255,255,0.35)"}}>Live on Aptos Testnet</span>
                  {aptPrice && (
                    <div style={{display:"flex",alignItems:"center",gap:"5px",marginLeft:"8px",padding:"2px 9px",borderRadius:"999px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
                      <span style={{fontSize:"10px",fontWeight:700,color:"white"}}>APT ${aptPrice.toFixed(2)}</span>
                      <span style={{fontSize:"10px",fontWeight:700,color:aptChange>=0?"#34d399":"#f87171"}}>{aptChange>=0?"▲":"▼"}{Math.abs(aptChange).toFixed(2)}%</span>
                    </div>
                  )}
                </div>

                <h1 className="hero-title">The Future of<br/>Digital Ownership</h1>

                <p className="anim-2" style={{color:"rgba(255,255,255,0.35)",fontSize:"13px",lineHeight:"1.85",margin:0}}>
                  Upload, protect, and monetize your digital assets on-chain.<br/>
                  Powered by Aptos. Built for creators who demand true ownership.
                </p>

                <div className="anim-3" style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                  {[["∞","Storage"],["0.001s","Finality"],["~$0","Gas"],["🔒","Non-custodial"]].map(([s,r],i)=>(
                    <div key={i} className="stat-pill"><strong>{s}</strong> {r}</div>
                  ))}
                </div>
              </div>

              {/* Middle: live market stats */}
              <div className="anim-4" style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                <p style={{fontSize:"10px",fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.2)",margin:0}}>ShelbyVault Market</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"}}>
                  {[
                    {label:"Assets",  value:marketStats.items.toString(),   color:"#c084fc"},
                    {label:"Listed",  value:marketStats.listed.toString(),   color:"#f472b6"},
                    {label:"Volume",  value:marketStats.volume+" APT",       color:"#34d399"},
                    {label:"Floor",   value:marketStats.floor,              color:"#60a5fa"},
                  ].map((s,i)=>(
                    <div key={i} className="live-stat">
                      <span style={{fontSize:"15px",fontWeight:800,color:s.color,lineHeight:1,animation:"countUp 0.5s ease both"}}>{s.value}</span>
                      <span style={{fontSize:"10px",color:"rgba(255,255,255,0.25)",fontWeight:500}}>{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* Recent activity */}
                {recentActivity.length > 0 && (
                  <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"12px",padding:"10px 14px",marginTop:"2px"}}>
                    <p style={{fontSize:"9px",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.2)",margin:"0 0 6px 0"}}>Recent Activity</p>
                    {recentActivity.map((a,i)=>(
                      <div key={i} className="activity-item">
                        <div style={{display:"flex",alignItems:"center",gap:"7px",minWidth:0}}>
                          <div style={{width:"6px",height:"6px",borderRadius:"50%",background:"#a855f7",flexShrink:0}}/>
                          <span style={{fontSize:"11px",color:"rgba(255,255,255,0.55)",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
                          <span style={{fontSize:"11px",fontWeight:700,color:"#f472b6"}}>{a.price} APT</span>
                          <span style={{fontSize:"10px",color:"rgba(255,255,255,0.2)"}}>{a.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom: feature bullets — 2 column compact */}
              <div className="anim-5" style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                <div style={{height:"1px",background:"linear-gradient(90deg,transparent,rgba(168,85,247,0.2),rgba(236,72,153,0.2),transparent)"}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                  {[
                    {icon:"🔐",label:"Encrypted upload",sub:"End-to-end secured"},
                    {icon:"⛓️",label:"On-chain proof",sub:"Wallet-signed"},
                    {icon:"💸",label:"Instant listing",sub:"Get paid in $APT"},
                    {icon:"🌐",label:"Decentralized",sub:"You own the keys"},
                  ].map((item,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",borderRadius:"10px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)"}}>
                      <span style={{fontSize:"15px",flexShrink:0}}>{item.icon}</span>
                      <div>
                        <p style={{fontSize:"11px",fontWeight:600,color:"rgba(255,255,255,0.65)",margin:0,lineHeight:1.3}}>{item.label}</p>
                        <p style={{fontSize:"10px",color:"rgba(255,255,255,0.25)",margin:0,lineHeight:1.3}}>{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: Upload card */}
            <div style={{flex:"1",display:"flex",justifyContent:"center",alignItems:"center",minWidth:0}}>
              <div ref={cardRef} style={{display:"inline-block",width:"100%",maxWidth:"460px"}}>
                <div style={{borderRadius:"28px",padding:"1.5px",background:"linear-gradient(135deg,rgba(139,92,246,0.45),rgba(236,72,153,0.3),rgba(99,102,241,0.45))",boxShadow:"0 0 40px rgba(139,92,246,0.1)"}}>
                  <div style={{borderRadius:"27px",background:"rgba(7,3,18,0.92)",backdropFilter:"blur(28px)"}}>
                    <UploadCard/>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── WHY SECTION ── */}
          <div className="shine-line" style={{margin:"0 80px"}}/>
          <div style={{width:"100%",padding:"32px 80px 28px"}}>
            <p style={{textAlign:"center",fontSize:"10px",letterSpacing:"0.15em",textTransform:"uppercase",color:"rgba(255,255,255,0.15)",marginBottom:"20px",fontWeight:600}}>Why ShelbyVault</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px"}}>
              {[
                {icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,bg:"rgba(139,92,246,0.1)",bc:"rgba(139,92,246,0.18)",title:"Secure Storage",body:"Files encrypted and anchored on-chain. Immutable."},
                {icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,bg:"rgba(236,72,153,0.1)",bc:"rgba(236,72,153,0.18)",title:"Prove Ownership",body:"Every upload wallet-signed. Cryptographic proof."},
                {icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,bg:"rgba(99,102,241,0.1)",bc:"rgba(99,102,241,0.18)",title:"Earn & Sell",body:"List instantly. Buyers pay in $APT. Zero middlemen."},
              ].map((f,i)=>(
                <div key={i} className="feature-card">
                  <div style={{width:"36px",height:"36px",borderRadius:"10px",background:f.bg,border:`1px solid ${f.bc}`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"12px"}}>{f.icon}</div>
                  <p style={{fontWeight:700,fontSize:"12px",color:"white",margin:"0 0 5px 0"}}>{f.title}</p>
                  <p style={{fontSize:"11px",color:"rgba(255,255,255,0.3)",lineHeight:"1.65",margin:0}}>{f.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="shine-line" style={{margin:"0 80px"}}/>

          <footer style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 80px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
              <span style={{fontSize:"11px",color:"rgba(255,255,255,0.12)"}}>© 2025</span>
              <span style={{fontSize:"11px",fontWeight:700,color:"rgba(168,85,247,0.4)"}}>ShelbyVault</span>
            </div>
            <div style={{display:"flex",gap:"20px"}}>
              {["Privacy Policy","Terms of Service","Contact Us"].map((l,i)=>(
                <a key={i} href={`/${l.toLowerCase().replace(/ /g,"-")}`} style={{fontSize:"11px",color:"rgba(255,255,255,0.16)",textDecoration:"none",transition:"color 0.2s"}}
                  onMouseOver={e=>(e.currentTarget.style.color="rgba(255,255,255,0.5)")}
                  onMouseOut={e=>(e.currentTarget.style.color="rgba(255,255,255,0.16)")}>{l}</a>
              ))}
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}

function getPerimPoint(t:number,x:number,y:number,w:number,h:number,r:number):{x:number;y:number}{
  const topEdge=w-2*r,rightEdge=h-2*r,bottomEdge=w-2*r,leftEdge=h-2*r,arcLen=(Math.PI/2)*r;
  const segs=[topEdge,arcLen,rightEdge,arcLen,bottomEdge,arcLen,leftEdge,arcLen];
  const total=segs.reduce((a,b)=>a+b,0);
  let rem=((t%total)+total)%total;
  for(let i=0;i<segs.length;i++){
    if(rem<=segs[i]){const f=rem/segs[i];switch(i){
      case 0:return{x:x+r+f*topEdge,y:y};
      case 1:{const a=-Math.PI/2+f*Math.PI/2;return{x:x+w-r+Math.cos(a)*r,y:y+r+Math.sin(a)*r};}
      case 2:return{x:x+w,y:y+r+f*rightEdge};
      case 3:{const a=f*Math.PI/2;return{x:x+w-r+Math.cos(a)*r,y:y+h-r+Math.sin(a)*r};}
      case 4:return{x:x+w-r-f*bottomEdge,y:y+h};
      case 5:{const a=Math.PI/2+f*Math.PI/2;return{x:x+r+Math.cos(a)*r,y:y+h-r+Math.sin(a)*r};}
      case 6:return{x:x,y:y+h-r-f*leftEdge};
      case 7:{const a=Math.PI+f*Math.PI/2;return{x:x+r+Math.cos(a)*r,y:y+r+Math.sin(a)*r};}
    }}
    rem-=segs[i];
  }
  return{x:x+r,y};
}