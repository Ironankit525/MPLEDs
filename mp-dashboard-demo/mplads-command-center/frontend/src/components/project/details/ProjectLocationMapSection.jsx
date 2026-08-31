import React, { useState } from 'react';
import { Card } from '../../common/Card.jsx';
import { 
  MapPin, 
  ExternalLink, 
  Navigation, 
  CheckCircle2, 
  Layers
} from 'lucide-react';

export const ProjectLocationMapSection = ({ 
  location = {}, 
  projectTitle = 'Community Health Centre Upgradation',
  sector = 'Healthcare Infrastructure' 
}) => {
  const [mapType, setMapType] = useState('roadmap'); // 'roadmap' | 'satellite'

  const lat = location.latitude ?? 22.510522;
  const lng = location.longitude ?? 80.840049;
  const mapsUrl = location.mapsUrl || `https://www.google.com/maps?q=${lat},${lng}`;

  // Google Maps embed URL with map type query (t=m for roadmap, t=k for satellite)
  const embedUrl = `https://maps.google.com/maps?q=${lat},${lng}&t=${mapType === 'satellite' ? 'k' : 'm'}&z=15&output=embed`;

  return (
    <Card className="hover:border-slate-300 transition">
      <div className="space-y-4">
        {/* 1. SECTION HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <MapPin className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-wide uppercase">
                GEOGRAPHIC LOCATION & SITE MAP
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Exact physical coordinates and live Google Maps iframe view of the sanctioned work site
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            {/* Roadmap / Satellite Switcher */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setMapType('roadmap')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  mapType === 'roadmap'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Roadmap
              </button>
              <button
                type="button"
                onClick={() => setMapType('satellite')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  mapType === 'satellite'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Satellite
              </button>
            </div>

            {/* Open Google Maps Button */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <span>Open Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* 2. METADATA ROW */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          {/* GPS Coordinates */}
          <div className="md:col-span-4 p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-sky-600 shadow-2xs shrink-0">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                EXACT GPS COORDINATES
              </span>
              <strong className="text-xs sm:text-sm font-black text-slate-900 font-mono mt-0.5 block">
                {lat.toFixed(6)}° N, {lng.toFixed(6)}° E
              </strong>
            </div>
          </div>

          {/* District & Constituency */}
          <div className="md:col-span-4 p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-rose-500 shadow-2xs shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                DISTRICT & CONSTITUENCY
              </span>
              <strong className="text-xs sm:text-sm font-black text-slate-900 mt-0.5 block truncate">
                {location.district || 'Belagavi'}, {location.state || 'Karnataka'} ({location.constituency || 'Bengaluru South'})
              </strong>
            </div>
          </div>

          {/* Geofence Status */}
          <div className="md:col-span-4 p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shadow-2xs shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                GEOFENCE STATUS
              </span>
              <strong className="text-xs sm:text-sm font-black text-slate-900 mt-0.5 block">
                GPS Geotag Verified (Accuracy: ±3m)
              </strong>
            </div>
          </div>
        </div>

        {/* 3. LIVE GOOGLE MAPS IFRAME VIEW */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-200/90 shadow-inner aspect-21/9 min-h-[380px] bg-slate-100">
          <iframe
            title="Google Maps Project Location"
            src={embedUrl}
            className="w-full h-full border-0 absolute inset-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />

          {/* Floating Location Overlay Tooltip */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none hidden sm:block">
            <div className="bg-slate-900/90 backdrop-blur-xs text-white px-3.5 py-1.5 rounded-lg shadow-xl text-[11px] font-bold border border-slate-700/80 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              <span>Google Maps Location for {sector} - {location.district} {location.village ? `(${location.village})` : ''}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
