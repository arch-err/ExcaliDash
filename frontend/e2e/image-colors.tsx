import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw, convertToExcalidrawElements, exportToCanvas } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "../src/index.css";

const colors = ["#000000", "#ffffff", "#ef3340", "#24ad64", "#3366ef", "transparent", "rgba(36,173,100,0.5)"];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="350" height="100">${colors.map((color, i) => `<rect x="${i * 50}" width="50" height="100" fill="${color}"/>`).join("")}</svg>`;
const image = new Image();
image.src = `data:image/svg+xml;base64,${btoa(svg)}`;
await image.decode();
const raster = document.createElement("canvas");
raster.width = 350; raster.height = 100;
raster.getContext("2d")!.drawImage(image, 0, 0);
const files = {
  svg: { id: "svg", mimeType: "image/svg+xml", dataURL: image.src, created: 1 },
  png: { id: "png", mimeType: "image/png", dataURL: raster.toDataURL(), created: 1 },
};
const elements = convertToExcalidrawElements([
  { type: "image", fileId: "svg", x: 0, y: 0, width: 350, height: 100, status: "saved", scale: [1, 1] },
  { type: "image", fileId: "png", x: 0, y: 150, width: 350, height: 100, status: "saved", scale: [1, 1] },
  { type: "rectangle", x: 400, y: 0, width: 100, height: 100, backgroundColor: "#1e1e1e", fillStyle: "solid", roughness: 0 },
]);
let api: any;
const points = colors.map((_, i) => i * 50 + 25);
function reference(theme: string) {
  const canvas = document.createElement("canvas"); canvas.width = 550; canvas.height = 100;
  const ctx = canvas.getContext("2d")!;
  ctx.filter = theme === "dark" ? "invert(93%) hue-rotate(180deg)" : "none";
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 550, 100);
  ctx.fillStyle = "#1e1e1e"; ctx.fillRect(400, 0, 100, 100);
  ctx.filter = "none"; ctx.drawImage(image, 0, 0);
  return { pixels: points.map(x => Array.from(ctx.getImageData(x, 50, 1, 1).data)), shape: Array.from(ctx.getImageData(450, 50, 1, 1).data) };
}
function sample() {
  const canvas = document.querySelector("canvas.static") as HTMLCanvasElement;
  if (!api || !canvas) return null;
  const state = api.getAppState(), ctx = canvas.getContext("2d")!;
  if (!state.width || !canvas.width) return null;
  const scale = canvas.width / state.width;
  const pixel = (x: number, y: number) => Array.from(ctx.getImageData(Math.floor((x + state.scrollX) * state.zoom.value * scale), Math.floor((y + state.scrollY) * state.zoom.value * scale), 1, 1).data);
  return { theme: state.theme, filter: getComputedStyle(canvas).filter, svg: points.map(x => pixel(x, 50)), png: points.map(x => pixel(x, 200)), shape: pixel(450, 50), reference: reference(state.theme) };
}
(window as any).imageColorFixture = {
  sample,
  ready: () => Boolean(api),
  loadLarge: (count = 1000) => api.updateScene({ elements: convertToExcalidrawElements(Array.from({ length: count }, (_, i) => ({ type: i % 3 === 0 ? "ellipse" : "rectangle", x: (i % 40) * 24, y: Math.floor(i / 40) * 20, width: 20, height: 16, backgroundColor: i % 2 ? "#ff0000" : "#1e1e1e", fillStyle: "solid", roughness: 0 }))) }),
  reset: () => api.updateScene({ elements, appState: { scrollX: 50, scrollY: 50, zoom: { value: 1 } } }),
  pan: (x: number) => api.updateScene({ appState: { scrollX: x } }),
  state: () => api.getAppState(),
  zoom: (value: number) => api.updateScene({ appState: { zoom: { value } } }),
  export: async (theme: string) => {
    const canvas = await exportToCanvas({ elements: [elements[0]], files: files as any, appState: { exportBackground: true, exportWithDarkMode: theme === "dark", viewBackgroundColor: "#ffffff" }, exportPadding: 0 });
    return { pixels: points.map(x => Array.from(canvas.getContext("2d")!.getImageData(x, 50, 1, 1).data)), reference: reference(theme).pixels };
  },
};
function Fixture() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  return <><button id="light" onClick={() => setTheme("light")}>Light</button><button id="dark" onClick={() => setTheme("dark")}>Dark</button><div style={{ width: 1100, height: 650 }}><Excalidraw theme={theme} initialData={{ elements, files: files as any, appState: { viewBackgroundColor: "#ffffff", scrollX: 50, scrollY: 50, zoom: { value: 1 } } }} excalidrawAPI={value => { api = value; }} /></div></>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
