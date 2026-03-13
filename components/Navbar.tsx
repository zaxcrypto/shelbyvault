"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

export default function Navbar() {
  const { account, connected, connect, disconnect, wallets, network, changeNetwork } = useWallet();
  const [showWallets, setShowWallets] = useState(false);

  const shortAddr = (addr: string) =>
    addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";

  const networkName = network?.name?.toLowerCase() ?? "";
  const isShelby =
    networkName.includes("shelby") ||
    (!!networkName && !["testnet", "mainnet", "devnet", "localnet"].includes(networkName));

  const handleNetworkSwitch = async (target: "aptos" | "shelby") => {
    try {
      if (target === "aptos") {
        await changeNetwork("testnet" as any);
      } else {
        await changeNetwork("shelby" as any);
      }
    } catch (err) {
      console.error("Network switch failed:", err);
    }
  };

  return (
    <nav
      className="w-full flex items-center justify-between relative z-50"
      style={{ padding: "20px 48px" }}
    >
      {/* ── Logo + Brand ── */}
      <Link href="/" className="flex items-center gap-2 group">
        <div className="relative flex items-center justify-center">
          <div
            className="relative w-11 h-11 rounded-full overflow-hidden"
            style={{
              border: "2px solid rgba(236,72,153,0.6)",
              boxShadow: "0 0 8px 2px rgba(236,72,153,0.35)",
            }}
          >
            <Image
              src="/shelby logo.jpg"
              alt="Logo"
              width={44}
              height={44}
              className="w-full h-full object-cover"
              style={{ mixBlendMode: "screen" }}
            />
          </div>
        </div>
        <span
          className="text-2xl font-black tracking-tight"
          style={{
            background: "linear-gradient(135deg, #f472b6, #c084fc, #818cf8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          ShelbyVault
        </span>
      </Link>

      {/* ── Nav Links ── */}
      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/50">
        {[
          { label: "Home", href: "/" },
          { label: "About", href: "/about" },
          { label: "FAQ", href: "/faq" },
          { label: "My Vault", href: "/vault" },
          { label: "Marketplace", href: "/marketplace" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="hover:text-white transition-colors duration-200"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* ── Right Side ── */}
      <div className="flex items-center gap-3">

        {/* Network Switch pill */}
        <div
          className="flex items-center gap-1"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: "12px",
            padding: "5px 6px",
            backdropFilter: "blur(12px)",
          }}
        >
          <button
            onClick={() => handleNetworkSwitch("aptos")}
            className="text-xs font-bold transition-all duration-200"
            style={{
              padding: "6px 16px",
              borderRadius: "8px",
              ...(
                !isShelby
                  ? {
                      background: "linear-gradient(135deg, #f472b6, #a855f7)",
                      color: "white",
                      boxShadow: "0 0 14px rgba(244,114,182,0.55)",
                    }
                  : {
                      color: "rgba(255,255,255,0.38)",
                      background: "transparent",
                    }
              ),
            }}
          >
            Aptos
          </button>
          <button
            onClick={() => handleNetworkSwitch("shelby")}
            className="text-xs font-bold transition-all duration-200"
            style={{
              padding: "6px 16px",
              borderRadius: "8px",
              ...(
                isShelby
                  ? {
                      background: "linear-gradient(135deg, #f472b6, #a855f7)",
                      color: "white",
                      boxShadow: "0 0 14px rgba(244,114,182,0.55)",
                    }
                  : {
                      color: "rgba(255,255,255,0.38)",
                      background: "transparent",
                    }
              ),
            }}
          >
            Shelby
          </button>
        </div>

        {/* Network badge pill */}
        <div
          className="hidden md:flex items-center gap-2 text-xs font-semibold"
          style={{
            background: !isShelby ? "rgba(59,130,246,0.10)" : "rgba(236,72,153,0.10)",
            border: !isShelby ? "1px solid rgba(59,130,246,0.28)" : "1px solid rgba(236,72,153,0.28)",
            borderRadius: "12px",
            padding: "8px 16px",
            backdropFilter: "blur(12px)",
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: !isShelby ? "#60a5fa" : "#f472b6" }}
          />
          <span style={{ color: !isShelby ? "#93c5fd" : "#f9a8d4" }}>
            {network?.name ?? (!isShelby ? "Aptos Testnet" : "Shelby Testnet")}
          </span>
        </div>

        {/* Wallet section */}
        {connected && account ? (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 text-xs font-mono"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: "12px",
                padding: "8px 16px",
                backdropFilter: "blur(12px)",
                color: "rgba(255,255,255,0.65)",
              }}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: "#4ade80", boxShadow: "0 0 6px #4ade80" }}
              />
              {shortAddr(account.address.toString())}
            </div>
            <button
              onClick={() => disconnect()}
              className="text-xs font-bold transition-all duration-200 hover:text-red-400"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: "12px",
                padding: "8px 18px",
                backdropFilter: "blur(12px)",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setShowWallets(!showWallets)}
              className="text-sm font-bold transition-all duration-200"
              style={{
                padding: "10px 28px",
                borderRadius: "999px",
                background: "linear-gradient(135deg, #ec4899, #a855f7, #6366f1)",
                boxShadow: "0 0 24px 6px rgba(236,72,153,0.5), 0 0 50px 10px rgba(168,85,247,0.3)",
                color: "white",
                border: "none",
                letterSpacing: "0.02em",
              }}
            >
              Connect Wallet
            </button>

            {showWallets && (
              <div
                className="absolute right-0 top-14 rounded-2xl flex flex-col gap-1 shadow-2xl"
                style={{
                  background: "rgba(18,6,42,0.97)",
                  border: "1px solid rgba(139,92,246,0.35)",
                  backdropFilter: "blur(24px)",
                  boxShadow: "0 0 20px 4px rgba(124,58,237,0.2), 0 8px 32px rgba(0,0,0,0.5)",
                  minWidth: "300px",
                  padding: "16px",
                }}
              >
                <p className="text-xs text-white/30 px-3 pb-2">Choose wallet</p>
                {wallets && wallets.length > 0 ? (
                  wallets.map((wallet) => (
                    <button
                      key={wallet.name}
                      onClick={() => { connect(wallet.name); setShowWallets(false); }}
                      className="hover:bg-white/8 transition rounded-xl text-sm text-left"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "10px 14px",
                        width: "100%",
                      }}
                    >
                      {wallet.icon && (
                        <img
                          src={wallet.icon}
                          alt={wallet.name}
                          style={{ width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0 }}
                        />
                      )}
                      <span className="font-medium text-white/80">{wallet.name}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-white/30 px-3 py-2">No wallets found. Install Petra.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}