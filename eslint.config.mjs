import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  { ignores: ["_archive/**", "out/**", ".next/**", "scripts/**"] },
  ...nextVitals,
];

export default config;
