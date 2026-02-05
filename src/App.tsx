import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { HeronWingsViewer, type RhinoLayer, type LightEffect, type LightSettings, DEFAULT_LIGHT_SETTINGS } from './components/HeronWingsViewer';
import { HeronWingsSidebar } from './components/HeronWingsSidebar';
import { HeronLightPanel } from './components/HeronLightPanel';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ConceptData {
  project: {
    name: string;
    site: string;
    primaryTenant: string;
  };
  sections: Section[];
  mapEntities: {
    zones: Zone[];
    nodes: Node[];
    layers: Layer[];
  };
}

interface Section {
  id: number;
  title: string;
  paragraph?: string;
  platforms?: Platform[];
  modes?: Mode[];
  audioZones?: AudioZone[];
}

interface Platform {
  id: string;
  name: string;
  type: string;
  primaryRoles: string[];
  systems: {
    lighting?: SystemDetail;
    audio?: SystemDetail;
    video?: SystemDetail;
    motion?: SystemDetail;
    rigging?: SystemDetail;
  };
  count?: number;
}

interface SystemDetail {
  type: string;
  control?: string[];
  capabilities?: string[];
  components?: string[];
  mounting?: string[];
  notes?: string;
}

interface Zone {
  id: string;
  name: string;
  type: string;
  links?: string[];
}

interface AudioZone {
  id: string;
  name: string;
  role: string;
  typicalContent: string[];
  targetSPL: { daily: string; event: string };
}

interface Node {
  id: string;
  name: string;
  type: string;
  platformRef?: string;
  ref?: string;
}

interface Layer {
  id: string;
  name: string;
  controls: string[];
  relatedZones?: string[];
  relatedPlatforms?: string[];
}

interface Mode {
  id: string;
  name: string;
  intent: string;
  lighting?: string[];
  audio?: string[];
  video?: string[];
  projection?: string[];
}

interface IconPlacement {
  id: string;
  entityType: 'platform' | 'node' | 'zone';
  entityId: string;
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  label: string;
  thumbnailUrl?: string;
}

interface PlacementsData {
  placements: IconPlacement[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getEntityById(conceptData: ConceptData | null, type: string, id: string): any {
  if (!conceptData) return null;

  switch (type) {
    case 'platform':
      for (const section of conceptData.sections) {
        if (section.platforms) {
          const platform = section.platforms.find(p => p.id === id);
          if (platform) return platform;
        }
      }
      break;
    case 'zone':
      return conceptData.mapEntities.zones.find(z => z.id === id);
    case 'node':
      return conceptData.mapEntities.nodes.find(n => n.id === id);
    case 'layer':
      return conceptData.mapEntities.layers.find(l => l.id === id);
    case 'mode':
      for (const section of conceptData.sections) {
        if (section.modes) {
          const mode = section.modes.find(m => m.id === id);
          if (mode) return mode;
        }
      }
      break;
  }
  return null;
}

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function toTitleCase(value: string): string {
  const cleaned = formatLabel(value);
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map(word => {
      if (word === word.toUpperCase()) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function toSentenceCase(value: string): string {
  const cleaned = formatLabel(value);
  if (!cleaned) return cleaned;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function withBase(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function getPlatformPriority(platform: Platform, mode: Mode | null): number {
  if (!mode) return 0; // No mode selected, maintain original order

  const platformId = platform.id;

  // Check which system types are mentioned in the mode
  const mentionedInLighting = mode.lighting?.some(item => item.toLowerCase().includes(platformId)) || false;
  const mentionedInAudio = mode.audio?.some(item => item.toLowerCase().includes(platformId)) || false;
  const mentionedInVideo = mode.video?.some(item => item.toLowerCase().includes(platformId)) || false;
  const mentionedInProjection = mode.projection?.some(item => item.toLowerCase().includes(platformId)) || false;

  // Determine if platform is primary, secondary, or supporting
  const isPrimary =
    (mode.id === 'M5_concert_mode' && platformId === 'event_stage') ||
    (mode.id === 'M6_brand_takeover' && platformId === 'dj_pavilion') ||
    (mode.audio?.some(item => item.includes('performance') && item.includes('high')) && platformId === 'dj_pavilion') ||
    (mode.audio?.some(item => item.includes('concert')) && platformId === 'event_stage');

  const isConcertSecondary = mode.id === 'M5_concert_mode' && platformId === 'dj_pavilion';

  const isSecondary =
    (mentionedInLighting || mentionedInAudio || mentionedInVideo) && !isPrimary;

  if (isPrimary) return 3;
  if (isConcertSecondary) return 2;
  if (isSecondary) return 2;
  if (mentionedInProjection) return 1;
  return 0;
}

function getPlatformRoleLabel(platform: Platform, mode: Mode): string {
  const priority = getPlatformPriority(platform, mode);
  if (priority >= 3) return 'primary';
  if (priority === 2) return 'secondary';
  return 'supporting';
}

function getPlatformContributions(platform: Platform, mode: Mode): string[] {
  const contributions: string[] = [];
  if (platform.systems?.lighting && mode.lighting?.length) contributions.push('lighting cues');
  if (platform.systems?.audio && mode.audio?.length) contributions.push('audio energy');
  if (platform.systems?.video && mode.video?.length) contributions.push('visual content');
  if (platform.systems?.motion) contributions.push('kinetic motion');
  if (platform.systems?.rigging) contributions.push('rigging support');
  return contributions;
}

function buildModeRoleSummary(
  conceptData: ConceptData,
  entity: Platform | Zone | Node,
  entityType: string,
  selectedModeId: string
): string {
  const entityName = (entity as any)?.name || (entity as any)?.id || 'This entity';
  const mode = selectedModeId ? (getEntityById(conceptData, 'mode', selectedModeId) as Mode | null) : null;

  if (!mode) {
    return `Select a plaza mode to see how ${entityName} supports the experience.`;
  }

  if (entityType === 'platform') {
    const platform = entity as Platform;
    if (mode.id === 'M1_daily_ambient' && platform.id === 'event_stage') {
      return `In ${mode.name}, ${entityName} is not active, keeping the plaza focused on calm, low-intensity ambience.`;
    }
    const roleLabel = getPlatformRoleLabel(platform, mode);
    const contributions = getPlatformContributions(platform, mode);
    const roleSentence = `In ${mode.name}, ${entityName} is a ${roleLabel} platform.`;
    let contributionSentence = '';
    if (contributions.length > 0) {
      contributionSentence = `It contributes through ${joinWithAnd(contributions)}.`;
    } else if (platform.primaryRoles?.length) {
      contributionSentence = `It supports ${joinWithAnd(platform.primaryRoles.map(toSentenceCase))}.`;
    } else {
      contributionSentence = 'It reinforces the overall atmosphere through its presence and programming.';
    }
    const intentSentence = mode.intent ? `This aligns with the mode intent: ${mode.intent}` : '';
    return [roleSentence, contributionSentence, intentSentence].filter(Boolean).join(' ');
  }

  if (entityType === 'zone') {
    const zone = entity as Zone;
    const typeLabel = zone.type ? formatLabel(zone.type) : 'zone';
    const audioZones = conceptData.sections.flatMap(section => section.audioZones || []);
    const audioZoneMap = new Map(audioZones.map(audio => [audio.id, audio.name]));
    const links = zone.links || [];
    const activeLinks = links.filter(link => mode.audio?.some(item => item.includes(link)));
    const activeNames = activeLinks.map(link => audioZoneMap.get(link) || link);
    const linkNames = links.map(link => audioZoneMap.get(link) || link);
    const roleSentence = `In ${mode.name}, ${entityName} is a supporting zone (${typeLabel}) shaping the ambience.`;
    let linkSentence = '';
    if (activeNames.length > 0) {
      linkSentence = `Audio emphasis is routed to ${joinWithAnd(activeNames)}.`;
    } else if (linkNames.length > 0) {
      linkSentence = `Audio links include ${joinWithAnd(linkNames)}.`;
    }
    const intentSentence = mode.intent ? `This supports the mode intent: ${mode.intent}` : '';
    return [roleSentence, linkSentence, intentSentence].filter(Boolean).join(' ');
  }

  if (entityType === 'node') {
    const node = entity as Node;
    const platform = node.platformRef
      ? (getEntityById(conceptData, 'platform', node.platformRef) as Platform | null)
      : null;
    const roleSentence = platform
      ? `In ${mode.name}, ${entityName} supports ${platform.name}, a ${getPlatformRoleLabel(platform, mode)} platform.`
      : `In ${mode.name}, ${entityName} supports the system network.`;
    const contributions = platform ? getPlatformContributions(platform, mode) : [];
    let contributionSentence = '';
    if (contributions.length > 0) {
      contributionSentence = `It helps deliver ${joinWithAnd(contributions)}.`;
    } else if (node.type) {
      contributionSentence = `It contributes as a ${formatLabel(node.type)}.`;
    } else {
      contributionSentence = 'It reinforces the overall ambience through system support.';
    }
    const intentSentence = mode.intent ? `This aligns with the mode intent: ${mode.intent}` : '';
    return [roleSentence, contributionSentence, intentSentence].filter(Boolean).join(' ');
  }

  return `In ${mode.name}, ${entityName} supports the overall experience.`;
}

function generateThumbnail(label: string, type: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 60;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background - IMCF themed colors
  ctx.fillStyle = type === 'platform' ? '#f7b5cd' : type === 'zone' ? '#a8e6cf' : type === 'node' ? '#ffd56b' : '#c9b5e6';
  ctx.fillRect(0, 0, 80, 60);

  // Text
  ctx.fillStyle = '#231f20';
  ctx.font = 'bold 12px Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initials = label.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase();
  ctx.fillText(initials, 40, 30);

  return canvas.toDataURL();
}

// ============================================================================
// COMPONENTS
// ============================================================================

// --- Platform List Sidebar ---
interface PlatformListProps {
  conceptData: ConceptData | null;
  selectedEntity: { type: string; id: string } | null;
  onSelectEntity: (type: string, id: string) => void;
  placements: IconPlacement[];
  selectedModeId: string;
  onSelectMode: (modeId: string) => void;
}

function PlatformList({ conceptData, selectedEntity, onSelectEntity, placements: _placements, selectedModeId, onSelectMode }: PlatformListProps) {
  if (!conceptData) return <div className="sidebar loading">Loading...</div>;

  const allModes = conceptData.sections.flatMap(s => s.modes || []);
  const allPlatforms = conceptData.sections.flatMap(s => s.platforms || []);

  const currentMode = selectedModeId ? (allModes.find(m => m.id === selectedModeId) || null) : null;
  const visiblePlatforms = selectedModeId === 'M1_daily_ambient'
    ? allPlatforms.filter(platform => platform.id !== 'event_stage')
    : allPlatforms;

  // Sort platforms based on the selected mode
  const sortedPlatforms = [...visiblePlatforms].sort((a, b) => {
    const priorityA = getPlatformPriority(a, currentMode);
    const priorityB = getPlatformPriority(b, currentMode);
    return priorityB - priorityA; // Descending order (highest priority first)
  });

  return (
    <div className="sidebar left-sidebar">
      <div className="sidebar-header">
        <h2>Modes</h2>
        <select
          value={selectedModeId}
          onChange={(e) => onSelectMode(e.target.value)}
          className="mode-select"
        >
          <option value="">Select Plaza Mode</option>
          {allModes.map(mode => (
            <option key={mode.id} value={mode.id}>
              {mode.name}
            </option>
          ))}
        </select>
      </div>
      <div className="platform-list">
        <div className="platforms-heading">Platforms</div>
        {sortedPlatforms.map(platform => {
          const isSelected = selectedEntity?.type === 'platform' && selectedEntity?.id === platform.id;
          return (
            <div
              key={platform.id}
              className={`platform-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectEntity('platform', platform.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelectEntity('platform', platform.id)}
            >
              <div className="platform-item-header">
                <h3>{platform.name}</h3>
              </div>
              <div className="platform-type">{toTitleCase(platform.type)}</div>
              <div className="system-indicators">
                {platform.systems.lighting && <span className="indicator lighting" title="Lighting">Lighting</span>}
                {platform.systems.audio && <span className="indicator audio" title="Audio">Audio</span>}
                {platform.systems.video && <span className="indicator video" title="Video">Video</span>}
                {platform.systems.motion && <span className="indicator motion" title="Motion">Motion</span>}
                {platform.systems.rigging && <span className="indicator rigging" title="Rigging">Rigging</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Map Canvas ---
interface MapCanvasProps {
  conceptData: ConceptData | null;
  placements: IconPlacement[];
  selectedEntity: { type: string; id: string } | null;
  onSelectEntity: (type: string, id: string) => void;
  onUpdatePlacement: (id: string, x: number, y: number) => void;
  onAddPlacement: (placement: Omit<IconPlacement, 'id'>) => void;
  onDeletePlacement: (id: string) => void;
  placementMode: { active: boolean; entityType: 'platform' | 'node' | 'zone'; entityId: string } | null;
  activeLayers: Set<string>;
  removeMode: boolean;
  selectedModeId: string;
}

function MapCanvas({
  conceptData,
  placements,
  selectedEntity,
  onSelectEntity,
  onUpdatePlacement,
  onAddPlacement,
  onDeletePlacement,
  placementMode,
  activeLayers,
  removeMode,
  selectedModeId
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggedIcon, setDraggedIcon] = useState<string | null>(null);
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const [currentImage, setCurrentImage] = useState(withBase('assets/Inactive.jpg'));
  const [nextImage, setNextImage] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Map mode IDs to background images
  const getModeBackgroundImage = (modeId: string): string => {
    const imageMap: { [key: string]: string } = {
      '': withBase('assets/Inactive.jpg'),
      'M1_daily_ambient': withBase('assets/Ambient.jpg'),
      'M2_gameday_pre_game': withBase('assets/Activation.jpg'),
      'M3_gameday_in_game': withBase('assets/Stadium.jpg'),
      'M4_gameday_post_game': withBase('assets/Activation.jpg'),
      'M5_concert_mode': withBase('assets/Concert.jpg'),
      'M6_brand_takeover': withBase('assets/Brand.jpg'),
      'M7_seasonal_activation': withBase('assets/Seasonal.jpg')
    };
    return imageMap[modeId] || withBase('assets/Inactive.jpg');
  };

  // Handle background image transitions when mode changes
  useEffect(() => {
    const newImage = getModeBackgroundImage(selectedModeId);

    if (newImage !== currentImage) {
      setNextImage(newImage);
      setIsTransitioning(true);

      // After transition completes, update current image
      const timer = setTimeout(() => {
        setCurrentImage(newImage);
        setNextImage('');
        setIsTransitioning(false);
      }, 600); // Match CSS transition duration

      return () => clearTimeout(timer);
    }
  }, [selectedModeId, currentImage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setCanvasSize({
        width: rect.width || 1,
        height: rect.height || 1
      });
    };

    updateSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => {
      const newZoom = Math.max(1, Math.min(3, prev * delta));
      // If zooming back to 100%, reset pan to center
      if (newZoom === 1 && prev !== 1) {
        setPan({ x: 0, y: 0 });
      }
      return newZoom;
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (placementMode) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMapClick = (e: React.MouseEvent) => {
    if (!placementMode || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / (rect.width * zoom);
    const y = (e.clientY - rect.top - pan.y) / (rect.height * zoom);

    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      const entity = getEntityById(conceptData, placementMode.entityType, placementMode.entityId);
      if (entity) {
        onAddPlacement({
          entityType: placementMode.entityType,
          entityId: placementMode.entityId,
          x,
          y,
          label: entity.name || entity.id
        });
      }
    }
  };

  const handleIconMouseDown = (e: React.MouseEvent, placementId: string) => {
    e.stopPropagation();
    if (placementMode) return;
    setDraggedIcon(placementId);
  };

  const handleIconMouseMove = (e: React.MouseEvent, placementId: string) => {
    if (draggedIcon === placementId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / (rect.width * zoom);
      const y = (e.clientY - rect.top - pan.y) / (rect.height * zoom);

      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        onUpdatePlacement(placementId, x, y);
      }
    }
  };

  const handleIconMouseUp = () => {
    setDraggedIcon(null);
  };

  const getIconShape = (entityType: string) => {
    switch (entityType) {
      case 'platform': return 'circle';
      case 'zone': return 'hexagon';
      case 'node': return 'square';
      default: return 'circle';
    }
  };

  const shouldShowIcon = (placement: IconPlacement) => {
    // Hide Event Stage icons in modes where Event Stage is not active
    if (placement.entityType === 'platform' && placement.entityId === 'event_stage') {
      const modesWithoutEventStage = ['', 'M1_daily_ambient', 'M2_gameday_pre_game', 'M3_gameday_in_game', 'M4_gameday_post_game'];
      if (modesWithoutEventStage.includes(selectedModeId)) {
        return false;
      }
    }

    if (activeLayers.size === 0) return true;

    const entity = getEntityById(conceptData, placement.entityType, placement.entityId);
    if (!entity) return true;

    // Check if entity is related to any active layer
    if (placement.entityType === 'platform') {
      return conceptData?.mapEntities.layers.some(layer =>
        activeLayers.has(layer.id) && layer.relatedPlatforms?.includes(placement.entityId)
      ) ?? true;
    } else if (placement.entityType === 'zone') {
      return conceptData?.mapEntities.layers.some(layer =>
        activeLayers.has(layer.id) && layer.relatedZones?.includes(placement.entityId)
      ) ?? true;
    }

    return true;
  };

  const aspectFix = canvasSize.width > 0 ? canvasSize.height / canvasSize.width : 1;

  const getPlacementLabel = (placement: IconPlacement) => {
    const entity = getEntityById(conceptData, placement.entityType, placement.entityId);
    return entity?.name || placement.label || placement.entityId;
  };

  return (
    <div
      ref={containerRef}
      className={`map-canvas ${placementMode ? 'placement-mode' : ''} ${removeMode ? 'remove-mode' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleMapClick}
    >
      <div
        className="map-container"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <img
          src={currentImage}
          alt="Site Plan"
          className="site-plan-image site-plan-image-current"
          draggable={false}
        />
        {isTransitioning && nextImage && (
          <img
            src={nextImage}
            alt="Site Plan"
            className="site-plan-image site-plan-image-next"
            draggable={false}
          />
        )}

        <svg className="icon-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
          {placements.filter(shouldShowIcon).map(placement => {
            const isSelected = selectedEntity?.type === placement.entityType && selectedEntity?.id === placement.entityId;
            const isHovered = hoveredIcon === placement.id;
            const shape = getIconShape(placement.entityType);
            const cx = placement.x * 100;
            const cy = placement.y * 100;
            const label = getPlacementLabel(placement);
            const correctionTransform = aspectFix !== 1
              ? `translate(${cx} ${cy}) scale(${aspectFix} 1) translate(${-cx} ${-cy})`
              : undefined;

            return (
              <g
                key={placement.id}
                className={`map-icon ${shape} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                transform={correctionTransform}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleIconMouseDown(e as any, placement.id);
                }}
                onMouseMove={(e) => handleIconMouseMove(e as any, placement.id)}
                onMouseUp={handleIconMouseUp}
                onMouseEnter={(e) => {
                  setHoveredIcon(placement.id);
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltipPos({
                      x: (e as any).clientX - rect.left,
                      y: (e as any).clientY - rect.top
                    });
                  }
                }}
                onMouseLeave={() => setHoveredIcon(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (removeMode) {
                    onDeletePlacement(placement.id);
                  } else if (!draggedIcon) {
                    onSelectEntity(placement.entityType, placement.entityId);
                  }
                }}
              >
                {shape === 'circle' && (
                  <circle cx={cx} cy={cy} r="1.5" />
                )}
                {shape === 'square' && (
                  <rect x={cx - 1.2} y={cy - 1.2} width="2.4" height="2.4" />
                )}
                {shape === 'hexagon' && (
                  <polygon points={`${cx},${cy-1.5} ${cx+1.3},${cy-0.75} ${cx+1.3},${cy+0.75} ${cx},${cy+1.5} ${cx-1.3},${cy+0.75} ${cx-1.3},${cy-0.75}`} />
                )}
                <text x={cx} y={cy + 2.5} className="icon-label">{label}</text>
              </g>
            );
          })}
        </svg>

        {hoveredIcon && (
          <div
            className="icon-tooltip"
            style={{
              left: tooltipPos.x + 15,
              top: tooltipPos.y + 15
            }}
          >
            {(() => {
              const placement = placements.find(p => p.id === hoveredIcon);
              if (!placement) return null;

              const label = getPlacementLabel(placement);
              const thumbnailUrl = placement.thumbnailUrl || generateThumbnail(label, placement.entityType);

              return (
                <>
                  <img src={thumbnailUrl} alt={label} />
                  <div className="tooltip-text">
                    <strong>{label}</strong>
                    <div className="tooltip-type">{placement.entityType}</div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      <div className="map-controls">
        <div className="zoom-info">Zoom: {Math.round(zoom * 100)}%</div>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="reset-btn">Reset View</button>
      </div>
    </div>
  );
}

// --- Context Drawer ---
interface ContextDrawerProps {
  conceptData: ConceptData | null;
  selectedEntity: { type: string; id: string } | null;
  onClose: () => void;
  selectedModeId: string;
}

function ContextDrawer({ conceptData, selectedEntity, onClose, selectedModeId }: ContextDrawerProps) {
  if (!selectedEntity || !conceptData) {
    return null;
  }

  const entity = getEntityById(conceptData, selectedEntity.type, selectedEntity.id);
  if (!entity) return null;
  const activeMode = selectedModeId ? (getEntityById(conceptData, 'mode', selectedModeId) as Mode | null) : null;
  const modeLabel = activeMode?.name || 'Select Plaza Mode';
  const modeSummary = buildModeRoleSummary(conceptData, entity, selectedEntity.type, selectedModeId);

  return (
    <div className="sidebar right-sidebar drawer-open">
      <div className="drawer-header">
        <div className="drawer-title">
          <h2>{entity.name || entity.id}</h2>
          <div className="drawer-mode">
            Mode: <span>{modeLabel}</span>
          </div>
        </div>
        <button onClick={onClose} className="close-btn" aria-label="Close">✕</button>
      </div>

      <div className="drawer-content">
        <div className="mode-role-summary">
          <p>{modeSummary}</p>
        </div>

        {/* Platform Details */}
        {selectedEntity.type === 'platform' && (
          <>
            <div className="detail-section">
              <h3>Platform Type</h3>
              <p>{toTitleCase(entity.type)}</p>
            </div>

            {entity.primaryRoles && entity.primaryRoles.length > 0 && (
              <div className="detail-section">
                <h3>Primary Roles</h3>
                <ul>
                  {entity.primaryRoles.map((role: string, i: number) => (
                    <li key={i}>{toSentenceCase(role)}</li>
                  ))}
                </ul>
              </div>
            )}

            {entity.count && (
              <div className="detail-section">
                <h3>Count</h3>
                <p>{entity.count} units</p>
              </div>
            )}

            {entity.systems && Object.keys(entity.systems).length > 0 && (
              <div className="detail-section">
                <h3>Systems</h3>
                {Object.entries(entity.systems).map(([systemType, systemDetail]: [string, any]) => (
                  <details key={systemType} className="system-accordion">
                    <summary>{systemType.charAt(0).toUpperCase() + systemType.slice(1)}</summary>
                    <div className="system-body">
                      {systemDetail.type && <p><strong>Type:</strong> {toSentenceCase(systemDetail.type)}</p>}
                      {systemDetail.control && (
                        <div>
                          <strong>Control:</strong>
                          <ul>
                            {systemDetail.control.map((c: string, i: number) => <li key={i}>{toSentenceCase(c)}</li>)}
                          </ul>
                        </div>
                      )}
                      {systemDetail.capabilities && (
                        <div>
                          <strong>Capabilities:</strong>
                          <ul>
                            {systemDetail.capabilities.map((cap: string, i: number) => (
                              <li key={i}>{toSentenceCase(cap)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {systemDetail.components && (
                        <div>
                          <strong>Components:</strong>
                          <ul>
                            {systemDetail.components.map((comp: string, i: number) => <li key={i}>{toSentenceCase(comp)}</li>)}
                          </ul>
                        </div>
                      )}
                      {systemDetail.mounting && (
                        <div>
                          <strong>Mounting:</strong>
                          <ul>
                            {systemDetail.mounting.map((m: string, i: number) => <li key={i}>{toSentenceCase(m)}</li>)}
                          </ul>
                        </div>
                      )}
                      {systemDetail.notes && <p className="notes"><em>{systemDetail.notes}</em></p>}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </>
        )}

        {/* Zone Details */}
        {selectedEntity.type === 'zone' && (
          <>
            <div className="detail-section">
              <h3>Zone Type</h3>
              <p>{entity.type}</p>
            </div>
            {entity.links && entity.links.length > 0 && (
              <div className="detail-section">
                <h3>Links</h3>
                <ul>
                  {entity.links.map((link: string, i: number) => <li key={i}>{link}</li>)}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Node Details */}
        {selectedEntity.type === 'node' && (
          <>
            <div className="detail-section">
              <h3>Node Type</h3>
              <p>{entity.type}</p>
            </div>
            {entity.platformRef && (
              <div className="detail-section">
                <h3>Platform Reference</h3>
                <p>{entity.platformRef}</p>
              </div>
            )}
            {entity.ref && (
              <div className="detail-section">
                <h3>Reference</h3>
                <p>{entity.ref}</p>
              </div>
            )}
          </>
        )}

        {/* Mode Details */}
        {selectedEntity.type === 'mode' && (
          <>
            <div className="detail-section">
              <h3>Intent</h3>
              <p>{entity.intent}</p>
            </div>

            {entity.lighting && entity.lighting.length > 0 && (
              <div className="detail-section">
                <h3>Lighting</h3>
                <ul>
                  {entity.lighting.map((item: string, i: number) => <li key={i}>{toSentenceCase(item)}</li>)}
                </ul>
              </div>
            )}

            {entity.audio && entity.audio.length > 0 && (
              <div className="detail-section">
                <h3>Audio</h3>
                <ul>
                  {entity.audio.map((item: string, i: number) => <li key={i}>{toSentenceCase(item)}</li>)}
                </ul>
              </div>
            )}

            {entity.video && entity.video.length > 0 && (
              <div className="detail-section">
                <h3>Video</h3>
                <ul>
                  {entity.video.map((item: string, i: number) => <li key={i}>{toSentenceCase(item)}</li>)}
                </ul>
              </div>
            )}

            {entity.projection && entity.projection.length > 0 && (
              <div className="detail-section">
                <h3>Projection</h3>
                <ul>
                  {entity.projection.map((item: string, i: number) => <li key={i}>{toSentenceCase(item)}</li>)}
                </ul>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

// --- Placement Toolbar ---
interface PlacementToolbarProps {
  conceptData: ConceptData | null;
  placementMode: { active: boolean; entityType: 'platform' | 'node' | 'zone'; entityId: string } | null;
  onSetPlacementMode: (mode: { entityType: 'platform' | 'node' | 'zone'; entityId: string } | null) => void;
  onUndo: () => void;
  canUndo: boolean;
  removeMode: boolean;
  onSetRemoveMode: (active: boolean) => void;
}

function PlacementToolbar({ conceptData, placementMode, onSetPlacementMode, onUndo, canUndo, removeMode, onSetRemoveMode }: PlacementToolbarProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedType, setSelectedType] = useState<'platform' | 'node' | 'zone'>('platform');

  if (!conceptData) return null;

  const getEntitiesForType = (type: string) => {
    switch (type) {
      case 'platform':
        return conceptData.sections.flatMap(s => s.platforms || []);
      case 'zone':
        return conceptData.mapEntities.zones;
      case 'node':
        return conceptData.mapEntities.nodes;
      default:
        return [];
    }
  };

  const entities = getEntitiesForType(selectedType);

  return (
    <div className="placement-toolbar">
      <button
        className={`toolbar-btn ${placementMode ? 'active' : ''}`}
        onClick={() => setShowPicker(!showPicker)}
      >
        {placementMode ? '✓ Placement Mode Active' : '+ Add Icon'}
      </button>

      {placementMode && (
        <button
          className="toolbar-btn cancel"
          onClick={() => onSetPlacementMode(null)}
        >
          Cancel
        </button>
      )}

      <button
        className={`toolbar-btn ${removeMode ? 'active danger' : ''}`}
        onClick={() => {
          onSetRemoveMode(!removeMode);
          if (placementMode) onSetPlacementMode(null);
        }}
      >
        {removeMode ? '✓ Remove Mode Active' : '🗑️ Remove Icon'}
      </button>

      {removeMode && (
        <button
          className="toolbar-btn cancel"
          onClick={() => onSetRemoveMode(false)}
        >
          Cancel
        </button>
      )}

      <button
        className="toolbar-btn"
        onClick={onUndo}
        disabled={!canUndo}
      >
        ↶ Undo
      </button>

      {showPicker && (
        <div className="entity-picker">
          <div className="picker-header">
            <h3>Select Entity to Place</h3>
            <button onClick={() => setShowPicker(false)} className="close-btn">✕</button>
          </div>

          <div className="type-tabs">
            {(['platform', 'node', 'zone'] as const).map(type => (
              <button
                key={type}
                className={`type-tab ${selectedType === type ? 'active' : ''}`}
                onClick={() => setSelectedType(type)}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="entity-list">
            {entities.map((entity: any) => (
              <button
                key={entity.id}
                className="entity-option"
                onClick={() => {
                  onSetPlacementMode({ entityType: selectedType, entityId: entity.id });
                  setShowPicker(false);
                }}
              >
                {entity.name || entity.id}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Layer Toggles ---
interface LayerTogglesProps {
  conceptData: ConceptData | null;
  activeLayers: Set<string>;
  onToggleLayer: (layerId: string) => void;
}

function LayerToggles({ conceptData, activeLayers, onToggleLayer }: LayerTogglesProps) {
  if (!conceptData) return null;

  const layers = conceptData.mapEntities.layers;

  return (
    <div className="layer-toggles">
      <h3>Layers</h3>
      <div className="toggle-list">
        {layers.map(layer => (
          <label key={layer.id} className="layer-toggle">
            <input
              type="checkbox"
              checked={activeLayers.has(layer.id)}
              onChange={() => onToggleLayer(layer.id)}
            />
            <span>{layer.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// --- Legend ---
function Legend() {
  return (
    <div className="legend">
      <h3>Icon Legend</h3>
      <div className="legend-items">
        <div className="legend-item">
          <svg width="24" height="24">
            <circle cx="12" cy="12" r="8" fill="#f7b5cd" />
          </svg>
          <span>Platform</span>
        </div>
        <div className="legend-item">
          <svg width="24" height="24">
            <rect x="4" y="4" width="16" height="16" fill="#ffd56b" />
          </svg>
          <span>Node</span>
        </div>
        <div className="legend-item">
          <svg width="24" height="24">
            <polygon points="12,4 20,10 20,18 12,24 4,18 4,10" fill="#a8e6cf" />
          </svg>
          <span>Zone</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

function App() {
  const [conceptData, setConceptData] = useState<ConceptData | null>(null);
  const [placements, setPlacements] = useState<IconPlacement[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: string } | null>(null);
  const [selectedModeId, setSelectedModeId] = useState('');
  const [placementMode, setPlacementMode] = useState<{ active: boolean; entityType: 'platform' | 'node' | 'zone'; entityId: string } | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<IconPlacement[]>([]);
  const [removeMode, setRemoveMode] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState<'plaza-modes' | 'heron-wings'>('plaza-modes');

  // Heron Wings state
  const [heronLayers, setHeronLayers] = useState<RhinoLayer[]>([]);
  const [heronLoading, setHeronLoading] = useState(true);
  const [lightEffect, setLightEffect] = useState<LightEffect>('off');
  const [washLightEffect, setWashLightEffect] = useState<LightEffect>('off');
  const [lightSettings, setLightSettings] = useState<LightSettings>(DEFAULT_LIGHT_SETTINGS);
  const resetCameraRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('plaza-auth');
    if (stored === 'true') {
      setIsAuthed(true);
    }
  }, []);

  // Load concept data
  useEffect(() => {
    fetch(withBase('concept.json'))
      .then(res => res.json())
      .then(data => setConceptData(data))
      .catch(err => console.error('Failed to load concept data:', err));
  }, []);

  // Clear saved placements once to remove legacy icons.
  useEffect(() => {
    const clearKey = 'plaza-placements-cleared-v1';
    if (!localStorage.getItem(clearKey)) {
      localStorage.removeItem('plaza-placements');
      setPlacements([]);
      setUndoStack([]);
      localStorage.setItem(clearKey, 'true');
    }
  }, []);

  // Load placements from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('plaza-placements');
    if (saved) {
      try {
        const data: PlacementsData = JSON.parse(saved);
        setPlacements(data.placements);
      } catch (err) {
        console.error('Failed to load placements:', err);
      }
    }
  }, []);

  // Save placements to localStorage
  useEffect(() => {
    if (placements.length > 0) {
      const data: PlacementsData = { placements };
      localStorage.setItem('plaza-placements', JSON.stringify(data));
    } else {
      localStorage.removeItem('plaza-placements');
    }
  }, [placements]);

  // URL state management
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const id = params.get('selected');
    if (type && id) {
      setSelectedEntity({ type, id });
    }
  }, []);

  useEffect(() => {
    if (selectedEntity) {
      const params = new URLSearchParams();
      params.set('type', selectedEntity.type);
      params.set('selected', selectedEntity.id);
      window.history.replaceState({}, '', `?${params.toString()}`);
    } else {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [selectedEntity]);

  const handleSelectEntity = (type: string, id: string) => {
    setSelectedEntity({ type, id });
  };

  const handleCloseDrawer = () => {
    setSelectedEntity(null);
  };

  const handleAddPlacement = (placement: Omit<IconPlacement, 'id'>) => {
    const newPlacement: IconPlacement = {
      ...placement,
      id: `plc_${Date.now()}_${Math.random().toString(36).substring(7)}`
    };
    setPlacements(prev => [...prev, newPlacement]);
    setUndoStack(prev => [...prev, newPlacement]);
    setPlacementMode(null);
  };

  const handleUpdatePlacement = (id: string, x: number, y: number) => {
    setPlacements(prev => prev.map(p => p.id === id ? { ...p, x, y } : p));
  };

  const handleDeletePlacement = (id: string) => {
    setPlacements(prev => prev.filter(p => p.id !== id));
  };

  const handleUndo = () => {
    if (undoStack.length > 0) {
      const lastPlacement = undoStack[undoStack.length - 1];
      setPlacements(prev => prev.filter(p => p.id !== lastPlacement.id));
      setUndoStack(prev => prev.slice(0, -1));
    }
  };

  const handleSetPlacementMode = (mode: { entityType: 'platform' | 'node' | 'zone'; entityId: string } | null) => {
    setPlacementMode(mode ? { ...mode, active: true } : null);
  };

  const handleToggleLayer = (layerId: string) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  };

  // Heron Wings handlers
  const handleHeronLayersLoaded = useCallback((layers: RhinoLayer[]) => {
    const defaultHiddenLayers = new Set(['emitters', 'base lights', 'wash lights']);
    setHeronLayers(layers.map((layer) => ({
      ...layer,
      visible: !defaultHiddenLayers.has(layer.name.trim().toLowerCase())
    })));
    setHeronLoading(false);
  }, []);

  const handleToggleHeronLayer = useCallback((index: number) => {
    setHeronLayers(prev => prev.map(layer =>
      layer.index === index ? { ...layer, visible: !layer.visible } : layer
    ));
  }, []);

  const handleShowAllHeronLayers = useCallback(() => {
    setHeronLayers(prev => prev.map(layer => ({ ...layer, visible: true })));
  }, []);

  const handleHideAllHeronLayers = useCallback(() => {
    setHeronLayers(prev => prev.map(layer => ({ ...layer, visible: false })));
  }, []);

  const handleResetHeronCamera = useCallback(() => {
    resetCameraRef.current?.();
  }, []);

  const registerResetCamera = useCallback((fn: () => void) => {
    resetCameraRef.current = fn;
  }, []);

  const handleLightEffectChange = useCallback((effect: LightEffect) => {
    setLightEffect(effect);
  }, []);

  const handleWashLightEffectChange = useCallback((effect: LightEffect) => {
    setWashLightEffect(effect);
  }, []);

  const handleLightSettingsChange = useCallback((settings: LightSettings) => {
    setLightSettings(settings);
  }, []);

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordInput === 'PlazaActivation') {
      sessionStorage.setItem('plaza-auth', 'true');
      setIsAuthed(true);
      setLoginError('');
    } else {
      setLoginError('Incorrect password.');
    }
  };

  if (!isAuthed) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1>MFP Celebration Plaza Activation Strategy</h1>
          <p>Enter the password to access the experience.</p>
          <form onSubmit={handleLogin} className="login-form">
            <label htmlFor="password" className="login-label">Password</label>
            <input
              id="password"
              type="password"
              className="login-input"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              autoFocus
            />
            {loginError && <div className="login-error">{loginError}</div>}
            <button type="submit" className="login-btn">Enter</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>{conceptData?.project.name || 'MFP Celebration Plaza Activation Strategy'}</h1>
      </header>
      
      <nav className="app-nav">
        <button 
          className={`nav-tab ${activeTab === 'plaza-modes' ? 'active' : ''}`}
          onClick={() => setActiveTab('plaza-modes')}
        >
          Plaza Modes
        </button>
        <button 
          className={`nav-tab ${activeTab === 'heron-wings' ? 'active' : ''}`}
          onClick={() => setActiveTab('heron-wings')}
        >
          Heron Wings
        </button>
      </nav>

      <div className="app-body">
        {activeTab === 'plaza-modes' ? (
          <>
            <PlatformList
              conceptData={conceptData}
              selectedEntity={selectedEntity}
              onSelectEntity={handleSelectEntity}
              placements={placements}
              selectedModeId={selectedModeId}
              onSelectMode={setSelectedModeId}
            />

            <div className="center-column">
              <div className="center-header">
                <PlacementToolbar
                  conceptData={conceptData}
                  placementMode={placementMode}
                  onSetPlacementMode={handleSetPlacementMode}
                  onUndo={handleUndo}
                  canUndo={undoStack.length > 0}
                  removeMode={removeMode}
                  onSetRemoveMode={setRemoveMode}
                />
                <LayerToggles
                  conceptData={conceptData}
                  activeLayers={activeLayers}
                  onToggleLayer={handleToggleLayer}
                />
              </div>

              <MapCanvas
                conceptData={conceptData}
                placements={placements}
                selectedEntity={selectedEntity}
                onSelectEntity={handleSelectEntity}
                onUpdatePlacement={handleUpdatePlacement}
                onAddPlacement={handleAddPlacement}
                onDeletePlacement={handleDeletePlacement}
                placementMode={placementMode}
                activeLayers={activeLayers}
                removeMode={removeMode}
                selectedModeId={selectedModeId}
              />

              <Legend />
            </div>

            <ContextDrawer
              conceptData={conceptData}
              selectedEntity={selectedEntity}
              onClose={handleCloseDrawer}
              selectedModeId={selectedModeId}
            />
          </>
        ) : (
          <>
            <HeronWingsSidebar
              layers={heronLayers}
              onToggleLayer={handleToggleHeronLayer}
              onShowAll={handleShowAllHeronLayers}
              onHideAll={handleHideAllHeronLayers}
              onResetCamera={handleResetHeronCamera}
              isLoading={heronLoading}
              lightEffect={lightEffect}
              onLightEffectChange={handleLightEffectChange}
              washLightEffect={washLightEffect}
              onWashLightEffectChange={handleWashLightEffectChange}
            />

            <HeronWingsViewer
              layers={heronLayers}
              onLayersLoaded={handleHeronLayersLoaded}
              onResetCamera={handleResetHeronCamera}
              registerResetCamera={registerResetCamera}
              lightEffect={lightEffect}
              washLightEffect={washLightEffect}
              lightSettings={lightSettings}
            />

            <HeronLightPanel
              settings={lightSettings}
              onSettingsChange={handleLightSettingsChange}
              isLoading={heronLoading}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
