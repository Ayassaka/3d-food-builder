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
	
	renderer.domElement.addEventListener("touchstart", handleMoveZoom);
	renderer.domElement.addEventListener("touchmove", handleMoveZoom);

	let tpCache = {};

	function handleMoveZoom(e) {
		// don't handle 3-touch
		if (e.targetTouches.length > 2) {
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
		
		// document.getElementById("test").innerHTML = movedTps.map(tp => tp.identifier).join(',');
		
		if (movedTps.length === 1) {
			let p = movedTps[0];
			currentMesh.position.x += (p.clientX - tpCache[p.identifier].clientX) / rendererHeight * maxSize;
			currentMesh.position.y -= (p.clientY - tpCache[p.identifier].clientY) / rendererHeight * maxSize;
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
			let kx = currentMesh.position.x - x1;
			let ky = currentMesh.position.y - y1;
			let a = Math.atan2(n2y, n2x) - Math.atan2(n1y, n1x);
			let r = Math.sqrt(n2x*n2x + n2y*n2y) / Math.sqrt(n1x*n1x + n1y*n1y);
			currentMesh.position.x = (Math.cos(a) * kx - Math.sin(a) * ky) * r + x3;
			currentMesh.position.y = (Math.sin(a) * kx + Math.cos(a) * ky) * r + y3;
			currentMesh.rotation.z += a;
			currentMesh.scale.x *= r;
			currentMesh.scale.y *= r;
			// document.getElementById("test").innerHTML = `${[n1x, n1y, n2x, n2y].join('+')}`;
		}

		
		tpCache = {};
		for (let i = 0; i < e.targetTouches.length; i++) {
			let tp = e.targetTouches[i];
			let id = tp.identifier;
			tpCache[id] = tp;
		}
	}
}
