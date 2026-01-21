# Celebration Plaza Digital Activation Systems Map

An interactive web application for visualizing and managing the plaza systems and infrastructure for the Inter Miami CF Celebration Plaza project.

## Features

### Visual Interface
- **Dark IMCF-Branded UI** with signature pink (#f7b5cd) accents on IMCF black (#231f20)
- **3-Column Layout**: Platform list sidebar, interactive map canvas, and context details drawer
- **Interactive Site Plan** with pan, zoom, and icon placement capabilities
- **Dynamic Entity Visualization** with distinct icon shapes for different entity types:
  - 🔵 Circle = Platform
  - 🟧 Square = Node
  - 🟢 Hexagon = Zone
  - 🟣 Diamond = Mode

### Data Management
- Loads plaza systems data from JSON specification
- Persistent icon placements via localStorage
- Export/Import placement configurations
- Deep-linking support with URL query parameters

### Interaction Features
- **Search & Filter**: Find platforms by name or type
- **Layer Toggles**: Show/hide systems by layer (audio/lighting/video/motion/projection)
- **Entity Details**: Click any platform, node, zone, or mode to view full specifications
- **Related Entities**: Navigate between connected systems
- **Drag & Drop**: Reposition icons on the map
- **Hover Tooltips**: Preview entity details with thumbnail images
- **Undo/Redo**: Placement history management

## Technology Stack

- **React 18** with TypeScript
- **Vite** for fast development and builds
- **Pure CSS** with custom properties (no heavy frameworks)
- **SVG** for lightweight map icons and overlays
- **localStorage** for data persistence

## Getting Started

### Development

```bash
cd plaza-systems-map
npm install
npm run dev
```

Access the application at **http://localhost:5173**

### Building for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
plaza-systems-map/
├── public/
│   ├── assets/
│   │   └── site-plan.jpeg      # Site plan background image
│   └── concept.json             # Plaza systems data specification
├── src/
│   ├── App.tsx                  # Main React application
│   ├── App.css                  # IMCF-branded dark theme styles
│   └── main.tsx                 # Entry point
└── README.md
```

## Design System

### IMCF Brand Colors
- **Primary Black**: #231f20
- **Primary Pink**: #f7b5cd
- **Pink Hover**: #ffc9dd
- **Success Green**: #a8e6cf
- **Warning Yellow**: #ffd56b
- **Purple**: #c9b5e6

### Typography
- **Primary Font**: MLSTifoHeadline, Helvetica Neue, Helvetica
- **Size Scale**: 11px - 20px
- **Line Height**: 1.5

## Usage Guide

### Placing Icons
1. Click "**+ Add Icon**" in the toolbar
2. Select entity type (Platform, Node, Zone, or Mode)
3. Choose the specific entity from the list
4. Click on the map to place the icon

### Managing Placements
- **Drag** icons to reposition them
- **Click** icons to view details in the right drawer
- **Undo** last placement with the Undo button
- **Export** all placements as JSON
- **Import** saved placement configurations

### Filtering by Layer
Use the layer toggles to filter visible icons by system:
- Audio Layer
- Lighting Layer
- Video Layer
- Motion Layer
- Projection Layer

### Navigation
- **Pan**: Click and drag on the map
- **Zoom**: Mouse wheel to zoom in/out
- **Reset View**: Click "Reset View" to return to default zoom
- **Deep Linking**: Share URLs with `?type=platform&selected=canopy` format

## Data Format

The application loads from `/public/concept.json` with the following structure:

```json
{
  "project": {
    "name": "Celebration Plaza Digital Activation Concept",
    "site": "Celebration Plaza outside Miami Freedom Park",
    "primaryTenant": "Inter Miami CF"
  },
  "sections": [
    {
      "platforms": [...],
      "modes": [...]
    }
  ],
  "mapEntities": {
    "zones": [...],
    "nodes": [...],
    "layers": [...]
  }
}
```

Placement data is persisted to localStorage and can be exported as:

```json
{
  "placements": [
    {
      "id": "plc_...",
      "entityType": "platform",
      "entityId": "canopy",
      "x": 0.52,
      "y": 0.34,
      "label": "Radial Overhead Canopy"
    }
  ]
}
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

Requires ES6+ and localStorage support.

## License

Internal use for Gensler / Inter Miami CF Celebration Plaza project.

---

**Built with** ⚽ **for Inter Miami CF**
