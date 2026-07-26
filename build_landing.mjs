import { readFileSync, writeFileSync } from "fs";

const tpl = readFileSync("landing/template.html", "utf8");

const b64 = (name) => readFileSync(`landing-shots/${name}.b64.txt`, "utf8").trim();

const out = tpl
  .replaceAll("__IMG_HALO__", `data:image/jpeg;base64,${b64("ride-active-halo")}`)
  .replaceAll("__IMG_MAP__", `data:image/jpeg;base64,${b64("map-hazards")}`)
  .replaceAll("__IMG_REPORT__", `data:image/jpeg;base64,${b64("report-photo-step")}`)
  .replaceAll("__IMG_PROFILE__", `data:image/jpeg;base64,${b64("profile-points")}`);

writeFileSync("landing/index.html", out, "utf8");
console.log("wrote landing/index.html, size:", (out.length / 1024).toFixed(1), "KB");
