/** Animated cartoon Batman from the V4 hero. Gradient ids are page-unique. */
export function BatmanCharacter() {
  return (
    <span className="ij-astronaut ij-bat-hero" role="img" aria-label="شخصية باتمان كرتونية متحركة">
      <svg viewBox="0 0 240 270" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="batCape" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#243c5d" />
            <stop offset="1" stopColor="#0c192b" />
          </linearGradient>
          <linearGradient id="batSuit" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#526b83" />
            <stop offset="1" stopColor="#26384b" />
          </linearGradient>
          <linearGradient id="batFace" x1="0" x2=".9" y2="1">
            <stop stopColor="#ffddad" />
            <stop offset="1" stopColor="#e6ac78" />
          </linearGradient>
        </defs>
        <ellipse cx="120" cy="251" rx="72" ry="12" fill="#56799a" opacity=".17" />
        <path
          d="M76 154 Q32 174 20 241 Q70 227 92 249 L148 249 Q179 225 220 241 Q207 174 163 154Z"
          fill="url(#batCape)"
        />
        <path
          d="M65 247 Q66 171 99 157 L141 157 Q174 171 175 247Z"
          fill="url(#batSuit)"
          stroke="#1c3044"
          strokeWidth="3"
        />
        <path
          d="M71 181 Q58 195 54 220 L69 231 L94 198Z M169 181 Q181 194 187 220 L171 231 L145 198Z"
          fill="#364c65"
        />
        <path d="M103 156 L120 174 138 156" fill="#dce5ec" />
        <path
          d="M73 68 L76 11 105 38 Q120 33 135 38 L164 11 168 70 Q183 87 178 123 Q174 166 120 178 Q66 166 62 123 Q58 87 73 68Z"
          fill="#182537"
          stroke="#102035"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="M73 68 L77 30 101 52 Q120 43 139 52 L163 30 165 71" fill="#2d4057" />
        <path
          d="M78 116 Q85 109 103 116 L111 125 92 128 Q82 125 78 116Z M162 116 Q155 109 137 116 L129 125 148 128 Q158 125 162 116Z"
          fill="#f5fafb"
        />
        <path d="M92 137 Q119 144 148 137 L145 155 Q120 176 95 155Z" fill="url(#batFace)" />
        <path
          d="M107 153 Q120 161 133 153"
          fill="none"
          stroke="#9d664c"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M92 87 Q120 78 148 87" stroke="#415771" strokeWidth="4" strokeLinecap="round" fill="none" />
        <ellipse cx="120" cy="200" rx="37" ry="19" fill="#f5c64b" stroke="#d6a330" strokeWidth="3" />
        <path
          d="M91 200 L102 194 108 198 114 190 120 195 126 190 132 198 139 194 149 200 138 203 131 211 120 205 109 211 102 203Z"
          fill="#172b42"
        />
        <rect x="80" y="231" width="80" height="12" rx="5" fill="#d7a934" />
        <rect x="110" y="229" width="20" height="15" rx="3" fill="#ffdf74" />
        <circle cx="87" cy="237" r="2" fill="#ffdf74" />
        <circle cx="153" cy="237" r="2" fill="#ffdf74" />
      </svg>
    </span>
  );
}
