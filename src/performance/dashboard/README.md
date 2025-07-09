# ALEJO Performance Dashboard

This module provides a comprehensive performance monitoring and resource management interface for the ALEJO system, allowing users to visualize system performance metrics and configure resource thresholds.

## Components

### Performance Dashboard

The Performance Dashboard visualizes real-time system performance metrics including:

- CPU usage
- Memory usage
- Temperature
- Battery level
- Current resource mode

### Resource Thresholds

The Resource Thresholds component allows users to configure custom threshold levels for:

- CPU usage (Low, Medium, High)
- Memory usage (Low, Medium, High)
- Temperature (Low, Medium, High, Critical)

These thresholds determine when ALEJO will switch between different resource modes to optimize performance and prevent overheating.

## Usage

### Importing the Module

```javascript
import { 
  createDashboard, 
  createThresholds, 
  initialize, 
  shutdown 
} from './path/to/performance/dashboard/index.js';
```

### Initializing the Module

```javascript
// Initialize the performance dashboard module
await initialize();

// Create a performance dashboard instance
const dashboard = await createDashboard({
  container: document.getElementById('dashboard-container'),
  showControls: true,
  refreshRate: 2000 // Update every 2 seconds
});

// Create a resource thresholds configuration component
const thresholds = createThresholds({
  container: document.getElementById('thresholds-container'),
  savePreferences: true // Save user preferences
});
```

### Cleaning Up

```javascript
// Destroy dashboard instance
await destroyDashboard(dashboard);

// Shut down the module
await shutdown();
```

## Integration with Resource Allocation Manager

The Performance Dashboard module integrates with ALEJO's Resource Allocation Manager to:

1. Register components with appropriate resource requirements
2. Subscribe to resource usage updates and mode changes
3. Publish threshold changes when users modify configuration
4. Adapt UI components based on current resource mode

## Demo Pages

### Dashboard Demo

The `dashboard-demo.html` page demonstrates the Performance Dashboard with:

- Real-time resource usage visualization
- Resource mode indicators
- Manual mode switching controls

### Thresholds Demo

The `thresholds-demo.html` page demonstrates the Resource Thresholds component with:

- Threshold configuration sliders
- Resource simulator
- Live status updates based on simulated inputs

## Accessibility

Both components are designed with accessibility in mind:

- All UI elements include ARIA attributes
- Keyboard navigation is fully supported
- High contrast visual indicators
- Screen reader compatible labels and announcements

## Events

The module publishes and subscribes to the following events:

### Published Events

- `performance.dashboard.initialized` - Dashboard has been initialized
- `performance.thresholds.updated` - User has updated threshold values
- `performance.dashboard.resourceModeChanged` - Resource mode has changed

### Subscribed Events

- `resource.usage.updated` - Resource usage metrics have been updated
- `resource.mode.changed` - Resource mode has been changed
- `system.preferences.updated` - User preferences have been updated

## Configuration Options

### Performance Dashboard Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| container | HTMLElement | null | Container element for the dashboard |
| showControls | boolean | true | Whether to show manual controls |
| refreshRate | number | 1000 | Update frequency in milliseconds |
| showBattery | boolean | true | Whether to show battery indicators |
| showTemperature | boolean | true | Whether to show temperature |

### Resource Thresholds Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| container | HTMLElement | null | Container element for the thresholds |
| savePreferences | boolean | true | Whether to save user preferences |
| showLabels | boolean | true | Whether to show value labels |
| showHelp | boolean | true | Whether to show help tooltips |
| confirmChanges | boolean | false | Require confirmation before saving |

## File Structure

```text
src/performance/dashboard/
├── index.js                  # Main entry point
├── performance-dashboard.js  # Dashboard component
├── resource-thresholds.js    # Thresholds component
├── performance-integration.js # Resource manager integration
├── dashboard-demo.html       # Dashboard demo page
├── thresholds-demo.html      # Thresholds demo page
├── README.md                 # This documentation
└── 404.html                  # Custom 404 page
```

## Development

To run the demo pages locally, use a simple HTTP server:

```bash
# Using Python (from the ALEJO root directory)
python -m http.server 8080

# Using Node.js (from the ALEJO root directory)
npx http-server -p 8080
```

Then navigate to:

- [Dashboard Demo](http://localhost:8080/src/performance/dashboard/dashboard-demo.html)
- [Thresholds Demo](http://localhost:8080/src/performance/dashboard/thresholds-demo.html)
