import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { geographyService } from './geographyService';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Loader } from '../../components/common/Loader';
import { MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${geoData.constituency} Constituency Geographic Profile`}
        description={`State: ${geoData.state} | Total Blocks: ${geoData.totalBlocks} | Covered Villages: ${geoData.villagesCovered} of ${geoData.totalVillages}`}
      />

      {/* Simulated Visual Interactive GIS Map Interface */}
      <Card className="p-0 overflow-hidden border border-slate-200 shadow-xs">
        <div className="bg-slate-50 relative h-96 w-full flex flex-col items-center justify-center bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]">
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur border border-slate-200 p-3 rounded-lg text-xs space-y-1 shadow-xs">
            <span className="font-bold text-slate-800 block">GIS Boundary Data</span>
            <span className="text-slate-500 block">Center: {geoData.mapBoundary?.center?.join(', ')}</span>
            <span className="text-slate-500 block">Zoom Level: {geoData.mapBoundary?.zoom}</span>
          </div>

          <div className="text-center p-6 bg-white border border-slate-200 rounded-2xl max-w-md shadow-lg space-y-3">
            <MapPin className="w-10 h-10 text-indigo-600 mx-auto animate-bounce" />
            <h3 className="text-lg font-bold text-slate-900">{geoData.constituency} GIS Layer</h3>
            <p className="text-xs text-slate-600">
              Interactive Leaflet / Mapbox spatial rendering engine placeholder. Integrated with spatial coordinates of all ongoing & completed MPLADS projects.
            </p>
            <div className="flex justify-center gap-2 pt-1">
              <Badge variant="indigo">{geoData.villagesCovered} Active Nodes</Badge>
              <Badge variant="amber">{geoData.developmentGaps?.length || 0} Identified Gaps</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Identified Infrastructure Gaps */}
      <Card title="Identified Infrastructure & Development Gaps">
        <div className="space-y-3">
          {geoData.developmentGaps?.map((gap) => (
            <div key={gap.id} className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-lg flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <h5 className="text-sm font-bold text-slate-900">{gap.issue}</h5>
                  <span className="text-xs text-slate-500 font-medium">Block: {gap.block}</span>
                </div>
              </div>
              <Badge variant={gap.severity === 'CRITICAL' ? 'rose' : 'amber'}>
                {gap.severity}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
