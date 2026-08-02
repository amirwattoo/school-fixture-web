import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name: "Proxy Management", short_name: "Proxy Management", description: "Multi-school proxy and timetable management", start_url: "/login", display: "standalone", background_color: "#f4f7f6", theme_color: "#176b5b" }; }
