/*******************************************************
 * main.js - Solar System with dynamic follow, audio, etc.
 *******************************************************/

import { planetsData } from "./planetsdata.js";
import { planetDescriptions } from "./planetsdescriptions.js";

// -----------------------------------
// Global Simulation & Camera Variables
// -----------------------------------
let simulationSpeed = 1;
let planetSizeFactor = 1;
let followTarget = null;       // which planet to follow
let cameraMode = "orbit";      // "orbit" or "free"

let alwaysShowNames = false;
let nameMode = "all"; // "all", "planet", or "moon"

// Free-cam states
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
const freeCamSpeed = 100;
const freeCamClock = new THREE.Clock();

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.TextureLoader().load("assets/Galaxy/stars_milky_way.jpg");

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(-140, 70, 10);

// Renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// OrbitControls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = true;

// ESC => stop follow
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    followTarget = null;
    controls.enabled = (cameraMode === "orbit");
  }
});

// Basic lighting
const light = new THREE.PointLight(0xffffff, 2, 3000);
scene.add(light);

let externalLightEnabled = false;
let externalLightIntensity = 1.0;
const externalLight = new THREE.DirectionalLight(0xffffff, externalLightIntensity);
externalLight.position.set(100, 100, 100);
externalLight.visible = externalLightEnabled;
scene.add(externalLight);

// Texture loader
const textureLoader = new THREE.TextureLoader();

// ----------------------
// Create the Sun
// ----------------------
const sunGeometry = new THREE.SphereGeometry(20, 32, 32);
const sunTexture = textureLoader.load("assets/Planets/Sun/sun.jpg");
const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture });
const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
sunMesh.position.set(0, 0, 0);
sunMesh.userData = {
  name: "Sun",
  size: "1,392,700 km",
  temperature: "5505°C",
  distance: "0 km",
  selfRotationSpeed: 0.001,
  type: "sun"
};
scene.add(sunMesh);

// Raycaster for picking
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredObject = null;

// Arrays for planets & moons
const planetMeshes = [];
const moonMeshes = [];

// ----------------------
// Orbit line helper
// ----------------------
function createOrbit(distance) {
  const orbitCurve = new THREE.EllipseCurve(0, 0, distance, distance);
  const orbitPoints = orbitCurve.getPoints(200);
  const orbitGeometry = new THREE.BufferGeometry().setFromPoints(
    orbitPoints.map((p) => new THREE.Vector3(p.x, 0, p.y))
  );
  const orbitMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5
  });
  const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
  scene.add(orbitLine);
}

// ----------------------
// Create Planets
// ----------------------
planetsData.forEach((planet) => {
  if (planet.name === "Earth") {
    createEarth(planet);
  } else {
    createGenericPlanet(planet);
  }
});

// Earth with day/night + clouds
function createEarth(planet) {
  const earthGeom = new THREE.SphereGeometry(planet.radius, 32, 32);
  const dayMap = textureLoader.load("assets/Planets/Earth/earth.jpg");
  const nightMap = textureLoader.load("assets/Planets/Earth/earthlight.jpg");
  const cloudMap = textureLoader.load("assets/Planets/Earth/earthcloud.jpg");

  const earthMat = new THREE.MeshPhongMaterial({
    map: dayMap,
    emissiveMap: nightMap,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 2,
    shininess: 10,
    specular: new THREE.Color(0x333333)
  });

  const earthMesh = new THREE.Mesh(earthGeom, earthMat);
  earthMesh.userData = {
    name: "Earth",
    size: planet.size,
    temperature: planet.temperature,
    distance: `${planet.distance} million km`,
    selfRotationSpeed: planet.selfRotationSpeed,
    type: "planet",
    albedo: planet.albedo || 0.3,
    greenhouse: planet.greenhouse || 0
  };

  // Clouds
  const cloudGeom = new THREE.SphereGeometry(planet.radius * 1.01, 32, 32);
  const cloudMat = new THREE.MeshLambertMaterial({
    map: cloudMap,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide
  });
  const cloudMesh = new THREE.Mesh(cloudGeom, cloudMat);
  earthMesh.userData.cloudMesh = cloudMesh;
  earthMesh.add(cloudMesh);

  scene.add(earthMesh);
  createOrbit(planet.distance);

  planetMeshes.push({
    mesh: earthMesh,
    distance: planet.distance,
    speed: planet.speed,
    angle: Math.random() * Math.PI * 2,
    selfRotationSpeed: planet.selfRotationSpeed
  });

  // Earth’s Moons
  planet.moons.forEach((moon) => {
    createMoon(moon, earthMesh);
  });
}

// Generic planet
function createGenericPlanet(planet) {
  const planetTex = textureLoader.load(`assets/Planets/${planet.name}/${planet.texture}`);
  const planetMat = new THREE.MeshStandardMaterial({ map: planetTex });
  const planetGeom = new THREE.SphereGeometry(planet.radius, 32, 32);
  const planetMesh = new THREE.Mesh(planetGeom, planetMat);

  planetMesh.userData = {
    name: planet.name,
    size: planet.size,
    temperature: planet.temperature,
    distance: `${planet.distance} million km`,
    selfRotationSpeed: planet.selfRotationSpeed,
    type: "planet",
    albedo: planet.albedo || 0.3,
    greenhouse: planet.greenhouse || 0
  };
  scene.add(planetMesh);
  createOrbit(planet.distance);

  planetMeshes.push({
    mesh: planetMesh,
    distance: planet.distance,
    speed: planet.speed,
    angle: Math.random() * Math.PI * 2,
    selfRotationSpeed: planet.selfRotationSpeed
  });

  // If Saturn => rings
  if (planet.name === "Saturn") {
    addSaturnRings(planetMesh, planet);
  }

  // Planet’s Moons
  planet.moons.forEach((moon) => {
    createMoon(moon, planetMesh);
  });
}

// Create a single moon
function createMoon(moonData, parentPlanet) {
  let moonMaterial;
  if (moonData.texture) {
    const moonTex = textureLoader.load(`assets/Moons/${moonData.name}/${moonData.texture}`);
    moonMaterial = new THREE.MeshStandardMaterial({ map: moonTex });
  } else {
    moonMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  }
  const moonGeom = new THREE.SphereGeometry(moonData.radius, 16, 16);
  const moonMesh = new THREE.Mesh(moonGeom, moonMaterial);
  moonMesh.userData = {
    name: moonData.name,
    size: moonData.size || "",
    temperature: moonData.temperature || "",
    distance: `${moonData.distance} million km`,
    type: "moon"
  };
  scene.add(moonMesh);

  moonMeshes.push({
    mesh: moonMesh,
    parent: parentPlanet,
    distance: moonData.distance,
    speed: moonData.speed,
    angle: Math.random() * Math.PI * 2
  });
}

// Saturn rings
function addSaturnRings(planetMesh, planet) {
  const atmGeom = new THREE.SphereGeometry(planet.radius * 1.05, 32, 32);
  const atmTex = textureLoader.load("assets/Planets/Saturn/saturn_atmosphere.png");
  const atmMat = new THREE.MeshStandardMaterial({
    map: atmTex,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0x222222)
  });
  const atmMesh = new THREE.Mesh(atmGeom, atmMat);
  planetMesh.add(atmMesh);

  const innerRing = planet.radius * 1.2;
  const outerRing = planet.radius * 2.0;
  const ringGeom = new THREE.RingGeometry(innerRing, outerRing, 64);
  const ringTex = textureLoader.load("assets/Planets/saturn/saturn_rings.jpg");
  const ringMat = new THREE.MeshBasicMaterial({
    map: ringTex,
    side: THREE.DoubleSide,
    transparent: true
  });
  const ringMesh = new THREE.Mesh(ringGeom, ringMat);
  ringMesh.rotation.x = Math.PI / 2;
  planetMesh.add(ringMesh);
}

// ----------------------
// Asteroid belt
// ----------------------
const asteroidBeltGroup = new THREE.Group();
scene.add(asteroidBeltGroup);
const asteroids = [];

function createAsteroidBelt() {
  const numAsteroids = 150; // fewer for better performance
  const innerRadius = 180;
  const outerRadius = 240;
  const rockTexture = textureLoader.load("assets/Rock/rock.jpg");

  for (let i = 0; i < numAsteroids; i++) {
    const baseRadius = THREE.MathUtils.randFloat(0.2, 0.7);
    const geometry = new THREE.SphereGeometry(baseRadius, 6, 6);

    // Optional random lumps
    const posAttr = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    for (let j = 0; j < posAttr.count; j++) {
      vertex.fromBufferAttribute(posAttr, j);
      vertex.x += THREE.MathUtils.randFloatSpread(0.4);
      vertex.y += THREE.MathUtils.randFloatSpread(0.4);
      vertex.z += THREE.MathUtils.randFloatSpread(0.4);
      posAttr.setXYZ(j, vertex.x, vertex.y, vertex.z);
    }
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ map: rockTexture });
    const asteroid = new THREE.Mesh(geometry, material);

    const r = THREE.MathUtils.randFloat(innerRadius, outerRadius);
    const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
    asteroid.position.x = r * Math.cos(theta);
    asteroid.position.z = r * Math.sin(theta);
    asteroid.position.y = THREE.MathUtils.randFloat(-2, 2);
    asteroid.userData = {
      name: "Asteroid",
      type: "asteroid",
      distance: r,
      angle: theta,
      speed: THREE.MathUtils.randFloat(0.0005, 0.002)
    };
    asteroidBeltGroup.add(asteroid);
    asteroids.push(asteroid);
  }
}
createAsteroidBelt();

// ----------------------
// ISS
// ----------------------
const issData = {
  mesh: null,
  distanceFromEarth: 15,
  speed: 0.05,
  angle: Math.random() * Math.PI * 2
};

function loadISS() {
  const loader = new THREE.GLTFLoader();
  loader.load(
    "assets/ISS/iss.glb",
    (gltf) => {
      const iss = gltf.scene;
      iss.scale.set(1, 1, 1);
      iss.userData = { name: "ISS", type: "station" };
      scene.add(iss);
      issData.mesh = iss;
      console.log("ISS loaded from assets/ISS/iss.glb");
    },
    undefined,
    (error) => {
      console.error("Error loading ISS:", error);
    }
  );
}
loadISS();

// ----------------------
// Clock & UI
// ----------------------
const clockDiv = document.getElementById("clock");
const clockToggle = document.getElementById("clockToggle");
clockToggle.addEventListener("change", () => {
  clockDiv.style.display = clockToggle.checked ? "block" : "none";
});

document.getElementById("alwaysShowNames").addEventListener("change", (e) => {
  alwaysShowNames = e.target.checked;
  if (!alwaysShowNames) hideAllLabels();
});
document.getElementById("nameMode").addEventListener("change", (e) => {
  nameMode = e.target.value;
});

// External Light
document.getElementById("externalLightToggle").addEventListener("change", (e) => {
  externalLightEnabled = e.target.checked;
  externalLight.visible = externalLightEnabled;
});
document.getElementById("externalLightIntensity").addEventListener("input", (e) => {
  externalLightIntensity = parseFloat(e.target.value);
  externalLight.intensity = externalLightIntensity;
  document.getElementById("externalLightIntensityValue").innerText =
    externalLightIntensity.toFixed(1);
});

// Speed/Zoom/Size
document.getElementById("speedSlider").addEventListener("input", (event) => {
  simulationSpeed = parseFloat(event.target.value);
  document.getElementById("speedValue").innerText = simulationSpeed.toFixed(1);
});

document.getElementById("zoomSlider").addEventListener("input", (event) => {
  const zoomVal = parseFloat(event.target.value);
  if (!followTarget && cameraMode === "orbit") {
    camera.position.set(0, -zoomVal * 3, zoomVal * 1.5);
  }
  document.getElementById("zoomValue").innerText = zoomVal;
});

document.getElementById("sizeSlider").addEventListener("input", (event) => {
  planetSizeFactor = parseFloat(event.target.value);
  document.getElementById("sizeValue").innerText = planetSizeFactor.toFixed(1);
  planetMeshes.forEach((p) => {
    p.mesh.scale.set(planetSizeFactor, planetSizeFactor, planetSizeFactor);
  });
});

// Camera mode dropdown => orbit or free
document.getElementById("cameraModeSelect").addEventListener("change", (e) => {
  setCameraMode(e.target.value);
});

// Param panel toggles
function togglePanel() {
  const panel = document.getElementById("paramPanel");
  panel.classList.toggle("collapsed");
}
function toggleSubsection(header) {
  const subsection = header.nextElementSibling;
  const arrow = header.querySelector(".subArrow");
  if (subsection.style.display === "none") {
    subsection.style.display = "block";
    arrow.innerHTML = "&#10095;";
  } else {
    subsection.style.display = "none";
    arrow.innerHTML = "&#10094;";
  }
}
window.togglePanel = togglePanel;
window.toggleSubsection = toggleSubsection;

// ----------------------
// Switch camera mode
// ----------------------
function setCameraMode(mode) {
  cameraMode = mode;
  if (mode === "orbit") {
    controls.enabled = true;
    // reset free cam flags
    moveForward = moveBackward = moveLeft = moveRight = false;
    freeCamClock.elapsedTime = 0;
  } else {
    // free
    controls.enabled = false;
    freeCamClock.elapsedTime = 0;
  }
}

// ----------------------
// Free-cam (WASD) Movement
// ----------------------
document.addEventListener("keydown", (event) => {
  if (cameraMode !== "free") return;
  switch (event.code) {
    case "KeyW":
      moveForward = true;
      break;
    case "KeyS":
      moveBackward = true;
      break;
    case "KeyA":
      moveLeft = true;
      break;
    case "KeyD":
      moveRight = true;
      break;
  }
});
document.addEventListener("keyup", (event) => {
  if (cameraMode !== "free") return;
  switch (event.code) {
    case "KeyW":
      moveForward = false;
      break;
    case "KeyS":
      moveBackward = false;
      break;
    case "KeyA":
      moveLeft = false;
      break;
    case "KeyD":
      moveRight = false;
      break;
  }
});

function updateFreeCam() {
  const delta = freeCamClock.getDelta();
  const actualSpeed = freeCamSpeed * delta;

  if (moveForward) {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    camera.position.addScaledVector(forward, actualSpeed);
  }
  if (moveBackward) {
    const backward = new THREE.Vector3();
    camera.getWorldDirection(backward);
    camera.position.addScaledVector(backward, -actualSpeed);
  }
  if (moveLeft || moveRight) {
    const right = new THREE.Vector3();
    camera.getWorldDirection(right);
    right.crossVectors(new THREE.Vector3(0, 1, 0), right).normalize();
    if (moveLeft) {
      camera.position.addScaledVector(right, -actualSpeed);
    }
    if (moveRight) {
      camera.position.addScaledVector(right, actualSpeed);
    }
  }
}

// ----------------------
// Update Planet Temperatures
// ----------------------
function updatePlanetTemperatures() {
  planetMeshes.forEach((pObj) => {
    const mesh = pObj.mesh;
    const dist = mesh.position.distanceTo(sunMesh.position);
    const distAU = dist / 100;
    const albedo = mesh.userData.albedo || 0.3;
    const greenhouse = mesh.userData.greenhouse || 0;

    let T_k = 279 * Math.sqrt((1 - albedo) / 0.7) / Math.sqrt(distAU);
    T_k += greenhouse;
    const T_c = T_k - 273;
    mesh.userData.temperature = T_c.toFixed(1) + "°C";
  });
}

// ----------------------
// Labels (names above objects)
// ----------------------
function createLabel(mesh) {
  if (!mesh.userData.labelElement) {
    const label = document.createElement("div");
    label.className = "objectLabel";
    label.innerText = mesh.userData.name;
    document.body.appendChild(label);
    mesh.userData.labelElement = label;
  }
  return mesh.userData.labelElement;
}

function updateLabels() {
  planetMeshes.forEach((item) => {
    if (alwaysShowNames && (nameMode === "all" || nameMode === "planet")) {
      const label = createLabel(item.mesh);
      label.style.display = "block";
      updateLabelPosition(item.mesh, label);
    } else if (item.mesh.userData.labelElement) {
      item.mesh.userData.labelElement.style.display = "none";
    }
  });

  moonMeshes.forEach((item) => {
    if (alwaysShowNames && (nameMode === "all" || nameMode === "moon")) {
      const label = createLabel(item.mesh);
      label.style.display = "block";
      updateLabelPosition(item.mesh, label);
    } else if (item.mesh.userData.labelElement) {
      item.mesh.userData.labelElement.style.display = "none";
    }
  });
}

function updateLabelPosition(mesh, label) {
  const vector = mesh.position.clone();
  vector.project(camera);
  const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
  label.style.position = "absolute";
  label.style.left = `${x}px`;
  label.style.top = `${y}px`;
}

function hideAllLabels() {
  planetMeshes.forEach((p) => {
    if (p.mesh.userData.labelElement) {
      p.mesh.userData.labelElement.style.display = "none";
    }
  });
  moonMeshes.forEach((m) => {
    if (m.mesh.userData.labelElement) {
      m.mesh.userData.labelElement.style.display = "none";
    }
  });
}

// ----------------------
// Animate
// ----------------------
function animate() {
  requestAnimationFrame(animate);

  // Update free or orbit
  if (cameraMode === "free") {
    updateFreeCam();
  } else {
    controls.update();
  }

  // Earth-based clock (days, hours, etc.)
  const earthData = planetMeshes.find((p) => p.mesh.userData.name === "Earth");
  if (earthData) {
    const totalDays = earthData.mesh.rotation.y / (2 * Math.PI);
    const wholeDays = Math.floor(totalDays);
    const fractionalDay = totalDays - wholeDays;
    const hours = Math.floor(fractionalDay * 24);
    const minutes = Math.floor(((fractionalDay * 24) - hours) * 60);
    const totalYears = earthData.angle / (2 * Math.PI);
    const wholeYears = Math.floor(totalYears);
    clockDiv.innerText = `Time: ${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}, ${wholeDays} days, ${wholeYears} years`;
  }

  // Planet orbits + rotation
  planetMeshes.forEach((planet) => {
    planet.angle += planet.speed * simulationSpeed * 0.001;
    planet.mesh.position.x = planet.distance * Math.cos(planet.angle);
    planet.mesh.position.z = planet.distance * Math.sin(planet.angle);
    planet.mesh.rotation.y += planet.selfRotationSpeed * simulationSpeed;

    // Earth clouds
    if (planet.mesh.userData.name === "Earth" && planet.mesh.userData.cloudMesh) {
      planet.mesh.userData.cloudMesh.rotation.y +=
        planet.selfRotationSpeed * simulationSpeed * 1.1;
    }
  });

  // Sun spin
  sunMesh.rotation.y += sunMesh.userData.selfRotationSpeed * simulationSpeed;

  // Moons revolve
  moonMeshes.forEach((moon) => {
    moon.angle += moon.speed * simulationSpeed * 0.002;
    const parentPos = moon.parent.position;
    moon.mesh.position.x = parentPos.x + moon.distance * Math.cos(moon.angle);
    moon.mesh.position.z = parentPos.z + moon.distance * Math.sin(moon.angle);
  });

  // Asteroids revolve
  asteroids.forEach((asteroid) => {
    asteroid.userData.angle += asteroid.userData.speed * simulationSpeed;
    const r = asteroid.userData.distance;
    asteroid.position.x = r * Math.cos(asteroid.userData.angle);
    asteroid.position.z = r * Math.sin(asteroid.userData.angle);
  });

  // ISS revolve
  const earthObj = planetMeshes.find((p) => p.mesh.userData.name === "Earth");
  if (issData.mesh && earthObj) {
    const earthPos = earthObj.mesh.position;
    issData.angle += issData.speed * simulationSpeed * 0.01;
    issData.mesh.position.x = earthPos.x + issData.distanceFromEarth * Math.cos(issData.angle);
    issData.mesh.position.z = earthPos.z + issData.distanceFromEarth * Math.sin(issData.angle);
    issData.mesh.position.y = earthPos.y;
    issData.mesh.lookAt(earthPos);
    issData.mesh.rotateY(Math.PI);
  }

  // Recompute planet temperature
  updatePlanetTemperatures();

  // Dynamic follow offset (if following a planet)
  if (followTarget) {
    // 1) Get planet radius (default 10 if not found)
    let planetRadius = 10;
    if (followTarget.userData && followTarget.userData.radius) {
      planetRadius = followTarget.userData.radius;
    }

    // 2) Decide how many "radii" away you want to be
    const offsetFactor = 4; // e.g. 4 planet-radii away

    // 3) Choose an offset direction
    const offsetDirection = new THREE.Vector3(-1, 0.3, -100).normalize();

    // 4) Multiply by planetRadius * offsetFactor
    const dynamicOffset = offsetDirection.multiplyScalar(planetRadius * offsetFactor);

    // 5) Lerp camera toward that position
    const desiredPos = followTarget.position.clone().add(dynamicOffset);
    camera.position.lerp(desiredPos, 0.1);

    // 6) If orbit mode, move controls target
    if (cameraMode === "orbit") {
      controls.target.lerp(followTarget.position, 0.1);
    }
  }

  // Render
  renderer.render(scene, camera);

  // Labels
  if (alwaysShowNames) {
    updateLabels();
  }
}
animate();

// ----------------------------------------------------------------------
// AUDIO in the existing left-side panel (planetDescPanel)
// with Mute + Pause/Resume side by side
// ----------------------------------------------------------------------
let currentAudio = null;
let isAudioMuted = false;

/** Plays the corresponding MP3 from assets/Audio/<name>.mp3 */
function playAudioFor(name) {
  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  const audioPath = `assets/Audio/${name}.mp3`;
  currentAudio = new Audio(audioPath);
  currentAudio.muted = isAudioMuted;
  currentAudio.play().catch((error) => {
    console.error("Error playing audio:", error);
  });
}

/** Toggles mute/unmute for the current audio */
function toggleMute() {
  isAudioMuted = !isAudioMuted;
  if (currentAudio) {
    currentAudio.muted = isAudioMuted;
  }
  const muteBtn = document.getElementById("descMuteButton");
  if (muteBtn) {
    muteBtn.innerText = isAudioMuted ? "🔇" : "🔊";
  }
}

/** Toggles pause/resume for the current audio */
function togglePause() {
  if (!currentAudio) return;
  if (currentAudio.paused) {
    // Resume
    currentAudio.play().catch((err) => console.error(err));
    const pauseBtn = document.getElementById("descPauseButton");
    if (pauseBtn) pauseBtn.innerText = "⏸";
  } else {
    // Pause
    currentAudio.pause();
    const pauseBtn = document.getElementById("descPauseButton");
    if (pauseBtn) pauseBtn.innerText = "▶️";
  }
}

// ----------------------------------------------------------------------
// Planet description logic
// ----------------------------------------------------------------------
function findPlanetOrMoon(name) {
  for (const planetObj of planetsData) {
    if (planetObj.name === name) return planetObj;
    for (const moonObj of planetObj.moons) {
      if (moonObj.name === name) return moonObj;
    }
  }
  return null;
}

function showPlanetDescription(planetName) {
  const panel = document.getElementById("planetDescPanel");
  const dataObj = findPlanetOrMoon(planetName);

  const descriptionText =
    planetDescriptions[planetName] || "No extended description available.";

  let extraFieldsHTML = "";
  if (dataObj) {
    extraFieldsHTML = `
      <table class="desc-table">
        <tr><th>Size</th><td>${dataObj.size}</td></tr>
        <tr><th>Temperature</th><td>${dataObj.temperature}</td></tr>
        <tr><th>Day Duration</th><td>${dataObj.dayDuration || ""}</td></tr>
        <tr><th>Year Duration</th><td>${dataObj.yearDuration || ""}</td></tr>
        <tr><th>Possibility of Life</th><td>${dataObj.possibilityOfLife || ""}</td></tr>
        <tr><th>Distance From Earth</th><td>${dataObj.distanceFromEarth || ""}</td></tr>
        <tr><th>Surface Gravity</th><td>${dataObj.surfaceGravity || ""}</td></tr>
        <tr><th>Axial Tilt</th><td>${dataObj.axialTilt || ""}</td></tr>
        <tr><th>Atmospheric Composition</th><td>${dataObj.atmosphericComposition || ""}</td></tr>
        <tr><th>Magnetic Field</th><td>${dataObj.magneticField || ""}</td></tr>
        <tr><th>Ring System</th><td>${dataObj.ringSystem || ""}</td></tr>
        <tr><th>Discovery Info</th><td>${dataObj.discoveryInfo || ""}</td></tr>
        <tr><th>Escape Velocity</th><td>${dataObj.escapeVelocity || ""}</td></tr>
        <tr><th>Key Missions</th><td>${dataObj.keyMissions || ""}</td></tr>
      </table>
    `;
  } else {
    extraFieldsHTML = "<p>No extra data found for this object.</p>";
  }

  const finalHTML = `
    <div style="margin-bottom:20px;">
      ${descriptionText}
    </div>
    ${extraFieldsHTML}
  `;
  document.getElementById("descPlanetName").innerText = planetName;
  document.getElementById("descContent").innerHTML = finalHTML;
  panel.style.display = "block";

  // Play audio for the selected planet or moon
  playAudioFor(planetName);
}

// Close the left-side panel => stop audio
document.getElementById("closeDescPanel").addEventListener("click", () => {
  document.getElementById("planetDescPanel").style.display = "none";
  followTarget = null;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
});

// ----------------------------------------------------------------------
// Add Mute + Pause Buttons Next to Close "X"
// ----------------------------------------------------------------------
(function createAudioButtonsInPanel() {
  const header = document.getElementById("descHeader");
  const closeBtn = document.getElementById("closeDescPanel");
  if (!header || !closeBtn) return;

  // Container for both buttons
  const audioBtnContainer = document.createElement("span");
  audioBtnContainer.style.display = "inline-flex";
  audioBtnContainer.style.alignItems = "center";

  // Mute button
  const muteBtn = document.createElement("span");
  muteBtn.id = "descMuteButton";
  muteBtn.innerText = isAudioMuted ? "🔇" : "🔊";
  muteBtn.style.cursor = "pointer";
  muteBtn.style.fontSize = "34px";
  muteBtn.style.marginLeft = "15px";
  audioBtnContainer.appendChild(muteBtn);

  // Pause/Resume button
  const pauseBtn = document.createElement("span");
  pauseBtn.id = "descPauseButton";
  pauseBtn.innerText = "⏸"; // or "▶️" initially
  pauseBtn.style.cursor = "pointer";
  pauseBtn.style.fontSize = "34px";
  pauseBtn.style.marginLeft = "15px";
  audioBtnContainer.appendChild(pauseBtn);

  // Insert after the close button
  closeBtn.insertAdjacentElement("afterend", audioBtnContainer);

  // Listeners
  muteBtn.addEventListener("click", toggleMute);
  pauseBtn.addEventListener("click", togglePause);
})();

// ----------------------
// Hover Info Panel
// ----------------------
document.addEventListener("mousemove", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(scene.children);
  if (intersects.length > 0) {
    const obj = intersects[0].object;
    if (hoveredObject !== obj && obj.userData.name) {
      hoveredObject = obj;
      showInfo(obj.userData, event.clientX, event.clientY);
    }
  } else {
    hoveredObject = null;
    hideInfo();
  }
});

function showInfo(data, x, y) {
  const infoPanel = document.getElementById("infoPanel");
  infoPanel.classList.add("visible");
  infoPanel.style.left = `${x + 10}px`;
  infoPanel.style.top = `${y + 10}px`;

  document.getElementById("planetName").innerText = data.name;
  document.getElementById("planetSize").innerText = data.size || "N/A";
  document.getElementById("planetTemp").innerText = data.temperature || "N/A";
  document.getElementById("planetDistance").innerText = data.distance || "N/A";
}
function hideInfo() {
  document.getElementById("infoPanel").classList.remove("visible");
}

// ----------------------
// CLICK => Follow Planet + Open Panel
// ----------------------
document.addEventListener("click", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(scene.children);
  if (intersects.length > 0) {
    const obj = intersects[0].object;
    if (obj.userData && obj.userData.name) {
      const name = obj.userData.name;
      showPlanetDescription(name);

      // Toggle follow
      if (followTarget === obj) {
        followTarget = null;
        controls.enabled = (cameraMode === "orbit");
      } else {
        followTarget = obj;
      }
    }
  }
});
