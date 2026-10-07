# Project Development Rules

1. Mathematical & Sensor Formula Standards:
   - All formulas and scientific measurements must follow LaTeX notation in documentation:
     - PM2.5 density: $\mu\text{g/m}^3$
     - Particle trapping efficiency: $\eta = 99.97\%$ at $0.3\,\mu\text{m}$
     - Relative Humidity: $\% \text{ RH}$
   - Calculate ambient status using strict priority:
     1. Critical AQI ($\text{AQI} > 150$) takes priority over humidity.
     2. High Humidity ($\text{Humidity} > 75\%$) takes priority over clean air.
     3. Default to Clean Mint Green ($\text{AQI} \le 50$).

2. Three.js / WebGL Guidelines:
   - Do NOT rely on heavy external `.gltf` / `.obj` files that fail to load offline.
   - Use procedural geometries (`BoxGeometry`, `BufferGeometry`, `PointsMaterial`) for pleats and dust particles.
   - Clean up WebGL animation frames (`cancelAnimationFrame`) and dispose of geometries/materials upon component unmount to prevent memory leaks.
   - Lock frame rates with device pixel ratio scaling capped at 2 (`Math.min(window.devicePixelRatio, 2)`).

3. Physics Simulation (Matter.js) Guidelines:
   - Walls and floor boundaries must have `isStatic: true`.
   - Element DOM nodes or Canvas bodies must have proper collision bounds matching their actual visual width and height.
   - Prevent UI elements from clipping through floors during aggressive mouse flings by clamping velocity.
