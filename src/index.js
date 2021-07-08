/****** Dependencies **********************************************************/

import * as THREE from 'three';
import { saveAs } from 'file-saver';
import font from 'url:./arial-unicode-ms.ttf'; // TODO: allow cache

import STLExporter from './STLExporter';
import WebkitInputRangeFillLower from './webkit-input-range-fill-lower' ;

import TextToSVG from 'text-to-svg';

import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import * as ImageTracer from "imagetracerjs";
// var potrace = require('potrace');

let cloneDeep = require('lodash.clonedeep');


/****** Globals ***************************************************************/

const previewLoopRadius = 4;

let scene, renderer, rendererWidth, footer, rendererHeight, camera, material;

let currentObject, currentShape, objectList = [];

let aspectSlider, heightSlider, clearBtn, undoBtn, redoBtn, doneBtn;
let disabledOpacity = 0.25;

let historyStep = 0;
let history = [{shape: null}];

const maxSize = 10;

const urlParams = new URLSearchParams(window.location.search);
const bevelSegments = urlParams.has('bevelSegments') ? urlParams.get('bevelSegments') : 2;
const bevelSize = urlParams.has('bevelSize') ? urlParams.get('bevelSize') : .2;
const shadowMapSize = urlParams.has('shadowMapSize') ? urlParams.get('shadowMapSize') : 1024;


/****** Mains *****************************************************************/

loadMaterial();
loadRenderer();
loadGround();
let textToSVG;
TextToSVG.load(font, function(err, t) { textToSVG = t; loadUI(); });


/****** Graphics **************************************************************/

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
  light.shadow.mapSize.width = shadowMapSize;
  light.shadow.mapSize.height = shadowMapSize;
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


/****** UI ********************************************************************/

function loadUI() {
  // Renderer touche control
  renderer.domElement.addEventListener("touchstart", handleRendererTouch);
  renderer.domElement.addEventListener("touchmove", handleRendererTouch);
  renderer.domElement.disabled = true;

  let tpCache = {};

  function handleRendererTouch(e) {
    if (renderer.domElement.disabled) return;
    handleMoveZoom(e);
  }

  function handleMoveZoom(e) {
    // don't handle 3-touch
    if (!currentShape || e.targetTouches.length > 2) {
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
        transformShape(currentShape, v => { 
          v.x += (p.clientX - tpCache[p.identifier].clientX) / rendererHeight * maxSize,
          v.y -= (p.clientY - tpCache[p.identifier].clientY) / rendererHeight * maxSize
        });
      extrudeCurrentShape();
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
      transformShape(currentShape, v => {
        let kx = v.x - x1;
        let ky = v.y - y1;
        let a = Math.atan2(n2y, n2x) - Math.atan2(n1y, n1x);
        let r = Math.sqrt(n2x*n2x + n2y*n2y) / Math.sqrt(n1x*n1x + n1y*n1y);
        v.x = (Math.cos(a) * kx - Math.sin(a) * ky) * r + x3;
        v.y = (Math.sin(a) * kx + Math.cos(a) * ky) * r + y3;
      });
      extrudeCurrentShape();
    }

    tpCache = {};
    for (let i = 0; i < e.targetTouches.length; i++) {
      let tp = e.targetTouches[i];
      let id = tp.identifier;
      tpCache[id] = tp;
    }
  }

  // Navigation bar
  clearBtn = document.getElementById('clearBtn');
  undoBtn = document.getElementById('undoBtn');
  redoBtn = document.getElementById('redoBtn');
  doneBtn = document.getElementById('doneBtn');
  
  clearBtn.onclick = clearObjects;
  undoBtn.onclick = undoOp;
  redoBtn.onclick = redoOp;
  doneBtn.onclick = saveObjects;


  // Side Sliders
  new WebkitInputRangeFillLower({
    selectors: ['aspectSlider', 'heightSlider'],
    color: '#f47321',
  });

  let prevAspect = 1;

  aspectSlider = document.getElementById('aspectSlider');
  aspectSlider.disable = () => disableSideBar(aspectSlider);
  aspectSlider.enable = () => enableSideBar(aspectSlider);
  aspectSlider.reset = () => resetSideBar(aspectSlider);

  heightSlider = document.getElementById('heightSlider');
  heightSlider.disable = () => disableSideBar(heightSlider);
  heightSlider.enable = () => enableSideBar(heightSlider);
  heightSlider.reset = () => resetSideBar(heightSlider);

  aspectSlider.disable();
  aspectSlider.addEventListener('input', e => {
    let newAspect = 2 ** (aspectSlider.value / 50 - 1);
    if (currentShape) {
      let r = newAspect / prevAspect;
      transformShape(currentShape, v => { v.y *= r; });
      extrudeCurrentShape();
    }
    prevAspect = newAspect;
  });
  aspectSlider.addEventListener('touchstart', e => {
    if (aspectSlider.disabled) return;
    heightSlider.disable();
    renderer.domElement.disabled = true;
    shapePool.disable();
  })
  aspectSlider.addEventListener('touchend', e => {
    if (aspectSlider.disabled) return;
    heightSlider.enable();
    renderer.domElement.disabled = false;
    shapePool.enable();
    prevAspect = 1;
    aspectSlider.reset();
    recordState();
  })
  
  heightSlider.disable();
  heightSlider.addEventListener('input', e => {
    if (!currentShape) return;
    extrudeCurrentShape();
  });
  heightSlider.addEventListener('touchstart', e => {
    if (heightSlider.disabled) return;
    aspectSlider.disable();
    renderer.domElement.disabled = true;
    shapePool.disable();
  })
  heightSlider.addEventListener('touchend', e => {
    if (heightSlider.disabled) return;
    aspectSlider.enable();
    renderer.domElement.disabled = false;
    shapePool.enable();
    recordState();
  })


  // Shape Pool
  const shapes = ['■','□','●','▲','♥','★','✈','JI','学术垃圾'].reverse();
  const shapePool = document.getElementById('shapePool');
  shapePool.disable = () => {
    shapePool.style.opacity = disabledOpacity;
    shapePool.disabled = true;
  };
  shapePool.enable = () => {
    shapePool.style.opacity = 1;
    shapePool.disabled = false;
  };
  let shapeInstantiated;
  const instantiateY = window.innerHeight - footer.offsetHeight;
  let prevScrollLeft;
  shapes.forEach(addTextShapeBtn);


  // Add shape
  function createShapeBtn(svg) {
    const div = document.createElement('div');
    div.className = 'shape';
    div.innerHTML = svg;
    div.addEventListener('touchstart', e => {
      if (shapePool.touchId || shapePool.disabled) return;
      shapePool.touchId = e.changedTouches[0].identifier;
      shapeInstantiated = false;
      prevScrollLeft = shapePool.scrollLeft;
      
      aspectSlider.disable();
      heightSlider.disable();
      renderer.domElement.disabled = true;
    });
    div.addEventListener('touchmove', e => {
      if (shapePool.disabled) return;
      if (prevScrollLeft !== shapePool.scrollLeft) return;
      if (e.targetTouches.length != 1) return;
      const p = e.targetTouches[0];
      if (p.identifier !== shapePool.touchId) return;
      if (!shapeInstantiated && p.clientY < instantiateY) {
        shapeInstantiated = true;
        currentShape = svgToShape(e.currentTarget.innerHTML);
        transformShape(currentShape, v => {
          v.x = v.x + (p.clientX / rendererHeight - 0.5) * maxSize;
          v.y = v.y - (p.clientY / rendererHeight - 0.5) * maxSize;
        })
        if (currentObject) objectList.push(currentObject);
        currentObject = null;
        aspectSlider.reset();
        heightSlider.reset();
        extrudeCurrentShape();
      }
      if (shapeInstantiated) {
        handleMoveZoom(e);
        e.preventDefault();
      }
    });
    div.addEventListener('touchend', e => {
      if (shapePool.disabled) return;
      if (e.changedTouches[0].identifier !== shapePool.touchId) return;
      shapePool.touchId = null;
      
      aspectSlider.enable();
      heightSlider.enable();
      if (shapeInstantiated) {
        recordState(true);
      } else if (prevScrollLeft === shapePool.scrollLeft) {
        addShape(svgToShape(e.currentTarget.innerHTML));
        recordState(true);
      }
      renderer.domElement.disabled = false;
    });
    document.getElementById('shapePoolSep').after(div);
  }

  function addTextShapeBtn(text) {
    const svg = genTextSvg(text);
    // console.log(svg);
    createShapeBtn(svg);
  }

  document.getElementById('addText').addEventListener('click', e => {
    const text =  window.prompt("New Text Shape","");
    addTextShapeBtn(text);
  });


  document.getElementById('addImage').addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) {
      let reader = new FileReader();
      let canvas = document.createElement('canvas');
      let context = canvas.getContext('2d');

      reader.onload = function (e) {
        let img = new Image();
        img.src = reader.result;
        img.onload = function () {
          canvas.width = img.width;
          canvas.height = img.height;
          context.drawImage(this, 0, 0, canvas.width, canvas.height);
          let imgd = ImageTracer.getImgdata(canvas);
            
          // Synchronous tracing to tracedata
          let svg = ImageTracer.imagedataToSVG(imgd, {
            colorsampling:0, numberofcolors:2,
            pal: [{r:0, g:0, b:0, a:0}, {r:255, g:255, b:255, a:0}],
            strokewidth: 0,
          });
          
          console.log(svg);
        }
      }
      reader.readAsDataURL(e.target.files[0]);
    }
  });


  // Renderer vs UI switching
  renderer.domElement.addEventListener('touchstart', e => {
    if (renderer.domElement.disabled) return;
    aspectSlider.disable();
    heightSlider.disable();
    shapePool.disable();
  });
  renderer.domElement.addEventListener('touchend', e => {
    if (renderer.domElement.disabled) return;
    if (e.touches.length) return;
    aspectSlider.enable();
    heightSlider.enable();
    shapePool.enable();
    recordState();
  });


  // Splash
  if (document.readyState !== "complete") {
    console.warn(`Document ready state is ${document.readyState}.`);
  }
  let splash = document.getElementById('splash');
  splash.style.opacity = 0;
  setTimeout(() => { splash.remove(); }, 500);


  // Helper
  function disableSideBar(elem) {
    elem.parentElement.style.opacity = disabledOpacity;
    elem.disabled = true;
  }

  function enableSideBar(elem) {
    elem.parentElement.style.opacity = 1;
    elem.disabled = false;
  }

  function resetSideBar(elem) {
    elem.value = 50;
    elem.dispatchEvent(new Event('input'));
  }
}


/****** Modeling **************************************************************/

function genTextSvg(text) {
  if (!textToSVG) console.error("textLoader not ready");
  const options = {
    x: 0,
    y: 0, fontSize: 1,
    anchor: 'center middle',
    attributes: { fill: "white" }
  };
  const metrics = textToSVG.getMetrics(text, options);
  const outputSize = 5;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${-outputSize/2} ${-outputSize/2} ${outputSize} ${outputSize}">`;
  options.fontSize = outputSize / Math.max(metrics.width, metrics.height);
  svg += textToSVG.getPath(text, options);
  svg += '</svg>';

  return svg;
}

function svgToShape(svg) {
  const loader = new SVGLoader();
  const svgData = loader.parse(svg);
  const shapes = [];

  svgData.paths.forEach(path => {
    shapes.push(...path.toShapes(true));
  });
  transformShape(shapes, v => { v.y = -v.y; });
  return shapes;
}

function extrudeCurrentShape() {
  if (currentObject) scene.remove(currentObject);
  const geometry = new THREE.ExtrudeGeometry(currentShape, {
    steps: 0,
    depth: 75 / (125 - heightSlider.value),
    bevelEnabled: true,
    bevelThickness: bevelSize,
    bevelSize: bevelSize,
    bevelSegments: bevelSegments
  });

  currentObject = new THREE.Mesh(geometry, material);
  currentObject.castShadow = true;
  currentObject.receiveShadow = true;
  scene.add(currentObject);
}


/****** Other helpers *********************************************************/

function transformShape(shape, t) {
  shape.forEach(s => {
    s.curves.forEach(c => {
      if (c.v0) t(c.v0);
      t(c.v1);
      t(c.v2);
      if (c.v3) t(c.v3);
    });
    if (s.holes) transformShape(s.holes, t);
  });
}


/****** History ***************************************************************/

function addShape(shape) {
  currentShape = null;
  if (currentObject) objectList.push(currentObject);
  currentObject = null;
  aspectSlider.enable();
  aspectSlider.reset();
  heightSlider.enable();
  heightSlider.reset();
  renderer.domElement.disabled = false;
  currentShape = shape;
  extrudeCurrentShape();
}

function recordState(isNew = false) {
  historyStep++;
  if (historyStep < history.length) {
    history.splice(historyStep, history.length - historyStep);
  }
  history.push({
    shape: cloneDeep(currentShape),
    height: heightSlider.value,
    isNew: isNew,
  });
  clearBtn.style.opacity = 1;
  undoBtn.style.opacity = 1;
  redoBtn.style.opacity = disabledOpacity;
  doneBtn.style.opacity = 1;
  renderer.domElement.disabled = false;
}

function undoOp() {
  if (undoBtn.style.opacity != 1) return;

  historyStep--;
  scene.remove(currentObject);
  if (historyStep == 0) {
    currentObject = null;
    currentShape = null;
    aspectSlider.disable();
    heightSlider.disable();
    clearBtn.style.opacity = disabledOpacity;
    undoBtn.style.opacity = disabledOpacity;
    doneBtn.style.opacity = disabledOpacity;
    renderer.domElement.disabled = true;
  } else {
    if (history[historyStep+1].isNew) {
      currentObject = objectList.pop();
    }
    currentShape = history[historyStep].shape;
    heightSlider.value = history[historyStep].height;
    heightSlider.dispatchEvent(new Event('input'));
  }
  redoBtn.style.opacity = 1;
}

function redoOp() {
  if (redoBtn.style.opacity != 1) return;

  historyStep++;
  if (history[historyStep].isNew) {
    addShape(history[historyStep].shape);
  } else {
    currentShape = history[historyStep].shape;
    heightSlider.value = history[historyStep].height;
    heightSlider.dispatchEvent(new Event('input'));
  }
  clearBtn.style.opacity = 1;
  undoBtn.style.opacity = 1;
  redoBtn.style.opacity = (historyStep === history.length - 1) ? disabledOpacity : 1;
  doneBtn.style.opacity = 1;
  renderer.domElement.disabled = false;
}

function clearObjects() {
  if (clearBtn.style.opacity != 1) return;
  if (currentObject) scene.remove(currentObject);
  currentObject = null;
  currentShape = null;
  
  objectList.forEach(obj => {
    scene.remove(obj);
  })
  
  historyStep = 0;
  history = [{shape: null}];
  clearBtn.style.opacity = disabledOpacity;
  undoBtn.style.opacity = disabledOpacity;
  redoBtn.style.opacity = disabledOpacity;
  doneBtn.style.opacity = disabledOpacity;
  renderer.domElement.disabled = true;

  aspectSlider.disable();
  heightSlider.disable();
}

function saveObjects() {
  if (doneBtn.style.opacity != 1) return;
  let exporter = new STLExporter();
  let str = exporter.parse( scene ); // Export the scene
  var blob = new Blob( [str], { type : 'text/plain' } ); // Generate Blob from the string
  saveAs( blob, 'file.stl' ); //Save the Blob to file.stl
}
