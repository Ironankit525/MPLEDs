import React from 'react'

/**
 * State Emblem of India (Ashoka Lion Capital) SVG Vector
 */
export default function NationalEmblem({ size = 38, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="National Emblem of India"
    >
      {/* Golden / Silver Ashoka Lion Silhouette Representation */}
      <g fill="currentColor">
        {/* Top Lions Crown / Statuary */}
        <path d="M50 8C43 8 40 14 40 18C40 22 43 25 45 27C42 29 40 33 40 38C40 44 44 48 50 48C56 44 60 44 60 38C60 33 58 29 55 27C57 25 60 22 60 18C60 14 57 8 50 8Z" opacity="0.95"/>
        {/* Left Lion Profile */}
        <path d="M36 20C32 20 28 24 28 29C28 34 31 38 35 41C32 43 30 47 31 52C32 57 37 60 42 59C40 54 40 48 41 43C39 41 38 38 38 35C38 30 40 25 36 20Z" opacity="0.9"/>
        {/* Right Lion Profile */}
        <path d="M64 20C68 20 72 24 72 29C72 34 69 38 65 41C68 43 70 47 69 52C68 57 63 60 58 59C60 54 60 48 59 43C61 41 62 38 62 35C62 30 60 25 64 20Z" opacity="0.9"/>
        {/* Abacus Platform */}
        <rect x="22" y="60" width="56" height="7" rx="2" opacity="0.95"/>
        {/* Ashoka Chakra in Center of Abacus */}
        <circle cx="50" cy="63.5" r="2.5" fill="#0B1426"/>
        <circle cx="50" cy="63.5" r="3" stroke="currentColor" strokeWidth="0.6"/>
        {/* Bull on Left, Horse on Right */}
        <circle cx="34" cy="63.5" r="1.5" opacity="0.8"/>
        <circle cx="66" cy="63.5" r="1.5" opacity="0.8"/>
        {/* Bell Lotus Base */}
        <path d="M26 69C26 69 32 78 50 78C68 78 74 69 74 69C74 72 70 82 50 82C30 82 26 72 26 69Z" opacity="0.95"/>
        {/* Plinth Base */}
        <rect x="20" y="83" width="60" height="4" rx="1.5" opacity="0.95"/>
        <rect x="16" y="88" width="68" height="4" rx="2" opacity="0.95"/>
        {/* Satyameva Jayate Banner Text Bar */}
        <rect x="24" y="93" width="52" height="2" rx="1" opacity="0.7"/>
      </g>
    </svg>
  )
}
