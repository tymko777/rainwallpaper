const container = document.getElementById("container");
let clock = new THREE.Clock();
let gui, guiVisible = false;
let scene, camera, renderer, material;
let settings = { fps: 120, parallaxVal: 0 };
let videoElement;

let defaultSettings = {};

async function loadSettings() {
  const response = await fetch("settings.json");
  defaultSettings = await response.json();
}

async function init() {
  await loadSettings();

  renderer = new THREE.WebGLRenderer({
    antialias: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight, 2);
  container.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  material = new THREE.ShaderMaterial({
    uniforms: {
      u_tex0: { type: "t" },
      u_time: { value: 0, type: "f" },
      u_intensity: { value: defaultSettings.rainIntensity, type: "f" },
      u_speed: { value: defaultSettings.rainSpeed, type: "f" },
      u_brightness: { value: defaultSettings.brightness, type: "f" },
      u_normal: { value: defaultSettings.rainNormal, type: "f" },
      u_zoom: { value: defaultSettings.rainZoom, type: "f" },
      u_blur_intensity: { value: defaultSettings.blurIntensity, type: "f" },
      u_blur_iterations: { value: defaultSettings.blurQuality, type: "i" },
      u_panning: { value: defaultSettings.panning, type: "b" },
      u_post_processing: { value: defaultSettings.postProcessing, type: "b" },
      u_lightning: { value: defaultSettings.lightning, type: "b" },
      u_texture_fill: { value: defaultSettings.scaleToFill, type: "b" },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight), type: "v2" },
      u_tex0_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight), type: "v2" },
    },
    vertexShader: `
          varying vec2 vUv;        
          void main() {
              vUv = uv;
              gl_Position = vec4( position, 1.0 );    
          }
        `,
  });
  material.fragmentShader = await (await fetch("shaders/rain.frag")).text();

  new THREE.TextureLoader().load("media/photo.jpg", function (tex) {
    material.uniforms.u_tex0_resolution.value = new THREE.Vector2(tex.image.width, tex.image.height);
    material.uniforms.u_tex0.value = tex;
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 1, 1), material);
  scene.add(quad);

  // Initialize parallax setting from settings
  settings.parallaxVal = defaultSettings.parallaxIntensity || 0;
}

window.addEventListener("resize", function (e) {
  renderer.setSize(window.innerWidth, window.innerHeight, 2);
  material.uniforms.u_resolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
});

function render() {
  material.uniforms.u_time.value = clock.getElapsedTime();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

// Alt+F10 toggles the GUI
window.addEventListener("keydown", function (e) {
  if (e.altKey && e.keyCode === 111) { // F10
    e.preventDefault();
    toggleGUI();
  }
});

function toggleGUI() {
  if (!gui) {
    createWebUI();
  }
  guiVisible = !guiVisible;
  if (guiVisible) {
    gui.show();
  } else {
    gui.hide();
  }
}

function createWebUI() {
  gui = new dat.GUI({ autoPlace: false });
  gui.domElement.style.position = "fixed";
  gui.domElement.style.top = "10px";
  gui.domElement.style.right = "10px";
  gui.domElement.style.zIndex = "1000";
  document.body.appendChild(gui.domElement);
  gui.hide();

  let rain = gui.addFolder("Rain");
  let bg = gui.addFolder("Background");
  let misc = gui.addFolder("More");
  rain.open();
  bg.open();
  misc.open();
  rain.add(material.uniforms.u_intensity, "value", 0, 1, 0.01).name("Intensity");
  rain.add(material.uniforms.u_speed, "value", 0, 10, 0.01).name("Speed");
  rain.add(material.uniforms.u_brightness, "value", 0, 1, 0.01).name("Brightness");
  rain.add(material.uniforms.u_normal, "value", 0, 3, 0.01).name("Normal");
  rain.add(material.uniforms.u_zoom, "value", 0.1, 3.0, 0.01).name("Zoom");
  rain.add(material.uniforms.u_lightning, "value").name("Lightning");
  bg.add(
    {
      picker: function () {
        document.getElementById("filePicker").click();
      },
    },
    "picker"
  ).name("Change Background");
  bg.add(material.uniforms.u_blur_iterations, "value", 1, 64, 1).name("Blur Quality");
  bg.add(material.uniforms.u_blur_intensity, "value", 0, 10, 0.01).name("Blur");
  bg.add(settings, "parallaxVal", 0, 5, 1).name("Parallax");
  bg.add(material.uniforms.u_texture_fill, "value").name("Scale to Fill");
  bg.add(material.uniforms.u_panning, "value").name("Panning");
  bg.add(material.uniforms.u_post_processing, "value").name("Post Processing");
  misc.add(settings, "fps", 15, 120, 15).name("FPS");
  misc
    .add(
      {
        source: function () {
          window.open("https://github.com/rocksdanister/rain");
        },
      },
      "source"
    )
    .name("Source Code");
}

init();
render();

let toggle = false;

document.getElementById("filePicker").addEventListener("change", function () {
  if (this.files[0] === undefined) return;
  let file = this.files[0];
  if (file.type == "image/jpg" || file.type == "image/jpeg" || file.type == "image/png") {
    disposeVideoElement(videoElement);
    material.uniforms.u_tex0.value?.dispose();

    new THREE.TextureLoader().load(URL.createObjectURL(file), function (tex) {
      material.uniforms.u_tex0.value = tex;
      material.uniforms.u_tex0_resolution.value = new THREE.Vector2(tex.image.width, tex.image.height);
    });
  } else if (file.type == "video/mp4" || file.type == "video/webm") {
    disposeVideoElement(videoElement);
    material.uniforms.u_tex0.value?.dispose();

    videoElement = createVideoElement(URL.createObjectURL(file));
    let videoTexture = new THREE.VideoTexture(videoElement);
    videoElement.addEventListener(
      "loadedmetadata",
      function (e) {
        material.uniforms.u_tex0_resolution.value = new THREE.Vector2(
          videoTexture.image.videoWidth,
          videoTexture.image.videoHeight
        );
      },
      false
    );
    material.uniforms.u_tex0.value = videoTexture;
  }
});

//parallax
document.addEventListener("mousemove", function (event) {
  if (settings.parallaxVal == 0) return;

  const x = (window.innerWidth - event.pageX * settings.parallaxVal) / 90;
  const y = (window.innerHeight - event.pageY * settings.parallaxVal) / 90;

  container.style.transform = `translateX(${x}px) translateY(${y}px) scale(1.09)`;
});

//helpers
function getExtension(filePath) {
  return filePath.substring(filePath.lastIndexOf(".") + 1, filePath.length) || filePath;
}

function createVideoElement(src) {
  let htmlVideo = document.createElement("video");
  htmlVideo.src = src;
  htmlVideo.muted = true;
  htmlVideo.loop = true;
  htmlVideo.play();
  return htmlVideo;
}

//ref: https://stackoverflow.com/questions/3258587/how-to-properly-unload-destroy-a-video-element
function disposeVideoElement(video) {
  if (video != null && video.hasAttribute("src")) {
    video.pause();
    video.removeAttribute("src"); // empty source
    video.load();
  }
}
