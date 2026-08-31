import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card.jsx';
import { MapPin, ArrowUpRight, Navigation } from 'lucide-react';

export const ConstituencyMapSnapshot = ({ constituencyMap, constituencyName = 'Pune' }) => {
  const navigate = useNavigate();
  const [selectedPin, setSelectedPin] = useState(constituencyMap?.pins?.[0] || null);

  if (!constituencyMap) return null;

  const getMarkerColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-500 ring-emerald-200 text-white';
      case 'On Track':
        return 'bg-indigo-600 ring-indigo-200 text-white';
      case 'At Risk':
        return 'bg-amber-500 ring-amber-200 text-white';
      case 'Delayed':
        return 'bg-rose-500 ring-rose-200 text-white';
      default:
        return 'bg-slate-400 ring-slate-200 text-white';
    }
  };

  return (
    <Card
      title="Constituency Development Map"
      subtitle={`${constituencyMap.totalProjects} Projects Across ${constituencyMap.areasCount} Assembly Segments & Blocks`}
      action={
        <button
          onClick={() => navigate('/mp/geography')}
          className="text-xs font-bold text-black hover:text-slate-700 flex items-center gap-1 cursor-pointer"
        >
          <span>Open Full GIS Map</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Interactive Simulated Topographical GIS Map Canvas */}
        <div className="flex-1 bg-slate-100 rounded-2xl border border-slate-200 relative min-h-[300px] h-72 sm:h-auto overflow-hidden shadow-inner p-3.5 flex flex-col justify-between bg-[radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] [background-size:20px_20px]">
          {/* Top GIS telemetry tags */}
          <div className="flex items-center justify-between z-10 gap-2">
            <div className="bg-white/95 backdrop-blur-xs border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-800 shadow-xs flex items-center gap-1.5 truncate">
              <Navigation className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">{constituencyName} GIS Layer</span>
            </div>

            <div className="bg-white/95 backdrop-blur-xs border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 shadow-xs shrink-0">
              Live Assets
            </div>
          </div>

          {/* Area boundary watermarks */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-around opacity-30 font-display font-extrabold text-slate-400 text-[11px] tracking-widest uppercase">
            <span>Mulshi</span>
            <span>Kasba</span>
            <span>Haveli</span>
          </div>

          {/* Geo Markers */}
          <div className="absolute inset-0">
            {constituencyMap.pins.map((pin) => {
              const isSelected = selectedPin?.id === pin.id;
              return (
                <button
                  key={pin.id}
                  onClick={() => setSelectedPin(pin)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 group z-10 ${
                    isSelected ? 'scale-125 z-20' : 'hover:scale-110'
                  }`}
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  title={`${pin.name} (${pin.status})`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ring-4 shadow-md ${getMarkerColor(
                      pin.status
                    )}`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  {isSelected && (
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-30">
                      {pin.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Marker Legend */}
          <div className="bg-white/95 backdrop-blur-xs border border-slate-200 p-2 rounded-xl text-[10px] sm:text-[11px] font-bold text-slate-700 shadow-xs flex items-center justify-between flex-wrap gap-1.5 z-10">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Completed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-600" /> Ongoing</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> At Risk</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Delayed</span>
          </div>
        </div>

        {/* Selected Project Quick Inspector Dossier */}
        <div className="w-full sm:w-64 bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between shrink-0 overflow-hidden">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200/80">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Asset Quick Inspector
              </span>
              {selectedPin && (
                <span className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded truncate max-w-[110px]" title={selectedPin.area}>
                  {selectedPin.area}
                </span>
              )}
            </div>

            {selectedPin ? (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 leading-snug break-words">
                  {selectedPin.name}
                </h4>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Agency</span>
                    <span className="font-extrabold text-slate-900 truncate block mt-0.5">{selectedPin.agency}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Sanctioned</span>
                    <span className="font-extrabold text-slate-900 truncate block mt-0.5">{selectedPin.amount}</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Physical Progress</span>
                    <span className="font-bold text-slate-900">{selectedPin.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-white border border-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-900 rounded-full transition-all duration-300"
                      style={{ width: `${selectedPin.progress}%` }}
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Ground Status:</span>
                  <strong className="font-extrabold text-indigo-900">{selectedPin.status}</strong>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs italic">
                Click any pin on the map to inspect project telemetry.
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/mp/projects')}
            className="w-full mt-3 py-2 px-2 bg-white hover:bg-slate-100 text-black hover:text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition shadow-xs flex items-center justify-center gap-1 cursor-pointer truncate"
          >
            <span className="truncate">Inspect Project Dossier</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>
    </Card>
  );
};
