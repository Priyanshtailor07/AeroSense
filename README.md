# AeroSense 3D & Anti-Gravity Interactive Dashboard

A high-performance WebGL & Physics web application featuring live reactive ambient environmental monitoring, a dedicated 3D mechanical HEPA chamber, and the classic Google Anti-Gravity rigid-body physics engine.

---

## 🌟 Architecture & Features

### 1. Dynamic Ambient Environmental Dashboard (`MODULE 1`)
- **Reactive Atmospheric Theme Engine (`transition-all duration-700`):**
  - **Clean Air:** $\text{AQI} \le 50 \implies$ Soft Sage / Mint Green theme with emerald glow (`from-emerald-50 via-teal-50 to-green-50`).
  - **Moist / Rainy Air:** $\text{Humidity} > 75\% \implies$ Cool Ice Blue theme (`from-sky-50 via-blue-50 to-indigo-50`) with live animated falling rain droplets.
  - **Critical Pollution Alert:** $\text{AQI} > 150 \lor \text{PM2.5} > 55\,\mu\text{g/m}^3 \implies$ Warning Crimson / Coral Red theme with pulsing alert aura.
  - Strict priority evaluation hierarchy conforming to `RULES.md`.
- **Interactive Telemetry Sliders:** Real-time controls for AQI (0–300), Relative Humidity (10–100% RH), $\text{CO}_2$ (300–1500 ppm), $\text{PM2.5}$ ($0\text{--}150\,\mu\text{g/m}^3$), and Temperature.
- **Quick Preset Scenarios:** Alpine Clean, Monsoon Rain, Smog Inversion, Wildfire Hazard, plus simulated live IoT telemetry streaming.
- **Glassmorphic Metric Cards:** Real-time sparklines, gauges, and health impact recommendations.
- **Interactive 3D Earth Globe Widget:**
  - Procedural Earth surface canvas texture (continents, latitude/longitude grids, glowing night city lights).
  - Atmospheric glow shell with day/night directional sun lighting.
  - Orbiting air mass particles and live sensor station beacon pin with 360° mouse rotation.

### 2. Dedicated "Know About HEPA" 3D Chamber (`MODULE 1`)
- **Procedural 3D Pleated HEPA Filter Mesh:**
  - Continuous 32-pleat zig-zag array built with Three.js `BufferGeometry` (zero external 3D asset dependencies).
  - Anodized royal blue aluminum frame, perimeter sealing gasket, and stainless steel support scrim.
  - 360° Mouse OrbitControls with zoom and pan.
- **Dual-Stream Particle Dynamics:**
  - **Inflow (Left):** Dense stream of amber/red PM2.5 and PM10 dust particles drifting towards the filter face.
  - **Core Filter:** Velocity deceleration upon hitting pleats; particles get captured and stick to filter surfaces.
  - **Outflow (Right):** Luminous crystal-cyan purified clean air stream.
- **Tri-Physics Aerodynamic Capture Explanations:**
  1. **Interception:** ($0.1\text{--}1\,\mu\text{m}$)
  2. **Inertial Impaction:** ($> 1\,\mu\text{m}$)
  3. **Brownian Diffusion:** ($< 0.1\,\mu\text{m}$)

### 3. Google Anti-Gravity Physics Engine (`MODULE 2`)
- **Pixel-Accurate Classic Google Homepage:** Google colored logo, search bar with voice/camera icons, "Google Search" and "I'm Feeling Lucky" buttons, Google app grid, sign-in button, and localized footer links.
- **Matter.js Rigid-Body Dynamics:**
  - 1.5-second countdown timer before automatic gravitational detachment.
  - Realistic restitution ($\approx 0.6$), angular friction, and dynamic tumbling.
  - Four static containment boundaries (floor, ceiling, left wall, right wall) dynamically updated on window resize.
  - Velocity clamping to prevent boundary tunneling.
- **Interactive Superpowers:**
  - **Interactive Drag & Fling:** Grab any element and fling it across the viewport with realistic momentum.
  - **Gravity Modes:** Earth (1G), Zero-G Float (0G), Inverted Helium (-1G), Jupiter Slam (2.8G).
  - **Radial Shockwave:** Click anywhere to unleash an explosive impulse wave that scatters elements outward.
  - **Web Audio Sound Effects:** Synthesized audio thuds on collision and whooshes on gravity shift (zero audio asset dependencies).
  - **Reassemble Button:** Restores all UI elements back to their initial homepage positions.

---

## 🚀 Running the Application

### Development Server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build:
```bash
npm run build
npm run preview
```
