'use strict';

// DOM Elements
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const captureButton = document.getElementById('capture-button');
const container = document.getElementById('container');

// Three.js Variables
let scene, camera, renderer, sphere, material;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// --- Camera Access ---
async function startCamera() {
    try {
        const constraints = {
            video: {
                facingMode: 'environment', // Prefer back camera
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        videoElement.onloadedmetadata = () => {
            initThreeJS(); // Initialize Three.js only after video dimensions are known
            loadFromLocalStorage(); // Load saved state after Three.js is ready
            animate();
        };
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Could not access the camera. Please ensure permissions are granted.");
        // Fallback or error message display
        canvasElement.style.backgroundColor = '#ffdddd'; // Indicate error
    }
}

// --- Three.js Initialization ---
function initThreeJS() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe0e0e0); // Match CSS background

    // Camera
    const aspectRatio = canvasElement.clientWidth / canvasElement.clientHeight;
    camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    camera.position.z = 2; // Adjust camera position

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true });
    renderer.setSize(canvasElement.clientWidth, canvasElement.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // Adjust for device pixel ratio

    // Lighting (Basic)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Sphere Geometry and Material
    const geometry = new THREE.SphereGeometry(0.8, 32, 32); // Radius, widthSegments, heightSegments
    material = new THREE.MeshStandardMaterial({
        color: 0xffffff, // Start with white
        map: null,       // No texture initially
        roughness: 0.7,
        metalness: 0.1
    });
    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Initial render
    renderer.render(scene, camera);

    // Add event listeners for interaction
    addInteractionListeners();
}

// --- Image Capture ---
captureButton.addEventListener('click', () => {
    if (!videoElement.srcObject || videoElement.readyState < videoElement.HAVE_METADATA) {
        console.warn("Video stream not ready for capture.");
        return;
    }

    // Create a temporary canvas to draw the video frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoElement.videoWidth;
    tempCanvas.height = videoElement.videoHeight;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);

    // Create texture from the temporary canvas
    const texture = new THREE.CanvasTexture(tempCanvas);
    texture.needsUpdate = true; // Important!

    // Apply texture to the sphere
    material.map = texture;
    material.needsUpdate = true; // Update material

    // Save to localStorage
    const imageDataUrl = tempCanvas.toDataURL('image/png');
    saveToLocalStorage(imageDataUrl);

    console.log("Image captured and applied as texture.");
});

// --- Interaction (Simple Drag Rotation) ---
function addInteractionListeners() {
    canvasElement.addEventListener('mousedown', (event) => {
        isDragging = true;
        previousMousePosition.x = event.clientX;
        previousMousePosition.y = event.clientY;
    });

    canvasElement.addEventListener('mousemove', (event) => {
        if (!isDragging || !sphere) return;

        const deltaMove = {
            x: event.clientX - previousMousePosition.x,
            y: event.clientY - previousMousePosition.y
        };

        // Adjust rotation based on mouse movement
        // Simple rotation - might need refinement for intuitive control
        sphere.rotation.y += deltaMove.x * 0.01;
        sphere.rotation.x += deltaMove.y * 0.01;

        previousMousePosition.x = event.clientX;
        previousMousePosition.y = event.clientY;

        // Save rotation state continuously while dragging
        saveToLocalStorage(null); // Pass null to only save rotation/scale
    });

    canvasElement.addEventListener('mouseup', () => {
        isDragging = false;
    });

    canvasElement.addEventListener('mouseleave', () => {
        isDragging = false; // Stop dragging if mouse leaves canvas
    });

    // Touch events for mobile
    canvasElement.addEventListener('touchstart', (event) => {
        if (event.touches.length === 1) {
            isDragging = true;
            previousMousePosition.x = event.touches[0].clientX;
            previousMousePosition.y = event.touches[0].clientY;
        }
    }, { passive: true }); // Use passive for better scroll performance

    canvasElement.addEventListener('touchmove', (event) => {
        if (!isDragging || !sphere || event.touches.length !== 1) return;

        const deltaMove = {
            x: event.touches[0].clientX - previousMousePosition.x,
            y: event.touches[0].clientY - previousMousePosition.y
        };

        sphere.rotation.y += deltaMove.x * 0.01;
        sphere.rotation.x += deltaMove.y * 0.01;

        previousMousePosition.x = event.touches[0].clientX;
        previousMousePosition.y = event.touches[0].clientY;

        saveToLocalStorage(null);
    }, { passive: true });

    canvasElement.addEventListener('touchend', () => {
        isDragging = false;
    });
}


// --- Local Storage ---
function saveToLocalStorage(imageDataUrl) {
    try {
        if (imageDataUrl) {
            localStorage.setItem('scannerAppData_image', imageDataUrl);
        }
        if (sphere) { // Only save geometry if sphere exists
            const state = {
                rotation: { x: sphere.rotation.x, y: sphere.rotation.y, z: sphere.rotation.z },
                // Add scale later if needed
                // scale: { x: sphere.scale.x, y: sphere.scale.y, z: sphere.scale.z }
            };
            localStorage.setItem('scannerAppData_state', JSON.stringify(state));
        }
        console.log("State saved to localStorage.");
    } catch (e) {
        console.error("Error saving to localStorage:", e);
        // Handle potential storage limits or errors
    }
}

function loadFromLocalStorage() {
    try {
        const imageDataUrl = localStorage.getItem('scannerAppData_image');
        const stateString = localStorage.getItem('scannerAppData_state');

        if (imageDataUrl && material) {
            const image = new Image();
            image.onload = () => {
                const texture = new THREE.Texture(image);
                texture.needsUpdate = true;
                material.map = texture;
                material.needsUpdate = true;
                console.log("Image loaded from localStorage.");
            };
            image.onerror = (err) => {
                console.error("Error loading image from localStorage data URL:", err);
                localStorage.removeItem('scannerAppData_image'); // Remove corrupted data
            };
            image.src = imageDataUrl;
        }

        if (stateString && sphere) {
            const state = JSON.parse(stateString);
            if (state.rotation) {
                sphere.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
            }
            // Load scale if implemented
            // if (state.scale) {
            //     sphere.scale.set(state.scale.x, state.scale.y, state.scale.z);
            // }
            console.log("State loaded from localStorage.");
        }
    } catch (e) {
        console.error("Error loading from localStorage:", e);
        // Clear potentially corrupted data
        localStorage.removeItem('scannerAppData_image');
        localStorage.removeItem('scannerAppData_state');
    }
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    // Handle window resize
    const width = canvasElement.clientWidth;
    const height = canvasElement.clientHeight;
    if (canvasElement.width !== width || canvasElement.height !== height) {
        renderer.setSize(width, height, false); // false = don't update style
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    // Render the scene
    if (renderer && scene && camera) { // Ensure Three.js objects are initialized
        renderer.render(scene, camera);
    }
}

// --- Initialization ---
startCamera(); // Start the process
