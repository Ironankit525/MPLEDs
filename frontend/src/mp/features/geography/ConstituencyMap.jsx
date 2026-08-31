import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../hooks/useAuth';
import { geographyService } from './geographyService';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Loader } from '../../components/common/Loader';
import { MapPin, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';

// Fix Leaflet default icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createStatusIcon = (status) => {
  const colors = {
    COMPLETED: '#10b981',
    ONGOING:   '#3b82f6',
    DELAYED:   '#ef4444',
    PLANNED:   '#f59e0b',
  };
  const color = colors[status] || '#6b7280';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42">
    <path d="M16 0C9.37 0 4 5.37 4 12c0 9 12 30 12 30S28 21 28 12C28 5.37 22.63 0 16 0z"
      fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="16" cy="12" r="5" fill="#fff"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [32, 42], iconAnchor: [16, 42], popupAnchor: [0, -44] });
};

const STATUS_META = {
  COMPLETED: { label: 'Completed', color: 'text-emerald-600', Icon: CheckCircle2 },
  ONGOING:   { label: 'Ongoing',   color: 'text-blue-600',    Icon: Clock },
  DELAYED:   { label: 'Delayed',   color: 'text-red-600',     Icon: XCircle },
  PLANNED:   { label: 'Planned',   color: 'text-amber-600',   Icon: Clock },
};

const formatCr = (amount) => {
  if (!amount) return '₹0';
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  return `₹${(amount / 100000).toFixed(1)} L`;
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
        {Object.entries(STATUS_META).map(([key, { label, color, Icon }]) => (
          <div key={key} className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <Icon className={`w-4 h-4 ${color}`} />
            <span>{label}</span>
            <span className="text-slate-400">({statusCounts[key] || 0})</span>
          </div>
        ))}
      </div>

      {/* Interactive Leaflet Map */}
      <Card className="p-0 overflow-hidden border border-slate-200 shadow-sm">
        <div style={{ height: '480px', width: '100%' }}>
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            scrollWheelZoom={true}
          >
            <ZoomControl position="bottomright" />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Constituency boundary */}
            <Circle
              center={center}
              radius={20000}
              pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.06, weight: 2, dashArray: '6 4' }}
            />
            {/* Project markers */}
            {projects.map((proj) => {
              const { latitude, longitude } = proj.location;
              if (!latitude || !longitude) return null;
              const meta = STATUS_META[proj.status] || STATUS_META.PLANNED;
              const Icon = meta.Icon;
              return (
                <Marker key={proj.id} position={[latitude, longitude]} icon={createStatusIcon(proj.status)}>
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px', color: '#0f172a' }}>{proj.name}</p>
                      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                        📍 {proj.location.village}, {proj.location.district}
                      </p>
                      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>🏗️ {proj.sector}</p>
                      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>💰 {formatCr(proj.sanctionedAmount)}</p>
                      <p style={{ fontSize: '12px', color: '#64748b' }}>📊 {proj.completionPercentage}% complete</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </Card>

      {/* Project List */}
      <Card title={`Projects in ${geoData.constituency} Lok Sabha (${projects.length})`}>
        <div className="space-y-3">
          {projects.map((proj) => {
            const meta = STATUS_META[proj.status] || STATUS_META.PLANNED;
            const Icon = meta.Icon;
            return (
              <div key={proj.id} className="p-4 border border-slate-200 rounded-xl flex items-start justify-between gap-4 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <MapPin className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h5 className="text-sm font-bold text-slate-900 line-clamp-1">{proj.name}</h5>
                    <p className="text-xs text-slate-500 mt-0.5">{proj.location.village}, {proj.location.district} · {proj.sector}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${proj.completionPercentage}%`,
                            backgroundColor: proj.status === 'COMPLETED' ? '#10b981' : proj.status === 'DELAYED' ? '#ef4444' : '#3b82f6'
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-600 shrink-0">{proj.completionPercentage}%</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`flex items-center gap-1 text-xs font-bold justify-end ${meta.color}`}>
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

      {/* Infrastructure Gaps */}
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
