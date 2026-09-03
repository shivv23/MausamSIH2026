import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Path,
  Circle,
  Polygon,
  Rect,
  Text as SvgText,
  G,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import type { Homepage, Lang, Severity } from '../engine';
import { CITIES, DEMO_USERS, L, SEVERITY_COLOR } from '../engine';
import { t } from '../i18n';
import { colors } from '../theme';
import type { DisasterAlertWithPolygon, MapLayerType } from '../types';

interface Props {
  hp: Homepage;
  lang: Lang;
  activeAlert: DisasterAlertWithPolygon | null;
  onSelectCity?: (cityKey: string) => void;
  onOpenAdmin?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_WIDTH = SCREEN_WIDTH - 32;
const MAP_HEIGHT = 380;

// Coordinate projection helper: converts Indian lat/lon to SVG canvas coordinates
// Lat: ~8 to ~35, Lon: ~68 to ~90
function project(lat: number, lon: number, focusCity = 'pune', zoom = 1): { x: number; y: number } {
  const cityAnchors: Record<string, { lat: number; lon: number; scale: number }> = {
    pune: { lat: 18.5204, lon: 73.8567, scale: zoom > 1 ? 140 : 18 },
    mumbai: { lat: 19.076, lon: 72.8777, scale: zoom > 1 ? 140 : 18 },
    delhi: { lat: 28.6139, lon: 77.209, scale: zoom > 1 ? 140 : 18 },
    chennai: { lat: 13.0827, lon: 80.2707, scale: zoom > 1 ? 140 : 18 },
    chandigarh: { lat: 30.7333, lon: 76.7794, scale: zoom > 1 ? 140 : 18 },
    kochi: { lat: 9.9312, lon: 76.2673, scale: zoom > 1 ? 140 : 18 },
    kolkata: { lat: 22.5726, lon: 88.3639, scale: zoom > 1 ? 140 : 18 },
    bengaluru: { lat: 12.9716, lon: 77.5946, scale: zoom > 1 ? 140 : 18 },
  };

  const center = cityAnchors[focusCity] || cityAnchors.pune;
  const cx = MAP_WIDTH / 2;
  const cy = MAP_HEIGHT / 2;

  // Regional projection
  const scale = center.scale * zoom;
  const x = cx + (lon - center.lon) * scale;
  const y = cy - (lat - center.lat) * scale;

  return { x, y };
}

// Radar animation frames (-60m to +30m nowcast)
const RADAR_TIMELINE = [
  { label: '-60m', timeOffset: -60, shiftX: -18, shiftY: 10, intensity: 0.7 },
  { label: '-45m', timeOffset: -45, shiftX: -12, shiftY: 8, intensity: 0.8 },
  { label: '-30m', timeOffset: -30, shiftX: -6, shiftY: 5, intensity: 0.9 },
  { label: '-15m', timeOffset: -15, shiftX: -2, shiftY: 2, intensity: 0.95 },
  { label: 'NOW', timeOffset: 0, shiftX: 0, shiftY: 0, intensity: 1.0 },
  { label: '+30m Nowcast', timeOffset: 30, shiftX: 12, shiftY: -6, intensity: 0.85 },
];

export default function MapScreen({ hp, lang, activeAlert, onSelectCity, onOpenAdmin }: Props) {
  const [activeLayers, setActiveLayers] = useState<Record<MapLayerType, boolean>>({
    radar: true,
    warnings: true,
    aqi: false,
    satellite: false,
    wind: false,
  });
  const [selectedCity, setSelectedCity] = useState(hp.city.key || 'pune');
  const [zoom, setZoom] = useState(1);
  const [radarFrame, setRadarFrame] = useState(4); // Default to 'NOW'
  const [isPlaying, setIsPlaying] = useState(false);
  const [inspectedEntity, setInspectedEntity] = useState<'geofence' | 'city' | 'user' | null>(null);

  // Radar playback ticker
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isPlaying) {
      timer = setInterval(() => {
        setRadarFrame((prev) => (prev + 1) % RADAR_TIMELINE.length);
      }, 1200);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying]);

  const toggleLayer = (layer: MapLayerType) => {
    setActiveLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const currentFrame = RADAR_TIMELINE[radarFrame];
  const activeSeverity: Severity = activeAlert?.severity || (hp.scenario.warning?.severity as Severity) || 'orange';

  // Base geofence coordinates fallback if no custom alert
  const geofenceCenter = activeAlert?.center || { lat: 18.5204, lon: 73.8567 };
  const p1 = project(geofenceCenter.lat + 0.35, geofenceCenter.lon - 0.4, selectedCity, zoom);
  const p2 = project(geofenceCenter.lat + 0.45, geofenceCenter.lon + 0.35, selectedCity, zoom);
  const p3 = project(geofenceCenter.lat - 0.25, geofenceCenter.lon + 0.45, selectedCity, zoom);
  const p4 = project(geofenceCenter.lat - 0.35, geofenceCenter.lon - 0.3, selectedCity, zoom);
  const geofencePoints = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t(lang, 'map_title')}</Text>
            <Text style={styles.sub}>{t(lang, 'map_sub')}</Text>
          </View>
          {onOpenAdmin ? (
            <TouchableOpacity style={styles.adminBadge} onPress={onOpenAdmin}>
              <Text style={styles.adminBadgeText}>🛠️ {t(lang, 'admin_dashboard')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Layer Selection Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerBar}>
          <LayerChip
            active={activeLayers.radar}
            label={t(lang, 'layer_radar')}
            icon="🛰️"
            onPress={() => toggleLayer('radar')}
          />
          <LayerChip
            active={activeLayers.warnings}
            label={t(lang, 'layer_warnings')}
            icon="🚨"
            onPress={() => toggleLayer('warnings')}
          />
          <LayerChip
            active={activeLayers.aqi}
            label={t(lang, 'layer_aqi')}
            icon="🫁"
            onPress={() => toggleLayer('aqi')}
          />
          <LayerChip
            active={activeLayers.satellite}
            label={t(lang, 'layer_satellite')}
            icon="☁️"
            onPress={() => toggleLayer('satellite')}
          />
          <LayerChip
            active={activeLayers.wind}
            label={t(lang, 'layer_wind')}
            icon="💨"
            onPress={() => toggleLayer('wind')}
          />
        </ScrollView>

        {/* City Focus Picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityBar}>
          {CITIES.map((c) => {
            const active = selectedCity === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.cityChip, active && styles.cityChipActive]}
                onPress={() => {
                  setSelectedCity(c.key);
                  onSelectCity?.(c.key);
                }}
              >
                <Text style={[styles.cityChipText, active && styles.cityChipTextActive]}>
                  {L(lang, c.name, c.nameHi)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Map Canvas Card */}
        <View style={styles.mapCard}>
          <View style={styles.mapTopOverlay}>
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>
                IMD GIS {currentFrame.label === 'NOW' ? 'LIVE' : currentFrame.label} · {selectedCity.toUpperCase()}
              </Text>
            </View>
            <View style={styles.zoomRow}>
              <TouchableOpacity
                style={styles.zoomBtn}
                onPress={() => setZoom((z) => Math.min(2.5, z + 0.4))}
              >
                <Text style={styles.zoomText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.zoomBtn}
                onPress={() => setZoom((z) => Math.max(0.8, z - 0.4))}
              >
                <Text style={styles.zoomText}>−</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SVG Map Visualizer */}
          <Svg width={MAP_WIDTH} height={MAP_HEIGHT} style={styles.svgCanvas}>
            <Defs>
              <LinearGradient id="landGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1E293B" />
                <Stop offset="1" stopColor="#0F172A" />
              </LinearGradient>
              <RadialGradient id="radarStorm" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor="#DC2626" stopOpacity="0.85" />
                <Stop offset="40%" stopColor="#EA580C" stopOpacity="0.75" />
                <Stop offset="75%" stopColor="#FACC15" stopOpacity="0.6" />
                <Stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="aqiGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor="#7F1D1D" stopOpacity="0.8" />
                <Stop offset="50%" stopColor="#B91C1C" stopOpacity="0.5" />
                <Stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
              </RadialGradient>
              <LinearGradient id="warnFill" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={SEVERITY_COLOR[activeSeverity]} stopOpacity="0.35" />
                <Stop offset="1" stopColor={SEVERITY_COLOR[activeSeverity]} stopOpacity="0.1" />
              </LinearGradient>
            </Defs>

            {/* Background Base Terrain */}
            <Rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#landGrad)" />

            {/* Stylized Coastal / State Grid lines */}
            <Path
              d={`M 20 60 Q ${MAP_WIDTH / 2} 40 ${MAP_WIDTH - 20} 80 T ${MAP_WIDTH - 30} 320 Q ${MAP_WIDTH / 2} 360 40 300 Z`}
              fill="#1E293B"
              stroke="#334155"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Layer 3: AQI Heatmap Layer */}
            {activeLayers.aqi && (
              <G>
                {CITIES.map((c) => {
                  const pt = project(c.sunrise === '06:48' ? 28.6 : 18.5, c.coastal ? 72.8 : 77.2, selectedCity, zoom);
                  return (
                    <Circle
                      key={c.key}
                      cx={pt.x}
                      cy={pt.y}
                      r={zoom * 55}
                      fill="url(#aqiGlow)"
                    />
                  );
                })}
              </G>
            )}

            {/* Layer 1: Doppler Radar Reflectivity Cells */}
            {activeLayers.radar && (
              <G>
                {/* Primary Storm cell */}
                <Circle
                  cx={MAP_WIDTH / 2 + currentFrame.shiftX * zoom}
                  cy={MAP_HEIGHT / 2 + currentFrame.shiftY * zoom}
                  r={zoom * 68}
                  fill="url(#radarStorm)"
                />
                {/* Secondary rain bands */}
                <Circle
                  cx={MAP_WIDTH / 2 + 50 + currentFrame.shiftX * zoom}
                  cy={MAP_HEIGHT / 2 - 40 + currentFrame.shiftY * zoom}
                  r={zoom * 42}
                  fill="#22C55E"
                  fillOpacity="0.4"
                />
                <Circle
                  cx={MAP_WIDTH / 2 - 60 + currentFrame.shiftX * zoom}
                  cy={MAP_HEIGHT / 2 + 50 + currentFrame.shiftY * zoom}
                  r={zoom * 35}
                  fill="#FBBF24"
                  fillOpacity="0.45"
                />
              </G>
            )}

            {/* Layer 4: Satellite Clouds */}
            {activeLayers.satellite && (
              <G opacity={0.4}>
                <Path
                  d={`M 10 100 Q ${MAP_WIDTH / 2} 80 ${MAP_WIDTH} 150 Q ${MAP_WIDTH - 80} 280 20 220 Z`}
                  fill="#FFFFFF"
                />
              </G>
            )}

            {/* Layer 5: Wind Flow Streamline Vectors */}
            {activeLayers.wind && (
              <G stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.7">
                {[
                  [60, 100],
                  [160, 130],
                  [260, 120],
                  [100, 240],
                  [200, 260],
                  [MAP_WIDTH / 2, MAP_HEIGHT / 2 - 20],
                ].map(([wx, wy], idx) => (
                  <G key={idx}>
                    <Path d={`M ${wx} ${wy} Q ${wx + 30} ${wy - 15} ${wx + 60} ${wy - 5}`} />
                    <Path d={`M ${wx + 55} ${wy - 10} L ${wx + 60} ${wy - 5} L ${wx + 52} ${wy}`} />
                  </G>
                ))}
              </G>
            )}

            {/* Layer 2: Geofence Polygon */}
            {activeLayers.warnings && (
              <G>
                <Polygon
                  points={geofencePoints}
                  fill="url(#warnFill)"
                  stroke={SEVERITY_COLOR[activeSeverity]}
                  strokeWidth="2.5"
                  strokeDasharray="6 3"
                  onPress={() => setInspectedEntity('geofence')}
                />
                {/* Geofence Label */}
                <SvgText
                  x={p1.x + 10}
                  y={p1.y + 16}
                  fill="#FFFFFF"
                  fontSize="10"
                  fontWeight="bold"
                >
                  ⚠️ {activeSeverity.toUpperCase()} GEOFENCE ZONE
                </SvgText>
              </G>
            )}

            {/* City & User Location Markers */}
            {DEMO_USERS.map((d) => {
              const anchor = CITIES.find((c) => c.key === d.cityKey) || CITIES[0];
              const pt = project(
                d.cityKey === 'pune' ? 18.52 : d.cityKey === 'mumbai' ? 19.07 : 30.73,
                d.cityKey === 'pune' ? 73.85 : d.cityKey === 'mumbai' ? 72.87 : 76.77,
                selectedCity,
                zoom
              );
              const isAffected = d.cityKey === selectedCity || (d.cityKey === 'pune' && activeSeverity === 'orange');

              return (
                <G key={d.user.id} onPress={() => setInspectedEntity('user')}>
                  <Circle cx={pt.x} cy={pt.y} r={14} fill={isAffected ? '#EF4444' : '#2563EB'} fillOpacity="0.25" />
                  <Circle cx={pt.x} cy={pt.y} r={7} fill={isAffected ? '#EF4444' : '#2563EB'} stroke="#FFFFFF" strokeWidth="2" />
                  <SvgText
                    x={pt.x + 10}
                    y={pt.y + 4}
                    fill="#F8FAFC"
                    fontSize="11"
                    fontWeight="bold"
                  >
                    {d.user.name} {isAffected ? '🚨' : '✓'}
                  </SvgText>
                </G>
              );
            })}
          </Svg>

          {/* Radar Animation Controller Scrubber */}
          {activeLayers.radar && (
            <View style={styles.scrubberCard}>
              <View style={styles.scrubberHead}>
                <TouchableOpacity
                  style={styles.playBtn}
                  onPress={() => setIsPlaying(!isPlaying)}
                >
                  <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={styles.scrubTime}>
                    {t(lang, 'radar_playback')}: <Text style={{ fontWeight: '800', color: colors.primary }}>{currentFrame.label}</Text>
                  </Text>
                  <Text style={styles.scrubSub}>
                    {currentFrame.label === '+30m Nowcast' ? 'AI Deep Learning extrapolation' : 'IMD Doppler Radar Reflectivity'}
                  </Text>
                </View>
                <Text style={styles.dbzBadge}>48 dBZ</Text>
              </View>

              <View style={styles.timelineRow}>
                {RADAR_TIMELINE.map((item, idx) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.timeStep, radarFrame === idx && styles.timeStepActive]}
                    onPress={() => {
                      setIsPlaying(false);
                      setRadarFrame(idx);
                    }}
                  >
                    <Text style={[styles.timeStepText, radarFrame === idx && styles.timeStepTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Map Color Legend */}
          <View style={styles.legend}>
            <Text style={styles.legendTitle}>PRECIPITATION INTENSITY (dBZ)</Text>
            <View style={styles.legendBar}>
              <View style={[styles.legSegment, { backgroundColor: '#22C55E' }]}><Text style={styles.legText}>15 Light</Text></View>
              <View style={[styles.legSegment, { backgroundColor: '#EAB308' }]}><Text style={styles.legText}>35 Mod</Text></View>
              <View style={[styles.legSegment, { backgroundColor: '#F97316' }]}><Text style={styles.legText}>45 Heavy</Text></View>
              <View style={[styles.legSegment, { backgroundColor: '#EF4444' }]}><Text style={styles.legText}>55+ Extreme</Text></View>
            </View>
          </View>
        </View>

        {/* Live Warning Bulletin Bottom Card */}
        <View style={styles.warningCard}>
          <View style={styles.warnHead}>
            <Text style={{ fontSize: 20 }}>{activeSeverity === 'red' ? '🚨' : '⚠️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.warnTitle}>
                {activeAlert?.headline || hp.scenario.warning?.headline || L(lang, 'Active Geofenced Warning: Pune Metro', 'सक्रिय चेतावनी: पुणे मेट्रो')}
              </Text>
              <Text style={styles.warnSub}>
                {L(lang, 'IMD Doppler Radar & PostGIS corridor match', 'IMD डॉपलर रडार व पोस्ट-जीआईएस मैच')}
              </Text>
            </View>
            <View style={[styles.sevPill, { backgroundColor: SEVERITY_COLOR[activeSeverity] }]}>
              <Text style={styles.sevPillText}>{activeSeverity.toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.warnBody}>
            {activeAlert?.body || hp.scenario.warning?.body || L(lang, 'Heavy convective cloud bands detected over central district. Localized waterlogging expected near low-lying underpasses.', 'मध्य जिले में भारी बादल। निचले इलाकों में जलभराव की संभावना।')}
          </Text>

          {/* User Target Geofence Status */}
          <View style={styles.targetGrid}>
            {DEMO_USERS.map((d) => {
              const inGeo = d.cityKey === selectedCity || d.cityKey === 'pune';
              return (
                <View key={d.user.id} style={[styles.targetPill, inGeo ? styles.targetPillIn : styles.targetPillOut]}>
                  <Text style={styles.targetName}>{d.user.name}</Text>
                  <Text style={[styles.targetStatus, { color: inGeo ? '#DC2626' : '#16A34A' }]}>
                    {inGeo ? '🚨 ' + t(lang, 'geofence_affected') : '✓ ' + t(lang, 'geofence_outside')}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LayerChip({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.layerChip, active && styles.layerChipActive]}
      onPress={onPress}
    >
      <Text style={styles.layerIcon}>{icon}</Text>
      <Text style={[styles.layerText, active && styles.layerTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, paddingBottom: 40 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  adminBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  adminBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  layerBar: { gap: 8, paddingBottom: 6 },
  layerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  layerChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  layerIcon: { fontSize: 13 },
  layerText: { fontSize: 11.5, fontWeight: '700', color: colors.textMuted },
  layerTextActive: { color: '#fff' },
  cityBar: { gap: 6, marginVertical: 8 },
  cityChip: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cityChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  cityChipText: { fontSize: 11.5, fontWeight: '600', color: '#475569' },
  cityChipTextActive: { color: '#fff', fontWeight: '700' },
  mapCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  mapTopOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#EF4444' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.4 },
  zoomRow: { flexDirection: 'row', gap: 6 },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  zoomText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  svgCanvas: { backgroundColor: '#0F172A' },
  scrubberCard: {
    backgroundColor: '#1E293B',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  scrubberHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { fontSize: 15, color: '#fff' },
  scrubTime: { fontSize: 12, fontWeight: '700', color: '#F8FAFC' },
  scrubSub: { fontSize: 10, color: '#94A3B8' },
  dbzBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  timelineRow: { flexDirection: 'row', gap: 4 },
  timeStep: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  timeStepActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeStepText: { fontSize: 9.5, fontWeight: '700', color: '#94A3B8' },
  timeStepTextActive: { color: '#fff' },
  legend: { backgroundColor: '#0F172A', padding: 12, borderTopWidth: 1, borderTopColor: '#1E293B' },
  legendTitle: { fontSize: 9, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 6 },
  legendBar: { flexDirection: 'row', borderRadius: 6, overflow: 'hidden', height: 16 },
  legSegment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  legText: { fontSize: 8.5, fontWeight: '800', color: '#000' },
  warningCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  warnHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  warnTitle: { fontSize: 13.5, fontWeight: '800', color: colors.text },
  warnSub: { fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
  sevPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  sevPillText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
  warnBody: { fontSize: 12, color: '#475569', lineHeight: 17, marginTop: 10 },
  targetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  targetPill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    minWidth: '47%',
  },
  targetPillIn: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  targetPillOut: { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' },
  targetName: { fontSize: 11, fontWeight: '800', color: colors.text },
  targetStatus: { fontSize: 10, fontWeight: '700', marginTop: 2 },
});
