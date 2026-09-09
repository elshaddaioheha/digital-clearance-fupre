import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit loads its built-in font metrics (.afm files) from a path relative to
  // its own module location at runtime. Bundling the package breaks that
  // resolution, so certificate generation failed with
  //   ENOENT ... node_modules/pdfkit/js/data/Helvetica.afm
  // Opting it out leaves it as a native require, where the lookup works.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
