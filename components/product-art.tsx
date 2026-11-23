const BALLOONS = [
  { transform: "translate(90 15) rotate(-29) scale(0.85)", fill: "url(#cn-g2)" },
  { transform: "translate(323 17) rotate(15) scale(1)", fill: "url(#cn-g1)" },
  { transform: "translate(432 96) rotate(27) scale(0.85)", fill: "url(#cn-g2)" },
  { transform: "translate(194 42) rotate(-9) scale(1.03)", fill: "url(#cn-g0)" },
  { transform: "translate(102 113) rotate(-22) scale(0.93)", fill: "url(#cn-g1)" },
  { transform: "translate(329 107) rotate(20) scale(1.08)", fill: "url(#cn-g0)" },
  { transform: "translate(211 142) rotate(-7) scale(0.97)", fill: "url(#cn-g2)" },
] as const;

export function ProductArt({ sticker, compact = false }: { sticker: string; compact?: boolean }) {
  return (
    <div className={compact ? "art art-compact" : "art"}>
      <svg
        viewBox="0 0 480 288"
        role="img"
        aria-label="בלונים בגווני לילך וכחול עם סרטים"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="cn-g0" cx="0.32" cy="0.25" r="0.85">
            <stop stopColor="#e5d8ff" />
            <stop offset="0.53" stopColor="#ae8fff" />
            <stop offset="0.92" stopColor="#6a49b2" />
            <stop offset="1" stopColor="#ae8fff" />
          </radialGradient>
          <radialGradient id="cn-g1" cx="0.32" cy="0.25" r="0.85">
            <stop stopColor="#e5e9ff" />
            <stop offset="0.53" stopColor="#8e9ff7" />
            <stop offset="0.92" stopColor="#4955bb" />
            <stop offset="1" stopColor="#8e9ff7" />
          </radialGradient>
          <radialGradient id="cn-g2" cx="0.32" cy="0.25" r="0.85">
            <stop stopColor="#fff5fd" />
            <stop offset="0.53" stopColor="#d9b9e7" />
            <stop offset="0.92" stopColor="#9b79bc" />
            <stop offset="1" stopColor="#d9b9e7" />
          </radialGradient>
        </defs>
        <rect width="480" height="288" fill="#ddd9f7" />
        {BALLOONS.map((balloon) => (
          <g key={balloon.transform} transform={balloon.transform}>
            <path
              d="M0 70q-18 30 1 60t-3 65q-16 23 1 50"
              fill="none"
              stroke="#6c6485"
              strokeWidth="1.1"
            />
            <path d="M0 67l-5 8q6 3 11 0Z" fill={balloon.fill} />
            <path
              d="M0 69C-17 69 -63 25 -63 -13C-63 -91 63 -91 63 -13C63 24 18 69 0 69Z"
              fill={balloon.fill}
            />
            <ellipse
              cx="-30"
              cy="-38"
              rx="9"
              ry="19"
              transform="rotate(38 -30 -38)"
              fill="white"
              opacity="0.48"
            />
          </g>
        ))}
      </svg>
      <span className="sticker">{sticker}</span>
    </div>
  );
}
