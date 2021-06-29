import * as THREE from 'three';
import { saveAs } from 'file-saver';
import font from 'url:./arial-unicode-ms.ttf' // TODO: allow cache

import STLExporter from './STLExporter'
import WebkitInputRangeFillLower from './webkit-input-range-fill-lower' 

import TextToSVG from 'text-to-svg';
let textToSVG;
TextToSVG.load(font, function(err, t) { textToSVG = t; });

import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";

const previewLoopRadius = 4;

let scene, renderer, rendererWidth, footer, rendererHeight, camera, material;

let currentObject, objectList = [];

let aspectSlider, heightSlider;

const maxSize = 10;

loadUI();
loadMaterial();
loadRenderer();
loadGround();
loadMoveHandlers();

function loadRenderer() {
  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer( { antialias: true } );
  rendererWidth = window.innerWidth;
  header = document.getElementById("header");
  footer = document.getElementById("footer");
  rendererHeight = window.innerHeight - footer.offsetHeight - header.offsetHeight;
  renderer.setSize(rendererWidth, rendererHeight);
  renderer.shadowMap.enabled = true;
  
  camera = new THREE.PerspectiveCamera(50, rendererWidth / rendererHeight, 0.01, 25);
  camera.position.x = previewLoopRadius;
  camera.position.y = 0;
  camera.position.z = previewLoopRadius * 4;
  camera.lookAt(0, 0, 0);
  renderer.setAnimationLoop(time => {
    camera.position.x = previewLoopRadius * Math.cos( time / 2000 );
    camera.position.y = previewLoopRadius * Math.sin( time / 2000 );
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    renderer.render( scene, camera );
  });
  document.getElementById("main").prepend(renderer.domElement);

  let hemiLight = new THREE.HemisphereLight(0xffeeb1, 0x080820, 1);
  // hemiLight.castShadow = true;
  scene.add(hemiLight);
  let light = new THREE.PointLight(0xffffff, 1);
  light.position.set(-maxSize * 1.5, maxSize * 1.5, maxSize * 1.5);
  light.castShadow = true;
  light.shadow.mapSize.width = 1024;
  light.shadow.mapSize.height = 1024;
  scene.add(light);
}

function loadMaterial() {
  material = new THREE.MeshPhongMaterial({
    color: '#7B3F00',
    shininess: 10,
    specular: 0x5f5f5f
  });
  material.flatShading = false;
}

function loadGround() {
  const geometry = new THREE.PlaneGeometry(maxSize, maxSize, 10, 10);
  const wireframe = new THREE.WireframeGeometry(geometry);
  const line = new THREE.LineSegments( wireframe );
  line.material.depthTest = true;
  scene.add( line );
}

function loadMoveHandlers() {
  renderer.domElement.addEventListener("touchstart", handleMoveZoom);
  renderer.domElement.addEventListener("touchmove", handleMoveZoom);

  let tpCache = {};

  function handleMoveZoom(e) {
    // don't handle 3-touch
    if (!currentObject || e.targetTouches.length > 2) {
      tpCache = {};
      return;
    }

    let movedTps = [];
    for (let i = 0; i < e.targetTouches.length; i++) {
      let tp = e.targetTouches[i];
      let id = tp.identifier;
      if (tpCache[id] !== undefined) {
        movedTps.push(tp);
      }
    }

    if (movedTps.length === 1) {
      let p = movedTps[0];
      currentObject.position.x += (p.clientX - tpCache[p.identifier].clientX) / rendererHeight * maxSize;
      currentObject.position.y -= (p.clientY - tpCache[p.identifier].clientY) / rendererHeight * maxSize;
    } else if (movedTps.length === 2) {
      let p1 = movedTps[0];
      let p2 = movedTps[1];
      let x1 = tpCache[p1.identifier].clientX / rendererHeight * maxSize - maxSize / 2;
      let x2 = tpCache[p2.identifier].clientX / rendererHeight * maxSize - maxSize / 2;
      let y1 = - tpCache[p1.identifier].clientY / rendererHeight * maxSize + maxSize / 2;
      let y2 = - tpCache[p2.identifier].clientY / rendererHeight * maxSize + maxSize / 2;
      let x3 = p1.clientX / rendererHeight * maxSize - maxSize / 2;
      let x4 = p2.clientX / rendererHeight * maxSize - maxSize / 2;
      let y3 = - p1.clientY / rendererHeight * maxSize + maxSize / 2;
      let y4 = - p2.clientY / rendererHeight * maxSize + maxSize / 2;
      let n1x = x2 - x1;
      let n1y = y2 - y1;
      let n2x = x4 - x3;
      let n2y = y4 - y3;
      let kx = currentObject.position.x - x1;
      let ky = currentObject.position.y - y1;
      let a = Math.atan2(n2y, n2x) - Math.atan2(n1y, n1x);
      let r = Math.sqrt(n2x*n2x + n2y*n2y) / Math.sqrt(n1x*n1x + n1y*n1y);
      currentObject.position.x = (Math.cos(a) * kx - Math.sin(a) * ky) * r + x3;
      currentObject.position.y = (Math.sin(a) * kx + Math.cos(a) * ky) * r + y3;
      currentObject.rotation.z += a;
      currentObject.scale.x *= r;
      currentObject.scale.y *= r;
    }

    tpCache = {};
    for (let i = 0; i < e.targetTouches.length; i++) {
      let tp = e.targetTouches[i];
      let id = tp.identifier;
      tpCache[id] = tp;
    }
  }
}

function loadUI() {
  // navigation bar
  document.getElementById('clearBtn').onclick = clearObjects;
  document.getElementById('undoBtn').onclick = undoOp;
  document.getElementById('redoBtn').onclick = redoOp;
  document.getElementById('doneBtn').onclick = saveObjects;
  
  // input ranges
  new WebkitInputRangeFillLower({
    selectors: ['aspectSlider', 'heightSlider'],
    color: 'white',
  });

  let prevAspect = 1;

  aspectSlider = document.getElementById('aspectSlider');
  aspectSlider.disabled = true;
  aspectSlider.addEventListener('input', e => {
    let newAspect = 75 / (125 - aspectSlider.value);
    if (currentObject) {
      currentObject.scale.y *= newAspect / prevAspect;
    }
    prevAspect = newAspect;
  });
  
  heightSlider = document.getElementById('heightSlider');
  heightSlider.disabled = true;
  heightSlider.addEventListener('input', e => {
    if (!currentObject) return;
    currentObject.scale.z = 75 / (125 - heightSlider.value);
  });
  
  // shapes
  const shapes = ['★','●','■','♥','✈','A'];
  const shapePool = document.getElementById('shapePool');
  shapes.forEach(text => {
    const div = document.createElement('div');
    div.className = 'shape';
    div.textContent = text;
    div.onclick = e => {
      addObject(genText(e.target.textContent));
    };
    shapePool.appendChild(div);
  });
}

function genText(text) {
  if (!textToSVG) return;
  const options = {x: 0, y: 0, fontSize: 4, anchor: 'center middle', attributes: {fill: "black"}};
  const svg = textToSVG.getSVG(text, options);
  return extrudeSvg(svg);
}

function extrudeSvg(svg) {
  const loader = new SVGLoader();
  const svgData = loader.parse(svg);

  // Group that will contain all of our paths
  const svgGroup = new THREE.Group();

  // Loop through all of the parsed paths
  svgData.paths.forEach((path, i) => {
    const shapes = path.toShapes(true);

    // Each path has array of shapes
    shapes.forEach((shape, j) => {
      // Finally we can take each shape and extrude it
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 1,
        bevelEnabled: false,
        // bevelThickness: 0.2,
        // bevelSize: 0.2,
        // bevelSegments: 8
      });

      // Create a mesh and add it to the group
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      svgGroup.add(mesh);
    });
  });
  svgGroup.scale.y *= -1;
  return svgGroup;
}

function addObject(obj) {
  currentObject = null;
  aspectSlider.disabled = false;
  aspectSlider.value = 50;
  aspectSlider.dispatchEvent(new Event('input'));
  heightSlider.disabled = false;
  heightSlider.value = 50;
  heightSlider.dispatchEvent(new Event('input'));
  objectList.push(obj);
  currentObject = obj;
  scene.add(obj);
}

function undoOp() {
  console.log('Not implemented');
}

function redoOp() {
  console.log('Not implemented');
}

function clearObjects() {
  currentObject = null;
  objectList.forEach(obj => {
    scene.remove(obj);
  })
  
  aspectSlider.value = 50;
  aspectSlider.dispatchEvent(new Event('input'));
  aspectSlider.disabled = true;
  heightSlider.value = 50;
  heightSlider.dispatchEvent(new Event('input'));
  heightSlider.disabled = true;
}

function saveObjects() {
  console.log('Not really implemented');
  let exporter = new STLExporter();
  let str = exporter.parse( scene ); // Export the scene
  var blob = new Blob( [str], { type : 'text/plain' } ); // Generate Blob from the string
  saveAs( blob, 'file.stl' ); //Save the Blob to file.stl
}
