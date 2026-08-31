import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { geographyService } from './geographyService';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Loader } from '../../components/common/Loader';
import { MapPin, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';

const STATUS_META = {
  COMPLETED: { label: 'Completed', colorClass: 'text-emerald-600', barColor: '#10b981', Icon: CheckCircle2 },
  ONGOING:   { label: 'Ongoing',   colorClass: 'text-blue-600',    barColor: '#3b82f6', Icon: Clock },
  DELAYED:   { label: 'Delayed',   colorClass: 'text-red-600',     barColor: '#ef4444', Icon: XCircle },
  PLANNED:   { label: 'Planned',   colorClass: 'text-amber-600',   barColor: '#f59e0b', Icon: Clock },
};

const PIN_COLORS = { COMPLETED: '#10b981', ONGOING: '#3b82f6', DELAYED: '#ef4444', PLANNED: '#f59e0b' };

const formatCr = (amount) => {
  if (!amount) return '₹0';
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  return `₹${(amount / 100000).toFixed(1)} L`;
};

// Standalone map renderer using raw Leaflet (no react-leaflet wrapper issues)
const LeafletMap = ({ center, zoom, projects, constituencyName }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [geoBoundary, setGeoBoundary] = useState(null);

  // Fetch GeoJSON once
  useEffect(() => {
    if (!constituencyName) return;
    fetch('/LGD_Parliament_Constituencies.geojson')
      .then(res => res.json())
      .then(data => {
        const targetName = constituencyName.toLowerCase().trim();
        const feature = data.features.find(f => {
          const pc = String(f.properties?.pc_name || '').toLowerCase().trim();
          return pc === targetName || pc.includes(targetName) || targetName.includes(pc);
        });
        if (feature) {
          setGeoBoundary(feature);
        }
      })
      .catch(err => console.error("Failed to load Lok Sabha boundary:", err));
  }, [constituencyName]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return; // already initialised

    // Dynamically import leaflet to avoid SSR / icon issues
    import('leaflet').then((L) => {
      import('leaflet/dist/leaflet.css');

      // Fix default icon
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current, { zoomControl: false }).setView(center, zoom);
      mapInstanceRef.current = map;

      // REMOVED tileLayer to only show the solid 2D shape of the Lok Sabha

      L.control.zoom({ position: 'bottomright' }).addTo(map);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // map init run once

  // Render markers and GeoJSON boundary whenever they change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import('leaflet').then((L) => {
      const map = mapInstanceRef.current;
      
      // Clear old layers
      map.eachLayer((layer) => {
        map.removeLayer(layer);
      });

      // Draw Lok Sabha boundary
      let bounds = null;
      if (geoBoundary) {
        const geoLayer = L.geoJSON(geoBoundary, {
          style: {
            color: '#4f46e5',     // Indigo border
            fillColor: '#e0e7ff', // Solid light indigo fill
            fillOpacity: 1.0,     // 100% solid
            weight: 2,
            dashArray: '4 4'
          }
        }).addTo(map);
        bounds = geoLayer.getBounds();
      } else {
        // Fallback subtle circle if GeoJSON not found yet
        L.circle(center, {
          radius: 20000,
          color: '#6366f1',
          fillColor: '#6366f1',
          fillOpacity: 0.05,
          weight: 2,
          dashArray: '6 4',
        }).addTo(map);
      }

      // Project pins
      const markerBounds = L.latLngBounds();
      let hasPins = false;

      projects.forEach((proj) => {
        const { latitude, longitude } = proj.location || {};
        if (!latitude || !longitude) return;

        hasPins = true;
        markerBounds.extend([latitude, longitude]);

        const pinColor = PIN_COLORS[proj.status] || '#6b7280';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42">
          <path d="M16 0C9.37 0 4 5.37 4 12c0 9 12 30 12 30S28 21 28 12C28 5.37 22.63 0 16 0z"
            fill="${pinColor}" stroke="#fff" stroke-width="1.5"/>
          <circle cx="16" cy="12" r="5" fill="#fff"/>
        </svg>`;

        const icon = L.divIcon({ html: svg, className: '', iconSize: [32, 42], iconAnchor: [16, 42], popupAnchor: [0, -46] });

        const popupHtml = `
          <div style="min-width:200px;font-family:inherit">
            <p style="font-weight:700;font-size:14px;margin:0 0 6px;color:#0f172a;line-height:1.3">${proj.name}</p>
            <p style="font-size:12px;color:#64748b;margin:3px 0">📍 ${proj.location.village}, ${proj.location.district}</p>
            <p style="font-size:12px;color:#64748b;margin:3px 0">🏗️ ${proj.sector}</p>
            <p style="font-size:12px;color:#64748b;margin:3px 0">💰 ${formatCr(proj.sanctionedAmount)}</p>
            <p style="font-size:12px;color:#64748b;margin:3px 0">📊 ${proj.completionPercentage}% complete</p>
            <p style="font-size:12px;font-weight:700;margin:6px 0 0;color:${pinColor}">${proj.status}</p>
          </div>`;

        L.marker([latitude, longitude], { icon })
          .addTo(map)
          .bindPopup(popupHtml);
      });

      // Auto-fit bounds (prioritize geo boundary, fallback to pins)
      if (bounds && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 12 });
      } else if (hasPins && markerBounds.isValid()) {
        map.fitBounds(markerBounds, { padding: [40, 40], maxZoom: 12 });
      } else {
        map.setView(center, zoom);
      }
    });
  }, [geoBoundary, projects, center, zoom]); 

  return <div ref={mapRef} style={{ height: '480px', width: '100%', backgroundColor: '#ffffff' }} className="rounded-b-xl" />;
};

export const ConstituencyMap = () => {
  const { currentMP } = useAuth();
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGeo = async () => {
      if (!currentMP?.id) return;
      setLoading(true);
      try {
        const data = await geographyService.getConstituencyData(currentMP.id);
        setGeoData(data);
      } catch (err) {
        console.error('Geography fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGeo();
  }, [currentMP?.id]);

  if (loading) return <Loader label="Loading Constituency GIS Mapping..." />;
  if (!geoData) return null;

  const center = geoData.mapBoundary?.center || [20.5937, 78.9629];
  const zoom   = geoData.mapBoundary?.zoom   || 10;
  const projects = geoData.projects || [];

  const statusCounts = projects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${geoData.constituency} Lok Sabha — Constituency Map`}
        description={`State: ${geoData.state} · ${projects.length} MPLADS Projects · ${geoData.villagesCovered} of ${geoData.totalVillages} villages covered`}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-5 px-1">
        {Object.entries(STATUS_META).map(([key, { label, colorClass, Icon }]) => (
          <div key={key} className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <Icon className={`w-4 h-4 ${colorClass}`} />
            <span>{label}</span>
            <span className="text-slate-400">({statusCounts[key] || 0})</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <Card className="p-0 overflow-hidden border border-slate-200 shadow-sm">
        <LeafletMap center={center} zoom={zoom} projects={projects} constituencyName={geoData.constituency} />
      </Card>

      {/* Project list */}
      <Card title={`Projects in ${geoData.constituency} Lok Sabha (${projects.length})`}>
        <div className="space-y-3">
          {projects.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No projects found for this constituency.</p>
          )}
          {projects.map((proj) => {
            const meta = STATUS_META[proj.status] || STATUS_META.PLANNED;
            const Icon = meta.Icon;
            return (
              <div key={proj.id} className="p-4 border border-slate-200 rounded-xl flex items-start justify-between gap-4 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <MapPin className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h5 className="text-sm font-bold text-slate-900 truncate">{proj.name}</h5>
                    <p className="text-xs text-slate-500 mt-0.5">{proj.location.village}, {proj.location.district} · {proj.sector}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${proj.completionPercentage}%`, backgroundColor: meta.barColor }} />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-600 shrink-0">{proj.completionPercentage}%</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`flex items-center gap-1 text-xs font-bold justify-end ${meta.colorClass}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {meta.label}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{formatCr(proj.sanctionedAmount)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Infrastructure gaps */}
      {geoData.developmentGaps?.length > 0 && (
        <Card title="Identified Infrastructure & Development Gaps">
          <div className="space-y-3">
            {geoData.developmentGaps.map((gap) => (
              <div key={gap.id} className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-lg flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">{gap.issue}</h5>
                    <span className="text-xs text-slate-500 font-medium">Block: {gap.block}</span>
                  </div>
                </div>
                <Badge variant={gap.severity === 'CRITICAL' ? 'rose' : 'amber'}>{gap.severity}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
