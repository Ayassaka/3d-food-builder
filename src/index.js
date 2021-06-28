import * as THREE from 'three';
import { saveAs } from 'file-saver';

import fira from './FiraSansHeavyRegular.json'
import STLExporter from './STLExporter.js'

const radius = 6;

let scene = new THREE.Scene();

let renderer = new THREE.WebGLRenderer( { antialias: true } );
let rendererWidth = window.innerWidth;
let rendererHeight = window.innerHeight;
renderer.setSize(rendererWidth, rendererHeight);

let camera = new THREE.PerspectiveCamera(70, rendererWidth / rendererHeight, 0.01, 20);
camera.position.x = radius;
camera.position.y = 0;
camera.position.z = 12;
camera.lookAt(0, 0, 0);
renderer.setAnimationLoop(time => {
	camera.position.x = radius * Math.cos( time / 2000 );
	camera.position.y = radius * Math.sin( time / 2000 );
	camera.lookAt(0, 0, 0);
	renderer.render( scene, camera );
});
document.body.appendChild( renderer.domElement );

let currentMesh = loadText("Meow", new THREE.Font(fira));

const maxSize = 10;

addGround();
addMoveHandlers();

function addGround() {
	const geometry = new THREE.PlaneGeometry(maxSize, maxSize, 10, 10);
	// const material = new THREE.MeshNormalMaterial();
	// const plane = new THREE.Mesh( geometry, material );
	// scene.add( plane );

	const wireframe = new THREE.WireframeGeometry(geometry);
	const line = new THREE.LineSegments( wireframe );
	line.material.depthTest = true;
	scene.add( line );
}

function loadText(string, font) {
	const geometry = new THREE.TextGeometry(string, {
		font: font,
		size: 2,
		height: 1,
		curveSegments: 12,
	});
	const material = new THREE.MeshNormalMaterial();
	const mesh = new THREE.Mesh( geometry, material );
	mesh.position.x = -4;
	mesh.position.z = 0;
	scene.add( mesh );
	return mesh;
}

function saveStl() {
	let exporter = new STLExporter();
	let str = exporter.parse( scene ); // Export the scene
	var blob = new Blob( [str], { type : 'text/plain' } ); // Generate Blob from the string
	saveAs( blob, 'file.stl' ); //Save the Blob to file.stl
}


function addMoveHandlers() {
	
	renderer.domElement.addEventListener("touchstart", e => {
		moveStart(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
	});
	// renderer.domElement.addEventListener("mouseup", moveEnd);
	// renderer.domElement.addEventListener("touchcancel", handleCancel, false);
	// renderer.domElement.addEventListener("touchleave", handleEnd, false);
	renderer.domElement.addEventListener("touchmove", e => {
		moveStep(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
	});

	let prev_x, prev_y;

	function moveStart(x, y) {
		prev_x = x;
		prev_y = y;
	}
	
	function moveStep(x, y) {
		currentMesh.position.x += (x - prev_x) / rendererHeight * maxSize;
		currentMesh.position.y -= (y - prev_y) / rendererHeight * maxSize;
		prev_x = x;
		prev_y = y;
	}
}
